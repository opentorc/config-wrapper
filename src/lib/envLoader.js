const events = require('events')
const fs = require('fs')
const fsp = require('fs').promises
const readline = require('readline')

async function readEnvFile (filename) {
  const aParams = []

  const rl = readline.createInterface({
    input: fs.createReadStream(filename)
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

function loadParamsIntoEnv (params) {
  params.forEach((param) => {
    process.env[param.key] = param.value
  })
}

function remapKeys (params, prefix, newPrefix) {
  const aParams = []

  for (let i = 0; i < params.length; i++) {
    const param = params[i]
    let key = param.key

    if (key.startsWith(prefix)) {
      key = newPrefix + key.slice(prefix.length)
    }

    aParams.push({
      key,
      value: param.value
    })
  }

  return aParams
}

function remapKeysInEnv (prefix, newPrefix, params) {
  if (!params) { // CWD -- if no params given then load from current env
    params = []
    console.log('loading params from current env')
    for (const key in process.env) {
      params.push({
        key,
        value: process.env[key]
      })
    }
  }
  const newParams = remapKeys(params, prefix, newPrefix)
  loadParamsIntoEnv(newParams)
  return newParams
}

async function loadFileIntoEnv (filename) {
  const params = await readEnvFile(filename)

  loadParamsIntoEnv(params)
}

async function paramsToSourceFile (params, filename) {
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
  remapKeys,
  remapKeysInEnv,
  loadFileIntoEnv,
  paramsToSourceFile
}
