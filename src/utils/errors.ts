export function getErrnoCode(e: unknown): string | undefined {
  return (e as NodeJS.ErrnoException).code
}
