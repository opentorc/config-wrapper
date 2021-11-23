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

async function loadIntoEnv(filename) {
  const aParams = await readEnvFile(filename)

  aParams.forEach((param) => {
    process.env[param.key] = param.value
  })
}

async function paramsToSourceFile(params, filename) {
  const aParams = []

  params.forEach((param) => {
    aParams.push(`${param.key}=${param.value}`)
  })

  await writeFile(filename, aParams.join('\n'))
  return aParams
}

module.exports = {
  readEnvFile,
  loadIntoEnv,
  paramsToSourceFile
}