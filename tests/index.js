const fs = require('fs').promises

// eslint-disable-next-line no-unused-vars
const assert = require('chai').assert
// eslint-disable-next-line no-unused-vars
const should = require('chai').should()

const { envLoader } = require('../index')

describe('config-wrapper', async () => {
  const params = [
    { key: 'key01', value: 'value01' },
    { key: 'key02', value: 'value02' },
    { key: 'key03', value: 'value03' }
  ]

  const envFile = './tests/.env'

  describe('paramsToSourceFile', async () => {
    it('should save array to file', async () => {
      const parmsToString = await envLoader.paramsToSourceFile(params, envFile)
      const fileData = await fs.readFile(envFile, 'utf8')
      fileData.should.equal(parmsToString)
      const aParams = fileData.split('\n')

      for (let i = 0; i < aParams.length; i++) {
        const aLine = aParams[i].split('=')
        aLine[0].should.equal(params[i].key)
        aLine[1].should.equal(params[i].value)
      }
    })
  })

  describe('readEnvFile', async () => {
    it('should read a file and return array of values', async () => {
      const fileParams = await envLoader.readEnvFile(envFile)
      fileParams.should.deep.equal(params)
    })
  })

  describe('loadParamsIntoEnv', async () => {
    it('should read ', async () => {
    })
  })

  describe('loadFileIntoEnv', async () => {
    it('should read ', async () => {
    })
  })
})
