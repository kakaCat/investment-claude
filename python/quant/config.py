"""量化模块配置"""

from pathlib import Path

# 项目路径
PROJECT_ROOT = Path(__file__).parent
MODELS_DIR = PROJECT_ROOT / "models"
MODELS_DIR.mkdir(exist_ok=True)

# 模型配置
MODEL_PATH = MODELS_DIR / "signal_model.pkl"

# 特征列表
FEATURE_COLUMNS = [
    "ma5",
    "ma10",
    "ma20",
    "ma60",
    "rsi",
    "macd",
    "macd_signal",
    "macd_hist",
    "bb_width",
    "atr",
    "price_change",
    "volume_change",
]

# 数据配置
DEFAULT_HISTORY_DAYS = 200
TRAIN_HISTORY_DAYS = 500
MAX_HISTORY_DAYS = 1000

# 训练配置
TRAIN_SYMBOLS_LIMIT = 20
EVAL_SYMBOLS_LIMIT = 5

# 预测配置
BUY_THRESHOLD = 0.6  # 买入信号阈值
SELL_THRESHOLD = 0.4  # 卖出信号阈值
