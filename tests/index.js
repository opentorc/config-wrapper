const fs = require('fs').promises

// eslint-disable-next-line no-unused-vars
const assert = require('chai').assert
// eslint-disable-next-line no-unused-vars
const should = require('chai').should()

const { envLoader, awsManager } = require('../index')
const envFile = './tests/.env'

describe('config-wrapper', async () => {
  const params = [
    { key: 'key01', value: 'value01' },
    { key: 'key02', value: 'value02' },
    { key: 'key03', value: 'value03' }
  ]

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
    it('should load array into process.env ', async () => {
      for (let i = 0; i < params.length; i++) {
        process.env.should.not.have.property(params[i].key)
      }

      envLoader.loadParamsIntoEnv(params)

      for (let i = 0; i < params.length; i++) {
        process.env[params[i].key].should.equal(params[i].value)
      }
    })
  })

  describe('remapKeys', async () => {
    it('should remap keys', async () => {
      const testParams = [
        { key: 'new_key_01', value: 'value01' },
        { key: 'new_key_02', value: 'value02' },
        { key: 'new_key_03', value: 'value03' }
      ]
      const remapped = envLoader.remapKeys(params, 'key', 'new_key_')
      remapped.should.deep.equal(testParams)
    })
  })

  describe('remapKeysInEnv', async () => {
    it('should remap keys in the env', async () => {
      const testParams = [
        { key: 'new_key_01', value: 'value01' },
        { key: 'new_key_02', value: 'value02' },
        { key: 'new_key_03', value: 'value03' }
      ]
      const testParams2 = [
        { key: 'key_01', value: 'value01' },
        { key: 'key_02', value: 'value02' },
        { key: 'key_03', value: 'value03' }
      ]

      const remapped = envLoader.remapKeysInEnv('key', 'new_key_', params)
      remapped.should.deep.equal(testParams)

      for (let i = 0; i < testParams.length; i++) {
        process.env[testParams[i].key].should.equal(testParams[i].value)
      }
      console.log(process.env)

      envLoader.remapKeysInEnv('new_', '')
      for (let i = 0; i < testParams2.length; i++) {
        testParams2[i].value.should.equal(process.env[testParams2[i].key])
      }
      console.log(process.env)
      
    })
  })

  describe('loadFileIntoEnv', async () => {
    it('should read & load a file into process.env', async () => {
      await envLoader.loadFileIntoEnv(envFile)

      for (let i = 0; i < params.length; i++) {
        process.env[params[i].key].should.equal(params[i].value)
      }
    })
  })
})
/*
describe('awsManager', async () => {
  describe('getParameter', async () => {
    it('should get a parameter from AWS', async () => {
      const param = await awsManager.getParameter('/torc/dev/frontend/GOOGLE_CLIENT_ID')
      console.log(param)
    })
  })
})
*/

after(() => {
  console.log('afterAll called')
  fs.unlink(envFile)
})
