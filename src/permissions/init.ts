// src/permissions/init.ts
// Bootstraps the permission system from settings.json into AppState

import { setAppState } from '../state/AppState.js'
import { loadPermissionSettings } from './settingsLoader.js'

/**
 * Load permission rules from settings.json files and write them
 * into AppState.permissionContext. Call once during REPL startup.
 */
export function initPermissions(): void {
  const permissionContext = loadPermissionSettings()
  setAppState(prev => ({ ...prev, permissionContext }))
}
