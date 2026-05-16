"""
量化模块统一异常体系

定义了量化分析中所有可能出现的异常类型，提供清晰的错误层次结构。
所有量化模块的异常都应该继承自 QuantException。

异常层次:
    QuantException (基类)
    ├── DataError (数据相关错误)
    │   ├── DataFetchError (数据获取失败)
    │   ├── InsufficientDataError (数据量不足)
    │   ├── DataValidationError (数据验证失败)
    │   └── DataQualityError (数据质量问题)
    ├── ModelError (模型相关错误)
    │   ├── ModelNotFoundError (模型不存在)
    │   ├── ModelLoadError (模型加载失败)
    │   ├── ModelSaveError (模型保存失败)
    │   └── ModelPredictionError (预测失败)
    ├── FeatureError (特征工程错误)
    │   ├── FeatureCalculationError (特征计算失败)
    │   └── InvalidFeatureError (无效特征)
    ├── StrategyError (策略相关错误)
    │   ├── StrategyExecutionError (策略执行失败)
    │   └── InvalidSignalError (无效信号)
    └── ValidationError (输入验证错误)
        ├── InvalidSymbolError (无效股票代码)
        ├── InvalidParameterError (无效参数)
        └── InvalidDateRangeError (无效日期范围)

使用示例:
    >>> from quant.exceptions import DataFetchError, InsufficientDataError
    >>>
    >>> # 数据获取失败
    >>> try:
    ...     df = get_stock_history("600519", days=500)
    ... except DataFetchError as e:
    ...     logger.error(f"Failed to fetch data: {e}")
    ...     # 可以尝试重试或使用缓存数据
    >>>
    >>> # 数据量不足
    >>> if len(df) < 60:
    ...     raise InsufficientDataError(
    ...         symbol="600519",
    ...         required=60,
    ...         actual=len(df),
    ...         message="Need at least 60 days for MA60 calculation"
    ...     )
    >>>
    >>> # 模型不存在
    >>> try:
    ...     predictor = SignalPredictor()
    ... except ModelNotFoundError as e:
    ...     print(f"Please train model first: {e.model_path}")
"""


class QuantException(Exception):
    """
    量化模块基础异常类

    所有量化模块的异常都应该继承此类。
    提供统一的错误信息格式和上下文信息。

    Attributes:
        message: 错误描述信息
        context: 错误上下文信息（字典）
    """

    def __init__(self, message: str, **context):
        """
        初始化异常

        Args:
            message: 错误描述信息
            **context: 错误上下文信息（如 symbol, days, path 等）
        """
        self.message = message
        self.context = context
        super().__init__(self._format_message())

    def _format_message(self) -> str:
        """格式化错误信息"""
        if not self.context:
            return self.message

        context_str = ", ".join(f"{k}={v}" for k, v in self.context.items())
        return f"{self.message} ({context_str})"


# ============================================================================
# 数据相关错误
# ============================================================================


class DataError(QuantException):
    """
    数据相关错误基类

    所有与数据获取、处理、验证相关的错误都继承此类。
    """

    pass


class DataFetchError(DataError):
    """
    数据获取失败

    当从数据源（如 akshare_bridge）获取数据失败时抛出。
    可能的原因：网络错误、API限流、数据源不可用等。

    Example:
        >>> raise DataFetchError(
        ...     "Failed to fetch stock history from akshare",
        ...     symbol="600519",
        ...     days=500,
        ...     error="Connection timeout"
        ... )
    """

    pass


class InsufficientDataError(DataError):
    """
    数据量不足

    当获取的数据量不满足计算要求时抛出。
    例如：计算 MA60 需要至少 60 天数据，但只获取到 30 天。

    Example:
        >>> raise InsufficientDataError(
        ...     "Not enough data for technical indicators",
        ...     symbol="600519",
        ...     required=60,
        ...     actual=30,
        ...     indicator="MA60"
        ... )
    """

    pass


class DataValidationError(DataError):
    """
    数据验证失败

    当数据格式、类型或内容不符合预期时抛出。
    例如：缺少必需列、数据类型错误、日期格式错误等。

    Example:
        >>> raise DataValidationError(
        ...     "Missing required columns",
        ...     symbol="600519",
        ...     required_columns=["open", "high", "low", "close"],
        ...     missing_columns=["close"]
        ... )
    """

    pass


