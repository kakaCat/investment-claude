# screen_stocks_by_sector 替代方案

## 问题
`screen_stocks_by_sector` 依赖的东方财富 API (`stock_board_industry_cons_em`) 当前不可用，所有 `push2.eastmoney.com` 域名都返回连接错误。

## 可用的替代接口

### 1. ✅ 同花顺行业分类
```python
# 获取行业列表
df = ak.stock_board_industry_name_ths()
# 返回: 90个行业，包括 '半导体', '电子化学品', '光学光电子' 等
```

**限制**: 没有对应的成分股查询接口 (`stock_board_industry_cons_ths` 不存在)

### 2. ✅ 同花顺概念板块
```python
# 获取概念列表（372个概念）
df = ak.stock_board_concept_name_ths()

# 获取热门概念汇总（20个）
df = ak.stock_board_concept_summary_ths()
```

**限制**: 
- 概念板块指数接口 (`stock_board_concept_index_ths`) 不稳定
- 没有直接的成分股查询接口

### 3. ✅ 东方财富概念板块成分股（已验证可用）
```python
# 这个接口可以工作！
df = ak.stock_board_concept_cons_em(symbol="人工智能")
# 返回: 50只股票，包含代码、名称、价格、涨跌幅等
```

**优势**: 
- 可以获取具体概念的成分股
- 数据完整（代码、名称、价格、涨跌幅）
- 已在当前项目中验证可用

## 推荐方案

### 方案A: 使用概念板块替代行业板块（推荐）

**实现思路**:
1. 将 `screen_stocks_by_sector` 改为支持概念板块
2. 使用 `stock_board_concept_cons_em` 获取成分股
3. 提供概念名称映射（如 "电子信息" → "半导体"、"芯片"、"消费电子"）

**优势**:
- 接口可用且稳定
- 数据完整
- 概念分类更细致，对投资分析更有价值

**代码示例**:
```python
def screen_stocks_by_concept(concept: str, limit: int = 20) -> dict:
    """按概念板块筛选股票（使用东方财富概念板块）"""
    import akshare as ak
    from datetime import datetime
    
    try:
        df = ak.stock_board_concept_cons_em(symbol=concept)
        
        if df is None or df.empty:
            return {
                "error": f"未找到概念: {concept}",
                "concept": concept,
                "suggestion": "使用 get_concept_stocks 查询可用概念"
            }
        
        results = []
        for _, row in df.head(limit).iterrows():
            results.append({
                "code": str(row.get("代码", "")),
                "name": str(row.get("名称", "")),
                "price": float(row.get("最新价", 0)),
                "change_pct": float(row.get("涨跌幅", 0)),
            })
        
        return {
            "concept": concept,
            "count": len(results),
            "data": results,
            "data_date": datetime.now().strftime("%Y-%m-%d")
        }
    except Exception as e:
        return {"error": str(e), "concept": concept}
```

### 方案B: 行业到概念的映射

创建一个映射表，将常见的行业查询转换为概念查询：

```python
SECTOR_TO_CONCEPT_MAP = {
    "电子信息": ["半导体", "消费电子", "光学光电子"],
    "新能源": ["新能源汽车", "锂电池", "光伏概念"],
    "医药": ["医疗器械", "生物医药", "中药"],
    "金融": ["银行", "保险", "券商"],
    # ... 更多映射
}

def screen_stocks_by_sector_v2(sector: str, limit: int = 20) -> dict:
    """按行业筛选股票（通过概念板块实现）"""
    
    # 尝试直接查询
    try:
        df = ak.stock_board_industry_cons_em(symbol=sector)
        # 如果成功，返回结果
    except:
        # 失败则使用概念映射
        concepts = SECTOR_TO_CONCEPT_MAP.get(sector, [sector])
        
        # 合并多个概念的结果
        all_stocks = []
        for concept in concepts:
            try:
                df = ak.stock_board_concept_cons_em(symbol=concept)
                # 添加到结果
            except:
                continue
        
        return merged_results
```

### 方案C: 等待上游修复（不推荐）

等待东方财富的 `push2.eastmoney.com` 服务恢复。

**缺点**:
- 恢复时间不确定
- 可能是永久性的 API 变更

## 实施建议

1. **短期（立即）**: 
   - 在 `screen_stocks_by_sector` 中添加友好的错误提示
   - 建议用户使用 `get_concept_stocks` 替代

2. **中期（本周）**:
   - 实现方案A：添加 `screen_stocks_by_concept` 函数
   - 更新工具描述，说明概念板块可用

3. **长期（持续）**:
   - 实现方案B：添加行业到概念的智能映射
   - 监控东方财富 API 状态，如果恢复则切换回原接口

## 测试验证

```bash
# 测试概念板块成分股（已验证可用）
/opt/miniconda3/bin/python3 python/akshare_bridge.py get_concept_stocks '{"concept": "人工智能"}'

# 测试同花顺概念列表（已验证可用）
python3 -c "import akshare as ak; print(ak.stock_board_concept_name_ths()['name'].head(10).tolist())"

# 测试同花顺行业列表（已验证可用）
python3 -c "import akshare as ak; print(ak.stock_board_industry_name_ths()['name'].head(10).tolist())"
```

## 结论

**推荐使用方案A**：用概念板块替代行业板块，因为：
1. ✅ 接口可用且稳定
2. ✅ 数据完整
3. ✅ 实现简单
4. ✅ 概念分类更适合投资分析

当前项目中的 `get_concept_stocks` 已经可以正常工作，可以直接使用。
