const {
  SSMClient,
  GetParameterCommand,
  GetParametersByPathCommand,
  PutParameterCommand
} = require('@aws-sdk/client-ssm')

let ssm

const BASE_PATH = '/torc'

const cachedParams = {}

function initializeSSM () {
  if (!ssm) {
    ssm = new SSMClient()
  }
}

function constructParamPath (env, service, paramName) {
  return `${BASE_PATH}/${env}/${service}${paramName ? '/' + paramName : ''}`
}

function restructureParam (param) {
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

async function getParameter (env, service, paramName, isEncrypted) {
  const Name = constructParamPath(env, service, paramName)
  const params = {
    Name,
    WithDecryption: isEncrypted
  }

  initializeSSM()

  const command = new GetParameterCommand(params)

  const response = await ssm.send(command)
  return restructureParam(response?.Parameter)
}

async function getParametersByService (env, service, isEncrypted) {
  const Path = constructParamPath(env, service)
  console.log(`Getting parameters from ${Path}`)

  if (cachedParams[Path]) {
    console.log('Found parameters in cache. Returning...')
    return cachedParams[Path]
  }

  const params = {
    Path,
    Recursive: true,
    WithDecryption: isEncrypted
  }

  const convertedParams = {}
  let nextToken = null

  initializeSSM()

  do {
    const command = new GetParametersByPathCommand(params)
    const response = await ssm.send(command)

    for (let i = 0; i < response.Parameters.length; i++) {
      const param = restructureParam(response.Parameters[i])
      convertedParams[param.name] = param
    }

    nextToken = response.NextToken
    params.NextToken = nextToken
  } while (nextToken)

  cachedParams[Path] = convertedParams

  return convertedParams
}

// TODO: add param caching
// TODO: add support for labels

async function setParameter (param, env, service, isEncrypted, canOverwrite) {
  const Name = constructParamPath(env, service, param.key)
  const Value = param.value
  const params = {
    Name,
    Value,
    Type: isEncrypted ? 'SecureString' : 'String',
    Overwrite: canOverwrite
  }

  initializeSSM()

  const command = new PutParameterCommand(params)
  const response = await ssm.send(command)

  console.log(response)
  return response
}

async function setParametersByService (params, env, service) {
  const data = []

  for (let i = 0; i < params.length; i++) {
    const result = setParameter(params[i], env, service, params[i]?.isEncrypted, params[i]?.canOverwrite)
    data.push(result)
  }

  return data
}

async function getEnvironments () {
  console.log(`Getting environments descending from ${BASE_PATH}`)
  const params = {
    Path: BASE_PATH,
    Recursive: true
  }

  const envs = {}
  let nextToken = null

  initializeSSM()

  do {
    const command = new GetParametersByPathCommand(params)
    const response = await ssm.send(command)

    for (let i = 0; i < response.Parameters.length; i++) {
      const param = response.Parameters[i]
      const name = param.Name.split('/')
      const env = name[2]
      envs[env] = envs[env] ? envs[env] + 1 : 1
    }

    nextToken = response.NextToken
    params.NextToken = nextToken
  } while (nextToken)

  return envs
}

async function getServicesForEnvironment (env) {
  const Path = BASE_PATH + '/' + env
  console.log(`Getting services descending from the environment ${Path}`)
  const params = {
    Path,
    Recursive: true
  }

  const svcs = {}
  let nextToken = null

  initializeSSM()

  do {
    const command = new GetParametersByPathCommand(params)
    const response = await ssm.send(command)

    for (let i = 0; i < response.Parameters.length; i++) {
      const param = response.Parameters[i]
      const name = param.Name.split('/')
      const svc = name[3]
      svcs[svc] = svcs[svc] ? svcs[svc] + 1 : 1
    }

    nextToken = response.NextToken
    params.NextToken = nextToken
  } while (nextToken)

  return svcs
}

async function getAllOrgParams (isEncrypted) {
  console.log(`Getting all parameters under ${BASE_PATH}`)
  const params = {
    Path: BASE_PATH,
    Recursive: true,
    WithDecryption: isEncrypted
  }

  const convertedParams = {}
  let nextToken = null

  initializeSSM()

  do {
    const command = new GetParametersByPathCommand(params)
    const response = await ssm.send(command)

    for (let i = 0; i < response.Parameters.length; i++) {
      const param = restructureParam(response.Parameters[i])
      const name = response.Parameters[i].Name.split('/')

      if (!convertedParams[name[2]]) {
        convertedParams[name[2]] = {}
      }

      if (!convertedParams[name[2]][name[3]]) {
        convertedParams[name[2]][name[3]] = {}
      }

      convertedParams[name[2]][name[3]][param.name] = param
    }

    nextToken = response.NextToken
    params.NextToken = nextToken
  } while (nextToken)

  return convertedParams
}

module.exports = {
  constructParamPath,
  getParameter,
  getParametersByService,
  setParameter,
  setParametersByService,
  getEnvironments,
  getServicesForEnvironment,
  getAllOrgParams
}
