const AWS = require('aws-sdk')

let ssm

let configTable

let docClient

const BASE_PATH = '/torc'

const cachedParams = {}

function initializeSSM() {
  if (!ssm) {
    ssm = new AWS.SSM();
  }
}

function initializeDocClient () {
  if (!docClient) {
    docClient = new AWS.DynamoDB.DocumentClient()
  }
}

function constructParamPath(env, service, paramName) {
  return `${BASE_PATH}/${env}/${service}${paramName?'/'+paramName:''}`
}

function restructureParam(param) {
  // console.log(`Restructuring parameter ${JSON.stringify(param)}`)
  const newParam = { 
    name: param.Name.split('/').pop(), 
    fullName: param.Name,
    value: param.Value,
    version: param.Version,
    lastModifiedDate: param.LastModifiedDate,
    type: param.Type
  }

  return newParam
}

function mapSharedConfigParam (param) {
  const newParam = {
    name: param.name,
    value: param.value,
    service: param.service,
    type: typeof param.value
    // lastModifiedDate: param.lastModifiedDate
    // fullName: param.name,
    // version: param.Version,
  }

  return newParam
}

/**
 * Pause execution for ms milliseconds
 * @param {Number} ms Sleep time
 */
async function sleep (ms) {
  console.log(`Sleeping for ${ms} ms...`)
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Batch write to Dynamodb with exponential back off
 * @param {Object} requestItems The batch write request
 */
async function batchWrite (requestItems) {
  let delayTime = 1000 // in ms
  let resp
  const timeMultiple = 2
  const maxRetries = 6

  // Capture the unprocessed items - and based on the config, proceed to invoke this function again after the configured seconds
  const res1 = await docClient.batchWrite({
    RequestItems: requestItems
  }).promise()

  resp = res1

  const tables = Object.keys(res1.UnprocessedItems)

  if (tables.length > 0) {
    console.log(`Unprocessed items found: ${JSON.stringify(res1.UnprocessedItems)}`)
  }

  for (let i = 0; i < tables.length; i++) {
    let unprocessedItems = res1.UnprocessedItems[tables[i]]

    if (unprocessedItems?.length > 0) {
      let retryAttempt = 0

      while (retryAttempt < maxRetries) {
        console.log('Retry Attempt: ', retryAttempt, 'delayTime: ', delayTime, 'Max Retries: ', maxRetries)
        // exponential backoff
        delayTime = delayTime * timeMultiple
        await sleep(delayTime)

        // Retry the deletion of the failed items again
        const res2 = await docClient.batchWrite({
          RequestItems: {
            [tables[i]]: unprocessedItems
          }
        }).promise()

        resp = res2

        if (Object.keys(res2.UnprocessedItems).length > 0) {
          console.log(`Unprocessed items found: ${JSON.stringify(res2.UnprocessedItems)}`)
          unprocessedItems = res2.UnprocessedItems[tables[i]]
        }

        if (unprocessedItems.length > 0) {
          retryAttempt++
        } else {
          // No more failed items. Quit
          break
        }
      }

      if (unprocessedItems.length > 0) {
        console.log('Unprocessed items still exist at the end of all the retries')
        console.log(JSON.stringify(unprocessedItems, null, 2))
      }
    }
  }
  return resp
}

async function getParameter(env, service, paramName, isEncrypted) {
  const Name = constructParamPath(env, service, paramName)
  const params = {
    Name,
    WithDecryption: isEncrypted
  };

  initializeSSM()

  const data = await ssm.getParameter(params).promise()
  return restructureParam(data?.Parameter)
}

async function getParametersByService(env, service, isEncrypted) {
  const Path = constructParamPath(env, service)
  console.log(`Getting parameters from ${Path}`)

  if (cachedParams[Path]) {
    console.log('Found parameters in cache. Returning...')
    return cachedParams[Path]
  }

  var config = {
    Path,
    Recursive: true,
    WithDecryption: isEncrypted
  };

  const convertedParams = {}
  let nextToken = null

  initializeSSM()

  do {
    let params = await ssm.getParametersByPath(config).promise()

    for (let i = 0; i < params.Parameters.length; i++) {
      const param = restructureParam(params.Parameters[i])
      convertedParams[param.name] = param
    }

    nextToken = params.NextToken
    config.NextToken = nextToken
  } while (nextToken)

  cachedParams[Path] = convertedParams

  return convertedParams
}

async function getSharedConfigByService (env, service) {
  const Path = constructParamPath(env, service)

  console.log(`Cache path: ${Path}`)
  if (cachedParams[Path]) {
    console.log('Found parameters in cache. Returning...')
    return cachedParams[Path]
  }

  initializeDocClient()

  if (!configTable) {
    configTable = await getParameter(env, 'common', 'DYNAMODB_CONFIG_TABLE', true)
  }

  const params = {
    TableName: configTable.value,
    IndexName: 'byService',
    KeyConditionExpression: 'service = :service',
    ExpressionAttributeValues: {
      ':service': service
    }
  }

  const convertedParams = {}
  let nexToken = null

  do {
    const records = await docClient.query(params).promise()

    for (const record of records.Items) {
      const param = mapSharedConfigParam(record)
      convertedParams[param.name] = param
    }

    nexToken = records.LastEvaluatedKey || null

    params.ExclusiveStartKey = nexToken
  } while (nexToken)

  cachedParams[Path] = convertedParams

  return convertedParams
}

async function setSharedConfigByService (params, env, service) {
  const batchSize = 25
  const keys = Object.keys(params)
  const data = []

  initializeDocClient()

  if (!configTable) {
    configTable = await getParameter(env, 'common', 'DYNAMODB_CONFIG_TABLE', true)
  }

  for (let i = 0; i < keys.length; i += batchSize) {
    const chunk = keys.slice(i, i + batchSize)

    const batchReqItems = chunk.map(key => {
      if (!params[key].value) {
        console.log(`Skipping ${key} no value provided.`)
      }
      const item = {
        name: key,
        service,
        value: params[key].value
      }
      return {
        PutRequest: {
          Item: item
        }
      }
    })

    const requestItems = {
      [configTable.value]: batchReqItems
    }
    console.log('Create Config batch requestItems', JSON.stringify(requestItems, null, 2))
    const result = await batchWrite(requestItems)
    data.push(result)
  }
  return data
}

// TODO: add param caching 
// TODO: add support for labels

async function setParameter(param, env, service, isEncrypted, canOverwrite) {
  const Name = constructParamPath(env, service, param.key)
  const Value = param.value
  const params = {
    Name,
    Value,
    Type: isEncrypted ? 'SecureString' : 'String',
    Overwrite: canOverwrite
  };
// console.log(`Setting parameter ${Name} = ${Value}`)
  initializeSSM()

  const data = await ssm.putParameter(params).promise()
  console.log(data)
  return data
}

async function setParametersByService(params, env, service) {
  // console.log(`Setting parameters ${JSON.stringify(params)}`)
  const data = [] 

  for (let i = 0; i < params.length; i++) {
    const result = setParameter(params[i], env, service, params[i]?.isEncrypted, params[i]?.canOverwrite)
    data.push(result)
  }

  return data
}

async function getEnvironments() {
  console.log(`Getting environments descending from ${BASE_PATH}`)
  var config = {
    Path: BASE_PATH,
    Recursive: true
  };

  const envs = {}
  let nextToken = null

  initializeSSM()

  do {
    let params = await ssm.getParametersByPath(config).promise()

    for (let i = 0; i < params.Parameters.length; i++) {
      const param = params.Parameters[i]
      const name = param.Name.split('/')
      const env = name[2]
      envs[env] = envs[env]? envs[env]+1 : 1
    }

    params = await ssm.getParametersByPath(config).promise()
    nextToken = params.NextToken
    config.NextToken = nextToken
  } while (nextToken)

  return envs
}

async function getServicesForEnvironment(env) {
  const Path = BASE_PATH + '/' + env
  console.log(`Getting services descending from the environment ${Path}`)
  var config = {
    Path,
    Recursive: true
  };

  const svcs = {}
  let nextToken = null

  initializeSSM()

  do {
    let params = await ssm.getParametersByPath(config).promise()

    for (let i = 0; i < params.Parameters.length; i++) {
      const param = params.Parameters[i]
      const name = param.Name.split('/')
      const svc = name[3]
      svcs[svc] = svcs[svc] ? svcs[svc] + 1 : 1
    }

    params = await ssm.getParametersByPath(config).promise()
    nextToken = params.NextToken
    config.NextToken = nextToken
  } while (nextToken)

  return svcs
}

async function getAllOrgParams(isEncrypted) {
  console.log(`Getting all parameters under ${BASE_PATH}`)
  var config = {
    Path: BASE_PATH,
    Recursive: true,
    WithDecryption: isEncrypted
  };

  const convertedParams = {}
  let nextToken = null

  initializeSSM()

  do {
    let params = await ssm.getParametersByPath(config).promise()

    for (let i = 0; i < params.Parameters.length; i++) {
      const param = restructureParam(params.Parameters[i])
      const name = params.Parameters[i].Name.split('/')

      if (!convertedParams[name[2]]) {
        convertedParams[name[2]] = {}
      }

      if (!convertedParams[name[2]][name[3]]) {
        convertedParams[name[2]][name[3]] = {}
      }

      convertedParams[name[2]][name[3]][param.name] = param
    }

    params = await ssm.getParametersByPath(config).promise()
    nextToken = params.NextToken
    config.NextToken = nextToken
  } while (nextToken)

  return convertedParams
}

module.exports = {
  constructParamPath,
  getParameter,
  getParametersByService,
  getSharedConfigByService,
  setSharedConfigByService,
  setParameter,
  setParametersByService,
  getEnvironments,
  getServicesForEnvironment,
  getAllOrgParams
}