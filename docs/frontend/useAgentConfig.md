# useAgentConfig Hook

This hook loads agent configuration from a backend endpoint, validates it using the `useValidatedConfig` composable and allows saving the updated configuration.

## Inputs
- `url` – endpoint path for the JSON config.

## Outputs
- `config` – reactive configuration object.
- `valid` – boolean validity flag.
- `errors` – validation error strings.

## Flow
```
load() -> fetch config -> validate
save() -> POST if valid
```

Known limitations: schema validation uses a simple AJV schema stub.
