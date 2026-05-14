// src/components/dashboard/Table.tsx
import React from 'react'
import { Box, Text } from 'ink'

type TableProps = {
  headers: string[]
  rows: string[][]
  columnWidths: number[]
  colorize?: (row: string[], rowIndex: number) => (string | undefined)[]
}

export function Table({ headers, rows, columnWidths, colorize }: TableProps) {
  const formatRow = (cells: string[]) => {
    return cells.map((cell, i) => {
      const width = columnWidths[i] || 10
      return cell.padEnd(width).slice(0, width)
    }).join('  ')
  }

  return (
    <Box flexDirection="column">
      <Text bold color="cyan">{formatRow(headers)}</Text>
      {rows.map((row, i) => {
        const colors = colorize ? colorize(row, i) : []
        const formattedRow = formatRow(row)

        if (colors.length === 0) {
          return <Text key={i}>{formattedRow}</Text>
        }

        return (
          <Box key={i}>
            {row.map((cell, j) => {
              const width = columnWidths[j] || 10
              const paddedCell = cell.padEnd(width).slice(0, width)
              return (
                <Text key={j} color={colors[j]}>
                  {paddedCell}
                  {j < row.length - 1 ? '  ' : ''}
                </Text>
              )
            })}
          </Box>
        )
      })}
    </Box>
  )
}
