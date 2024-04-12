/* globals describe, it, after */
const fs = require('fs').promises

// eslint-disable-next-line no-unused-vars
const assert = require('chai').assert
// eslint-disable-next-line no-unused-vars
const should = require('chai').should()

const { envLoader, awsManager } = require('../src/index')
const envFile = './tests/.env'

describe('envLoader', async () => {
  const params = [
    { key: 'key01', value: 'value01' },
    { key: 'key02', value: 'value02' },
    { key: 'key03', value: 'value03' },
    { key: 'key04', value: 'special$code' },
    { key: 'key05', value: '"quoted"' },
    { key: 'key06', value: '`code`!' }
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

        const specialCharsRegex = /[$\\"!` ]/

        if (specialCharsRegex.test(aLine[1])) {
          aLine[1].should.equal(`'${params[i].value}'`)
        } else {
          aLine[1].should.equal(params[i].value)
        }
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
        { key: 'new_key_03', value: 'value03' },
        { key: 'new_key_04', value: 'special$code' },
        { key: 'new_key_05', value: '"quoted"' },
        { key: 'new_key_06', value: '`code`!' }
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
        { key: 'new_key_03', value: 'value03' },
        { key: 'new_key_04', value: 'special$code' },
        { key: 'new_key_05', value: '"quoted"' },
        { key: 'new_key_06', value: '`code`!' }
      ]
      const testParams2 = [
        { key: 'key_01', value: 'value01' },
        { key: 'key_02', value: 'value02' },
        { key: 'key_03', value: 'value03' },
        { key: 'new_key_04', value: 'special$code' },
        { key: 'new_key_05', value: '"quoted"' },
        { key: 'new_key_06', value: '`code`!' }
      ]

      const remapped = envLoader.remapKeysInEnv('key', 'new_key_', params)
      remapped.should.deep.equal(testParams)

      for (let i = 0; i < testParams.length; i++) {
        process.env[testParams[i].key].should.equal(testParams[i].value)
      }

      envLoader.remapKeysInEnv('new_', '')
      for (let i = 0; i < testParams2.length; i++) {
        testParams2[i].value.should.equal(process.env[testParams2[i].key])
      }
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

describe('awsManager', async () => {
  const env = 'test'
  const service = 'config-wrapper'
  const aParams = [
    { key: 'testParam01', value: 'value01', canOverwrite: true },
    { key: 'testParam02', value: 'value02' },
    { key: 'secretParam01', value: 'secretValue01', isEncrypted: true }
  ]

  describe('setParameter', async () => {
    it('should set a parameter', async () => {
      aParams.push({ key: 'testParam03', value: 'value03' })
      const param = await awsManager.setParameter(aParams[3], env, service, false, true)
      param.Tier.should.equal('Standard')
      param.Version.should.be.at.least(1)
    })
  })

  describe('setParametersByService', async () => {
    it('should set parameters by service', async () => {
      const params = await awsManager.setParametersByService(aParams, env, service)
      params.should.have.lengthOf(aParams.length)
    })
  })

  describe('getParameter', async () => {
    it('should get a parameter from AWS', async () => {
      const param = await awsManager.getParameter(env, service, aParams[0].key)
      param.value.should.equal(aParams[0].value)
    })
  })

  describe('getParameter with secret', async () => {
    it('should get a secret parameter from AWS', async () => {
      const param = await awsManager.getParameter(env, service, aParams[2].key, true)
      param.value.should.equal(aParams[2].value)
    })
  })

  describe('getParametersByService', async () => {
    it('should get all the parameters by env and service', async () => {
      const params = await awsManager.getParametersByService(env, service, true)
      console.log(params)
      for (let i = 0; i < aParams.length; i++) {
        const found = params[aParams[i].key]

        should.exist(found)
        found.value.should.equal(aParams[i].value)
      }
    })
  })

  describe('getEnvironments', async () => {
    it('should get all the environments', async () => {
      const envs = await awsManager.getEnvironments()
      console.log(envs)
      should.exist(envs.test)
      envs.test.should.equal(4)
    })
  })

  describe('getServicesForEnvironment', async () => {
    it('should get all the services in an environment', async () => {
      const svcs = await awsManager.getServicesForEnvironment('test')
      console.log(svcs)
      should.exist(svcs['config-wrapper'])
      svcs['config-wrapper'].should.equal(4)
    })
  })

  describe('getAllOrgParams', async () => {
    it('should get all the org parameters', async () => {
      const params = await awsManager.getAllOrgParams()
      console.log(params)
      should.exist(params.test)
      should.exist(params.test['config-wrapper'])
      Object.keys(params.test['config-wrapper']).should.have.lengthOf(4)
      params.test['config-wrapper'].should.have.property('testParam01')
      params.test['config-wrapper'].should.have.property('secretParam01')
    })
  })
})

after(() => {
  console.log('afterAll called')
  fs.unlink(envFile)
})
