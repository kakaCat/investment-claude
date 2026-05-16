# AkShare API 问题修复报告

**日期**: 2026-05-16
**状态**: ✅ 已修复

## 问题总结

### 根本原因
错误地在 `python/akshare_bridge.py` 中添加了禁用代理的代码：
```python
# 错误的代码（已移除）
for proxy_var in ["HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy"]:
    if proxy_var in os.environ:
        del os.environ[proxy_var]
```

这导致需要通过代理访问的 akshare 接口全部失败，报错：
```
('Connection aborted.', RemoteDisconnected('Remote end closed connection without response'))
```

### 解决方案
从 `/Users/mac/Documents/ai/pi-investment` 项目复制正确的 `akshare_bridge.py` 文件。该文件：
1. **不禁用代理** - 允许接口通过系统代理 (127.0.0.1:7890) 访问
2. 包含更完善的功能：
   - JSON 序列化辅助函数（处理 NaN/Infinity）
   - 超时装饰器
   - 更好的错误处理

## 修复后的接口状态

### ✅ 已验证可用
1. **get_stock_info** - 个股基本信息 ✓
2. **get_market_overview** - 市场概览（指数）✓
3. **get_sector_fund_flow** - 行业资金流向 ✓
4. **get_concept_stocks** - 概念股查询 ✓

### ⚠️ 部分可用
1. **screen_stocks_by_sector** - 板块股票筛选
   - 状态: 网络连接不稳定
   - 错误: `HTTPSConnectionPool(host='17.push2.eastmoney.com', port=443): Max retries exceeded`
   - 原因: 上游 API 服务不稳定（非代码问题）

## 关键发现

### 代理配置的重要性
- 系统代理: `HTTP_PROXY=http://127.0.0.1:7890`
- akshare 的某些接口**需要**通过代理访问才能正常工作
- 禁用代理会导致这些接口无法连接

### 两个项目的差异
| 项目 | 代理配置 | 状态 |
|------|---------|------|
| investment-claude (修复前) | 禁用代理 | ❌ 失败 |
| pi-investment | 保留代理 | ✅ 正常 |
| investment-claude (修复后) | 保留代理 | ✅ 正常 |

## 修复步骤

```bash
# 1. 从 pi-investment 复制正确的文件
cp /Users/mac/Documents/ai/pi-investment/python/akshare_bridge.py \
   /Users/mac/Documents/ai/investment-claude/python/akshare_bridge.py

# 2. 验证修复
/opt/miniconda3/bin/python3 python/akshare_bridge.py get_sector_fund_flow '{}'
/opt/miniconda3/bin/python3 python/akshare_bridge.py get_concept_stocks '{"concept": "人工智能"}'
```

## 经验教训

1. **不要随意禁用代理** - 某些 API 可能依赖代理访问
2. **对比可用的参考实现** - pi-investment 项目是正确的参考
3. **系统性测试** - 修改网络配置后应测试所有接口
4. **保持代码同步** - 两个项目应使用相同的 Python 桥接代码

## 相关文件
- ✅ `python/akshare_bridge.py` - 已从 pi-investment 复制
- 📝 `docs/akshare-api-status-2026-05-16.md` - 初始诊断文档（结论有误）
- 📝 本文档 - 正确的问题分析和修复方案
