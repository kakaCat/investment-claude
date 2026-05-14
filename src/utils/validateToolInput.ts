import Ajv from 'ajv'

const ajv = new Ajv({ allErrors: true })

/**
 * 校验工具输入是否符合 schema
 * @returns { valid: true } 或 { valid: false, errors: string[] }
 */
export function validateToolInput(
  input: unknown,
  schema: Record<string, unknown>,
): { valid: true } | { valid: false; errors: string[] } {
  const validate = ajv.compile(schema)
  const valid = validate(input)

  if (valid) {
    return { valid: true }
  }

  const errors = (validate.errors || []).map((err) => {
    const field = err.instancePath || err.params?.missingProperty || 'input'
    return `${field}: ${err.message}`
  })

  return { valid: false, errors }
}
