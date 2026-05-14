// src/permissions/index.ts
// Public API for the permission system

export { checkToolPermission } from './checkPermissions.js'
export { loadPermissionSettings, applyPermissionUpdate, persistPermissionUpdate } from './settingsLoader.js'
export { ruleValueToString, ruleValueFromString, findMatchingRule } from './ruleMatching.js'
export { initPermissions } from './init.js'
export {
  createEmptyPermissionContext,
  PERMISSION_MODES,
  type PermissionMode,
  type PermissionBehavior,
  type PermissionRuleSource,
  type PermissionRuleValue,
  type PermissionRule,
  type ToolPermissionContext,
  type PermissionDecision,
  type PermissionUpdate,
  type PermissionUserChoice,
} from './types.js'
