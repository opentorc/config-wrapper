const AWS = require('aws-sdk')
const docClient = new AWS.DynamoDB.DocumentClient()

let ssm

let configTable

const BASE_PATH = '/torc'

const cachedParams = {}

function initializeSSM() {
  if (!ssm) {
    ssm = new AWS.SSM();
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
  console.log(`Getting SharedConfig from "${service}" service`)

  console.log(`Cache path: ${Path}`)
  if (cachedParams[Path]) {
    console.log('Found parameters in cache. Returning...')
    return cachedParams[Path]
  }

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
  setParameter,
  setParametersByService,
  getEnvironments,
  getServicesForEnvironment,
  getAllOrgParams
}