const AWS = require('aws-sdk')

const ssm = new AWS.SSM();

async function getParameter(name, isEncrypted) {
  const params = {
    Name: name,
    WithDecryption: isEncrypted
  };

  const data = await ssm.getParameter(params).promise()
  return data
}

module.exports = {
  getParameter
}