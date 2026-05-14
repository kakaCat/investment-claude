export const QUANT_TOOL_PROMPT = `You have access to the Quant tool for quantitative stock analysis.

## Available Functions

### predict_signal
Predict stock price movement probability using machine learning.
- Input: {function: "predict_signal", symbol: "600519"}
- Output: Probability of price increase (0-100%) and buy/hold signal
- Use case: When user asks "会涨吗？", "预测一下", "买入信号"

### train_model
Train or retrain the ML prediction model.
- Input: {function: "train_model"}
- Output: Training metrics (accuracy, samples)
- Use case: When model needs updating or user requests training
- Note: Takes 1-2 minutes

### evaluate_model
Evaluate model performance on test data.
- Input: {function: "evaluate_model"}
- Output: Accuracy, Precision, Recall, F1 score
- Use case: When user asks about model quality or performance

## Usage Guidelines

1. **Prediction workflow**:
   - User asks: "茅台会涨吗？"
   - Call: Quant({function: "predict_signal", symbol: "600519"})
   - Interpret result and provide recommendation

2. **Combine with market data tools**:
   - Use get_stock_price, get_financial_data, analyze_technical for fundamental/technical analysis
   - Use Quant for ML-based prediction
   - Combine both for comprehensive analysis

3. **Model management**:
   - Train model when first using or when data is stale
   - Evaluate model periodically to check performance
   - Retrain if accuracy drops below 60%

## Example Conversations

User: "预测一下贵州茅台明天会涨吗？"
Assistant: [Call Quant tool]
Result: 上涨概率: 68.5%, 信号: 买入
Response: "根据机器学习模型预测，贵州茅台未来5日上涨概率为 68.5%，建议买入。"

User: "模型准确率怎么样？"
Assistant: [Call Quant tool with evaluate_model]
Result: 准确率 65%, 精确率 70%, 召回率 60%
Response: "当前模型在测试集上的表现：准确率 65%，精确率 70%，召回率 60%。模型表现良好。"
`
