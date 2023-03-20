const fs = require('fs/promises')
const arg = require('arg')
const inquirer = require('inquirer')
const chalk = require('chalk')

let pkg = require('../package.json');
const configWrapper = require('./index');
const { mkdir } = require('fs');


function parseArgumentsIntoOptions(rawArgs) {
  const args = arg({
    '--outfile': String,
    '--infile': String,
    '--oldprefix': String,
    '--newprefix': String,
    '--env': String,
    '--folder': String,
    '--service': String,
    '--overwrite': Boolean,
    '--encrypt': Boolean,
    '--help': Boolean,
    '-o': '--outfile',
    '-i': '--infile',
    '-e': '--env',
    '-f': '--folder',
    '-s': '--service',
    '-h': '--help'
   },{
    argv: rawArgs.slice(2),
    permissive: true
   }
  )

  return {
    outfile: args['--outfile'] || '',
    infile: args['--infile'] || '',
    oldprefix: args['--oldprefix'] || '',
    newprefix: args['--newprefix'] || '',
    service: args['--service'],
    overwrite: args['--overwrite'] || false,
    encrypt: args['--encrypt'] || false,
    env: args['--env'],
    folder: args['--folder'] || '',
    help: args['--help'] || false,
    command: args._[0] || ''
  }
}

function displayHelp() {
  console.log(chalk.green.bgRed.bold('HJAAALP!'))
/*
{underline.green loadParamsIntoEnv:} load up parameters into the current process environment as env vars
    {bold.blue * --source:} aws || filename (default: aws)
*/
  console.log(chalk`
{bold.red COMMANDS:}
{underline.green remapKeysInEnv:} take {italic.red existing env vars} and remap them to {italic.red new env vars}. ie: {italic.blue DEV_AWS_ACCESS_KEY_ID} -> {italic.blue AWS_ACCESS_KEY_ID}
    {bold.blue * --outfile} file to save the new env vars to
    {bold.blue * --oldprefix} prefix to be replaced
    {bold.blue * --newprefix} prefix to replace with
{underline.green saveParamsFile:} save params to a file so that they can be loaded in another process via {italic.blue source} command
    {bold.blue * --outfile} file to save the aws env vars to
    {bold.blue * --env} aws application environment
    {bold.blue * --service} aws application service
{underline.green putToAWSFromFile:} save params from an env var file into AWS Parameter Store
    {bold.blue * --infile} file to read the env vars from
    {bold.blue * --env} aws application environment
    {bold.blue * --service} aws application service
    {bold.blue * --overwrite} optional flag to overwrite existing parameters
    {bold.blue * --encrypt} optional flag to encrypt the parameters
{underline.green exportAllParams:} export all parameters from AWS Parameter Store to hierarchical folders
    {bold.blue * --folder} folder to save parameters to
    {bold.blue * --env} optional aws application environment
{underline.green getSharedConfigByService:} get params by service from Config Table.
    {bold.blue * --env} aws application environment
    {bold.blue * --service} aws application service
    {bold.blue * --outfile} optional flag to save parameters with provided file name, file will be saved as -> {italic.blue "fileName"-"service".json} 
{underline.green putSharedConfigFromFile:} save params from json file into Config Table.
    {bold.blue * --infile} json file to read the params from
    {bold.blue * --env} aws application environment
    {bold.blue * --service} aws application service
`)
}

async function remapKeysInEnv(config) {
  console.log(chalk.green('Remapping keys in env'))
  const params = configWrapper.envLoader.remapKeysInEnv(config.oldprefix, config.newprefix)
  console.log(chalk.green(`Saving ${params.length} parameters to ${config.outfile}`))
  configWrapper.envLoader.paramsToSourceFile(params, config.outfile)
  console.log(chalk.green(`Saved ${params.length} parameters to ${config.outfile}`))
}

