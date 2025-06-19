import Ajv from 'ajv'

const ajv = new Ajv()

export function validateConfig(config: any) {
  // Simple schema example; real schema would be more complex
  const schema = { type: 'object' }
  const validate = ajv.compile(schema)
  const valid = validate(config)
  return { valid: !!valid, errors: validate.errors?.map(e => e.message || '') || [] }
}
