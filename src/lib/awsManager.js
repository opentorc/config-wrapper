const AWS = require('aws-sdk')

const ssm = new AWS.SSM();

const BASE_PATH = '/torc'

function constructParamPath(env, service, paramName) {
  return `${BASE_PATH}/${env}/${service}${paramName?'/'+paramName:''}`
}

async function getParameter(env, service, paramName, isEncrypted) {
  const Name = constructParamPath(env, service, paramName)
  const params = {
    Name,
    WithDecryption: isEncrypted
  };

  const data = await ssm.getParameter(params).promise()
  return data
}

async function getParametersByService(env, service, isEncrypted) {
  const Path = constructParamPath(env, service)
  console.log(`Getting parameters from ${Path}`)
  var config = {
    Path,
    Recursive: true,
    WithDecryption: isEncrypted
  };

  const params = await ssm.getParametersByPath(config).promise()
  return params
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
console.log(`Setting parameter ${Name} = ${Value}`)
  const data = await ssm.putParameter(params).promise()
  console.log(data)
  return data
}

async function setParametersByService(params, env, service) {
  console.log(`Setting parameters ${JSON.stringify(params)}`)
  const data = [] 

  for (let i = 0; i < params.length; i++) {
    const result = setParameter(params[i], env, service, params[i]?.isEncrypted, params[i]?.canOverwrite)
    data.push(result)
  }

  return data
}

module.exports = {
  constructParamPath,
  getParameter,
  getParametersByService,
  setParameter,
  setParametersByService
}