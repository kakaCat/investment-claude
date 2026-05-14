// src/utils/dashboardConfig.ts
import fs from 'fs/promises'
import path from 'path'
import type { DashboardConfig } from '../types/dashboard.js'

const CONFIG_PATH = '.pi/dashboard-config.json'

const DEFAULT_CONFIG: DashboardConfig = {
  refreshInterval: 60,
  autoRefresh: true,
  theme: {
    profit: 'green',
    loss: 'red',
    neutral: 'gray',
  },
  panels: {
    portfolio: {
      maxRows: 10,
      sortBy: 'marketValue',
    },
    decisionLog: {
      maxRows: 5,
    },
    market: {
      indexCount: 3,
      watchlistMaxRows: 5,
    },
  },
}

export async function loadConfig(): Promise<DashboardConfig> {
  try {
    const content = await fs.readFile(CONFIG_PATH, 'utf-8')
    return JSON.parse(content)
  } catch (error) {
    return DEFAULT_CONFIG
  }
}

export async function saveConfig(config: DashboardConfig): Promise<void> {
  await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8')
}

export async function updateConfig(key: string, value: string): Promise<void> {
  const config = await loadConfig()

  // 支持嵌套键，如 "theme.profit"
  const keys = key.split('.')
  let current: any = config

  for (let i = 0; i < keys.length - 1; i++) {
    if (!(keys[i] in current)) {
      throw new Error(`Invalid config key: ${key}`)
    }
    current = current[keys[i]]
  }

  const lastKey = keys[keys.length - 1]
  if (!(lastKey in current)) {
    throw new Error(`Invalid config key: ${key}`)
  }

  // 类型转换
  if (typeof current[lastKey] === 'number') {
    current[lastKey] = parseInt(value, 10)
  } else if (typeof current[lastKey] === 'boolean') {
    current[lastKey] = value === 'true'
  } else {
    current[lastKey] = value
  }

  await saveConfig(config)
}