async function saveParamsFile(config) {
  console.log(chalk.green('Saving params file'))
  const path = configWrapper.awsManager.constructParamPath(config.env, config.service)
  console.log(chalk.green(`saving '${path}' out to ${config.outfile}`))
  const results = await configWrapper.awsManager.getParametersByService(config.env, config.service, true)

  if (Object.keys(results)?.length > 0) {
    const params = Object.keys(results).map((key) => {
      const param = results[key]
      return { key: param.name, value: param.value }
    })

    configWrapper.envLoader.paramsToSourceFile(params, config.outfile)
    console.log(chalk.green(`Saved ${Object.keys(results).length} parameters to ${config.outfile}`))
  } else {
    console.log(chalk.red('No parameters found'))
    throw new Error(chalk.red('No parameters found'))
  }
}

async function getSharedConfigByService (config) {
  const { outfile, service, env } = config

  if (!service) {
    console.log(chalk.red('Service name is required'))
    return
  }

  console.log(chalk.green(`Getting parameters from Config Table  environment: "${env}" service: "${service}"`))

  const results = await configWrapper.awsManager.getSharedConfigByService(env, service)

  console.log(`Parameters under environment: "${env}" service: "${service}"\n`, JSON.stringify(results, null, 2))

  if (outfile) {
    console.log(`writing to ${outfile}-${service}-config.json`)
    await fs.writeFile(`${outfile}-${service}-config.json`, JSON.stringify(results, null, 2))
  }
}

async function putSharedConfigFromFile (config) {
  const { infile, env, service } = config

  if (!service) {
    console.log(chalk.red('Service name is required'))
    return
  }

  console.log(chalk.green(`Reading params from file: ${infile}`))
  const data = await fs.readFile(infile, 'utf8')

  // Parse the JSON data
  const jsonData = JSON.parse(data)

  console.log(chalk.green(`Saving parameters to Config Table  environment: "${env}" service: "${service}"`))
  await configWrapper.awsManager.setSharedConfigByService(jsonData, env, service)
  console.log(chalk.green(`Saved parameters to Config Table  "environment ${env}" service: "${service}"`))
}

async function putToAWSFromFile(config) {
  const { infile, env, service, overwrite, encrypt } = config
  console.log(chalk.green(`Reading params from file: ${infile}`))
  const params = await configWrapper.envLoader.readEnvFile(infile)
  params.forEach((param) => {
    param.canOverwrite = overwrite
    param.isEncrypted = encrypt
  })
  console.log(chalk.green(`Saving ${params.length} parameters to AWS for "/torc/${env}/${service}"`))
  const results = await configWrapper.awsManager.setParametersByService(params, env, service)
  console.log(chalk.green(`Saved ${results.length} parameters to AWS for "/torc/${env}/${service}"`))
}
async function exportAllParams(config) {
  // console.log(config)
  const rootFolder = config?.folder || './params'
  await fs.mkdir(rootFolder, { recursive: true })
  let params = {}
  const allParams = await configWrapper.awsManager.getAllOrgParams(true)

  if (config?.env) {
    Object.keys(allParams).forEach((key) => {
      if (key === config.env) {
        console.log(`adding params for: ${key}`)
        params[key] = allParams[key]
      }
    })
  } else {
    params = allParams
  }

  // console.log(params)
  const envs = Object.keys(params)

  for (let i = 0; i < envs.length; ++i) {
    const env = envs[i]
    await fs.mkdir(`${rootFolder}/${env}`)
    const services = Object.keys(params[env])

    for (let j = 0; j < services.length; ++j) { 
      const service = services[j]
      const aEnvVars = []
      const vars = Object.keys(params[env][service])

      for (let k = 0; k < vars.length; ++k) {
        const key = vars[k]
        const param = params[env][service][key]
        aEnvVars.push(`${key}=${param.value}`)
      }

      console.log(`writing ${aEnvVars.length} params for ${env}/${service} to ${rootFolder}/${env}/${service}.env`)
      await fs.writeFile(`${rootFolder}/${env}/${service}.env`, aEnvVars.join('\n'))
    }
  }
 }

