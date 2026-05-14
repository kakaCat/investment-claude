import { describe, it, expect } from 'vitest'
import { formatBytes } from '../formatBytes.js'

describe('formatBytes', () => {
  describe('基础功能', () => {
    it('should format 0 bytes', () => {
      expect(formatBytes(0)).toBe('0 Bytes')
    })

    it('should format bytes', () => {
      expect(formatBytes(500)).toBe('500 Bytes')
      expect(formatBytes(1023)).toBe('1023 Bytes')
    })

    it('should handle negative numbers', () => {
      expect(formatBytes(-1024)).toBe('-1 KiB')
      expect(formatBytes(-1536)).toBe('-1.5 KiB')
    })

    it('should handle very large numbers', () => {
      expect(formatBytes(1024 ** 8)).toBe('1 YiB')
    })
  })

  describe('向后兼容性（默认 binary 标准）', () => {
    it('should format KiB (binary)', () => {
      expect(formatBytes(1024)).toBe('1 KiB')
      expect(formatBytes(1536)).toBe('1.5 KiB')
    })

    it('should format MiB (binary)', () => {
      expect(formatBytes(1048576)).toBe('1 MiB')
      expect(formatBytes(1572864)).toBe('1.5 MiB')
    })

    it('should format GiB (binary)', () => {
      expect(formatBytes(1073741824)).toBe('1 GiB')
    })

    it('should respect decimal places with number parameter', () => {
      expect(formatBytes(1536, 0)).toBe('2 KiB')
      expect(formatBytes(1536, 1)).toBe('1.5 KiB')
      expect(formatBytes(1536, 3)).toBe('1.5 KiB')
    })
  })

  describe('Binary 标准 (1024, KiB/MiB/GiB)', () => {
    it('should use binary units', () => {
      expect(formatBytes(1024, { standard: 'binary' })).toBe('1 KiB')
      expect(formatBytes(1048576, { standard: 'binary' })).toBe('1 MiB')
      expect(formatBytes(1073741824, { standard: 'binary' })).toBe('1 GiB')
      expect(formatBytes(1099511627776, { standard: 'binary' })).toBe('1 TiB')
    })

    it('should calculate correctly with binary base', () => {
      expect(formatBytes(1536, { standard: 'binary' })).toBe('1.5 KiB')
      expect(formatBytes(2048, { standard: 'binary' })).toBe('2 KiB')
      expect(formatBytes(2560, { standard: 'binary', decimals: 1 })).toBe('2.5 KiB')
    })
  })

  describe('Decimal 标准 (1000, KB/MB/GB)', () => {
    it('should use decimal units', () => {
      expect(formatBytes(1000, { standard: 'decimal' })).toBe('1 KB')
      expect(formatBytes(1000000, { standard: 'decimal' })).toBe('1 MB')
      expect(formatBytes(1000000000, { standard: 'decimal' })).toBe('1 GB')
      expect(formatBytes(1000000000000, { standard: 'decimal' })).toBe('1 TB')
    })

    it('should calculate correctly with decimal base', () => {
      expect(formatBytes(1500, { standard: 'decimal' })).toBe('1.5 KB')
      expect(formatBytes(2000, { standard: 'decimal' })).toBe('2 KB')
      expect(formatBytes(2500, { standard: 'decimal', decimals: 1 })).toBe('2.5 KB')
    })

    it('should show difference between binary and decimal', () => {
      const bytes = 1024
      expect(formatBytes(bytes, { standard: 'binary' })).toBe('1 KiB')
      expect(formatBytes(bytes, { standard: 'decimal' })).toBe('1.02 KB')
    })
  })

  describe('精度控制', () => {
    it('should respect decimals option', () => {
      expect(formatBytes(1536, { decimals: 0 })).toBe('2 KiB')
      expect(formatBytes(1536, { decimals: 1 })).toBe('1.5 KiB')
      expect(formatBytes(1536, { decimals: 2 })).toBe('1.5 KiB')
      expect(formatBytes(1536, { decimals: 3 })).toBe('1.5 KiB')
    })

    it('should handle negative decimals', () => {
      expect(formatBytes(1536, { decimals: -1 })).toBe('2 KiB')
    })

    it('should work with decimal standard', () => {
      expect(formatBytes(1500, { standard: 'decimal', decimals: 0 })).toBe('2 KB')
      expect(formatBytes(1500, { standard: 'decimal', decimals: 1 })).toBe('1.5 KB')
      expect(formatBytes(1234, { standard: 'decimal', decimals: 3 })).toBe('1.234 KB')
    })
  })

  describe('单位分隔符', () => {
    it('should use custom unit separator', () => {
      expect(formatBytes(1024, { unitSeparator: '' })).toBe('1KiB')
      expect(formatBytes(1024, { unitSeparator: '_' })).toBe('1_KiB')
      expect(formatBytes(1024, { unitSeparator: ' - ' })).toBe('1 - KiB')
    })

    it('should apply separator to zero bytes', () => {
      expect(formatBytes(0, { unitSeparator: '' })).toBe('0Bytes')
      expect(formatBytes(0, { unitSeparator: '_' })).toBe('0_Bytes')
    })

    it('should work with negative numbers', () => {
      expect(formatBytes(-1024, { unitSeparator: '' })).toBe('-1KiB')
    })
  })

  describe('组合选项', () => {
    it('should combine standard, decimals, and separator', () => {
      expect(
        formatBytes(1234567, {
          standard: 'decimal',
          decimals: 1,
          unitSeparator: '',
        })
      ).toBe('1.2MB')

      expect(
        formatBytes(1234567, {
          standard: 'binary',
          decimals: 3,
          unitSeparator: ' ',
        })
      ).toBe('1.177 MiB')
    })
  })

  describe('边界情况', () => {
    it('should handle very small positive numbers', () => {
      expect(formatBytes(1)).toBe('1 Bytes')
      expect(formatBytes(0.5)).toBe('0.5 Bytes')
    })

    it('should handle numbers at unit boundaries', () => {
      expect(formatBytes(1024, { standard: 'binary', decimals: 0 })).toBe('1 KiB')
      expect(formatBytes(1023, { standard: 'binary', decimals: 0 })).toBe('1023 Bytes')

      expect(formatBytes(1000, { standard: 'decimal', decimals: 0 })).toBe('1 KB')
      expect(formatBytes(999, { standard: 'decimal', decimals: 0 })).toBe('999 Bytes')
    })

    it('should not exceed maximum unit', () => {
      const hugeNumber = 1024 ** 10 // 超过 YiB
      const result = formatBytes(hugeNumber, { standard: 'binary' })
      expect(result).toContain('YiB')
    })
  })

  describe('所有单位级别', () => {
    it('should format all binary units', () => {
      expect(formatBytes(1, { standard: 'binary' })).toBe('1 Bytes')
      expect(formatBytes(1024, { standard: 'binary' })).toBe('1 KiB')
      expect(formatBytes(1024 ** 2, { standard: 'binary' })).toBe('1 MiB')
      expect(formatBytes(1024 ** 3, { standard: 'binary' })).toBe('1 GiB')
      expect(formatBytes(1024 ** 4, { standard: 'binary' })).toBe('1 TiB')
      expect(formatBytes(1024 ** 5, { standard: 'binary' })).toBe('1 PiB')
      expect(formatBytes(1024 ** 6, { standard: 'binary' })).toBe('1 EiB')
      expect(formatBytes(1024 ** 7, { standard: 'binary' })).toBe('1 ZiB')
      expect(formatBytes(1024 ** 8, { standard: 'binary' })).toBe('1 YiB')
    })

    it('should format all decimal units', () => {
      expect(formatBytes(1, { standard: 'decimal' })).toBe('1 Bytes')
      expect(formatBytes(1000, { standard: 'decimal' })).toBe('1 KB')
      expect(formatBytes(1000 ** 2, { standard: 'decimal' })).toBe('1 MB')
      expect(formatBytes(1000 ** 3, { standard: 'decimal' })).toBe('1 GB')
      expect(formatBytes(1000 ** 4, { standard: 'decimal' })).toBe('1 TB')
      expect(formatBytes(1000 ** 5, { standard: 'decimal' })).toBe('1 PB')
      expect(formatBytes(1000 ** 6, { standard: 'decimal' })).toBe('1 EB')
      expect(formatBytes(1000 ** 7, { standard: 'decimal' })).toBe('1 ZB')
      expect(formatBytes(1000 ** 8, { standard: 'decimal' })).toBe('1 YB')
    })
  })
})
