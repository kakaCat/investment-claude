# pi-investment 项目分析报告

> 分析 pi-investment 项目，识别可复用的代码和工具

**日期**: 2026-04-14

---

## 📊 项目概览

**项目路径**: `/Users/mac/Documents/ai/pi-investment`

**项目类型**: A股/港股投资分析 Agent

**技术栈**: TypeScript + Python (akshare)

---

## ✅ 已实现的功能

### 1. 投资工具集 (invest-tools.ts)

**位置**: `src/infrastructure/tools/invest-tools.ts`

**已实现的工具**:

| 工具名称 | 功能 | 支持市场 | 状态 |
|---------|------|---------|------|
| `get_stock_info` | 股票基本信息 | A股 + 港股 | ✅ 完整 |
| `get_stock_price` | 实时价格 | A股 + 港股 | ✅ 完整 |
| `get_stock_history` | 历史行情 | A股 + 港股 | ✅ 完整 |
| `get_financial_data` | 财务指标 | A股 | ✅ 完整 |
| `screen_stocks` | 板块选股 | A股 | ✅ 完整 |
| `get_sector_list` | 板块列表 | A股 | ✅ 完整 |
| `calculate_technical_indicators` | 技术指标 | A股 | ✅ 完整 |
| `get_market_overview` | 大盘概览 | A股 | ✅ 完整 |
| `get_north_flow` | 北向资金 | A股 | ✅ 完整 |
| `get_macro_data` | 宏观数据 | - | ✅ 完整 |
| `manage_portfolio` | 持仓管理 | - | ✅ 完整 |

**特点**:
- ✅ 优先使用 TypeScript 原生实现
- ✅ Python (akshare) 作为 fallback
- ✅ 分级缓存（实时5分钟、技术10分钟、财务1天）
- ✅ 支持 A股 + 港股

### 2. 数据源

**TypeScript 原生数据源**:
- `src/infrastructure/akshare-ts/index.ts` - TS 原生实现
- `src/infrastructure/data-sources/sina.ts` - 新浪财经
- `src/infrastructure/data-sources/eastmoney.ts` - 东方财富
- `src/infrastructure/data-sources/stooq.ts` - Stooq

**Python 数据源**:
- `python/akshare_bridge.py` - akshare 桥接

### 3. 持仓管理

**位置**: `src/services/portfolio/portfolio-service.ts`

**功能**:
- ✅ 添加/删除持仓
- ✅ 查询持仓
- ✅ 计算盈亏
- ✅ 持久化到 JSON

### 4. 系统提示词

**位置**: `src/core/agent/trader-system-prompt.ts`

**特点**:
- ✅ 6层结构（Introduction + System + Trading Tasks + Risk Control + Tools + Runtime）
- ✅ 交易员风格
- ✅ 风控规则（仓位限制、止损规则）
- ✅ 并行工具调用

### 5. 飞书集成

**位置**:
- `src/api/feishu.ts` - 飞书 API
- `src/services/notification/feishu-service.ts` - 飞书服务

**功能**:
- ✅ 消息推送
- ✅ 卡片消息
- ✅ 会话管理

### 6. 定时任务

**位置**: `src/services/cron/cron-service.ts`

**功能**:
- ✅ Cron 调度
- ✅ 任务配置
- ✅ 任务执行

---

## 🔍 可复用的代码

### 高优先级（直接复用）

| 文件 | 功能 | 复用方式 |
|------|------|---------|
| `invest-tools.ts` | 投资工具集 | 直接复制，适配接口 |
| `trader-system-prompt.ts` | 交易员提示词 | 直接复制 |
| `portfolio-service.ts` | 持仓管理 | 直接复制 |
| `feishu-service.ts` | 飞书推送 | 直接复制 |
| `cron-service.ts` | 定时任务 | 直接复制 |
| `china-time.ts` | 中国时间工具 | 直接复制 |
| `akshare-ts/` | TS 数据源 | 直接复制 |
| `data-sources/` | 数据源适配器 | 直接复制 |
| `python/akshare_bridge.py` | Python 桥接 | 直接复制 |

### 中优先级（需要适配）

