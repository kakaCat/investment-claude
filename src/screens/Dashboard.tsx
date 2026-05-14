// src/screens/Dashboard.tsx
import React, { useState, useEffect } from 'react'
import { Box, useInput, useApp } from 'ink'
import { PortfolioPanel } from '../components/dashboard/PortfolioPanel.js'
import { DecisionLogPanel } from '../components/dashboard/DecisionLogPanel.js'
import { MarketPanel } from '../components/dashboard/MarketPanel.js'
import { RiskAlertsPanel } from '../components/dashboard/RiskAlertsPanel.js'
import { CommandInput } from '../components/dashboard/CommandInput.js'
import { ResultModal } from '../components/dashboard/ResultModal.js'
import { useDashboardData } from '../hooks/useDashboardData.js'
import { useAutoRefresh } from '../hooks/useAutoRefresh.js'
import { loadConfig, updateConfig } from '../utils/dashboardConfig.js'
import { calculateAlerts } from '../utils/alertCalculator.js'
import type { DashboardConfig, Command } from '../types/dashboard.js'

export function Dashboard() {
  const { exit } = useApp()
  const [config, setConfig] = useState<DashboardConfig | null>(null)
  const [commandMode, setCommandMode] = useState(false)
  const [modalContent, setModalContent] = useState<string | null>(null)

  const {
    portfolio,
    decisions,
    watchlist,
    indices,
    lastUpdate,
    loadPortfolio,
    loadDecisionLog,
    loadWatchlist,
    refreshMarketData,
  } = useDashboardData()

  // 加载初始数据
  useEffect(() => {
    const init = async () => {
      const cfg = await loadConfig()
      setConfig(cfg)
      await Promise.all([loadPortfolio(), loadDecisionLog(), loadWatchlist(), refreshMarketData()])
    }
    init()
  }, [loadPortfolio, loadDecisionLog, loadWatchlist, refreshMarketData])

  // 自动刷新
  useAutoRefresh(
    config?.refreshInterval || 60,
    refreshMarketData,
    config?.autoRefresh ?? true
  )

  // 计算风险提示
  const alerts = calculateAlerts(
    portfolio,
    decisions,
    { aStock: true, hkStock: false } // TODO: 实际检测数据源状态
  )

  // 命令解析
  const parseCommand = (input: string): Command => {
    const parts = input.trim().split(/\s+/)
    const type = parts[0] as Command['type']
    const args = parts.slice(1)
    return { type, args }
  }

  // 命令处理
  const handleCommand = async (input: string) => {
    const cmd = parseCommand(input)

    switch (cmd.type) {
      case 'refresh':
        await refreshMarketData()
        await loadPortfolio()
        setCommandMode(false)
        break

      case 'config':
        if (cmd.args.length === 2) {
          await updateConfig(cmd.args[0], cmd.args[1])
          const newConfig = await loadConfig()
          setConfig(newConfig)
        }
        setCommandMode(false)
        break

      case 'help':
        setModalContent(
          ':analyze 股票名 - 分析股票\n' +
          ':screen 条件 - 筛选股票\n' +
          ':buy 代码 数量 - 记录买入\n' +
          ':sell 代码 数量 - 记录卖出\n' +
          ':refresh - 刷新数据\n' +
          ':config key value - 修改配置\n' +
          ':quit - 退出'
        )
        setCommandMode(false)
        break

      case 'quit':
        exit()
        break

      default:
        setModalContent(`未知命令: ${cmd.type}`)
        setCommandMode(false)
    }
  }

  // 快捷键处理
  useInput((input, key) => {
    // Modal has highest priority - any key closes it
    if (modalContent) {
      setModalContent(null)
      return
    }

    // When in command mode, let CommandInput handle all input
    if (commandMode) {
      return
    }

    // Dashboard shortcuts (only when not in command mode)
    if (input === ':') {
      setCommandMode(true)
    } else if (input === 'r') {
      refreshMarketData()
      loadPortfolio()
    } else if (input === 'q') {
      exit()
    } else if (input === '?') {
      setModalContent(
        '快捷键:\n' +
        ': - 命令模式\n' +
        'r - 刷新\n' +
        'q - 退出\n' +
        '? - 帮助'
      )
    }
  })

  return (
    <Box flexDirection="column" height="100%">
      <Box flexGrow={1} flexDirection="column">
        <Box height="50%">
          <Box width="50%" borderStyle="single" borderColor="gray">
            <PortfolioPanel data={portfolio} />
          </Box>
          <Box width="50%" borderStyle="single" borderColor="gray">
            <DecisionLogPanel data={decisions} />
          </Box>
        </Box>
        <Box height="50%">
          <Box width="50%" borderStyle="single" borderColor="gray">
            <MarketPanel indices={indices} watchlist={watchlist} lastUpdate={lastUpdate} />
          </Box>
          <Box width="50%" borderStyle="single" borderColor="gray">
            <RiskAlertsPanel alerts={alerts} />
          </Box>
        </Box>
      </Box>

      {commandMode && (
        <CommandInput
          onSubmit={handleCommand}
          onCancel={() => setCommandMode(false)}
          isActive={commandMode}
        />
      )}

      {modalContent && <ResultModal content={modalContent} onClose={() => setModalContent(null)} />}
    </Box>
  )
}