async function promptForMissingOptions(options) {
  let commandFunc = null

  const questions = []

  switch (options.command) {
    case 'remapKeysInEnv': {
      commandFunc = remapKeysInEnv

      if (!options.outfile) {
        questions.push({
          type: 'input',
          name: 'outfile',
          message: 'Output file: ',
          default: '.env',
        })
      }

      if (!options.oldprefix) {
        questions.push({
          type: 'input',
          name: 'oldprefix',
          message: 'Prefix to replace: ',
          default: 'DEV_',
        })
      }

      if (!options.newprefix) {
        questions.push({
          type: 'input',
          name: 'newprefix',
          message: 'Replacing previx (can be blank): ',
          default: '',
        })
      }
      break
    }
    case 'saveParamsFile': {
      commandFunc = saveParamsFile
      if (!options.outfile) {
        questions.push({
          type: 'input',
          name: 'outfile',
          message: 'Output file: ',
          default: '.env',
        })
      }
  
      if (!options.env) {
        questions.push({
          type: 'input',
          name: 'env',
          message: 'Environment: ',
          default: 'dev',
        })
      }

      if (!options.service) {
        questions.push({
          type: 'input',
          name: 'service',
          message: 'Service: ',
          default: '',
        })
      }
      break
    }
    case 'getSharedConfigByService': {
      commandFunc = getSharedConfigByService

      if (!options.env) {
        questions.push({
          type: 'input',
          name: 'env',
          message: 'Environment: ',
          default: 'develop'
        })
      }

      if (!options.service) {
        questions.push({
          type: 'input',
          name: 'service',
          message: 'Service: ',
          default: ''
        })
      }
      break
    }
    case 'putSharedConfigFromFile': {
      commandFunc = putSharedConfigFromFile

      if (!options.infile) {
        questions.push({
          type: 'input',
          name: 'infile',
          message: 'Input file: ',
          default: 'sharedConfig.json'
        })
      }

      if (!options.env) {
        questions.push({
          type: 'input',
          name: 'env',
          message: 'Environment: ',
          default: 'develop'
        })
      }

      if (!options.service) {
        questions.push({
          type: 'input',
          name: 'service',
          message: 'Service: ',
          default: ''
        })
      }
      break
    }
    case 'putToAWSFromFile': {
      commandFunc = putToAWSFromFile
      if (!options.infile) {
        questions.push({
          type: 'input',
          name: 'infile',
          message: 'Input file: ',
          default: '.env',
        })
      }

      if (!options.env) {
        questions.push({
          type: 'input',
          name: 'env',
          message: 'Environment: ',
          default: 'dev',
        })
      }

      if (!options.service) {
        questions.push({
          type: 'input',
          name: 'service',
          message: 'Service: ',
          default: '',
        })
      }
      break
    }
    case 'exportAllParams': {
      commandFunc = exportAllParams
      if (!options.folder) {
        questions.push({
          type: 'input',
          name: 'folder',
          message: 'Folder: ',
          default: './params',
        })
      }
      break
    }
    default: {
      commandFunc = displayHelp
      return { commandFunc }
    }
  }

  const answers = await inquirer.prompt(questions)
  return {
    ...options,
    outfile: options.outfile || answers.outfile,
    infile: options.infile || answers.infile,
    oldprefix: options.oldprefix || answers.oldprefix,
    newprefix: options.newprefix || answers.newprefix,
    source: options.source || answers.source,
    service: options.service || answers.service,
    env: options.env || answers.env,
    commandFunc
  };
}

async function cli(args) {
  console.log(chalk.green(`\n${pkg.name} v${pkg.version}`))
  let options = parseArgumentsIntoOptions(args)
  options = await promptForMissingOptions(options)

  if (options) {
    await options.commandFunc(options)
  }
}

module.exports = {
  cli
}