# useValidatedConfig

Utility composable that validates JSON data against a provided schema using Ajv.

## Inputs
- **data**: `object` - configuration object to validate
- **schema**: `object` (optional) - JSON schema

## Outputs
- **validate**: `(data, schema?) => boolean` returns `true` if data conforms to the schema

The frontend exposes a typed wrapper `apps/frontend/composables/useValidatedConfig.ts` which re-exports the logic from `useValidatedConfig.js` with TypeScript support.

