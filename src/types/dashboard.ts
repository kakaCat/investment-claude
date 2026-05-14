// src/types/dashboard.ts

export type Portfolio = {
  totalValue: number
  totalProfit: number
  profitRate: number
  holdings: Holding[]
}

export type Holding = {
  code: string
  name: string
  quantity: number
  cost: number
  currentPrice: number
  marketValue: number
  profit: number
  profitRate: number
}

export type Decision = {
  date: string
  time: string
  code: string
  name: string
  type: 'buy' | 'sell' | 'hold' | 'avoid'
  reason: string
  verifyDate?: string
}

export type Stock = {
  code: string
  name: string
  price: number
  change: number
  changeRate: number
}

export type Index = {
  name: string
  value: number
  change: number
  changeRate: number
}

export type Alert = {
  type: 'error' | 'warning' | 'info'
  category: 'data' | 'risk' | 'todo'
  message: string
}

export type DashboardState = {
  portfolio: Portfolio | null
  decisions: Decision[]
  watchlist: Stock[]
  indices: Index[]
  alerts: Alert[]
  refreshInterval: number
  commandMode: boolean
  lastUpdate?: Date
}

export type DashboardConfig = {
  refreshInterval: number
  autoRefresh: boolean
  theme: {
    profit: string
    loss: string
    neutral: string
  }
  panels: {
    portfolio: {
      maxRows: number
      sortBy: 'marketValue' | 'profitRate'
    }
    decisionLog: {
      maxRows: number
    }
    market: {
      indexCount: number
      watchlistMaxRows: number
    }
  }
}

export type Command = {
  type: 'analyze' | 'screen' | 'buy' | 'sell' | 'refresh' | 'config' | 'help' | 'quit'
  args: string[]
}
