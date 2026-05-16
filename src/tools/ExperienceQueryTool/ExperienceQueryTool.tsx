import React from 'react'
import { Box, Text } from 'ink'
import { readFileSync, existsSync, readdirSync } from 'fs'
import { join } from 'path'
import { buildTool, type ToolResult, type ToolUseContext } from '../../Tool.js'
import { EXPERIENCE_QUERY_TOOL_DESCRIPTION } from './prompt.js'

interface ExperienceRecord {
  source: string
  content: string
  category?: string
  timestamp?: string
}

type ExperienceQueryInput = {
  query: string
  category?: 'stock_selection' | 'timing' | 'position_sizing' | 'risk_management' | 'market_analysis'
  limit?: number
}

type ExperienceQueryOutput = {
  success: boolean
  data?: ExperienceRecord[]
  error?: string
  query?: string
  total?: number
}

// Category mapping for JSONL files
const CATEGORY_MAP: Record<string, string[]> = {
  stock_selection: ['stock_decision', 'fact', 'context'],
  timing: ['stock_decision', 'timing'],
  position_sizing: ['stock_decision', 'position'],
  risk_management: ['stock_decision', 'risk', 'bug'],
  market_analysis: ['market', 'analysis', 'context'],
}

function getMemoryBasePath(): string {
  // For testing: check test directory first
  const testPath = join(process.cwd(), '.pi-test', 'memory')
  if (existsSync(testPath)) {
    return testPath
  }

  // Check if symlink exists in current project
  const localPath = join(process.cwd(), '.pi', 'memory')
  if (existsSync(localPath)) {
    return localPath
  }

  // Fallback to pi-investment directory
  const piInvestPath = '/Users/mac/Documents/ai/pi-investment/.pi-invest/memory'
  if (existsSync(piInvestPath)) {
    return piInvestPath
  }

  throw new Error('Memory directory not found')
}

function searchDailyLogs(
  query: string,
  category?: string,
  limit: number = 10
): ExperienceRecord[] {
  const results: ExperienceRecord[] = []
  const basePath = getMemoryBasePath()
  const dailyPath = join(basePath, 'daily')

  if (!existsSync(dailyPath)) {
    return results
  }

  const files = readdirSync(dailyPath)
    .filter((f) => f.endsWith('.jsonl'))
    .sort()
    .reverse() // Most recent first

  const queryLower = query.toLowerCase()
  const categoryFilters = category ? CATEGORY_MAP[category] || [] : []

  for (const file of files) {
    if (results.length >= limit) break

    const filePath = join(dailyPath, file)
    try {
      const content = readFileSync(filePath, 'utf-8')
      const lines = content.split('\n').filter((line) => line.trim())

      for (const line of lines) {
        if (results.length >= limit) break

        try {
          const record = JSON.parse(line)
          const recordContent = record.content || ''
          const recordCategory = record.category || ''

          // Check category filter
          if (categoryFilters.length > 0) {
            const matchesCategory = categoryFilters.some((cat) =>
              recordCategory.toLowerCase().includes(cat.toLowerCase())
            )
            if (!matchesCategory) continue
          }

          // Check query match
          if (recordContent.toLowerCase().includes(queryLower)) {
            results.push({
              source: `daily/${file}`,
              content: recordContent,
              category: recordCategory,
              timestamp: record.ts || record.timestamp,
            })
          }
        } catch {
          // Skip invalid JSON lines
          continue
        }
      }
    } catch {
      // Skip files that can't be read
      continue
    }
  }

  return results
}

function searchStockMemories(
  query: string,
  limit: number = 10
): ExperienceRecord[] {
  const results: ExperienceRecord[] = []
  const basePath = getMemoryBasePath()
  const stocksPath = join(basePath, 'stocks')

  if (!existsSync(stocksPath)) {
    return results
  }

  const files = readdirSync(stocksPath).filter((f) => f.endsWith('.md'))
  const queryLower = query.toLowerCase()

  for (const file of files) {
    if (results.length >= limit) break

    const filePath = join(stocksPath, file)
    try {
      const content = readFileSync(filePath, 'utf-8')

      if (content.toLowerCase().includes(queryLower)) {
        // Extract relevant excerpt (first 200 chars containing query)
        const lines = content.split('\n')
        let excerpt = ''

        for (const line of lines) {
          if (line.toLowerCase().includes(queryLower)) {
            excerpt = line.trim()
            break
          }
        }

        if (!excerpt && content.length > 0) {
          excerpt = content.substring(0, 200).trim()
        }

        results.push({
          source: `stocks/${file}`,
          content: excerpt || content.substring(0, 200),
          category: 'stock_memory',
        })
      }
    } catch {
      // Skip files that can't be read
      continue
    }
  }

  return results
}

function searchExperiences(input: ExperienceQueryInput): ExperienceQueryOutput {
  const { query, category, limit = 10 } = input

  if (!query || query.trim().length === 0) {
    return {
      success: false,
      error: 'Query string is required',
    }
  }

  try {
    // Search both daily logs and stock memories
    const dailyResults = searchDailyLogs(query, category, limit)
    const stockResults = searchStockMemories(query, Math.max(0, limit - dailyResults.length))

    const allResults = [...dailyResults, ...stockResults].slice(0, limit)

    return {
      success: true,
      data: allResults,
      query,
      total: allResults.length,
    }
  } catch (error) {
    return {
      success: false,
      error: `Failed to search experiences: ${error}`,
    }
  }
}

