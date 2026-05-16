# AkShare API 状态报告

**日期**: 2026-05-16
**问题**: 部分 akshare 接口无法访问

## 问题分析

### 根本原因
东方财富的行情推送服务域名 `push2.eastmoney.com` 当前返回空响应（HTTP 52 错误），导致依赖该域名的 akshare 接口全部失败。

### 测试结果

#### ✓ 可用的数据源
- `emweb.securities.eastmoney.com` - 东方财富公司信息接口
- `hq.sinajs.cn` - 新浪财经实时行情接口

#### ✗ 不可用的数据源
- `push2.eastmoney.com` - 东方财富行情推送服务
- `82.push2.eastmoney.com` - 东方财富行情推送服务（备用域名）

## 接口可用性

### ✓ 可用接口
1. **get_stock_info** - 个股基本信息
   - 数据源: emweb.securities.eastmoney.com + 新浪实时行情
   - 状态: 正常

2. **get_market_overview** - 市场概览（指数）
   - 数据源: hq.sinajs.cn
   - 状态: 正常

3. **get_stock_realtime_price** - 个股实时行情
   - 数据源: 新浪财经
   - 状态: 正常

### ✗ 不可用接口
1. **screen_stocks_by_sector** - 板块股票筛选
   - 依赖: `ak.stock_board_industry_name_em()`
   - 错误: RemoteDisconnected

2. **screen_stocks_quality** - 质量股票筛选
   - 依赖: screen_stocks_by_sector
   - 错误: 间接失败

3. **get_concept_stocks** - 概念股查询
   - 依赖: `ak.stock_board_concept_name_em()`
   - 错误: RemoteDisconnected

4. **get_sector_fund_flow** - 行业资金流向
   - 依赖: `ak.stock_sector_fund_flow_rank()`
   - 错误: RemoteDisconnected

5. **stock_zh_a_spot_em** - A股实时行情列表
   - 依赖: push2.eastmoney.com
   - 错误: RemoteDisconnected

## 已尝试的修复方案

1. ✗ 禁用系统代理配置 - 无效
2. ✗ 添加重试机制 - 无效
3. ✗ 修改请求头模拟浏览器 - 无效
4. ✗ 测试不同的域名变体 - 无效

## 建议方案

### 短期方案（立即实施）
1. 在工具描述中标注不可用的接口
2. 返回友好的错误信息，说明服务暂时不可用
3. 建议用户使用可用的替代接口

### 中期方案（1-2周）
1. 监控 push2.eastmoney.com 服务恢复情况
2. 考虑使用其他数据源替代（如 Tushare、聚宽等）
3. 实现基于可用接口的变通方案：
   - 使用 get_stock_info 批量查询模拟板块筛选
   - 使用新浪财经接口获取资金流向数据

### 长期方案
1. 升级 akshare 到最新版本（当前 1.17.16）
2. 考虑实现多数据源切换机制
3. 添加数据源健康检查和自动降级

## 技术细节

### 错误信息
```
('Connection aborted.', RemoteDisconnected('Remote end closed connection without response'))
```

### 测试命令
```bash
# 测试可用接口
curl --noproxy "*" "https://emweb.securities.eastmoney.com/PC_HSF10/CompanySurvey/PageAjax?code=SH600519"

# 测试不可用接口
curl --noproxy "*" "https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=5&fs=m:0+t:6&fields=f12,f14"
# 返回: curl: (52) Empty reply from server
```

## 相关文件
- `python/akshare_bridge.py` - Python 接口封装
- `src/utils/python-bridge.ts` - TypeScript 桥接层
- `.pi/logs/session-ob-20260516121608-b52298.jsonl` - 原始错误日志
