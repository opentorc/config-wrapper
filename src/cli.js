const arg = require('arg')
const inquirer = require('inquirer')
const chalk = require('chalk')

let pkg = require('../package.json');
const configWrapper = require('./index')


function parseArgumentsIntoOptions(rawArgs) {
  const args = arg({
    '--outfile': String,
    '--infile': String,
    '--oldprefix': String,
    '--newprefix': String,
    '--env': String,
    '--service': String,
    '--overwrite': Boolean,
    '--encrypt': Boolean,
    '--help': Boolean,
    '-o': '--outfile',
    '-i': '--infile',
    '-e': '--env',
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