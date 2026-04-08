import { randomBytes } from 'crypto'

let _sessionId: string | undefined

function generateSessionId(): string {
  const now = new Date()
  const ts =
    String(now.getFullYear()) +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0') +
    String(now.getHours()).padStart(2, '0') +
    String(now.getMinutes()).padStart(2, '0') +
    String(now.getSeconds()).padStart(2, '0')
  const short = randomBytes(3).toString('hex') // 6 chars
  return `${ts}-${short}`
}

export function getSessionId(): string {
  if (!_sessionId) _sessionId = generateSessionId()
  return _sessionId
}