class DataQualityError(DataError):
    """
    数据质量问题

    当数据存在质量问题时抛出。
    例如：价格为负数、成交量异常、价格逻辑错误（high < low）等。

    Example:
        >>> raise DataQualityError(
        ...     "Invalid price data detected",
        ...     symbol="600519",
        ...     issue="high < low",
        ...     affected_rows=5
        ... )
    """

    pass


# ============================================================================
# 模型相关错误
# ============================================================================


class ModelError(QuantException):
    """
    模型相关错误基类

    所有与机器学习模型相关的错误都继承此类。
    """

    pass


class ModelNotFoundError(ModelError):
    """
    模型文件不存在

    当尝试加载不存在的模型文件时抛出。
    通常需要先运行训练命令创建模型。

    Example:
        >>> raise ModelNotFoundError(
        ...     "Model file does not exist",
        ...     model_path="/path/to/model.pkl",
        ...     suggestion="Run 'python ml_pipeline.py train' first"
        ... )
    """

    pass


class ModelLoadError(ModelError):
    """
    模型加载失败

    当模型文件存在但加载失败时抛出。
    可能的原因：文件损坏、版本不兼容、权限问题等。

    Example:
        >>> raise ModelLoadError(
        ...     "Failed to load model file",
        ...     model_path="/path/to/model.pkl",
        ...     error="Pickle protocol mismatch"
        ... )
    """

    pass


class ModelSaveError(ModelError):
    """
    模型保存失败

    当模型训练完成但保存失败时抛出。
    可能的原因：磁盘空间不足、权限问题、路径不存在等。

    Example:
        >>> raise ModelSaveError(
        ...     "Failed to save trained model",
        ...     model_path="/path/to/model.pkl",
        ...     error="Permission denied"
        ... )
    """

    pass


class ModelTrainingError(ModelError):
    """
    模型训练失败

    当模型训练过程中发生错误时抛出。
    可能的原因：数据问题、参数配置错误、内存不足等。

    Example:
        >>> raise ModelTrainingError(
        ...     "Model training failed",
        ...     error="Out of memory",
        ...     samples=10000,
        ...     features=100
        ... )
    """

    pass


class ModelPredictionError(ModelError):
    """
    模型预测失败

    当模型预测过程中出现错误时抛出。
    可能的原因：特征维度不匹配、数据类型错误、模型内部错误等。

    Example:
        >>> raise ModelPredictionError(
        ...     "Prediction failed due to feature mismatch",
        ...     expected_features=12,
        ...     actual_features=10,
        ...     missing_features=["ma60", "atr"]
        ... )
    """

    pass


# ============================================================================
# 特征工程错误
# ============================================================================


class FeatureError(QuantException):
    """
    特征工程错误基类

    所有与特征计算相关的错误都继承此类。
    """

    pass


class FeatureCalculationError(FeatureError):
    """
    特征计算失败

    当技术指标或特征计算过程中出现错误时抛出。
    可能的原因：数据不足、计算溢出、依赖特征缺失等。

    Example:
        >>> raise FeatureCalculationError(
        ...     "Failed to calculate RSI indicator",
        ...     indicator="RSI",
        ...     symbol="600519",
        ...     error="Division by zero in gain calculation"
        ... )
    """

    pass


class InvalidFeatureError(FeatureError):
    """
    无效特征

    当请求的特征不存在或不支持时抛出。

    Example:
        >>> raise InvalidFeatureError(
        ...     "Requested feature is not supported",
        ...     feature="unknown_indicator",
        ...     supported_features=["ma5", "ma10", "rsi", "macd"]
        ... )
    """

    pass


# ============================================================================
# 策略相关错误
# ============================================================================


class StrategyError(QuantException):
    """
    策略相关错误基类

    所有与量化策略执行相关的错误都继承此类。
    """

    pass


class StrategyExecutionError(StrategyError):
    """
    策略执行失败

    当量化策略执行过程中出现错误时抛出。

    Example:
        >>> raise StrategyExecutionError(
        ...     "Trend following strategy execution failed",
        ...     strategy="TrendFollowing",
        ...     symbol="600519",
        ...     error="Insufficient data for trend calculation"
        ... )
    """

    pass


