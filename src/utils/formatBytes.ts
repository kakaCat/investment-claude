/**
 * 单位标准类型
 * - 'binary': 使用 1024 为基数，单位为 KiB, MiB, GiB 等（IEC 标准）
 * - 'decimal': 使用 1000 为基数，单位为 KB, MB, GB 等（SI 标准）
 */
export type UnitStandard = 'binary' | 'decimal'

/**
 * formatBytes 函数的配置选项
 */
export interface FormatBytesOptions {
  /**
   * 单位标准（默认 'binary'）
   * - 'binary': 1024 为基数，使用 KiB, MiB, GiB 等
   * - 'decimal': 1000 为基数，使用 KB, MB, GB 等
   */
  standard?: UnitStandard

  /**
   * 小数位数（默认 2）
   * 设置为 0 则不显示小数
   */
  decimals?: number

  /**
   * 数值和单位之间的分隔符（默认 ' '）
   */
  unitSeparator?: string
}

/**
 * 将字节数转换为人类可读的格式
 *
 * @param bytes - 字节数
 * @param decimals - 小数位数（默认 2）
 * @returns 格式化后的字符串（如 "1.5 KB"）
 *
 * @example
 * formatBytes(1024) // "1 KB"
 * formatBytes(1536, 1) // "1.5 KB"
 * formatBytes(0) // "0 Bytes"
 */
export function formatBytes(bytes: number, decimals?: number): string

/**
 * 将字节数转换为人类可读的格式（带选项）
 *
 * @param bytes - 字节数
 * @param options - 格式化选项
 * @returns 格式化后的字符串
 *
 * @example
 * formatBytes(1024, { standard: 'binary' }) // "1 KiB"
 * formatBytes(1000, { standard: 'decimal' }) // "1 KB"
 * formatBytes(1536, { decimals: 1, unitSeparator: '' }) // "1.5KB"
 */
export function formatBytes(bytes: number, options?: FormatBytesOptions): string

/**
 * 实现
 */
export function formatBytes(
  bytes: number,
  decimalsOrOptions?: number | FormatBytesOptions
): string {
  // 解析参数
  const options: FormatBytesOptions =
    typeof decimalsOrOptions === 'number'
      ? { decimals: decimalsOrOptions, standard: 'binary' }
      : decimalsOrOptions || {}

  const {
    standard = 'binary',
    decimals = 2,
    unitSeparator = ' ',
  } = options

  // 处理边界情况
  if (bytes === 0) return `0${unitSeparator}Bytes`
  if (bytes < 0) return '-' + formatBytes(-bytes, options)

  // 根据标准选择基数和单位
  const k = standard === 'decimal' ? 1000 : 1024
  const sizes =
    standard === 'decimal'
      ? ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
      : ['Bytes', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB']

  const dm = decimals < 0 ? 0 : decimals
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  // 防止超出数组范围（处理小于 1 的数和超大数）
  const sizeIndex = Math.max(0, Math.min(i, sizes.length - 1))

  const value = bytes / Math.pow(k, sizeIndex)
  const formattedValue = parseFloat(value.toFixed(dm))

  return `${formattedValue}${unitSeparator}${sizes[sizeIndex]}`
}
