#!/usr/bin/env node
/**
 * 批量迁移工具以适配新的 Tool 接口
 *
 * 变更：
 * 1. call() 返回 { data: T } 而不是直接返回 T
 * 2. 添加 mapToolResultToToolResultBlockParam() 方法
 */

import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TOOLS_DIR = path.join(__dirname, '../src/tools')

async function migrateToolFile(filePath) {
  const fileName = path.basename(filePath)
  console.log(`\nProcessing: ${fileName}`)

  let content = await fs.readFile(filePath, 'utf-8')

  // 跳过已经迁移的文件
  if (content.includes('mapToolResultToToolResultBlockParam')) {
    console.log(`  ✓ Already migrated`)
    return
  }

  // 跳过有 callWithBlocks 的文件（需要手动处理）
  if (content.includes('callWithBlocks')) {
    console.log(`  ⚠ Has callWithBlocks, skipping`)
    return
  }

  // 简单的正则替换：将所有 return 语句包装为 { data: ... }
  // 匹配模式：return 后面跟着非 { 开头的内容
  const returnPattern = /(\n\s+)return\s+(?!{)([^\n]+)/g

  let modified = false
  const newContent = content.replace(returnPattern, (match, indent, value) => {
    // 跳过已经是对象字面量的情况
    if (value.trim().startsWith('{')) {
      return match
    }
    modified = true
    return `${indent}return {\n${indent}  data: ${value}\n${indent}}`
  })

  if (!modified) {
    console.log(`  ✗ No return statements modified`)
    return
  }

  // 添加 mapToolResultToToolResultBlockParam 方法
  // 查找最后一个 }, 或 }) 在 buildTool 调用中
  const buildToolEndPattern = /(\n\s+async call\([^)]*\)[^}]*\{[\s\S]*?\n\s+}\s*,?)(\n\s*}\))/

  const finalContent = newContent.replace(buildToolEndPattern, (match, callMethod, closing) => {
    return `${callMethod}
  mapToolResultToToolResultBlockParam(data, toolUseId) {
    return {
      type: 'tool_result',
      tool_use_id: toolUseId,
      content: data,
    }
  },${closing}`
  })

  if (finalContent === newContent) {
    console.log(`  ✗ Could not add mapToolResultToToolResultBlockParam`)
    return
  }

  await fs.writeFile(filePath, finalContent, 'utf-8')
  console.log(`  ✓ Migrated successfully`)
}

async function main() {
  const entries = await fs.readdir(TOOLS_DIR, { withFileTypes: true })

  const toolDirs = entries.filter(e => e.isDirectory())

  console.log(`Found ${toolDirs.length} tool directories\n`)

  for (const dir of toolDirs) {
    const toolFile = path.join(TOOLS_DIR, dir.name, `${dir.name}.tsx`)
    try {
      await fs.access(toolFile)
      await migrateToolFile(toolFile)
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.error(`  ✗ Error: ${err.message}`)
      }
    }
  }

  console.log('\n✅ Migration complete!')
}

main().catch(console.error)
