const fs = require('fs').promises
const lineReader = require('line-reader')

const eachLine = function (filename, options, iteratee) {
  return new Promise(function (resolve, reject) {
    lineReader.eachLine(filename, options, iteratee, function (err) {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}


async function readEnvFile(filename) {
  const aParams = []

  eachLine(filename, (line) => {
    const aLine = line.split('=')

    if (aLine.length === 2) {
      aParams.push({
        key: aLine[0],
        value: aLine[1]
      })
    }
  }).then(() => {
    return aParams
  }).catch((err) => {
    console.log('err:', err)
    throw err
  })
}

function loadParamsIntoEnv(params) {
  params.forEach((param) => {
    process.env[param.key] = param.value
  })
}

async function loadFileIntoEnv(filename) {
  const params = await readEnvFile(filename)

  loadParamsIntoEnv(params)
}

async function paramsToSourceFile(params, filename) {
  const aParams = []

  params.forEach((param) => {
    aParams.push(`${param.key}=${param.value}`)
  })

  const paramsToString = aParams.join('\n')
  await fs.writeFile(filename, paramsToString)
  return paramsToString
}

module.exports = {
  readEnvFile,
  loadParamsIntoEnv,
  loadFileIntoEnv,
  paramsToSourceFile
}