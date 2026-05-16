import { describe, it, expect, beforeEach, vi } from 'vitest'
import { handleCreate, handleAppend, handleGet, handleList } from '../TradeLogTool.js'
import * as fs from 'fs'
import * as path from 'path'

// Mock fs module
vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  readdirSync: vi.fn(),
}))

describe('TradeLogTool', () => {
  const mockTradeLog = {
    log_id: 'AAPL_1234567890',
    symbol: 'AAPL',
    name: 'Apple Inc.',
    entry_price: 150.5,
    entry_date: '2024-01-15',
    notes: 'Initial position',
    created_at: '2024-01-15T10:00:00.000Z',
    records: [],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.mkdirSync).mockReturnValue(undefined)
  })

  describe('handleCreate', () => {
    it('should create a new trade log successfully', () => {
      vi.mocked(fs.existsSync).mockReturnValueOnce(true).mockReturnValueOnce(false)
      vi.mocked(fs.writeFileSync).mockReturnValue(undefined)

      const result = handleCreate({
        action: 'create',
        symbol: 'AAPL',
        name: 'Apple Inc.',
        entry_price: 150.5,
        entry_date: '2024-01-15',
        notes: 'Initial position',
      })

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data?.symbol).toBe('AAPL')
      expect(result.data?.name).toBe('Apple Inc.')
      expect(result.data?.entry_price).toBe(150.5)
      expect(result.data?.entry_date).toBe('2024-01-15')
      expect(result.data?.notes).toBe('Initial position')
      expect(result.data?.records).toEqual([])
      expect(fs.writeFileSync).toHaveBeenCalledOnce()
    })

    it('should create trade log with empty notes when notes not provided', () => {
      vi.mocked(fs.existsSync).mockReturnValueOnce(true).mockReturnValueOnce(false)
      vi.mocked(fs.writeFileSync).mockReturnValue(undefined)

      const result = handleCreate({
        action: 'create',
        symbol: 'AAPL',
        name: 'Apple Inc.',
        entry_price: 150.5,
        entry_date: '2024-01-15',
      })

      expect(result.success).toBe(true)
      expect(result.data?.notes).toBe('')
    })

    it('should fail when symbol is missing', () => {
      const result = handleCreate({
        action: 'create',
        name: 'Apple Inc.',
        entry_price: 150.5,
        entry_date: '2024-01-15',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Missing required fields: symbol, name, entry_price, entry_date')
    })

    it('should fail when name is missing', () => {
      const result = handleCreate({
        action: 'create',
        symbol: 'AAPL',
        entry_price: 150.5,
        entry_date: '2024-01-15',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Missing required fields: symbol, name, entry_price, entry_date')
    })

    it('should fail when entry_price is missing', () => {
      const result = handleCreate({
        action: 'create',
        symbol: 'AAPL',
        name: 'Apple Inc.',
        entry_date: '2024-01-15',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Missing required fields: symbol, name, entry_price, entry_date')
    })

    it('should fail when entry_date is missing', () => {
      const result = handleCreate({
        action: 'create',
        symbol: 'AAPL',
        name: 'Apple Inc.',
        entry_price: 150.5,
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Missing required fields: symbol, name, entry_price, entry_date')
    })

    it('should fail when file write fails', () => {
      vi.mocked(fs.existsSync).mockReturnValueOnce(true).mockReturnValueOnce(false)
      vi.mocked(fs.writeFileSync).mockImplementation(() => {
        throw new Error('Write failed')
      })

      const result = handleCreate({
        action: 'create',
        symbol: 'AAPL',
        name: 'Apple Inc.',
        entry_price: 150.5,
        entry_date: '2024-01-15',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Failed to create trade log')
    })

    it('should fail when trade log already exists', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)

      const result = handleCreate({
        action: 'create',
        symbol: 'AAPL',
        name: 'Apple Inc.',
        entry_price: 150.5,
        entry_date: '2024-01-15',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Trade log already exists')
    })

    it('should sanitize log_id by removing special characters', () => {
      vi.mocked(fs.existsSync).mockReturnValueOnce(true).mockReturnValueOnce(false)
      vi.mocked(fs.writeFileSync).mockReturnValue(undefined)

      const result = handleCreate({
        action: 'create',
        symbol: 'AAPL@#$',
        name: 'Apple Inc.',
        entry_price: 150.5,
        entry_date: '2024-01-15',
      })

      expect(result.success).toBe(true)
      expect(result.data?.log_id).toMatch(/^AAPL_\d+$/)
    })
  })

  describe('handleAppend', () => {
    it('should append record to existing trade log successfully', () => {
      const existingLog = { ...mockTradeLog }
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(existingLog))
      vi.mocked(fs.writeFileSync).mockReturnValue(undefined)

      const result = handleAppend({
        action: 'append',
        log_id: 'AAPL_1234567890',
        record: {
          date: '2024-01-20',
          event: 'Price increase',
          price: 155.0,
          notes: 'Good momentum',
        },
      })

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data?.records).toHaveLength(1)
      expect(result.data?.records[0].date).toBe('2024-01-20')
      expect(result.data?.records[0].event).toBe('Price increase')
      expect(result.data?.records[0].price).toBe(155.0)
      expect(result.data?.records[0].notes).toBe('Good momentum')
      expect(result.data?.records[0].timestamp).toBeDefined()
      expect(fs.writeFileSync).toHaveBeenCalledOnce()
    })

    it('should append record without optional fields', () => {
      const existingLog = { ...mockTradeLog }
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(existingLog))
      vi.mocked(fs.writeFileSync).mockReturnValue(undefined)

      const result = handleAppend({
        action: 'append',
        log_id: 'AAPL_1234567890',
        record: {
          date: '2024-01-20',
          event: 'Price increase',
        },
      })

      expect(result.success).toBe(true)
      expect(result.data?.records[0].price).toBeUndefined()
      expect(result.data?.records[0].notes).toBe('')
    })

    it('should fail when log_id is missing', () => {
      const result = handleAppend({
        action: 'append',
        record: {
          date: '2024-01-20',
          event: 'Price increase',
        },
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Missing required fields: log_id, record')
    })

    it('should fail when record is missing', () => {
      const result = handleAppend({
        action: 'append',
        log_id: 'AAPL_1234567890',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Missing required fields: log_id, record')
    })

    it('should fail when record.date is missing', () => {
      const result = handleAppend({
        action: 'append',
        log_id: 'AAPL_1234567890',
        record: {
          date: '',
          event: 'Price increase',
        },
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Record must have date and event fields')
    })

    it('should fail when record.event is missing', () => {
      const result = handleAppend({
        action: 'append',
        log_id: 'AAPL_1234567890',
        record: {
          date: '2024-01-20',
          event: '',
        },
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Record must have date and event fields')
    })

    it('should fail when log file not found', () => {
      vi.mocked(fs.existsSync).mockReturnValueOnce(true).mockReturnValueOnce(false)

      const result = handleAppend({
        action: 'append',
        log_id: 'AAPL_1234567890',
        record: {
          date: '2024-01-20',
          event: 'Price increase',
        },
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Trade log not found')
    })

    it('should fail when log file contains invalid JSON', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readFileSync).mockReturnValue('invalid json')

      const result = handleAppend({
        action: 'append',
        log_id: 'AAPL_1234567890',
        record: {
          date: '2024-01-20',
          event: 'Price increase',
        },
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Trade log not found')
    })

    it('should fail when file write fails', () => {
      const existingLog = { ...mockTradeLog }
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(existingLog))
      vi.mocked(fs.writeFileSync).mockImplementation(() => {
        throw new Error('Write failed')
      })

      const result = handleAppend({
        action: 'append',
        log_id: 'AAPL_1234567890',
        record: {
          date: '2024-01-20',
          event: 'Price increase',
        },
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Failed to append record')
    })

    it('should append multiple records sequentially', () => {
      const existingLog = { ...mockTradeLog }
      vi.mocked(fs.existsSync).mockReturnValue(true)

      // First append
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(existingLog))
      vi.mocked(fs.writeFileSync).mockReturnValue(undefined)

      const result1 = handleAppend({
        action: 'append',
        log_id: 'AAPL_1234567890',
        record: {
          date: '2024-01-20',
          event: 'First event',
        },
      })

      expect(result1.success).toBe(true)
      expect(result1.data?.records).toHaveLength(1)

      // Second append
      const updatedLog = { ...existingLog, records: result1.data!.records }
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(updatedLog))

      const result2 = handleAppend({
        action: 'append',
        log_id: 'AAPL_1234567890',
        record: {
          date: '2024-01-21',
          event: 'Second event',
        },
      })

      expect(result2.success).toBe(true)
      expect(result2.data?.records).toHaveLength(2)
    })
  })

  describe('handleGet', () => {
    it('should retrieve existing trade log successfully', () => {
      const existingLog = { ...mockTradeLog }
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(existingLog))

      const result = handleGet({
        action: 'get',
        log_id: 'AAPL_1234567890',
      })

      expect(result.success).toBe(true)
      expect(result.data).toEqual(existingLog)
    })

    it('should fail when log_id is missing', () => {
      const result = handleGet({
        action: 'get',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Missing required field: log_id')
    })

    it('should fail when log file not found', () => {
      vi.mocked(fs.existsSync).mockReturnValueOnce(true).mockReturnValueOnce(false)

      const result = handleGet({
        action: 'get',
        log_id: 'AAPL_1234567890',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Trade log not found')
    })

    it('should fail when log file contains invalid JSON', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readFileSync).mockReturnValue('invalid json')

      const result = handleGet({
        action: 'get',
        log_id: 'AAPL_1234567890',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Trade log not found')
    })

    it('should sanitize log_id before lookup', () => {
      const existingLog = { ...mockTradeLog }
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(existingLog))

      const result = handleGet({
        action: 'get',
        log_id: 'AAPL@#$_1234567890',
      })

      expect(result.success).toBe(true)
      expect(fs.readFileSync).toHaveBeenCalled()
    })
  })

  describe('handleList', () => {
    it('should list all trade logs successfully', () => {
      const log1 = { ...mockTradeLog, log_id: 'AAPL_1234567890' }
      const log2 = { ...mockTradeLog, log_id: 'GOOGL_9876543210', symbol: 'GOOGL', name: 'Google' }

      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readdirSync).mockReturnValue(['AAPL_1234567890.json', 'GOOGL_9876543210.json'] as any)
      vi.mocked(fs.readFileSync)
        .mockReturnValueOnce(JSON.stringify(log1))
        .mockReturnValueOnce(JSON.stringify(log2))

      const result = handleList()

      expect(result.success).toBe(true)
      expect(result.data).toHaveLength(2)
      expect(result.data).toEqual([log1, log2])
    })

    it('should return empty array when directory is empty', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readdirSync).mockReturnValue([] as any)

      const result = handleList()

      expect(result.success).toBe(true)
      expect(result.data).toEqual([])
    })

    it('should filter out non-JSON files', () => {
      const log1 = { ...mockTradeLog }

      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readdirSync).mockReturnValue([
        'AAPL_1234567890.json',
        'README.md',
        'backup.txt',
      ] as any)
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(log1))

      const result = handleList()

      expect(result.success).toBe(true)
      expect(result.data).toHaveLength(1)
      expect(fs.readFileSync).toHaveBeenCalledTimes(1)
    })

    it('should skip files with invalid JSON', () => {
      const log1 = { ...mockTradeLog, log_id: 'AAPL_1234567890' }

      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readdirSync).mockReturnValue([
        'AAPL_1234567890.json',
        'INVALID_9876543210.json',
      ] as any)
      vi.mocked(fs.readFileSync)
        .mockReturnValueOnce(JSON.stringify(log1))
        .mockReturnValueOnce('invalid json')

      const result = handleList()

      expect(result.success).toBe(true)
      expect(result.data).toHaveLength(1)
      expect(result.data).toEqual([log1])
    })

    it('should fail when directory read fails', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readdirSync).mockImplementation(() => {
        throw new Error('Read failed')
      })

      const result = handleList()

      expect(result.success).toBe(false)
      expect(result.error).toContain('Failed to list trade logs')
    })

    it('should create directory if it does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValueOnce(false)
      vi.mocked(fs.mkdirSync).mockReturnValue(undefined)
      vi.mocked(fs.readdirSync).mockReturnValue([] as any)

      const result = handleList()

      expect(fs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('.pi/trade-log'),
        { recursive: true }
      )
      expect(result.success).toBe(true)
    })
  })
})
