const AWS = require('aws-sdk')

const ssm = new AWS.SSM();

const BASE_PATH = '/torc'

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

async function getParameter(env, service, paramName, isEncrypted) {
  const Name = constructParamPath(env, service, paramName)
  const params = {
    Name,
    WithDecryption: isEncrypted
  };

  const data = await ssm.getParameter(params).promise()
  return restructureParam(data?.Parameter)
}

async function getParametersByService(env, service, isEncrypted) {
  const Path = constructParamPath(env, service)
  console.log(`Getting parameters from ${Path}`)
  var config = {
    Path,
    Recursive: true,
    WithDecryption: isEncrypted
  };

  

  const convertedParams = {}
  let nextToken = null

  do {
    let params = await ssm.getParametersByPath(config).promise()

    for (let i = 0; i < params.Parameters.length; i++) {
      const param = restructureParam(params.Parameters[i])
      convertedParams[param.name] = param
    }

    params = await ssm.getParametersByPath(config).promise()
    nextToken = params.NextToken
    config.NextToken = nextToken
  } while (nextToken)

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

module.exports = {
  constructParamPath,
  getParameter,
  getParametersByService,
  setParameter,
  setParametersByService,
  getEnvironments,
  getServicesForEnvironment
}