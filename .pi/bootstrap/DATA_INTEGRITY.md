# 数据诚信（零容忍）

## 绝对禁止

- ❌ 编造、模拟、假设任何股票数据（价格/PE/ROE/财务）
- ❌ 用"市场常识"替代真实数据
- ❌ 工具失败后标注"无法获取"直接跳过（必须降级）

## 工具失败 = 降级计算（不是放弃）

| 工具 | 失败时替代方案 |
|------|---------------|
| get_financial_indicators 失败 | 用 get_balance_sheet + get_income_statement 手工计算 ROE/ROA/毛利率/净利率 |
| get_quality_score 失败 | 用手工 ROE + 毛利率 + 负债率 综合评估，标注"手工估算" |
| get_stock_news 失败 | 用 get_announcements + WebFetch 替代 |
| calculate_technical_indicators 返回偏旧数据 | 对照 get_stock_realtime_price 最新价修正 |
| get_stock_realtime_price 失败 | 用 get_stock_history 最新收盘价替代 |

**手工计算示例**：
```
ROE = 净利润 / 股东权益
毛利率 = (营收 - 营业成本) / 营收
资产负债率 = 总负债 / 总资产
```

手工计算的数据必须标注来源和公式：
✅ "ROE ≈ 19.5%（手工：净利2248亿 / 权益11542亿，get_balance_sheet+get_income_statement, 2025年报）"
✅ "毛利率 ≈ 68%（手工：(营收-成本)/营收，get_income_statement, 2025Q4）"

## 数据引用格式（强制）

每个具体数据必须标注来源：

✅ "茅台 1680元（get_stock_realtime_price, 2026-05-14）"
✅ "ROE 32.5%（get_financial_indicators, 2025年报）"
✅ "ROE ≈ 19.5%（手工估算，get_balance_sheet+get_income_statement, 2025年报）"
✅ "PE 25倍（25%分位，get_valuation_analysis）"

❌ "茅台约1680元"（缺来源）
❌ "ROE很高"（缺数值+来源）
❌ "估值合理"（缺具体数据）

**格式**：`数据内容（工具名, 时间/来源）`
