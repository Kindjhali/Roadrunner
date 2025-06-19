# useAgentConfig

Provides helper functions for loading, validating, and saving agent configuration files.

## Inputs
- **file**: name of the config file
- **data**: configuration object

## Outputs
- **models**: list of available models from `/api/models`
- **validate**: function to validate configuration against a schema
- **loadConfig**: fetches a JSON config from the API
- **saveConfig**: posts updated config to the API
