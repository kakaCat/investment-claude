// src/utils/auth.ts

/**
 * Subscription types for feature gating
 */
export type SubscriptionType = 'free' | 'pro' | 'team'

/**
 * Get the current user's subscription type
 * TODO: Implement actual subscription checking logic
 */
export function getSubscriptionType(): SubscriptionType {
  // Default to 'pro' for now - can be configured via env var
  const envType = process.env.SUBSCRIPTION_TYPE?.toLowerCase()
  if (envType === 'free' || envType === 'pro' || envType === 'team') {
    return envType
  }
  return 'pro'
}
