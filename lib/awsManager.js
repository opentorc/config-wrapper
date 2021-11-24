const AWS = require('aws-sdk')

const ssm = new AWS.SSM();

const BASE_PATH = '/torc'

async function getParameter(name, isEncrypted) {
  const params = {
    Name: name,
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