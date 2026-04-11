#!/usr/bin/env tsx
/**
 * 批量迁移工具以适配新的 Tool 接口
 *
 * 变更：
 * 1. call() 返回 { data: T } 而不是直接返回 T
 * 2. 添加 mapToolResultToToolResultBlockParam() 方法
 */

import fs from 'fs/promises'
import path from 'path'
import { glob } from 'glob'

const TOOLS_DIR = path.join(process.cwd(), 'src/tools')

async function migrateToolFile(filePath: string) {
  console.log(`Processing: ${filePath}`)

  let content = await fs.readFile(filePath, 'utf-8')

  // 跳过已经迁移的文件（包含 mapToolResultToToolResultBlockParam）
  if (content.includes('mapToolResultToToolResultBlockParam')) {
    console.log(`  ✓ Already migrated`)
    return
  }

  // 跳过有 callWithBlocks 的文件（需要手动处理）
  if (content.includes('callWithBlocks')) {
    console.log(`  ⚠ Has callWithBlocks, skipping (manual migration needed)`)
    return
  }

  // 查找 async call( 的位置
  const callMatch = content.match(/(async call\([^)]*\)[^{]*\{)/s)
  if (!callMatch) {
    console.log(`  ✗ No call() method found`)
    return
  }

  // 查找 call 方法的结束位置（匹配对应的 }）
  const callStart = content.indexOf(callMatch[0])
  let braceCount = 0
  let inCall = false
  let callEnd = -1

  for (let i = callStart; i < content.length; i++) {
    if (content[i] === '{') {
      braceCount++
      inCall = true
    } else if (content[i] === '}') {
      braceCount--
      if (inCall && braceCount === 0) {
        callEnd = i
        break
      }
    }
  }

  if (callEnd === -1) {
    console.log(`  ✗ Could not find call() method end`)
    return
  }

  const callBody = content.substring(callStart, callEnd + 1)

  // 提取所有 return 语句
  const returnMatches = [...callBody.matchAll(/return\s+([^}]+?)(?=\n|$)/g)]

  if (returnMatches.length === 0) {
    console.log(`  ✗ No return statements found`)
    return
  }

  // 修改所有 return 语句，包装为 { data: ... }
  let newCallBody = callBody
  for (const match of returnMatches.reverse()) { // 从后往前替换，避免索引变化
    const returnValue = match[1].trim()
    // 跳过已经是对象字面量的情况
    if (returnValue.startsWith('{') && returnValue.includes('data:')) {
      continue
    }
    const newReturn = `return {\n      data: ${returnValue}\n    }`
    newCallBody = newCallBody.replace(match[0], newReturn)
  }

  // 添加 mapToolResultToToolResultBlockParam 方法
  const mapMethod = `  },
  mapToolResultToToolResultBlockParam(data, toolUseId) {
    return {
      type: 'tool_result',
      tool_use_id: toolUseId,
      content: data,
    }
  },`

  // 替换原来的 call 方法并添加新方法
  const beforeCall = content.substring(0, callStart)
  const afterCall = content.substring(callEnd + 1)

  // 查找 call 方法后的 }, 或 }) 结束符
  const closingMatch = afterCall.match(/^(\s*},?)/)
  if (!closingMatch) {
    console.log(`  ✗ Could not find closing brace after call()`)
    return
  }

  const newContent = beforeCall + newCallBody + mapMethod + afterCall.substring(closingMatch[0].length)

  await fs.writeFile(filePath, newContent, 'utf-8')
  console.log(`  ✓ Migrated successfully`)
}

async function main() {
  const toolFiles = await glob('**/*Tool.tsx', { cwd: TOOLS_DIR, absolute: true })

  console.log(`Found ${toolFiles.length} tool files\n`)

  for (const file of toolFiles) {
    try {
      await migrateToolFile(file)
    } catch (err) {
      console.error(`  ✗ Error: ${err instanceof Error ? err.message : String(err)}`)
    }
    console.log()
  }

  console.log('Migration complete!')
}

main().catch(console.error)
