import { describe, expect, it, vi } from 'vitest'

const runGateway = vi.fn(async () => {})

vi.mock('./runner.js', () => ({
  runGateway,
}))

import { gatewayCmd } from './cmd.js'

describe('gatewayCmd', () => {
  it('delegates to runGateway', async () => {
    await gatewayCmd()

    expect(runGateway).toHaveBeenCalledTimes(1)
  })
})
