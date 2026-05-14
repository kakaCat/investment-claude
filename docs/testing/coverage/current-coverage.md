# 当前测试覆盖率报告

> 量化项目测试覆盖率统计和分析

**版本**: v1.0
**更新日期**: 2026-04-14
**报告周期**: Phase 1 - Week 1

---

## 📊 总体覆盖率

| 指标 | 当前值 | 目标值 | 状态 |
|------|--------|--------|------|
| **总体覆盖率** | **34%** | **80%+** | 🟡 进行中 |
| 单元测试数量 | 18 | 200+ | 🔴 需要补充 |
| 集成测试数量 | 0 | 30+ | 🔴 未开始 |
| E2E 测试数量 | 0 | 10+ | 🔴 未开始 |

### 覆盖率趋势

```
Week 1: 0% → 34% ✅ (+34%)
Week 2: 34% → 60% (目标)
Week 3: 60% → 80% (目标)
```

---

## 📁 模块覆盖率详情

### 核心模块

| 模块 | 覆盖率 | 测试数量 | 优先级 | 状态 | 负责人 |
|------|--------|---------|--------|------|--------|
| **data_adapter.py** | **82%** | 18 | P0 | ✅ 完成 | test-engineer |
| **exceptions.py** | **100%** | 0 | P1 | ✅ 完成 | backend-dev |
| features/technical.py | 0% | 0 | P0 | ⏳ 待开始 | test-engineer |
| inference/predictor.py | 0% | 0 | P0 | ⏳ 待开始 | test-engineer |
| training/trainer.py | 0% | 0 | P0 | ⏳ 待开始 | test-engineer |
| config.py | 0% | 0 | P2 | ⏳ 待开始 | - |
| logger.py | 0% | 0 | P2 | ⏳ 待开始 | - |

### 详细覆盖率

#### ✅ data_adapter.py (82% 覆盖)

**已覆盖功能**:
- ✅ `get_stock_history()` - 正常流程
- ✅ `get_stock_history()` - 重试机制
- ✅ `get_stock_history()` - 错误处理
- ✅ `_validate_and_clean_dataframe()` - 数据验证
- ✅ `_validate_and_clean_dataframe()` - 异常值处理
- ✅ 输入验证（symbol, days）

**未覆盖代码** (18%):
```python
# Line 230-237: 理论上不会到达的代码路径
if last_error:
    raise DataFetchError(
        "Failed to fetch data after all retries",
        symbol=symbol,
        days=days,
        retry_count=retry,
        last_error=str(last_error),
    ) from last_error
```

**测试文件**: `tests/unit/backend/test_data_adapter.py`
**测试数量**: 18 个测试用例

---

#### ✅ exceptions.py (100% 覆盖)

**已覆盖功能**:
- ✅ 所有自定义异常类
- ✅ 输入验证函数
- ✅ 异常消息格式化

**测试方式**: 通过 `test_data_adapter.py` 间接测试
**状态**: 完全覆盖

---

#### ⏳ features/technical.py (0% 覆盖)

**需要测试的功能**:
- [ ] `TechnicalFeatures.calculate_all()` - 计算所有指标
- [ ] `calculate_ma()` - 移动平均线
- [ ] `calculate_rsi()` - RSI 指标
- [ ] `calculate_macd()` - MACD 指标
- [ ] `calculate_bollinger_bands()` - 布林带
- [ ] `calculate_atr()` - ATR 指标
- [ ] 边界条件（数据不足、NaN 值）

**预估测试数量**: 30+ 个测试用例
**预估覆盖率**: 80%+
**优先级**: P0
**计划开始**: Week 1 Day 2

---

#### ⏳ inference/predictor.py (0% 覆盖)

**需要测试的功能**:
- [ ] `SignalPredictor.load_model()` - 加载模型
- [ ] `SignalPredictor.predict()` - 预测信号
- [ ] `predict_from_features()` - 从特征预测
- [ ] 模型不存在时的错误处理
- [ ] 预测结果验证（BUY/SELL/HOLD）

**预估测试数量**: 15+ 个测试用例
**预估覆盖率**: 80%+
**优先级**: P0
**计划开始**: Week 1 Day 3

---

#### ⏳ training/trainer.py (0% 覆盖)

**需要测试的功能**:
- [ ] `SignalTrainer.train()` - 训练模型
- [ ] `train_with_data()` - 使用数据训练
- [ ] `save()` - 保存模型
- [ ] `load()` - 加载模型
- [ ] 训练结果验证（train_score, test_score）
- [ ] 数据不足时的处理

**预估测试数量**: 15+ 个测试用例
**预估覆盖率**: 75%+
**优先级**: P0
**计划开始**: Week 1 Day 3

---

## 🎯 覆盖率目标

### Phase 1 目标 (Week 1-2)

| 模块 | 当前 | Week 1 目标 | Week 2 目标 |
|------|------|------------|------------|
| data_adapter.py | 82% | 85% | 85% |
| features/technical.py | 0% | 60% | 80% |
| inference/predictor.py | 0% | 60% | 80% |
| training/trainer.py | 0% | 50% | 75% |
| **总体** | **34%** | **50%** | **60%** |

### Phase 2 目标 (Week 3-5)

| 模块 | Week 3 | Week 4 | Week 5 |
|------|--------|--------|--------|
| 所有核心模块 | 70% | 75% | 80% |
| 集成测试 | 10 个 | 20 个 | 30 个 |
| **总体** | **70%** | **75%** | **80%** |

---

## 📋 未覆盖代码分析

### 高优先级未覆盖代码

#### 1. features/technical.py

