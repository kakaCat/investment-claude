import { buildTool, type ToolDef, type ToolResult } from '../../Tool.js'
import type { PermissionDecision } from '../../permissions/types.js'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { TRADE_LOG_TOOL_DESCRIPTION } from './prompt.js'

type TradeLogInput = {
  action: 'create' | 'append' | 'get' | 'list'
  symbol?: string
  name?: string
  entry_price?: number
  entry_date?: string
  notes?: string
  log_id?: string
  record?: {
    date: string
    event: string
    price?: number
    notes?: string
  }
}

type TradeLogOutput = {
  success: boolean
  data?: any
  error?: string
}

function loadJson<T>(filePath: string): T | null {
  try {
    if (!existsSync(filePath)) return null
    return JSON.parse(readFileSync(filePath, 'utf-8'))
  } catch {
    return null
  }
}

function ensureTradeLogDir(): string {
  const dir = join(process.cwd(), '.pi', 'trade-log')
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  return dir
}

function handleCreate(input: TradeLogInput): TradeLogOutput {
  const { symbol, name, entry_price, entry_date, notes } = input

  if (!symbol || !name || !entry_price || !entry_date) {
    return {
      success: false,
      error: 'Missing required fields: symbol, name, entry_price, entry_date',
    }
  }

  const dir = ensureTradeLogDir()
  const logId = `${symbol}_${Date.now()}`
  const filePath = join(dir, `${logId}.json`)

  if (existsSync(filePath)) {
    return {
      success: false,
      error: `Trade log already exists: ${logId}`,
    }
  }

  const tradeLog = {
    log_id: logId,
    symbol,
    name,
    entry_price,
    entry_date,
    notes: notes || '',
    created_at: new Date().toISOString(),
    records: [],
  }

  try {
    writeFileSync(filePath, JSON.stringify(tradeLog, null, 2), 'utf-8')
    return {
      success: true,
      data: tradeLog,
    }
  } catch (error) {
    return {
      success: false,
      error: `Failed to create trade log: ${error}`,
    }
  }
}

function handleAppend(input: TradeLogInput): TradeLogOutput {
  const { log_id, record } = input

  if (!log_id || !record) {
    return {
      success: false,
      error: 'Missing required fields: log_id, record',
    }
  }

  if (!record.date || !record.event) {
    return {
      success: false,
      error: 'Record must have date and event fields',
    }
  }

  const dir = ensureTradeLogDir()
  const filePath = join(dir, `${log_id}.json`)

  const tradeLog = loadJson<any>(filePath)
  if (!tradeLog) {
    return {
      success: false,
      error: `Trade log not found: ${log_id}`,
    }
  }

  const newRecord = {
    date: record.date,
    event: record.event,
    price: record.price,
    notes: record.notes || '',
    timestamp: new Date().toISOString(),
  }

  tradeLog.records.push(newRecord)

  try {
    writeFileSync(filePath, JSON.stringify(tradeLog, null, 2), 'utf-8')
    return {
      success: true,
      data: tradeLog,
    }
  } catch (error) {
    return {
      success: false,
      error: `Failed to append record: ${error}`,
    }
  }
}

function handleGet(input: TradeLogInput): TradeLogOutput {
  const { log_id } = input

  if (!log_id) {
    return {
      success: false,
      error: 'Missing required field: log_id',
    }
  }

  const dir = ensureTradeLogDir()
  const filePath = join(dir, `${log_id}.json`)

  const tradeLog = loadJson<any>(filePath)
  if (!tradeLog) {
    return {
      success: false,
      error: `Trade log not found: ${log_id}`,
    }
  }

  return {
    success: true,
    data: tradeLog,
  }
}

function handleList(): TradeLogOutput {
  const dir = ensureTradeLogDir()

  try {
    const fs = require('fs')
    const files = fs.readdirSync(dir).filter((f: string) => f.endsWith('.json'))

    const logs = files
      .map((file: string) => {
        const filePath = join(dir, file)
        return loadJson<any>(filePath)
      })
      .filter((log: any) => log !== null)

    return {
      success: true,
      data: logs,
    }
  } catch (error) {
    return {
      success: false,
      error: `Failed to list trade logs: ${error}`,
    }
  }
}

async function execute(input: TradeLogInput): Promise<ToolResult> {
  const { action } = input

  let result: TradeLogOutput

  switch (action) {
    case 'create':
      result = handleCreate(input)
      break
    case 'append':
      result = handleAppend(input)
      break
    case 'get':
      result = handleGet(input)
      break
    case 'list':
      result = handleList()
      break
    default:
      result = {
        success: false,
        error: `Unknown action: ${action}`,
      }
  }

  if (!result.success) {
    return {
      type: 'text',
      text: `Error: ${result.error}`,
    }
  }

  return {
    type: 'text',
    text: JSON.stringify(result.data, null, 2),
  }
}

async function checkPermission(
  input: TradeLogInput
): Promise<PermissionDecision> {
  const { action } = input

  if (action === 'get' || action === 'list') {
    return { allowed: true }
  }

  return {
    allowed: false,
    reason: `Trade log ${action} requires user confirmation`,
  }
}

export const TradeLogTool: ToolDef = buildTool({
  name: 'trade_log',
  description: TRADE_LOG_TOOL_DESCRIPTION,
  input_schema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['create', 'append', 'get', 'list'],
        description: 'Action to perform',
      },
      symbol: {
        type: 'string',
        description: 'Stock symbol (required for create)',
      },
      name: {
        type: 'string',
        description: 'Stock name (required for create)',
      },
      entry_price: {
        type: 'number',
        description: 'Entry price (required for create)',
      },
      entry_date: {
        type: 'string',
        description: 'Entry date in YYYY-MM-DD format (required for create)',
      },
      notes: {
        type: 'string',
        description: 'Initial notes (optional for create)',
      },
      log_id: {
        type: 'string',
        description: 'Trade log ID (required for append/get)',
      },
      record: {
        type: 'object',
        description: 'Record to append (required for append)',
        properties: {
          date: {
            type: 'string',
            description: 'Record date in YYYY-MM-DD format',
          },
          event: {
            type: 'string',
            description: 'Event description',
          },
          price: {
            type: 'number',
            description: 'Price at the time of event (optional)',
          },
          notes: {
            type: 'string',
            description: 'Additional notes (optional)',
          },
        },
        required: ['date', 'event'],
      },
    },
    required: ['action'],
  },
  execute,
  checkPermission,
})
