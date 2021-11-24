const events = require('events')
const fs = require('fs')
const fsp = require('fs').promises
const readline = require('readline')

async function readEnvFile(filename) {
  const aParams = []

  const rl = readline.createInterface({
    input: fs.createReadStream(filename),
  })

  rl.on('line', (line) => {
    // console.log(line)
    const aLine = line.split('=')
    // console.log(aLine)

    if (aLine.length === 2) {
      aParams.push({
        key: aLine[0],
        value: aLine[1]
      })
    }
  })

  await events.once(rl, 'close')

  return aParams
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
  await fsp.writeFile(filename, paramsToString)
  return paramsToString
}

module.exports = {
  readEnvFile,
  loadParamsIntoEnv,
  loadFileIntoEnv,
  paramsToSourceFile
}