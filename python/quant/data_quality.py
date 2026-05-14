"""
数据质量检查模块

提供全面的数据质量检查功能，包括：
- 完整性检查（缺失值、必需列）
- 一致性检查（日期连续性、价格逻辑）
- 质量指标（数据量、时间范围、异常值比例）
- 质量报告生成

使用示例:
    >>> from quant.data_quality import DataQualityChecker
    >>>
    >>> checker = DataQualityChecker()
    >>> report = checker.check(df, symbol="600519")
    >>> print(report)
    >>>
    >>> if not report.is_passed:
    ...     print(f"Quality issues: {report.issues}")
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd
from quant.exceptions import DataQualityError, DataValidationError
from quant.logger import setup_logger

logger = setup_logger(__name__)


@dataclass
class QualityIssue:
    """质量问题"""

    severity: str  # "error", "warning", "info"
    category: str  # "completeness", "consistency", "quality"
    message: str
    details: Dict[str, Any] = field(default_factory=dict)

    def __str__(self):
        severity_emoji = {"error": "❌", "warning": "⚠️", "info": "ℹ️"}
        emoji = severity_emoji.get(self.severity, "")
        return f"{emoji} [{self.category}] {self.message}"


@dataclass
class QualityReport:
    """数据质量报告"""

    symbol: str
    total_rows: int
    date_range: tuple
    issues: List[QualityIssue] = field(default_factory=list)
    metrics: Dict[str, Any] = field(default_factory=dict)
    is_passed: bool = True

    def add_issue(self, severity: str, category: str, message: str, **details):
        """添加质量问题"""
        issue = QualityIssue(severity, category, message, details)
        self.issues.append(issue)
        if severity == "error":
            self.is_passed = False

    def get_summary(self) -> str:
        """获取摘要"""
        error_count = sum(1 for i in self.issues if i.severity == "error")
        warning_count = sum(1 for i in self.issues if i.severity == "warning")
        info_count = sum(1 for i in self.issues if i.severity == "info")

        status = "✅ PASSED" if self.is_passed else "❌ FAILED"

        lines = [
            f"\n{'='*60}",
            f"Data Quality Report - {self.symbol}",
            f"{'='*60}",
            f"Status: {status}",
            f"Total Rows: {self.total_rows}",
            f"Date Range: {self.date_range[0]} to {self.date_range[1]}",
            f"Issues: {error_count} errors, {warning_count} warnings, {info_count} info",
            f"{'='*60}",
        ]

        if self.issues:
            lines.append("\nIssues:")
            for issue in self.issues:
                lines.append(f"  {issue}")
                if issue.details:
                    for key, value in issue.details.items():
                        lines.append(f"    - {key}: {value}")

        if self.metrics:
            lines.append("\nMetrics:")
            for key, value in self.metrics.items():
                lines.append(f"  - {key}: {value}")

        lines.append(f"{'='*60}\n")
        return "\n".join(lines)

    def __str__(self):
        return self.get_summary()


class DataQualityChecker:
    """
    数据质量检查器

    提供全面的数据质量检查功能。
    """

    def __init__(
        self,
        min_rows: int = 60,
        max_missing_ratio: float = 0.1,
        max_outlier_ratio: float = 0.05,
        check_date_continuity: bool = True,
    ):
        """
        初始化检查器

        Args:
            min_rows: 最小行数要求
            max_missing_ratio: 最大缺失值比例（0-1）
            max_outlier_ratio: 最大异常值比例（0-1）
            check_date_continuity: 是否检查日期连续性
        """
        self.min_rows = min_rows
        self.max_missing_ratio = max_missing_ratio
        self.max_outlier_ratio = max_outlier_ratio
        self.check_date_continuity = check_date_continuity

        logger.info(
            "DataQualityChecker initialized",
            extra={
                "min_rows": min_rows,
                "max_missing_ratio": max_missing_ratio,
                "max_outlier_ratio": max_outlier_ratio,
            },
        )

    def check(self, df: pd.DataFrame, symbol: str = "UNKNOWN") -> QualityReport:
        """
        执行完整的数据质量检查

        Args:
            df: 待检查的 DataFrame
            symbol: 股票代码

        Returns:
            QualityReport: 质量报告

        Raises:
            DataValidationError: 数据验证失败
        """
        logger.info("Starting data quality check", extra={"symbol": symbol, "rows": len(df)})

        # 基本验证
        if not isinstance(df, pd.DataFrame):
            raise DataValidationError(
                "Input must be a pandas DataFrame", input_type=type(df).__name__
            )

        if df.empty:
            raise DataValidationError("DataFrame is empty", symbol=symbol, rows=0)

        # 创建报告
        date_range = (
            df["date"].min().strftime("%Y-%m-%d") if "date" in df.columns else "N/A",
            df["date"].max().strftime("%Y-%m-%d") if "date" in df.columns else "N/A",
        )
        report = QualityReport(symbol=symbol, total_rows=len(df), date_range=date_range)

        # 执行各项检查
        self._check_completeness(df, report)
        self._check_consistency(df, report)
        self._check_quality_metrics(df, report)

        logger.info(
            "Data quality check completed",
            extra={
                "symbol": symbol,
                "is_passed": report.is_passed,
                "error_count": sum(1 for i in report.issues if i.severity == "error"),
                "warning_count": sum(1 for i in report.issues if i.severity == "warning"),
            },
        )

        return report

    def _check_completeness(self, df: pd.DataFrame, report: QualityReport):
        """检查数据完整性"""
        logger.debug("Checking data completeness", extra={"symbol": report.symbol})

        # 检查必需列
        required_columns = ["date", "open", "high", "low", "close", "volume"]
        missing_columns = [col for col in required_columns if col not in df.columns]

        if missing_columns:
            report.add_issue(
                "error",
                "completeness",
                f"Missing required columns: {missing_columns}",
                missing_columns=missing_columns,
                available_columns=list(df.columns),
            )
            return  # 无法继续检查

        # 检查数据量
        if len(df) < self.min_rows:
            report.add_issue(
                "error",
                "completeness",
                f"Insufficient data rows",
                required=self.min_rows,
                actual=len(df),
            )

        # 检查缺失值
        for col in required_columns:
            missing_count = df[col].isna().sum()
            if missing_count > 0:
                missing_ratio = missing_count / len(df)
                severity = "error" if missing_ratio > self.max_missing_ratio else "warning"
                report.add_issue(
                    severity,
                    "completeness",
                    f"Column '{col}' has missing values",
                    column=col,
                    missing_count=missing_count,
                    missing_ratio=f"{missing_ratio:.2%}",
                )

    def _check_consistency(self, df: pd.DataFrame, report: QualityReport):
        """检查数据一致性"""
        logger.debug("Checking data consistency", extra={"symbol": report.symbol})

        if "date" not in df.columns:
            return

        # 检查日期类型
        if not pd.api.types.is_datetime64_any_dtype(df["date"]):
            report.add_issue(
                "warning",
                "consistency",
                "Date column is not datetime type",
                current_type=str(df["date"].dtype),
            )

        # 检查日期排序
        if not df["date"].is_monotonic_increasing:
            report.add_issue("warning", "consistency", "Dates are not sorted in ascending order")

        # 检查日期连续性（仅工作日）
        if self.check_date_continuity and len(df) > 1:
            dates = pd.to_datetime(df["date"])
            date_diffs = dates.diff().dt.days.dropna()

            # 允许的间隔：1天（连续交易日）或3天（周末）
            large_gaps = date_diffs[date_diffs > 5]
            if len(large_gaps) > 0:
                report.add_issue(
                    "info",
                    "consistency",
                    f"Found {len(large_gaps)} large date gaps (>5 days)",
                    max_gap=int(large_gaps.max()),
                    gap_count=len(large_gaps),
                )

        # 检查价格逻辑
        if all(col in df.columns for col in ["open", "high", "low", "close"]):
            # high >= low
            invalid_high_low = df["high"] < df["low"]
            if invalid_high_low.any():
                report.add_issue(
                    "error",
                    "consistency",
                    "Found rows where high < low",
                    invalid_count=int(invalid_high_low.sum()),
                )

            # close 在 high 和 low 之间
            invalid_close = (df["close"] > df["high"]) | (df["close"] < df["low"])
            if invalid_close.any():
                report.add_issue(
                    "error",
                    "consistency",
                    "Found rows where close is outside [low, high] range",
                    invalid_count=int(invalid_close.sum()),
                )

            # open 在 high 和 low 之间
            invalid_open = (df["open"] > df["high"]) | (df["open"] < df["low"])
            if invalid_open.any():
                report.add_issue(
                    "warning",
                    "consistency",
                    "Found rows where open is outside [low, high] range",
                    invalid_count=int(invalid_open.sum()),
                )

    def _check_quality_metrics(self, df: pd.DataFrame, report: QualityReport):
        """检查质量指标"""
        logger.debug("Checking quality metrics", extra={"symbol": report.symbol})

        # 价格异常值检查
        if "close" in df.columns:
            # 检查零值或负值
            invalid_prices = (df["close"] <= 0).sum()
            if invalid_prices > 0:
                report.add_issue(
                    "error",
                    "quality",
                    "Found invalid prices (<=0)",
                    invalid_count=int(invalid_prices),
                )

            # 检查极端价格变化（单日涨跌幅 >20%）
            if len(df) > 1:
                price_changes = df["close"].pct_change(fill_method=None).abs()
                extreme_changes = (price_changes > 0.2).sum()
                if extreme_changes > 0:
                    extreme_ratio = extreme_changes / len(df)
                    severity = "warning" if extreme_ratio < self.max_outlier_ratio else "error"
                    report.add_issue(
                        severity,
                        "quality",
                        "Found extreme price changes (>20%)",
                        extreme_count=int(extreme_changes),
                        extreme_ratio=f"{extreme_ratio:.2%}",
                        max_change=f"{price_changes.max():.2%}",
                    )

        # 成交量异常值检查
        if "volume" in df.columns:
            # 检查负值
            invalid_volumes = (df["volume"] < 0).sum()
            if invalid_volumes > 0:
                report.add_issue(
                    "error",
                    "quality",
                    "Found invalid volumes (<0)",
                    invalid_count=int(invalid_volumes),
                )

            # 检查零成交量
            zero_volumes = (df["volume"] == 0).sum()
            if zero_volumes > 0:
                zero_ratio = zero_volumes / len(df)
                if zero_ratio > 0.05:  # 超过5%
                    report.add_issue(
                        "warning",
                        "quality",
                        "High proportion of zero volume days",
                        zero_count=int(zero_volumes),
                        zero_ratio=f"{zero_ratio:.2%}",
                    )

        # 计算质量指标
        report.metrics["total_rows"] = len(df)

        if "date" in df.columns:
            date_range_days = (df["date"].max() - df["date"].min()).days
            report.metrics["date_range_days"] = date_range_days
            report.metrics["data_density"] = f"{len(df) / max(date_range_days, 1):.2f} rows/day"

        if "close" in df.columns:
            report.metrics["price_range"] = f"{df['close'].min():.2f} - {df['close'].max():.2f}"
            report.metrics["avg_price"] = f"{df['close'].mean():.2f}"

        if "volume" in df.columns:
            report.metrics["avg_volume"] = f"{df['volume'].mean():.0f}"
            report.metrics["total_volume"] = f"{df['volume'].sum():.0f}"


def check_data_quality(df: pd.DataFrame, symbol: str = "UNKNOWN", **kwargs) -> QualityReport:
    """
    便捷函数：检查数据质量

    Args:
        df: 待检查的 DataFrame
        symbol: 股票代码
        **kwargs: 传递给 DataQualityChecker 的参数

    Returns:
        QualityReport: 质量报告

    Example:
        >>> report = check_data_quality(df, symbol="600519")
        >>> if not report.is_passed:
        ...     print(report)
    """
    checker = DataQualityChecker(**kwargs)
    return checker.check(df, symbol)
