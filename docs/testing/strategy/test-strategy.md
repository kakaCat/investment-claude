# 测试策略

> 量化项目测试方法论和整体策略

**版本**: v1.0
**更新日期**: 2026-04-14

---

## 📋 目录

1. [测试金字塔](#测试金字塔)
2. [测试原则](#测试原则)
3. [覆盖率目标](#覆盖率目标)
4. [测试分类](#测试分类)
5. [测试优先级](#测试优先级)
6. [质量门禁](#质量门禁)

---

## 测试金字塔

我们遵循经典的测试金字塔模型，确保测试的效率和有效性：

```
        /\
       /  \      E2E Tests (5%)
      /----\     - 完整用户场景
     /      \    - 端到端验证
    /--------\
   / Integration\ Integration Tests (15%)
  /    Tests    \- 模块协同
 /--------------\- API 测试
/   Unit Tests   \ Unit Tests (80%)
\________________/- 函数级测试
                  - 快速反馈
```

### 测试比例

| 测试类型 | 占比 | 数量目标 | 执行时间 |
|---------|------|---------|---------|
| 单元测试 | 80% | 200+ | < 30s |
| 集成测试 | 15% | 30+ | < 2min |
| E2E 测试 | 5% | 10+ | < 5min |

### 为什么是金字塔？

1. **单元测试多** - 快速、稳定、易维护
2. **集成测试适中** - 验证模块协同
3. **E2E 测试少** - 慢、脆弱、维护成本高

---

## 测试原则

### 1. FIRST 原则

- **Fast (快速)**: 测试应该快速执行，单元测试 < 100ms
- **Independent (独立)**: 测试之间不应相互依赖
- **Repeatable (可重复)**: 任何环境都能重复执行
- **Self-validating (自验证)**: 测试结果明确（通过/失败）
- **Timely (及时)**: 与代码同步编写（TDD）

### 2. AAA 模式

所有测试遵循 Arrange-Act-Assert 模式：

```python
def test_calculate_ma():
    # Arrange - 准备测试数据
    data = create_sample_data()

    # Act - 执行被测试的操作
    result = calculate_ma(data, period=5)

    # Assert - 验证结果
    assert len(result) == len(data)
    assert result.iloc[-1] > 0
```

### 3. 测试隔离

- 使用 **fixtures** 准备测试数据
- 使用 **mock** 隔离外部依赖
- 每个测试独立运行，不共享状态

### 4. 测试可读性

```python
# ✅ 好的测试 - 清晰的命名和结构
def test_validate_dataframe_removes_rows_with_negative_prices():
    """测试数据验证会删除价格为负的行"""
    # Given
    data = create_data_with_negative_prices()

    # When
    result = validate_dataframe(data, "600519")

    # Then
    assert all(result['close'] > 0)
    assert len(result) < len(data)

# ❌ 不好的测试 - 命名模糊，逻辑不清
def test1():
    data = get_data()
    result = func(data)
    assert result
```

### 5. 测试边界条件

每个函数都应测试：
- **正常情况** - 典型输入
- **边界情况** - 空值、最小值、最大值
- **异常情况** - 错误输入、异常抛出

```python
def test_get_stock_history_edge_cases():
    """测试边界条件"""
    # 最小天数
    result = get_stock_history("600519", days=1)
    assert len(result) >= 1

    # 最大天数
    result = get_stock_history("600519", days=1000)
    assert len(result) <= 1000

    # 无效股票代码
    with pytest.raises(InvalidSymbolError):
        get_stock_history("invalid", days=100)
```

---

## 覆盖率目标

### 整体目标

| 阶段 | 时间 | 覆盖率目标 |
|------|------|-----------|
| Phase 1 | Week 1-2 | 60%+ |
| Phase 2 | Week 3-5 | 80%+ |
| Phase 3 | Week 6-9 | 85%+ |

### 模块级目标

| 模块 | 优先级 | 目标覆盖率 | 原因 |
|------|--------|-----------|------|
| data_adapter.py | P0 | 85%+ | 数据入口，关键模块 |
| features/technical.py | P0 | 80%+ | 核心特征计算 |
| inference/predictor.py | P0 | 80%+ | 预测逻辑 |
| training/trainer.py | P0 | 75%+ | 模型训练 |
| exceptions.py | P1 | 90%+ | 异常处理 |
| config.py | P2 | 60%+ | 配置文件 |
| logger.py | P2 | 60%+ | 日志工具 |

### 覆盖率不是唯一指标

⚠️ **重要**: 覆盖率是必要条件，但不是充分条件

- ✅ 80% 覆盖率 + 高质量测试 = 可靠代码
- ❌ 100% 覆盖率 + 低质量测试 = 虚假安全感

**关注点**:
1. 关键路径是否覆盖
2. 边界条件是否测试
3. 异常情况是否处理
4. 测试是否有意义

---

## 测试分类

### 1. 单元测试 (Unit Tests)

**定义**: 测试单个函数或类的功能

**特点**:
- 快速执行（< 100ms）
- 完全隔离（使用 mock）
- 测试单一职责

**示例**:
```python
@pytest.mark.unit
def test_calculate_rsi():
    """测试 RSI 指标计算"""
    data = create_sample_data(days=100)
    result = calculate_rsi(data, period=14)

    assert len(result) == len(data)
    assert 0 <= result.iloc[-1] <= 100
```

**覆盖范围**:
- `python/quant/data_adapter.py`
- `python/quant/features/technical.py`
- `python/quant/inference/predictor.py`
- `python/quant/training/trainer.py`

### 2. 集成测试 (Integration Tests)

**定义**: 测试多个模块协同工作

**特点**:
- 中等速度（< 1s）
- 真实依赖或部分 mock
- 测试模块交互

**示例**:
```python
@pytest.mark.integration
def test_training_pipeline():
    """测试完整训练流程"""
    # 数据获取 -> 特征计算 -> 模型训练
    symbols = ["600519", "000858"]

    # 获取数据
    data = [get_stock_history(s, days=500) for s in symbols]

    # 计算特征
    features = [TechnicalFeatures.calculate_all(d) for d in data]

    # 训练模型
    trainer = SignalTrainer()
    result = trainer.train(features)

    assert result['train_score'] > 0.5
    assert result['test_score'] > 0.5
```

**覆盖范围**:
- 数据获取 → 特征工程
- 特征工程 → 模型训练
- 模型训练 → 预测推理

### 3. 端到端测试 (E2E Tests)

**定义**: 测试完整的用户场景

**特点**:
- 较慢（< 5s）
- 真实环境
- 测试完整流程

**示例**:
```python
@pytest.mark.e2e
def test_full_prediction_workflow():
    """测试完整预测流程"""
    # 1. 训练模型
    trainer = SignalTrainer()
    trainer.train_from_symbols(["600519", "000858"])
    trainer.save()

    # 2. 加载模型
    predictor = SignalPredictor()
    predictor.load_model()

    # 3. 预测信号
    signal = predictor.predict("600036")

    assert signal in ['BUY', 'SELL', 'HOLD']
```

### 4. 性能测试 (Performance Tests)

**定义**: 测试系统性能和响应时间

**特点**:
- 测量执行时间
- 测量资源使用
- 设置性能基准

**示例**:
```python
@pytest.mark.performance
def test_prediction_speed():
    """测试预测速度"""
    predictor = SignalPredictor()
    predictor.load_model()

    start = time.time()
    predictor.predict("600519")
    duration = time.time() - start

    # 预测应在 500ms 内完成
    assert duration < 0.5
```

---

## 测试优先级

### P0 - 必须测试（关键路径）

1. **数据获取和验证**
   - `get_stock_history()` - 所有场景
   - `_validate_and_clean_dataframe()` - 边界条件

2. **特征计算**
   - `calculate_all()` - 完整特征集
   - 各个技术指标 - 正确性验证

3. **模型训练和预测**
   - `train()` - 训练流程
   - `predict()` - 预测逻辑

4. **异常处理**
   - 所有自定义异常
   - 重试机制

### P1 - 应该测试（重要功能）

1. **数据质量检查**
2. **模型保存和加载**
3. **日志记录**
4. **配置管理**

### P2 - 可以测试（辅助功能）

1. **工具函数**
2. **常量定义**
3. **类型定义**

---

## 质量门禁

### 代码提交前

```bash
# 1. 运行所有测试
pytest

# 2. 检查覆盖率
pytest --cov=python/quant --cov-report=term-missing

# 3. 代码质量检查
black python/
pylint python/quant/
mypy python/quant/
```

### Pull Request 要求

- [ ] 所有测试通过
- [ ] 新代码覆盖率 ≥ 80%
- [ ] 总体覆盖率不下降
- [ ] pylint 评分 ≥ 9.0
- [ ] mypy 无类型错误
- [ ] 代码审查通过

### CI/CD 检查

```yaml
# .github/workflows/ci.yml
- name: Run tests
  run: pytest --cov=python/quant --cov-report=xml

- name: Check coverage
  run: |
    coverage report --fail-under=80

- name: Code quality
  run: |
    pylint python/quant/ --fail-under=9.0
    mypy python/quant/
```

---

## 测试维护

### 定期审查

- **每周**: 检查失败的测试，修复或更新
- **每月**: 审查测试覆盖率，补充缺失测试
- **每季度**: 重构测试代码，提高可维护性

### 测试债务管理

识别和处理测试债务：
- 跳过的测试（`@pytest.mark.skip`）
- 标记为预期失败的测试（`@pytest.mark.xfail`）
- 覆盖率低的模块

### 测试重构

当测试变得难以维护时：
1. 提取公共 fixtures
2. 使用参数化减少重复
3. 改进测试命名
4. 添加文档字符串

---

## 参考资料

- [测试金字塔](https://martinfowler.com/articles/practical-test-pyramid.html)
- [pytest 最佳实践](https://docs.pytest.org/en/stable/goodpractices.html)
- [Google 测试博客](https://testing.googleblog.com/)

---

**维护者**: test-engineer
**审核者**: team-lead
**最后更新**: 2026-04-14
