export async function gatewayCmd(): Promise<void> {
  const { runGateway } = await import('./runner.js')
  await runGateway()
}