// ── Tool Integration Layer ──────────────────────────────────────────────────

async function execute(
  input: ExperienceQueryInput,
  context: ToolUseContext,
): Promise<ToolResult<ExperienceQueryOutput>> {
  const result = searchExperiences(input)
  return { data: result }
}

// ── UI Rendering ────────────────────────────────────────────────────────────

function renderToolResultMessage(
  result: ExperienceQueryOutput,
  options: { verbose: boolean }
): React.ReactNode {
  // Error state
  if (!result.success) {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Box>
          <Text backgroundColor="gray" color="black"> IN </Text>
          <Text> Experience Query</Text>
        </Box>
        <Box marginTop={1}>
          <Text backgroundColor="gray" color="black"> OUT </Text>
          <Text color="red"> ✗ Error: {result.error}</Text>
        </Box>
      </Box>
    )
  }

  const experiences = result.data || []

  // Empty results
  if (experiences.length === 0) {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Box>
          <Text backgroundColor="gray" color="black"> IN </Text>
          <Text> Experience Query</Text>
        </Box>
        <Box marginTop={1}>
          <Text backgroundColor="gray" color="black"> OUT </Text>
          <Text color="yellow"> No experiences found for query: "{result.query}"</Text>
        </Box>
      </Box>
    )
  }

  // Success with results
  return (
    <Box flexDirection="column" paddingLeft={2}>
      <Box>
        <Text backgroundColor="gray" color="black"> IN </Text>
        <Text> Experience Query</Text>
      </Box>
      <Box marginTop={1}>
        <Text backgroundColor="gray" color="black"> OUT </Text>
        <Text color="green"> ✓ Found {experiences.length} experience{experiences.length !== 1 ? 's' : ''}</Text>
      </Box>
      <Box paddingLeft={5} marginTop={1} flexDirection="column">
        <Text color="gray" dimColor>Query: "{result.query}"</Text>
        {experiences.map((exp, i) => (
          <Box key={i} marginTop={1} flexDirection="column">
            <Text color="cyan">{exp.source}</Text>
            {exp.category && (
              <Text color="yellow" dimColor>
                [{exp.category}]
              </Text>
            )}
            {exp.timestamp && (
              <Text color="gray" dimColor>
                {new Date(exp.timestamp).toLocaleString('zh-CN')}
              </Text>
            )}
            <Box paddingLeft={2}>
              <Text color="white">
                {exp.content.length > 300
                  ? exp.content.substring(0, 300) + '...'
                  : exp.content}
              </Text>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  )
}

// ── Tool Definition ─────────────────────────────────────────────────────────

export const ExperienceQueryTool = buildTool({
  name: 'query_experience',
  description: EXPERIENCE_QUERY_TOOL_DESCRIPTION,
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query string',
      },
      category: {
        type: 'string',
        enum: ['stock_selection', 'timing', 'position_sizing', 'risk_management', 'market_analysis'],
        description: 'Filter by category (optional)',
      },
      limit: {
        type: 'number',
        description: 'Maximum results to return (default 10)',
        default: 10,
      },
    },
    required: ['query'],
  },
  isReadOnly: () => true,
  call: execute,
  mapToolResultToToolResultBlockParam(output, toolUseId) {
    if (!output.success) {
      return {
        type: 'tool_result',
        tool_use_id: toolUseId,
        content: `❌ 经验查询失败: ${output.error}`,
        is_error: true,
      }
    }

    const experiences = output.data || []
    if (experiences.length === 0) {
      return {
        type: 'tool_result',
        tool_use_id: toolUseId,
        content: `🔍 未找到相关经验\n\n查询关键词: "${output.query}"\n\n建议:\n• 尝试更通用的关键词\n• 检查是否有相关记录\n• 使用不同的分类筛选`,
      }
    }

    // Format results for Claude with clear structure
    let content = `✅ 找到 ${experiences.length} 条相关经验\n\n`
    content += `🔍 查询: "${output.query || 'N/A'}"`
    const inputCategory = (output as any).category // Access from original input if needed
    if (inputCategory) content += ` | 分类: ${inputCategory}`
    content += `\n\n`
    content += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`

    experiences.forEach((exp, i) => {
      content += `📌 [${i + 1}] ${exp.source}`
      if (exp.category) {
        const categoryMap: Record<string, string> = {
          stock_selection: '选股',
          timing: '择时',
          position_sizing: '仓位',
          risk_management: '风控',
          market_analysis: '市场分析',
        }
        content += ` | ${categoryMap[exp.category] || exp.category}`
      }
      content += `\n`

      if (exp.timestamp) {
        content += `   时间: ${exp.timestamp}\n`
      }

      content += `   ${exp.content}\n`

      if (i < experiences.length - 1) {
        content += `\n`
      }
    })

    content += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`
    content += `💡 提示: 这些经验可以帮助你做出更好的投资决策`

    return {
      type: 'tool_result',
      tool_use_id: toolUseId,
      content,
    }
  },
  renderToolResultMessage(output, options) {
    return renderToolResultMessage(output, { verbose: options.verbose })
  },
})

export { searchExperiences, searchDailyLogs, searchStockMemories }
