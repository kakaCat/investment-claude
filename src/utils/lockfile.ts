import { createRequire } from 'module'

import type { LockOptions, UnlockOptions } from 'proper-lockfile'

type Lockfile = typeof import('proper-lockfile')

const require = createRequire(import.meta.url)

let _lockfile: Lockfile | undefined

function getLockfile(): Lockfile {
  if (!_lockfile) {
    _lockfile = require('proper-lockfile') as Lockfile
  }
  return _lockfile
}

export function lock(
  file: string,
  options?: LockOptions,
): Promise<() => Promise<void>> {
  return getLockfile().lock(file, options)
}

export function unlock(file: string, options?: UnlockOptions): Promise<void> {
  return getLockfile().unlock(file, options)
}
