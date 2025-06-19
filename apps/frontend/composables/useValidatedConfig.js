import Ajv from 'ajv'

const ajv = new Ajv()

export function useValidatedConfig() {
  const validate = (data, schema) => {
    if (!schema) return true
    const validator = ajv.compile(schema)
    return validator(data)
  }

  return { validate }
}
