# 半自动量化投资 Agent 系统设计

> 技术手段获取信息 → Agent 分析决策 → 通知用户 → 用户确认 → 执行交易

**版本**: v1.0
**日期**: 2026-04-14
**定位**: 半自动交易 - 决策辅助 + 人工确认

---

## 🎯 核心理念

**人机协作，安全第一**

- ✅ Agent 负责：数据获取、量化分析、策略执行、风险计算
- ✅ 用户负责：最终决策、交易确认、资金管理
- ✅ 通知机制：飞书/微信/邮件实时推送交易信号
- ✅ 风控保护：多重检查、止损保护、仓位限制

---

## 📊 系统架构

```
┌─────────────────────────────────────────────────────────┐
│                    数据采集层                             │
│  - 实时行情（Sina/Eastmoney）                            │
│  - 财务数据（Akshare）                                    │
│  - 技术指标（TS Native）                                  │
│  - 新闻舆情（爬虫/API）                                   │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                    分析决策层                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Market       │  │ Stock        │  │ Technical    │  │
│  │ Analyst      │  │ Screener     │  │ Analyst      │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Risk         │  │ Quant        │  │ Portfolio    │  │
│  │ Manager      │  │ Strategist   │  │ Manager      │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                          ↓                               │
│                   Team Lead (投资总监)                    │
│                   - 汇总分析                              │
│                   - 生成交易信号                          │
│                   - 风险检查                              │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                    通知推送层                             │
│  - 飞书 Bot 推送交易信号                                  │
│  - 包含：股票代码、操作类型、建议价格、仓位、理由          │
│  - 用户点击【确认】或【拒绝】按钮                          │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                    执行记录层                             │
│  - 记录虚拟持仓（portfolio.json）                         │
│  - 记录交易历史（trades.json）                            │
│  - 计算收益和绩效                                         │
│  - 生成复盘报告                                           │
└─────────────────────────────────────────────────────────┘
```

---

## 🔄 工作流程

### 场景 1: 主动选股推荐

```
1. 定时任务触发（每日 9:00）
   ↓
2. Market Analyst 分析市场环境
   - 判断市场阶段（牛市/熊市/震荡）
   - 识别热点板块
   - 计算市场温度
   ↓
3. Stock Screener 筛选优质股票
   - 基本面筛选（ROE > 15%, 负债率 < 50%）
   - 估值筛选（PE < 30, PB < 5）
   - 质量评分 > 80
   ↓
4. Technical Analyst 确认技术面
   - 趋势向上
   - 突破关键位
   - 资金流入
   ↓
5. Risk Manager 计算仓位
   - 凯利公式计算最优仓位
   - 检查组合集中度
   - 设置止损止盈
   ↓
6. Team Lead 生成交易信号
   {
     "action": "buy",
     "symbol": "600519",
     "name": "贵州茅台",
     "price_range": [1800, 1850],
     "position": "10%",
     "stop_loss": 1750,
     "take_profit": 2000,
     "reasoning": "基本面优秀(92分)，技术面突破(85分)，市场环境良好"
   }
   ↓
7. 飞书推送通知
   ━━━━━━━━━━━━━━━━━━━━━━
   📈 交易信号 - 买入推荐
   ━━━━━━━━━━━━━━━━━━━━━━
   股票: 贵州茅台 (600519)
   操作: 买入
   价格区间: 1800-1850
   建议仓位: 10%
   止损价: 1750
   止盈价: 2000

   📊 分析依据:
   - 基本面评分: 92/100
   - 技术面评分: 85/100
   - 市场环境: 良好
   - ROE: 25%, PE: 28
   - 趋势: 上升，突破关键位

   ⚠️ 风险提示:
   - 估值偏高，注意回调风险
   - 建议分批买入

   [确认买入] [拒绝] [稍后决定]
   ━━━━━━━━━━━━━━━━━━━━━━
   ↓
8. 用户点击【确认买入】
   ↓
9. 记录到虚拟持仓
   portfolio.json:
   {
     "symbol": "600519",
     "name": "贵州茅台",
     "quantity": 100,
     "cost_price": 1820,
     "buy_date": "2026-04-14",
     "stop_loss": 1750,
     "take_profit": 2000
   }
   ↓
10. 持续监控
    - 每日检查是否触发止损/止盈
    - 基本面是否恶化
    - 技术面是否破位
```

### 场景 2: 止损止盈提醒

