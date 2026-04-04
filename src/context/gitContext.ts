import { execSync } from 'child_process'

const MAX_GIT_CHARS = 2000

function run(cmd: string, cwd: string): string {
  try {
    return execSync(cmd, { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
  } catch {
    return ''
  }
}

export async function loadGitStatus(cwd: string): Promise<string | null> {
  // 先检查是否在 git 仓库内
  const rootCheck = run('git rev-parse --show-toplevel', cwd)
  if (!rootCheck) return null

  const branch = run('git rev-parse --abbrev-ref HEAD', cwd)
  const mainBranch = run('git rev-parse --abbrev-ref origin/HEAD', cwd).replace('origin/', '') || 'main'
  const user = run('git config user.name', cwd)
  const log = run('git log --oneline -5', cwd)
  const status = run('git status --short', cwd)

  const lines = [
    '# Git Status',
    `Current branch: ${branch}`,
    `Main branch: ${mainBranch}`,
    ...(user ? [`Git user: ${user}`] : []),
    '',
    'Recent commits:',
    ...log.split('\n').map((line) => `  ${line}`),
  ]

  if (status) {
    lines.push('', 'Changed files:')
    lines.push(...status.split('\n').map((line) => `  ${line}`))
  }

  const result = lines.join('\n')
  return result.length > MAX_GIT_CHARS ? `${result.slice(0, MAX_GIT_CHARS)}\n  ...(truncated)` : result
}