class InvalidSignalError(StrategyError):
    """
    无效信号

    当策略生成的交易信号无效或不合理时抛出。

    Example:
        >>> raise InvalidSignalError(
        ...     "Generated signal is out of valid range",
        ...     signal=1.5,
        ...     valid_range="[-1, 1]"
        ... )
    """

    pass


# ============================================================================
# 输入验证错误
# ============================================================================


class ValidationError(QuantException):
    """
    输入验证错误基类

    所有与输入参数验证相关的错误都继承此类。
    """

    pass


class InvalidSymbolError(ValidationError):
    """
    无效股票代码

    当股票代码格式不正确或不存在时抛出。

    Example:
        >>> raise InvalidSymbolError(
        ...     "Invalid stock symbol format",
        ...     symbol="ABC123",
        ...     expected_format="6-digit number (e.g., 600519)"
        ... )
    """

    pass


class InvalidParameterError(ValidationError):
    """
    无效参数

    当函数参数值不在有效范围内时抛出。

    Example:
        >>> raise InvalidParameterError(
        ...     "Parameter 'days' out of valid range",
        ...     parameter="days",
        ...     value=-10,
        ...     valid_range="[1, 1000]"
        ... )
    """

    pass


class InvalidDateRangeError(ValidationError):
    """
    无效日期范围

    当日期范围不合理时抛出（如开始日期晚于结束日期）。

    Example:
        >>> raise InvalidDateRangeError(
        ...     "Start date is after end date",
        ...     start_date="2024-01-01",
        ...     end_date="2023-01-01"
        ... )
    """

    pass


# ============================================================================
# 便捷函数
# ============================================================================


def validate_symbol(symbol: str) -> str:
    """
    验证股票代码格式

    Args:
        symbol: 股票代码

    Returns:
        验证通过的股票代码

    Raises:
        InvalidSymbolError: 股票代码格式不正确

    Example:
        >>> symbol = validate_symbol("600519")  # OK
        >>> symbol = validate_symbol("ABC")     # Raises InvalidSymbolError
    """
    import re

    if not isinstance(symbol, str):
        raise InvalidSymbolError(
            "Symbol must be a string", symbol=symbol, type=type(symbol).__name__
        )

    if not re.match(r"^\d{1,6}$", symbol):
        raise InvalidSymbolError(
            "Invalid stock symbol format",
            symbol=symbol,
            expected_format="1-5 digit HK (e.g., 1, 700, 9988, 00700) or 6-digit A-share (e.g., 600519)",
        )

    return symbol


def validate_days(days: int, min_days: int = 1, max_days: int = 1000) -> int:
    """
    验证天数参数

    Args:
        days: 天数
        min_days: 最小天数（默认1）
        max_days: 最大天数（默认1000）

    Returns:
        验证通过的天数

    Raises:
        InvalidParameterError: 天数不在有效范围内

    Example:
        >>> days = validate_days(500)    # OK
        >>> days = validate_days(-10)    # Raises InvalidParameterError
        >>> days = validate_days(2000)   # Raises InvalidParameterError
    """
    if not isinstance(days, int):
        raise InvalidParameterError(
            "Parameter 'days' must be an integer",
            parameter="days",
            value=days,
            type=type(days).__name__,
        )

    if days < min_days or days > max_days:
        raise InvalidParameterError(
            "Parameter 'days' out of valid range",
            parameter="days",
            value=days,
            valid_range=f"[{min_days}, {max_days}]",
        )

    return days


def validate_dataframe_columns(df, required_columns: list, symbol: str = None):
    """
    验证 DataFrame 是否包含必需的列

    Args:
        df: pandas DataFrame
        required_columns: 必需的列名列表
        symbol: 股票代码（可选，用于错误信息）

    Raises:
        DataValidationError: 缺少必需的列

    Example:
        >>> validate_dataframe_columns(
        ...     df,
        ...     required_columns=["open", "high", "low", "close"],
        ...     symbol="600519"
        ... )
    """
    missing_columns = [col for col in required_columns if col not in df.columns]

    if missing_columns:
        raise DataValidationError(
            "Missing required columns in DataFrame",
            symbol=symbol,
            required_columns=required_columns,
            missing_columns=missing_columns,
            available_columns=list(df.columns),
        )