```
1. 定时任务（每日 15:00 收盘后）
   ↓
2. Portfolio Manager 检查持仓
   - 更新最新价格
   - 计算浮盈浮亏
   - 检查止损止盈条件
   ↓
3. 发现触发条件
   贵州茅台当前价: 1740
   止损价: 1750
   触发止损！
   ↓
4. 飞书推送告警
   ━━━━━━━━━━━━━━━━━━━━━━
   ⚠️ 止损提醒
   ━━━━━━━━━━━━━━━━━━━━━━
   股票: 贵州茅台 (600519)
   持仓: 100股 @1820
   当前价: 1740
   浮亏: -4.4%

   ⚠️ 已触发止损线 (1750)
   建议立即卖出止损

   [确认卖出] [继续持有] [调整止损]
   ━━━━━━━━━━━━━━━━━━━━━━
   ↓
5. 用户点击【确认卖出】
   ↓
6. 记录交易
   trades.json:
   {
     "date": "2026-04-20",
     "action": "sell",
     "symbol": "600519",
     "quantity": 100,
     "price": 1740,
     "profit": -80,
     "profit_pct": -0.044,
     "reason": "触发止损"
   }
```

### 场景 3: 用户主动查询

```
用户在飞书: "@投资顾问 帮我分析一下比亚迪"
   ↓
Agent 启动分析流程
   1. Stock Screener: 获取基本面数据
   2. Technical Analyst: 计算技术指标
   3. Risk Manager: 评估风险
   ↓
返回分析报告（不推送交易信号，仅供参考）
```

---

## 🛠️ 核心功能模块

### 1. 信号生成器 (Signal Generator)

**职责**: 根据策略生成交易信号

**输入**:
- 市场环境分析
- 个股分析结果
- 风险评估

**输出**:
```typescript
interface TradingSignal {
  action: 'buy' | 'sell' | 'hold';
  symbol: string;
  name: string;
  price_range: [number, number];
  position: string;  // "10%"
  stop_loss: number;
  take_profit: number;
  confidence: number;  // 0-100
  reasoning: string;
  risk_level: 'low' | 'medium' | 'high';
  urgency: 'immediate' | 'today' | 'this_week';
}
```

### 2. 通知推送器 (Notification Pusher)

**职责**: 将交易信号推送给用户

**支持渠道**:
- 飞书 Bot（主要）
- 微信（备用）
- 邮件（备用）

**消息模板**:
```typescript
interface NotificationTemplate {
  title: string;
  signal: TradingSignal;
  analysis_summary: string;
  risk_warning: string;
  actions: Array<{
    label: string;
    action: string;
    style: 'primary' | 'danger' | 'default';
  }>;
}
```

### 3. 用户确认器 (User Confirmer)

**职责**: 等待用户确认并处理响应

**交互方式**:
- 飞书卡片按钮
- 超时处理（24小时未确认自动取消）
- 支持修改参数（调整仓位、止损价等）

### 4. 持仓管理器 (Portfolio Manager)

**职责**: 管理虚拟持仓和交易记录

**数据结构**:
```json
// portfolio.json
{
  "cash": 1000000,
  "holdings": [
    {
      "symbol": "600519",
      "name": "贵州茅台",
      "quantity": 100,
      "cost_price": 1820,
      "current_price": 1850,
      "market_value": 185000,
      "profit": 3000,
      "profit_pct": 0.0165,
      "buy_date": "2026-04-14",
      "stop_loss": 1750,
      "take_profit": 2000,
      "position_pct": 0.185
    }
  ],
  "total_value": 1003000,
  "total_profit": 3000,
  "total_profit_pct": 0.003
}
```

### 5. 监控守护进程 (Monitor Daemon)

**职责**: 持续监控持仓和市场

**监控项**:
- 止损止盈检查（实时）
- 基本面变化（每日）
- 技术面破位（实时）
- 重大公告（实时）
- 市场异常（实时）

---

## 📅 定时任务配置

