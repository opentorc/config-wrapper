# config-wrapper
Wrapper module for managing app configurations w/ AWS param store

This module will:
- load env vars into a running node process from a key/value pair array
- create an env var file to `source` against in a CI script
- store and recall env vars to AWS parameter store based on env and app tags

### Install
`npm i -g @opentorc/config-wrapper`

### CLI Usage
`config-wrapper --help` 
#### Commands
- remapKeysInEnv: take existing env vars and remap them to new env vars. ie: DEV_AWS_ACCESS_KEY_ID -> AWS_ACCESS_KEY_ID
    * --outfile file to save the new env vars to
    * --oldprefix prefix to be replaced
    * --newprefix prefix to replace with
- saveParamsFile: save params to a file so that they can be loaded in another process via source command
    * --outfile file to save the aws env vars to
    * --env aws application environment
    * --service aws application service
- putToAWSFromFile: save params from an env var file into AWS Parameter Store
    * --infile file to read the env vars from
    * --env aws application environment
    * --service aws application service
    * --overwrite optional flag to overwrite existing parameters
    * --encrypt optional flag to encrypt the parameters
- exportAllParams: export all parameters from AWS Parameter Store to hierarchical folders
    * --folder folder to save parameters to
    * --env optional aws application 
- getSharedConfigByService: get params by service from Config Table.
    * --env aws application environment
    * --service aws application service
    * --outfile optional flag to save parameters with provided file name, file will be saved as -> "fileName"-"service"-config.json 
- putSharedConfigFromFile: save params from json file into Config Table.
    * --infile json file to read the params from
      
      eg:

      `sharedConfig.json` (key represents the name of the parameter)
      ```json
        {
          "USER_TABLE": {
            "value": "user_table_name"
           }
        }
      ```
    * --env aws application environment
    * --service aws application service
#### Tests
`npm test` 

#### Note:
Remember to have an `AWS_REGION` set in your env when running