**影响**: 核心特征计算逻辑未测试，风险高

**未覆盖功能**:
- 所有技术指标计算函数
- 边界条件处理
- NaN 值处理

**建议**:
- 立即开始编写测试
- 优先测试 `calculate_all()` 和常用指标（MA, RSI, MACD）
- 使用参数化测试覆盖多种场景

#### 2. inference/predictor.py

**影响**: 预测逻辑未测试，可能产生错误信号

**未覆盖功能**:
- 模型加载和预测
- 特征准备
- 信号生成逻辑

**建议**:
- 使用 mock 模型进行测试
- 测试各种预测场景（BUY/SELL/HOLD）
- 验证概率值范围

#### 3. training/trainer.py

**影响**: 训练逻辑未测试，模型质量无保障

**未覆盖功能**:
- 模型训练流程
- 模型保存和加载
- 训练结果验证

**建议**:
- 使用小数据集快速测试
- 验证训练结果的合理性
- 测试模型持久化

---

## 🔍 覆盖率质量分析

### 已有测试质量评估

#### data_adapter.py 测试质量: ⭐⭐⭐⭐⭐ (优秀)

**优点**:
- ✅ 覆盖所有主要功能
- ✅ 测试边界条件（空数据、异常值）
- ✅ 测试错误处理和重试机制
- ✅ 使用 fixtures 和 mock
- ✅ 测试命名清晰
- ✅ 测试独立性好

**改进空间**:
- 可以添加更多性能测试
- 可以测试并发场景

**示例测试**:
```python
class TestGetStockHistory:
    """测试 get_stock_history 函数"""

    @patch('quant.data_adapter.akshare_bridge')
    def test_successful_fetch(self, mock_bridge, mock_akshare_response):
        """测试成功获取数据"""
        mock_bridge.get_stock_history.return_value = mock_akshare_response
        result = get_stock_history("600519", days=100)

        assert isinstance(result, pd.DataFrame)
        assert not result.empty
        assert len(result) == 100
        mock_bridge.get_stock_history.assert_called_once()
```

---

## 📈 覆盖率提升计划

### Week 1 计划

**Day 2 (今天)**:
- [ ] 编写 `test_technical.py` (30+ 测试)
- [ ] 目标覆盖率: features/technical.py → 60%

**Day 3**:
- [ ] 编写 `test_predictor.py` (15+ 测试)
- [ ] 编写 `test_trainer.py` (15+ 测试)
- [ ] 目标覆盖率: 总体 → 50%

**Day 4-5**:
- [ ] 补充测试，提高覆盖率
- [ ] 编写集成测试
- [ ] 目标覆盖率: 总体 → 60%

### Week 2 计划

**Day 1-3**:
- [ ] 继续提高单元测试覆盖率
- [ ] 编写更多集成测试
- [ ] 目标覆盖率: 总体 → 70%

**Day 4-5**:
- [ ] 补充边界条件测试
- [ ] 性能测试
- [ ] 目标覆盖率: 总体 → 80%

---

## 🚀 如何提高覆盖率

### 1. 查看未覆盖代码

```bash
# 生成覆盖率报告
pytest --cov=python/quant --cov-report=html

# 在浏览器中查看
open htmlcov/index.html

# 查看特定文件的未覆盖行
pytest --cov=python/quant --cov-report=term-missing
```

### 2. 针对性编写测试

```python
# 查看报告后，针对未覆盖的行编写测试
def test_uncovered_branch():
    """测试之前未覆盖的分支"""
    # 触发特定条件
    result = function_with_uncovered_branch(special_input)
    assert result == expected
```

### 3. 使用覆盖率工具

```bash
# 只运行覆盖率低的模块的测试
pytest tests/unit/backend/test_technical.py --cov=python/quant/features/technical.py

# 设置覆盖率阈值
pytest --cov=python/quant --cov-fail-under=80
```

---

## 📊 覆盖率报告生成

### 终端报告

```bash
pytest --cov=python/quant --cov-report=term-missing
```

### HTML 报告

```bash
pytest --cov=python/quant --cov-report=html
open htmlcov/index.html
```

### XML 报告（用于 CI）

```bash
pytest --cov=python/quant --cov-report=xml
```

### 组合报告

```bash
pytest --cov=python/quant \
  --cov-report=term-missing \
  --cov-report=html \
  --cov-report=xml
```

---

## 🎯 覆盖率里程碑

| 里程碑 | 覆盖率 | 预计时间 | 状态 |
|--------|--------|---------|------|
| 测试框架搭建 | 0% → 34% | Week 1 Day 1 | ✅ 完成 |
| 核心模块基础覆盖 | 34% → 50% | Week 1 Day 2-3 | 🔄 进行中 |
| 核心模块完整覆盖 | 50% → 60% | Week 1 Day 4-5 | ⏳ 待开始 |
| 所有模块基础覆盖 | 60% → 70% | Week 2 Day 1-3 | ⏳ 待开始 |
| 达到目标覆盖率 | 70% → 80% | Week 2 Day 4-5 | ⏳ 待开始 |

---

## 📝 覆盖率报告更新

本报告每周更新一次，记录覆盖率变化和测试进展。

**下次更新**: 2026-04-21 (Week 2)

---

## 🔗 相关资源

- [测试策略](../strategy/test-strategy.md)
- [单元测试指南](../guides/unit-testing-guide.md)
- [集成测试指南](../guides/integration-testing-guide.md)
- [测试框架文档](../../../tests/README.md)

---

**维护者**: test-engineer
**审核者**: team-lead
**最后更新**: 2026-04-14