| 文件 | 功能 | 适配内容 |
|------|------|---------|
| `quant-tools.ts` | 量化工具 | 适配工具接口 |
| `stock-db-tools.ts` | 股票数据库 | 适配工具接口 |
| `memory-tool.ts` | 记忆工具 | 适配工具接口 |

### 低优先级（参考即可）

| 文件 | 功能 | 说明 |
|------|------|------|
| `browser-tool.ts` | 浏览器工具 | investment-claude 已有 |
| `task-tools.ts` | 任务工具 | investment-claude 已有 |
| `plan-tool.ts` | 计划工具 | investment-claude 已有 |

---

## ❌ 不需要的代码

| 文件 | 原因 |
|------|------|
| `compact-tool.ts` | investment-claude 已有 |
| `clarify-tool.ts` | investment-claude 已有 |
| `reflect-tool.ts` | investment-claude 已有 |

---

## 🔧 需要适配的地方

### 1. 工具接口格式

**pi-investment 格式**:
```typescript
export interface ToolDefinition {
  name: string;
  label: string;
  description: string;
  parameters: TSchema;
  execute: (toolCallId: string, params: any) => Promise<{
    content: Array<{ type: "text", text: string }>;
    details: any;
  }>;
}
```

**investment-claude 格式**:
```typescript
export interface Tool {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
  execute: (params: any) => Promise<string>;
}
```

**适配方案**: 创建适配器函数

### 2. 导入路径

需要调整所有相对路径导入

### 3. 环境变量

pi-investment 使用 `PI_DIR`，investment-claude 可能需要调整

---

## 📋 改造计划

### Phase 1: 复制核心代码 (1-2天)

**任务**:
1. 复制投资工具集
2. 复制数据源
3. 复制持仓管理
4. 复制工具函数

**输出**: 所有文件复制到 investment-claude

### Phase 2: 适配工具接口 (1-2天)

**任务**:
1. 创建工具接口适配器
2. 适配所有投资工具
3. 注册工具到 Tool.tsx
4. 测试工具调用

**输出**: 投资工具可用

### Phase 3: 改造系统提示词 (1天)

**任务**:
1. 复制 trader-system-prompt.ts
2. 集成到 promptSections.ts
3. 测试提示词加载

**输出**: 系统提示词改为投资顾问

### Phase 4: 实现信号推送 (2-3天)

**任务**:
1. 复制飞书服务
2. 实现信号生成器
3. 实现推送逻辑
4. 测试推送功能

**输出**: 可以推送交易信号

### Phase 5: 实现定时任务 (2-3天)

**任务**:
1. 复制定时任务服务
2. 实现选股任务
3. 实现监控任务
4. 配置定时任务

**输出**: 定时任务可用

### Phase 6: 测试和优化 (2-3天)

**任务**:
1. 单元测试
2. 集成测试
3. 性能优化
4. 文档完善

**输出**: 系统稳定运行

---

## 🎯 总结

### 可复用性评估

| 类别 | 可复用度 | 说明 |
|------|---------|------|
| **投资工具** | 95% | 只需适配接口格式 |
| **数据源** | 100% | 直接复用 |
| **持仓管理** | 100% | 直接复用 |
| **系统提示词** | 90% | 需要微调 |
| **飞书集成** | 100% | 直接复用 |
| **定时任务** | 100% | 直接复用 |

### 预计工作量

- **复制代码**: 1-2 天
- **适配接口**: 1-2 天
- **改造提示词**: 1 天
- **实现信号推送**: 2-3 天
- **实现定时任务**: 2-3 天
- **测试优化**: 2-3 天

**总计**: 9-15 天（约 2-3 周）

### 风险点

1. ⚠️ 工具接口适配可能遇到兼容性问题
2. ⚠️ Python 环境依赖（akshare）
3. ⚠️ 飞书 API 配置

### 建议

✅ **先做 Phase 1-3**，验证核心功能可用
✅ **再做 Phase 4-5**，实现完整流程
✅ **最后做 Phase 6**，优化和完善

---

## 🚀 下一步

立即开始 **Phase 1: 复制核心代码**
