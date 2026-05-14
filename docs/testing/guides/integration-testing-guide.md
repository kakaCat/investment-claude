# 集成测试指南

> 如何编写集成测试验证模块协同工作

**版本**: v1.0
**更新日期**: 2026-04-14

---

## 📋 目录

1. [什么是集成测试](#什么是集成测试)
2. [集成测试 vs 单元测试](#集成测试-vs-单元测试)
3. [测试数据流](#测试数据流)
4. [测试训练流程](#测试训练流程)
5. [测试预测流程](#测试预测流程)
6. [最佳实践](#最佳实践)

---

## 什么是集成测试

集成测试验证**多个模块协同工作**，确保模块之间的接口和交互正确。

### 特点

- **中等速度**: 每个测试 < 1s
- **部分真实**: 使用真实依赖或部分 mock
- **测试交互**: 验证模块间的数据流和协作
- **数量适中**: 占总测试的 15%

### 集成测试的价值

单元测试验证每个模块单独工作正常，但不能保证它们组合在一起也能正常工作。集成测试填补了这个空白。

```
单元测试: ✅ 模块 A 正常 + ✅ 模块 B 正常
集成测试: ✅ 模块 A + B 协同工作正常
```

---

## 集成测试 vs 单元测试

| 特性 | 单元测试 | 集成测试 |
|------|---------|---------|
| 测试范围 | 单个函数/类 | 多个模块协同 |
| 外部依赖 | 全部 Mock | 部分或不 Mock |
| 执行速度 | 快（< 100ms） | 中（< 1s） |
| 测试重点 | 函数逻辑正确性 | 模块交互正确性 |
| 失败原因 | 单一模块问题 | 接口不匹配、数据流问题 |
| 数量占比 | 80% | 15% |

### 示例对比

```python
# 单元测试 - 测试单个函数
@patch('quant.data_adapter.akshare_bridge')
def test_get_stock_history_unit(mock_bridge):
    """单元测试：只测试 get_stock_history 函数"""
    mock_bridge.get_stock_history.return_value = mock_data
    result = get_stock_history("600519", days=100)
    assert not result.empty

# 集成测试 - 测试多个模块协同
@pytest.mark.integration
def test_data_to_features_integration():
    """集成测试：测试数据获取 -> 特征计算流程"""
    # 真实调用数据获取（或使用真实数据）
    data = get_stock_history("600519", days=100)

    # 真实调用特征计算
    features = TechnicalFeatures.calculate_all(data)

    # 验证数据流正确
    assert len(features) == len(data)
    assert 'ma5' in features.columns
    assert not features.isnull().any()
```

---

## 测试数据流

集成测试的核心是验证数据在模块间正确流动。

### 数据获取 → 特征计算

```python
@pytest.mark.integration
class TestDataToFeatures:
    """测试数据获取到特征计算的流程"""

    def test_complete_flow(self):
        """测试完整数据流"""
        # Step 1: 获取数据
        data = get_stock_history("600519", days=200)
        assert not data.empty
        assert len(data) >= 60  # 至少需要 60 天计算 MA60

        # Step 2: 计算特征
        features = TechnicalFeatures.calculate_all(data)

        # Step 3: 验证特征
        assert len(features) == len(data)
        assert all(col in features.columns for col in [
            'ma5', 'ma10', 'ma20', 'ma60', 'rsi', 'macd'
        ])

        # Step 4: 验证数据质量
        assert not features.isnull().any()
        assert all(features['rsi'] >= 0)
        assert all(features['rsi'] <= 100)

    def test_handles_minimal_data(self):
        """测试最小数据量"""
        # 只有 60 天数据（MA60 的最小要求）
        data = get_stock_history("600519", days=60)
        features = TechnicalFeatures.calculate_all(data)

        # 应该能计算，但可能有 NaN
        assert not features.empty
        assert 'ma60' in features.columns

    def test_multiple_symbols(self):
        """测试多个股票"""
        symbols = ["600519", "000858", "600036"]

        for symbol in symbols:
            data = get_stock_history(symbol, days=100)
            features = TechnicalFeatures.calculate_all(data)

            assert not features.empty
            assert len(features) == len(data)
```

### 特征计算 → 模型训练

```python
@pytest.mark.integration
class TestFeaturesToTraining:
    """测试特征计算到模型训练的流程"""

    def test_training_with_real_features(self):
        """使用真实特征训练模型"""
        # Step 1: 准备训练数据
        symbols = ["600519", "000858"]
        all_features = []

        for symbol in symbols:
            data = get_stock_history(symbol, days=500)
            features = TechnicalFeatures.calculate_all(data)
            all_features.append(features)

        # Step 2: 训练模型
        trainer = SignalTrainer()
        result = trainer.train(all_features)

        # Step 3: 验证训练结果
        assert result['train_score'] > 0.5
        assert result['test_score'] > 0.5
        assert result['n_samples'] > 0
        assert trainer.model is not None

    def test_feature_compatibility(self):
        """测试特征与模型的兼容性"""
        # 计算特征
        data = get_stock_history("600519", days=200)
        features = TechnicalFeatures.calculate_all(data)

        # 准备训练数据
        X, y = prepare_training_data(features)

        # 验证特征列与配置一致
        from quant.config import FEATURE_COLUMNS
        assert all(col in X.columns for col in FEATURE_COLUMNS)
```

### 模型训练 → 预测推理

```python
@pytest.mark.integration
class TestTrainingToPrediction:
    """测试模型训练到预测推理的流程"""

    def test_train_save_load_predict(self):
        """测试完整的训练-保存-加载-预测流程"""
        # Step 1: 训练模型
        trainer = SignalTrainer()
        symbols = ["600519", "000858"]

        all_features = []
        for symbol in symbols:
            data = get_stock_history(symbol, days=500)
            features = TechnicalFeatures.calculate_all(data)
            all_features.append(features)

        trainer.train(all_features)

        # Step 2: 保存模型
        model_path = trainer.save("test_model.pkl")
        assert os.path.exists(model_path)

        # Step 3: 加载模型
        predictor = SignalPredictor()
        predictor.load_model("test_model.pkl")

        # Step 4: 预测
        signal = predictor.predict("600036")

        # Step 5: 验证预测结果
        assert signal in ['BUY', 'SELL', 'HOLD']
        assert 0 <= predictor.last_probability <= 1

        # 清理
        os.remove(model_path)
```

---

## 测试训练流程

### 完整训练流程

```python
@pytest.mark.integration
class TestTrainingPipeline:
    """测试完整训练流程"""

    def test_full_training_pipeline(self):
        """测试从数据到模型的完整流程"""
        # Step 1: 数据获取
        symbols = ["600519", "000858", "600036"]
        raw_data = []

        for symbol in symbols:
            data = get_stock_history(symbol, days=500)
            assert not data.empty
            raw_data.append(data)

        # Step 2: 特征工程
        features_list = []
        for data in raw_data:
            features = TechnicalFeatures.calculate_all(data)
            assert not features.empty
            features_list.append(features)

        # Step 3: 数据准备
        X_list, y_list = [], []
        for features in features_list:
            X, y = prepare_training_data(features)
            X_list.append(X)
            y_list.append(y)

        # 合并数据
        X_train = pd.concat(X_list, ignore_index=True)
        y_train = pd.concat(y_list, ignore_index=True)

        # Step 4: 模型训练
        trainer = SignalTrainer()
        result = trainer.train_with_data(X_train, y_train)

        # Step 5: 验证结果
        assert result['train_score'] > 0.5
        assert result['test_score'] > 0.5
        assert trainer.model is not None

        # Step 6: 模型保存
        model_path = trainer.save()
        assert os.path.exists(model_path)

        # 清理
        os.remove(model_path)

    def test_training_with_insufficient_data(self):
        """测试数据不足时的处理"""
        # 只有一个股票的少量数据
        data = get_stock_history("600519", days=100)
        features = TechnicalFeatures.calculate_all(data)

        trainer = SignalTrainer()

        # 应该能训练，但可能性能不佳
        result = trainer.train([features])

        # 至少不应该崩溃
        assert result is not None
        assert 'train_score' in result
```

### 测试训练性能

```python
@pytest.mark.integration
@pytest.mark.performance
class TestTrainingPerformance:
    """测试训练性能"""

    def test_training_speed(self):
        """测试训练速度"""
        import time

        # 准备数据
        symbols = ["600519", "000858"]
        features_list = []

        for symbol in symbols:
            data = get_stock_history(symbol, days=500)
            features = TechnicalFeatures.calculate_all(data)
            features_list.append(features)

        # 测量训练时间
        trainer = SignalTrainer()
        start = time.time()
        trainer.train(features_list)
        duration = time.time() - start

        # 训练应在合理时间内完成（< 10s）
        assert duration < 10, f"Training took {duration:.2f}s, expected < 10s"
```

---

## 测试预测流程

### 完整预测流程

```python
@pytest.mark.integration
class TestPredictionPipeline:
    """测试完整预测流程"""

    @pytest.fixture(scope="class")
    def trained_model(self):
        """准备训练好的模型"""
        trainer = SignalTrainer()
        symbols = ["600519", "000858"]

        features_list = []
        for symbol in symbols:
            data = get_stock_history(symbol, days=500)
            features = TechnicalFeatures.calculate_all(data)
            features_list.append(features)

        trainer.train(features_list)
        model_path = trainer.save("test_integration_model.pkl")

        yield model_path

        # 清理
        if os.path.exists(model_path):
            os.remove(model_path)

    def test_full_prediction_pipeline(self, trained_model):
        """测试从数据到预测的完整流程"""
        # Step 1: 加载模型
        predictor = SignalPredictor()
        predictor.load_model(os.path.basename(trained_model))

        # Step 2: 获取新数据
        symbol = "600036"
        data = get_stock_history(symbol, days=200)

        # Step 3: 计算特征
        features = TechnicalFeatures.calculate_all(data)

        # Step 4: 预测
        X = features[FEATURE_COLUMNS].iloc[-1:].dropna()
        signal = predictor.predict_from_features(X)

        # Step 5: 验证结果
        assert signal in ['BUY', 'SELL', 'HOLD']
        assert 0 <= predictor.last_probability <= 1

    def test_batch_prediction(self, trained_model):
        """测试批量预测"""
        predictor = SignalPredictor()
        predictor.load_model(os.path.basename(trained_model))

        symbols = ["600519", "000858", "600036"]
        results = []

        for symbol in symbols:
            signal = predictor.predict(symbol)
            results.append({
                'symbol': symbol,
                'signal': signal,
                'probability': predictor.last_probability
            })

        # 验证所有预测
        assert len(results) == len(symbols)
        for result in results:
            assert result['signal'] in ['BUY', 'SELL', 'HOLD']
            assert 0 <= result['probability'] <= 1
```

### 测试预测性能

```python
@pytest.mark.integration
@pytest.mark.performance
class TestPredictionPerformance:
    """测试预测性能"""

    def test_prediction_speed(self, trained_model):
        """测试预测速度"""
        import time

        predictor = SignalPredictor()
        predictor.load_model(os.path.basename(trained_model))

        # 测量单次预测时间
        start = time.time()
        predictor.predict("600519")
        duration = time.time() - start

        # 预测应在 500ms 内完成
        assert duration < 0.5, f"Prediction took {duration:.3f}s, expected < 0.5s"

    def test_batch_prediction_speed(self, trained_model):
        """测试批量预测速度"""
        import time

        predictor = SignalPredictor()
        predictor.load_model(os.path.basename(trained_model))

        symbols = ["600519", "000858", "600036", "601318", "000333"]

        start = time.time()
        for symbol in symbols:
            predictor.predict(symbol)
        duration = time.time() - start

        # 平均每个预测 < 500ms
        avg_time = duration / len(symbols)
        assert avg_time < 0.5, f"Average prediction time {avg_time:.3f}s, expected < 0.5s"
```

---

## 最佳实践

### 1. 使用真实数据（或接近真实）

```python
# ✅ 好的集成测试 - 使用真实数据流
@pytest.mark.integration
def test_with_real_data():
    data = get_stock_history("600519", days=100)  # 真实调用
    features = TechnicalFeatures.calculate_all(data)  # 真实计算
    assert not features.empty

# ❌ 不好的集成测试 - 全部 mock
@patch('module.get_stock_history')
@patch('module.TechnicalFeatures')
def test_with_all_mocks(mock_features, mock_data):
    # 这更像单元测试，不是集成测试
    pass
```

### 2. 测试关键路径

集成测试应该覆盖最重要的用户场景：

```python
@pytest.mark.integration
class TestCriticalPaths:
    """测试关键路径"""

    def test_new_user_first_prediction(self):
        """新用户首次预测（最常见场景）"""
        # 1. 训练模型
        # 2. 保存模型
        # 3. 加载模型
        # 4. 预测
        pass

    def test_model_update_workflow(self):
        """模型更新工作流"""
        # 1. 加载旧模型
        # 2. 用新数据重新训练
        # 3. 保存新模型
        # 4. 验证新模型性能
        pass
```

### 3. 使用 Fixtures 准备测试环境

```python
@pytest.fixture(scope="module")
def test_environment():
    """准备测试环境"""
    # Setup
    model_dir = Path("/tmp/test_models")
    model_dir.mkdir(exist_ok=True)

    yield model_dir

    # Teardown
    import shutil
    shutil.rmtree(model_dir)

@pytest.mark.integration
def test_with_environment(test_environment):
    """使用测试环境"""
    trainer = SignalTrainer(model_dir=test_environment)
    # ...
```

### 4. 测试错误恢复

```python
@pytest.mark.integration
def test_error_recovery():
    """测试错误恢复"""
    # 模拟网络错误
    with patch('quant.data_adapter.akshare_bridge') as mock:
        mock.get_stock_history.side_effect = [
            ConnectionError("Network error"),
            {'data': [...]}  # 第二次成功
        ]

        # 应该能重试并成功
        data = get_stock_history("600519", days=100, retry=3)
        assert not data.empty
```

### 5. 验证数据一致性

```python
@pytest.mark.integration
def test_data_consistency():
    """测试数据在模块间传递的一致性"""
    # 获取数据
    data = get_stock_history("600519", days=100)
    original_length = len(data)

    # 计算特征
    features = TechnicalFeatures.calculate_all(data)

    # 验证数据长度一致
    assert len(features) == original_length

    # 验证日期一致
    assert all(features['date'] == data['date'])
```

### 6. 使用标记分类测试

```python
@pytest.mark.integration
@pytest.mark.slow
def test_slow_integration():
    """慢速集成测试"""
    pass

@pytest.mark.integration
@pytest.mark.requires_network
def test_with_network():
    """需要网络的集成测试"""
    pass

# 运行时可以选择性执行
# pytest -m "integration and not slow"
```

---

## 运行集成测试

```bash
# 运行所有集成测试
pytest tests/integration/ -v

# 运行特定集成测试文件
pytest tests/integration/backend/test_training_pipeline.py -v

# 使用标记运行
pytest -m integration -v

# 排除慢速测试
pytest -m "integration and not slow" -v

# 显示详细输出
pytest tests/integration/ -v -s
```

---

## 故障排查

### 常见问题

**1. 测试太慢**
```python
# 解决方案：减少数据量或使用缓存
@pytest.fixture(scope="module")  # 模块级别，只运行一次
def cached_data():
    return get_stock_history("600519", days=100)
```

**2. 测试不稳定**
```python
# 解决方案：增加重试或使用固定数据
@pytest.mark.flaky(reruns=3)  # 失败时重试 3 次
def test_unstable():
    pass
```

**3. 依赖外部服务**
```python
# 解决方案：使用条件跳过
@pytest.mark.skipif(not network_available(), reason="No network")
def test_requires_network():
    pass
```

---

## 参考资料

- [集成测试最佳实践](https://martinfowler.com/bliki/IntegrationTest.html)
- [pytest 集成测试](https://docs.pytest.org/en/stable/example/simple.html)

---

**维护者**: test-engineer
**最后更新**: 2026-04-14
