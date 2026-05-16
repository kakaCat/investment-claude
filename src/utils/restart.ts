import { spawn, execSync } from 'child_process'
import { join, dirname } from 'path'
import { writeFileSync, mkdirSync, existsSync, unlinkSync } from 'fs'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = join(__dirname, '..', '..')
const RESTART_DIR = join(PROJECT_ROOT, '.restart')
const CONTEXT_FILE = join(RESTART_DIR, 'context.json')

interface RestartContext {
  timestamp: string
  cwd: string
  reason: string
  env: {
    NODE_ENV?: string
  }
}

function getSpawnCommand(): { cmd: string; args: string[] } {
  const localTsx = join(PROJECT_ROOT, 'node_modules', '.bin', 'tsx')
  const tsxBin = existsSync(localTsx) ? localTsx : 'tsx'

  const entryFile = process.argv[1]
  if (entryFile && entryFile !== process.argv[0] && entryFile.endsWith('.tsx')) {
    return {
      cmd: tsxBin,
      args: [entryFile]
    }
  }

  return {
    cmd: tsxBin,
    args: [join(PROJECT_ROOT, 'src', 'entrypoints', 'cli.tsx')]
  }
}

export async function performRestart(preserveContext: boolean): Promise<void> {
  if (preserveContext) {
    try {
      if (!existsSync(RESTART_DIR)) {
        mkdirSync(RESTART_DIR, { recursive: true })
      }

      const context: RestartContext = {
        timestamp: new Date().toISOString(),
        cwd: process.cwd(),
        reason: 'user_requested_restart',
        env: {
          NODE_ENV: process.env.NODE_ENV || 'development'
        }
      }

      writeFileSync(CONTEXT_FILE, JSON.stringify(context, null, 2), 'utf-8')
    } catch (e) {
      console.error('[restart] 保存上下文失败:', e)
    }
  } else {
    try {
      if (existsSync(CONTEXT_FILE)) {
        unlinkSync(CONTEXT_FILE)
      }
    } catch {
      // ignore
    }
  }

  const { cmd, args } = getSpawnCommand()

  const tsxExists = existsSync(cmd) || cmd === 'tsx'
  if (!tsxExists) {
    console.warn(`[restart] 警告: ${cmd} 不存在，尝试使用全局 tsx`)
  }

  const child = spawn(cmd, args, {
    cwd: process.cwd(),
    stdio: 'inherit',
    detached: true,
    env: {
      ...process.env,
      PI_RESTARTED: 'true',
      PI_RESTART_TIMESTAMP: new Date().toISOString()
    }
  })

  let spawnFailed = false
  child.on('error', (err: NodeJS.ErrnoException) => {
    spawnFailed = true
    console.error(`[restart] 新进程启动失败: ${err.message}`)
  })

  child.unref()

  setImmediate(() => {
    if (spawnFailed) {
      console.log('[restart] 新进程启动失败，当前进程继续运行')
      return
    }
    process.exit(0)
  })
}
