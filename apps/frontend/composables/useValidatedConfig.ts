import { useValidatedConfig as base } from './useValidatedConfig.js'

/**
 * TypeScript wrapper for useValidatedConfig to expose typed validate function.
 */
export type ValidateFn = <T>(data: T, schema?: object) => boolean

export function useValidatedConfig(): { validate: ValidateFn } {
  return base() as { validate: ValidateFn }
}
