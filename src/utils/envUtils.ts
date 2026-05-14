// src/utils/envUtils.ts

/**
 * Check if an environment variable is explicitly set to a truthy value
 */
export function isEnvTruthy(value: string | undefined): boolean {
  if (!value) return false
  const normalized = value.toLowerCase().trim()
  return normalized === 'true' || normalized === '1' || normalized === 'yes'
}

/**
 * Check if an environment variable is explicitly set to a falsy value
 */
export function isEnvDefinedFalsy(value: string | undefined): boolean {
  if (value === undefined) return false
  const normalized = value.toLowerCase().trim()
  return normalized === 'false' || normalized === '0' || normalized === 'no'
}
