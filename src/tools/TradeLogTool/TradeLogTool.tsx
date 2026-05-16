import React from 'react'
import { Box, Text } from 'ink'
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs'
import { join } from 'path'
import { buildTool, type ToolResult, type ToolUseContext } from '../../Tool.js'
import { TRADE_LOG_TOOL_DESCRIPTION } from './prompt.js'
import type { PermissionDecision } from '../../permissions/types.js'

interface TradeLog {
  log_id: string
  symbol: string
  name: string
  entry_price: number
  entry_date: string
  notes: string
  created_at: string
  records: Array<{
    date: string
    event: string
    price?: number
    notes?: string
    timestamp: string
  }>
}

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
  data?: TradeLog | TradeLog[]
  error?: string
}

function sanitizeLogId(logId: string): string {
  return logId.replace(/[^a-zA-Z0-9_-]/g, '')
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
  const logId = sanitizeLogId(`${symbol}_${Date.now()}`)
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
  const sanitizedLogId = sanitizeLogId(log_id)
  const filePath = join(dir, `${sanitizedLogId}.json`)

  const tradeLog = loadJson<TradeLog>(filePath)
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
  const sanitizedLogId = sanitizeLogId(log_id)
  const filePath = join(dir, `${sanitizedLogId}.json`)

  const tradeLog = loadJson<TradeLog>(filePath)
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
    const files = readdirSync(dir).filter((f: string) => f.endsWith('.json'))

    const logs = files
      .map((file: string) => {
        const filePath = join(dir, file)
        return loadJson<TradeLog>(filePath)
      })
      .filter((log: TradeLog | null): log is TradeLog => log !== null)

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

// ── Tool Integration Layer ──────────────────────────────────────────────────

async function execute(
  input: TradeLogInput,
  context: ToolUseContext,
): Promise<ToolResult<TradeLogOutput>> {
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

  return { data: result }
}

function checkPermission(input: TradeLogInput): PermissionDecision {
  const { action } = input

  // Write operations require user confirmation
  if (action === 'create') {
    const { symbol, name, entry_price } = input
    return {
      behavior: 'ask',
      message: `Create trade log for ${name} (${symbol}) at entry price ${entry_price}?`,
    }
  }

  if (action === 'append') {
    const { log_id, record } = input
    return {
      behavior: 'ask',
      message: `Append record to trade log ${log_id}: ${record?.event}?`,
    }
  }

  // Read operations auto-approve
  return { behavior: 'allow' }
}

// ── UI Rendering ────────────────────────────────────────────────────────────

function renderToolResultMessage(
  result: TradeLogOutput,
  options: { verbose: boolean }
): React.ReactNode {
  // Error state
  if (!result.success) {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Box>
          <Text backgroundColor="gray" color="black"> IN </Text>
          <Text> Trade Log</Text>
        </Box>
        <Box marginTop={1}>
          <Text backgroundColor="gray" color="black"> OUT </Text>
          <Text color="red"> ✗ Error: {result.error}</Text>
        </Box>
      </Box>
    )
  }

  // Success state - render based on data type
  const isSingleLog = result.data && !Array.isArray(result.data)
  const isLogList = result.data && Array.isArray(result.data)

  if (isSingleLog) {
    const log = result.data as TradeLog
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Box>
          <Text backgroundColor="gray" color="black"> IN </Text>
          <Text> Trade Log</Text>
        </Box>
        <Box marginTop={1}>
          <Text backgroundColor="gray" color="black"> OUT </Text>
          <Text color="green"> ✓ Success</Text>
        </Box>
        <Box paddingLeft={5} marginTop={1} flexDirection="column">
          <Text color="cyan">Log ID: {log.log_id}</Text>
          <Text color="gray">Symbol: {log.symbol} | Name: {log.name}</Text>
          <Text color="gray">Entry: ¥{log.entry_price} on {log.entry_date}</Text>
          {log.notes && <Text color="gray">Notes: {log.notes}</Text>}
          <Text color="gray" dimColor>Created: {log.created_at}</Text>

          {log.records.length > 0 && (
            <Box marginTop={1} flexDirection="column">
              <Text color="yellow">Records ({log.records.length}):</Text>
              {log.records.slice(0, 5).map((record, i) => (
                <Box key={i} paddingLeft={2}>
                  <Text color="gray">
                    {record.date} | {record.event}
                    {record.price ? ` | ¥${record.price}` : ''}
                    {record.notes ? ` | ${record.notes}` : ''}
                  </Text>
                </Box>
              ))}
              {log.records.length > 5 && (
                <Box paddingLeft={2}>
                  <Text color="gray" dimColor>
                    ... and {log.records.length - 5} more records
                  </Text>
                </Box>
              )}
            </Box>
          )}
        </Box>
      </Box>
    )
  }

  if (isLogList) {
    const logs = result.data as TradeLog[]
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Box>
          <Text backgroundColor="gray" color="black"> IN </Text>
          <Text> Trade Log</Text>
        </Box>
        <Box marginTop={1}>
          <Text backgroundColor="gray" color="black"> OUT </Text>
          <Text color="green"> ✓ Found {logs.length} trade log{logs.length !== 1 ? 's' : ''}</Text>
        </Box>
        {logs.length > 0 && (
          <Box paddingLeft={5} marginTop={1} flexDirection="column">
            {logs.map((log, i) => (
              <Box key={i} marginTop={i > 0 ? 1 : 0}>
                <Text color="cyan">{log.log_id}</Text>
                <Text color="gray"> | {log.symbol} ({log.name})</Text>
                <Text color="gray"> | Entry: ¥{log.entry_price}</Text>
                <Text color="gray"> | {log.records.length} record{log.records.length !== 1 ? 's' : ''}</Text>
              </Box>
            ))}
          </Box>
        )}
      </Box>
    )
  }

  // Fallback for unexpected data structure
  return (
    <Box flexDirection="column" paddingLeft={2}>
      <Box>
        <Text backgroundColor="gray" color="black"> IN </Text>
        <Text> Trade Log</Text>
      </Box>
      <Box marginTop={1}>
        <Text backgroundColor="gray" color="black"> OUT </Text>
        <Text color="green"> ✓ Success</Text>
      </Box>
    </Box>
  )
}

// ── Tool Definition ─────────────────────────────────────────────────────────

export const TradeLogTool = buildTool({
  name: 'trade_log',
  description: TRADE_LOG_TOOL_DESCRIPTION,
  inputSchema: {
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
            description: 'Price at event time (optional)',
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
  isReadOnly: () => false,
  checkPermissions: checkPermission,
  call: execute,
  mapToolResultToToolResultBlockParam(output, toolUseId) {
    if (!output.success) {
      return {
        type: 'tool_result',
        tool_use_id: toolUseId,
        content: `Trade log operation failed: ${output.error}`,
        is_error: true,
      }
    }

    // Format success output
    const formatted = JSON.stringify(output.data, null, 2)
    return {
      type: 'tool_result',
      tool_use_id: toolUseId,
      content: `Trade log operation successful:\n\n${formatted}`,
    }
  },
  renderToolResultMessage(output, options) {
    return renderToolResultMessage(output, { verbose: options.verbose })
  },
})

export { handleCreate, handleAppend, handleGet, handleList }
