// src/utils/growthbook.ts

/**
 * GrowthBook feature flag system (stub implementation)
 * TODO: Implement actual GrowthBook integration
 */

const featureDefaults: Record<string, any> = {
  tengu_agent_list_attach: false,
  tengu_explore_agent: 'inherit',
  // Add more feature flags as needed
}

/**
 * Get a feature flag value (cached, may be stale)
 * This is a stub - real implementation would connect to GrowthBook
 */
export function getFeatureValue_CACHED_MAY_BE_STALE<T>(
  featureKey: string,
  defaultValue: T,
): T {
  // Check environment variable override first
  const envKey = `FEATURE_${featureKey.toUpperCase()}`
  const envValue = process.env[envKey]
  if (envValue !== undefined) {
    // Try to parse as JSON, fall back to string
    try {
      return JSON.parse(envValue) as T
    } catch {
      return envValue as T
    }
  }

  // Return default from feature defaults or provided default
  return (featureDefaults[featureKey] ?? defaultValue) as T
}
