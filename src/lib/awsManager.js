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
// TODO: add support for saving parameters

module.exports = {
  constructParamPath,
  getParameter,
  getParametersByService
}