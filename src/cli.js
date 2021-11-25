const arg = require('arg')
const inquirer = require('inquirer')
const chalk = require('chalk')

let pkg = require('../package.json');
const configWrapper = require('./index')


function parseArgumentsIntoOptions(rawArgs) {
  const args = arg({
    '--outfile': String,
    '--oldprefix': String,
    '--newprefix': String,
    '--env': String,
    '--service': String,
    '--help': Boolean,
    '-o': '--outfile',
    '-e': '--env',
    '-a': '--service',
    '-h': '--help'
   },{
    argv: rawArgs.slice(2),
    permissive: true
   }
  )

  return {
  outfile: args['--outfile'] || '',
  oldprefix: args['--oldprefix'] || '',
  newprefix: args['--newprefix'] || '',
  service: args['--service'] || '',
  env: args['--env'] || '',
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
    {bold.blue * --env} aws application environment if source is aws
    {bold.blue * --service} aws application service if source is aws
`)
}

async function remapKeysInEnv(config) {
  console.log(chalk.green('Remapping keys in env'))
}

async function saveParamsFile(config) {
  console.log(chalk.green('Saving params file'))
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
  console.log(options)

  if (options) {
    await options.commandFunc(options)
  }
}

module.exports = {
  cli
}