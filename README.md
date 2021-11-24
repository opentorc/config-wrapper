# config-wrapper
Wrapper module for managing app configurations w/ AWS param store

This module will:
- load env vars into a running node process from an array
- create an env var file to `source` against in a CI script
- store and recall env vars to AWS parameter store based on env and app tags

### Install
`npm i`

#### Tests
`npm test` 
