// src/utils/alertCalculator.ts
import type { Alert, Portfolio, Decision } from '../types/dashboard.js'

export function calculateAlerts(
  portfolio: Portfolio | null,
  decisions: Decision[],
  dataSourceStatus: { aStock: boolean; hkStock: boolean }
): Alert[] {
  const alerts: Alert[] = []

  // 数据源状态检查
  if (dataSourceStatus.aStock) {
    alerts.push({
      type: 'info',
      category: 'data',
      message: '✅ A股数据正常',
    })
  } else {
    alerts.push({
      type: 'error',
      category: 'data',
      message: '❌ A股数据不可用',
    })
  }

  if (dataSourceStatus.hkStock) {
    alerts.push({
      type: 'info',
      category: 'data',
      message: '✅ 港股数据正常',
    })
  } else {
    alerts.push({
      type: 'error',
      category: 'data',
      message: '❌ 港股数据不可用 (akshare故障)',
    })
  }

  // 持仓风险检查
  if (portfolio) {
    for (const holding of portfolio.holdings) {
      // 盈亏超过±30%
      if (holding.profitRate > 30) {
        alerts.push({
          type: 'warning',
          category: 'risk',
          message: `• ${holding.name}(${holding.code}) 盈亏+${holding.profitRate.toFixed(1)}%，建议止盈`,
        })
      } else if (holding.profitRate < -30) {
        alerts.push({
          type: 'warning',
          category: 'risk',
          message: `• ${holding.name}(${holding.code}) 盈亏${holding.profitRate.toFixed(1)}%，建议止损`,
        })
      }

      // 单只股票市值占比超过30%
      const ratio = (holding.marketValue / portfolio.totalValue) * 100
      if (ratio > 30) {
        alerts.push({
          type: 'warning',
          category: 'risk',
          message: `• ${holding.name}(${holding.code}) 占比${ratio.toFixed(1)}%，重仓风险`,
        })
      }
    }
  }

  // 待验证决策
  const now = new Date()
  const pendingDecisions = decisions.filter((d) => {
    if (!d.verifyDate) return false
    const verifyDate = new Date(d.verifyDate)
    return verifyDate > now
  })

  if (pendingDecisions.length > 0) {
    for (const decision of pendingDecisions) {
      alerts.push({
        type: 'info',
        category: 'todo',
        message: `• ${decision.verifyDate} 复盘: ${decision.name}${decision.type}决策`,
      })
    }
  }

  return alerts
}
