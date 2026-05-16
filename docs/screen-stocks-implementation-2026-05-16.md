# screen_stocks_by_sector 降级方案实现

**日期**: 2026-05-16
**状态**: ✅ 已完成并测试通过

## 问题背景

东方财富的行业板块接口 `stock_board_industry_cons_em` 依赖 `push2.eastmoney.com` 服务，该服务当前不可用，导致 `screen_stocks_by_sector` 函数无法正常工作。

## 解决方案

实现了自动降级机制：当行业板块接口失败时，自动使用同花顺概念板块数据作为替代。

### 实现细节

1. **行业到概念映射表** (`SECTOR_TO_CONCEPT_MAP`)
   - 将常见行业名称映射到相关的同花顺概念
   - 支持一对多映射（一个行业可对应多个概念）
   - 示例映射：
     - "电子信息" → ["芯片概念", "消费电子概念", "第三代半导体"]
     - "新能源" → ["新能源汽车", "锂电池概念", "光伏概念"]
     - "人工智能" → ["AI PC", "AI手机", "AI语料"]

2. **降级函数** (`_screen_stocks_by_concept_fallback`)
   - 根据映射表查找对应的概念
   - 调用 `get_concept_stocks` 获取每个概念的成分股
   - 自动去重（同一股票可能属于多个概念）
   - 按涨跌幅排序返回结果

3. **主函数改进** (`screen_stocks_by_sector`)
   - 首先尝试使用行业板块接口
   - 遇到网络错误或空结果时自动降级
   - 返回结果中标注数据来源（`source` 字段）

## 测试结果

所有测试均通过：

```bash
# 电子信息行业
screen_stocks_by_sector(sector="电子信息", limit=10)
✅ 返回 131 只股票，使用概念：芯片概念、消费电子概念、第三代半导体

# 新能源行业
screen_stocks_by_sector(sector="新能源", limit=5)
✅ 返回 115 只股票，使用概念：新能源汽车、锂电池概念、光伏概念

# 人工智能行业
screen_stocks_by_sector(sector="人工智能", limit=5)
✅ 返回 121 只股票，使用概念：AI PC、AI手机、AI语料

# 医疗行业
screen_stocks_by_sector(sector="医疗", limit=5)
✅ 返回 129 只股票，使用概念：医疗器械概念、智能医疗、眼科医疗
```

## 返回数据格式

```json
{
  "sector": "电子信息",
  "count": 131,
  "data": [
    {
      "code": "688549",
      "name": "中巨芯",
      "price": 16.79,
      "change_pct": 20.01,
      "pe": null,
      "roe": null
    }
  ],
  "data_date": "2026-05-16",
  "source": "concept_ths",
  "concepts_used": ["芯片概念", "消费电子概念", "第三代半导体"],
  "note": "行业板块接口不可用，已使用同花顺概念板块数据"
}
```

## 注意事项

1. **PE/ROE 数据缺失**: 概念板块接口不提供 PE 和 ROE 数据，这些字段返回 `null`
2. **概念名称差异**: 同花顺的概念分类与东方财富的行业分类不完全一致
3. **数据来源标识**: 返回结果中的 `source` 字段标识数据来源：
   - `"industry"`: 东方财富行业板块（原始接口）
   - `"concept_ths"`: 同花顺概念板块（降级方案）

## 未来改进

1. 可以考虑添加更多行业到概念的映射
2. 如果需要 PE/ROE 数据，可以对每只股票调用 `get_stock_info` 补充（会增加响应时间）
3. 可以定期检查东方财富接口是否恢复，优先使用原始接口

## 相关文件

- 实现文件: `python/akshare_bridge.py`
- 映射表: `SECTOR_TO_CONCEPT_MAP` (第 634 行之前)
- 主函数: `screen_stocks_by_sector` (第 634 行)
- 降级函数: `_screen_stocks_by_concept_fallback` (第 700+ 行)
