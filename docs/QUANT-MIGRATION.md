# 量化功能使用指南

## 概述

已成功将 `pi-investment` 项目的量化分析功能迁移到 `investment-claude` 项目。

## 目录结构

```
python/quant/
├── ml_pipeline.py          # CLI 入口
├── data_adapter.py         # 数据适配器（连接 akshare_bridge）
├── requirements.txt        # Python 依赖
├── features/
│   └── technical.py        # 技术指标计算（MA, RSI, MACD, 布林带等）
├── inference/
│   └── predictor.py        # ML 预测器
├── training/
│   └── trainer.py          # 模型训练器
├── strategies/
│   ├── base.py
│   ├── mean_reversion.py   # 均值回归策略
│   ├── momentum.py         # 动量策略
│   └── trend_following.py  # 趋势跟踪策略
└── models/                 # 模型存储目录
```

## 功能说明

### 1. 技术指标计算

支持的技术指标：
- 移动平均线：MA5, MA10, MA20, MA60
- 相对强弱指标：RSI
- MACD：MACD, MACD Signal, MACD Histogram
- 布林带：BB Upper, BB Middle, BB Lower, BB Width
- 平均真实波幅：ATR
- 价格/成交量变化率

### 2. ML 预测

- 使用 XGBoost 分类模型
- 预测未来 5 日上涨概率
- 支持模型训练、预测、评估

### 3. 量化策略

- 均值回归策略
- 动量策略
- 趋势跟踪策略

## 使用方法

### 命令行使用

```bash
# 1. 训练模型（使用多只股票的历史数据）
python python/quant/ml_pipeline.py train

# 2. 预测股票信号
python python/quant/ml_pipeline.py predict --symbol 600519

# 3. 评估模型性能
python python/quant/ml_pipeline.py evaluate
```

### 在 Agent 中使用

通过 `QuantTool` 调用：

```typescript
// 预测股票信号
{
  function: 'predict_signal',
  symbol: '600519'
}

// 训练模型
{
  function: 'train_model'
}

// 评估模型
{
  function: 'evaluate_model'
}
```

## 数据流

```
Agent (investment-claude)
  ↓
QuantTool
  ↓
python/quant/ml_pipeline.py
  ↓
data_adapter.py → akshare_bridge.py → 新浪财经 API
  ↓
features/technical.py (计算技术指标)
  ↓
inference/predictor.py (ML 预测)
  ↓
返回预测结果
```

## 技术细节

### 数据适配器

`data_adapter.py` 负责：
- 调用 `akshare_bridge.py` 获取股票历史数据
- 转换数据格式为量化模块需要的格式
- 添加缺失的列（amount, turnover_rate）

### 特征工程

`features/technical.py` 提供：
- 数据清洗（处理缺失值、异常值）
- 技术指标计算
- 标签生成（未来 5 日涨幅 > 2% 为正样本）

### 模型训练

`training/trainer.py` 提供：
- XGBoost 分类器训练
- 自动处理类别不平衡（scale_pos_weight）
- 训练/测试集分割（80/20）
- 模型持久化

### 预测器

`inference/predictor.py` 提供：
- 加载训练好的模型
- 预测上涨概率
- 返回 0-1 之间的概率值

## 依赖

```
scikit-learn >= 1.3.0
xgboost >= 2.0.0
pandas >= 2.0.0
numpy >= 1.24.0
```

## 注意事项

1. **首次使用需要训练模型**：运行 `python python/quant/ml_pipeline.py train`
2. **数据量限制**：akshare_bridge 单次最多返回 1000 条历史数据
3. **模型存储**：模型保存在 `python/quant/models/signal_model.pkl`
4. **Python 环境**：使用 conda 环境的 `python` 命令（已安装 akshare）

## 后续优化

- [ ] 增加更多技术指标
- [ ] 支持多种 ML 模型（LSTM, Random Forest 等）
- [ ] 实现回测引擎
- [ ] 添加风险管理模块
- [ ] 支持实时信号推送
