const AWS = require('aws-sdk')

const ssm = new AWS.SSM();

const BASE_PATH = '/torc'

async function getParameter(env, service, paramName, isEncrypted) {
  const Name = `${BASE_PATH}/${env}/${service}/${paramName}`
  const params = {
    Name,
    WithDecryption: isEncrypted
  };

  const data = await ssm.getParameter(params).promise()
  return data
}

async function getParametersByService(env, service, isEncrypted) {
  const Path = `${BASE_PATH}/${env}/${service}`
  console.log(`Getting parameters from ${Path}`)
  var config = {
    Path,
    Recursive: true,
    WithDecryption: isEncrypted
  };

  const params = await ssm.getParametersByPath(config).promise()
  return params
}

module.exports = {
  getParameter,
  getParametersByService
}