```json
// .pi-invest/TRADING_CRON.json
{
  "jobs": [
    {
      "name": "早盘选股推荐",
      "cron": "0 9 * * 1-5",
      "enabled": true,
      "agent": "team-lead",
      "task": "daily_stock_screening",
      "params": {
        "max_recommendations": 3,
        "min_quality_score": 80
      }
    },
    {
      "name": "盘中监控",
      "cron": "*/30 9-15 * * 1-5",
      "enabled": true,
      "agent": "portfolio-manager",
      "task": "monitor_positions",
      "params": {
        "check_stop_loss": true,
        "check_take_profit": true
      }
    },
    {
      "name": "收盘复盘",
      "cron": "0 15 * * 1-5",
      "enabled": true,
      "agent": "team-lead",
      "task": "daily_review",
      "params": {
        "generate_report": true,
        "send_notification": true
      }
    },
    {
      "name": "周末策略回测",
      "cron": "0 10 * * 6",
      "enabled": true,
      "agent": "quant-strategist",
      "task": "weekly_backtest",
      "params": {
        "strategies": ["momentum", "value", "quality"]
      }
    }
  ]
}
```

---

## 🔐 风控机制

### 1. 多重检查

```
交易信号生成
  ↓
风险检查 1: 基本面是否健康
  ↓
风险检查 2: 技术面是否确认
  ↓
风险检查 3: 仓位是否合理
  ↓
风险检查 4: 市场环境是否适合
  ↓
风险检查 5: 是否符合用户风险偏好
  ↓
通过所有检查 → 推送通知
```

### 2. 仓位限制

- 单只股票 ≤ 15%
- 单个板块 ≤ 30%
- 总仓位根据市场环境动态调整（40%-80%）
- 新股票初始仓位 ≤ 5%（试探性建仓）

### 3. 止损保护

- 强制止损：-8%
- 建议止损：-5%
- 移动止损：盈利后自动上移止损线
- 时间止损：持仓超过 N 天未盈利

### 4. 黑名单机制

自动过滤：
- ST、*ST 股票
- 停牌股票
- 流动性差的股票（日成交额 < 1亿）
- 财务造假股票
- 用户自定义黑名单

---

## 📱 飞书 Bot 交互设计

### 消息卡片示例

```json
{
  "msg_type": "interactive",
  "card": {
    "header": {
      "title": {
        "content": "📈 交易信号 - 买入推荐",
        "tag": "plain_text"
      },
      "template": "blue"
    },
    "elements": [
      {
        "tag": "div",
        "text": {
          "content": "**股票**: 贵州茅台 (600519)\n**操作**: 买入\n**价格区间**: 1800-1850\n**建议仓位**: 10%",
          "tag": "lark_md"
        }
      },
      {
        "tag": "hr"
      },
      {
        "tag": "div",
        "text": {
          "content": "📊 **分析依据**\n- 基本面评分: 92/100\n- 技术面评分: 85/100\n- 市场环境: 良好",
          "tag": "lark_md"
        }
      },
      {
        "tag": "action",
        "actions": [
          {
            "tag": "button",
            "text": {
              "content": "确认买入",
              "tag": "plain_text"
            },
            "type": "primary",
            "value": {
              "action": "confirm_buy",
              "signal_id": "sig_20260414_001"
            }
          },
          {
            "tag": "button",
            "text": {
              "content": "拒绝",
              "tag": "plain_text"
            },
            "type": "default",
            "value": {
              "action": "reject",
              "signal_id": "sig_20260414_001"
            }
          },
          {
            "tag": "button",
            "text": {
              "content": "查看详情",
              "tag": "plain_text"
            },
            "type": "default",
            "value": {
              "action": "view_detail",
              "signal_id": "sig_20260414_001"
            }
          }
        ]
      }
    ]
  }
}
```

---

## 🎯 下一步实施计划

### Phase 1: 基础框架（1-2周）
- [ ] 改造系统提示词（coding → 投资）
- [ ] 集成 pi-investment 工具
- [ ] 实现 6 个核心 Agent
- [ ] 实现 Team Lead 协调逻辑

### Phase 2: 信号生成（1周）
- [ ] 实现信号生成器
- [ ] 实现选股策略
- [ ] 实现风险检查
- [ ] 单元测试

### Phase 3: 通知推送（1周）
- [ ] 飞书 Bot 集成
- [ ] 消息卡片设计
- [ ] 用户确认处理
- [ ] 超时处理

### Phase 4: 持仓管理（1周）
- [ ] 虚拟持仓管理
- [ ] 交易记录
- [ ] 收益计算
- [ ] 复盘报告

### Phase 5: 监控守护（1周）
- [ ] 定时任务调度
- [ ] 止损止盈监控
- [ ] 异常告警
- [ ] 日志记录

### Phase 6: 测试优化（1-2周）
- [ ] 回测验证
- [ ] 压力测试
- [ ] 性能优化
- [ ] 文档完善

---

**总计**: 6-8 周完成完整系统
