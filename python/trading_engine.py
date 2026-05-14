#!/usr/bin/env python3
"""
模拟交易引擎 - Mock Trading Engine

功能：
- 账户管理（资金、持仓）
- 订单管理（下单、撤单、查询）
- 风控系统（资金检查、仓位限制、涨跌停限制）
- T+1 交易规则
- 手续费计算

数据存储：data/mock_trading/
"""

import json
import os
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional


class TradingEngine:
    """模拟交易引擎"""

    def __init__(self, data_dir: str = "data/mock_trading"):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)

        self.account_file = self.data_dir / "account.json"
        self.positions_file = self.data_dir / "positions.json"
        self.orders_file = self.data_dir / "orders.json"
        self.trade_log_file = self.data_dir / "trade_log.json"

        self._init_files()

    def _init_files(self):
        """初始化数据文件"""
        # 初始化账户
        if not self.account_file.exists():
            account = {
                "account_id": "mock_account_001",
                "cash": 1000000.0,
                "total_assets": 1000000.0,
                "frozen_cash": 0.0,
                "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            }
            self._save_json(self.account_file, account)

        # 初始化持仓
        if not self.positions_file.exists():
            self._save_json(self.positions_file, [])

        # 初始化订单
        if not self.orders_file.exists():
            self._save_json(self.orders_file, [])

        # 初始化交易日志
        if not self.trade_log_file.exists():
            self._save_json(self.trade_log_file, [])

    def _load_json(self, file_path: Path) -> any:
        """加载 JSON 文件"""
        with open(file_path, "r", encoding="utf-8") as f:
            return json.load(f)

    def _save_json(self, file_path: Path, data: any):
        """保存 JSON 文件"""
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def _calculate_commission(self, amount: float, direction: str) -> float:
        """
        计算手续费

        买入：成交金额 × 0.0003（万三）
        卖出：成交金额 × 0.0003 + 印花税 0.001
        最低手续费：5元
        """
        if direction == "buy":
            commission = amount * 0.0003
        else:  # sell
            commission = amount * 0.0003 + amount * 0.001

        return max(commission, 5.0)

    def _generate_order_id(self) -> str:
        """生成订单ID"""
        now = datetime.now()
        orders = self._load_json(self.orders_file)
        order_count = len(orders) + 1
        return f"ORD{now.strftime('%Y%m%d')}{order_count:04d}"

    def _log_trade(self, action: str, details: dict):
        """记录交易日志"""
        logs = self._load_json(self.trade_log_file)
        log_entry = {
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "action": action,
            "details": details,
        }
        logs.append(log_entry)
        self._save_json(self.trade_log_file, logs)

    def get_account_info(self) -> dict:
        """获取账户信息"""
        account = self._load_json(self.account_file)
        positions = self._load_json(self.positions_file)

        # 计算总市值
        total_market_value = sum(p["market_value"] for p in positions)

        # 更新总资产
        account["total_assets"] = account["cash"] + total_market_value
        account["market_value"] = total_market_value
        account["position_ratio"] = (
            (total_market_value / account["total_assets"] * 100)
            if account["total_assets"] > 0
            else 0
        )

        return account

    def get_positions(self) -> List[dict]:
        """获取持仓列表"""
        return self._load_json(self.positions_file)

    def get_position(self, symbol: str) -> Optional[dict]:
        """获取单个持仓"""
        positions = self.get_positions()
        for pos in positions:
            if pos["symbol"] == symbol:
                return pos
        return None

    def get_orders(self, status: Optional[str] = None) -> List[dict]:
        """
        获取订单列表

        Args:
            status: 订单状态过滤 (pending/filled/cancelled/rejected)
        """
        orders = self._load_json(self.orders_file)
        if status:
            return [o for o in orders if o["status"] == status]
        return orders

    def update_position_price(self, symbol: str, current_price: float):
        """更新持仓的当前价格"""
        positions = self.get_positions()
        updated = False

        for pos in positions:
            if pos["symbol"] == symbol:
                pos["current_price"] = current_price
                pos["market_value"] = pos["quantity"] * current_price
                pos["profit_loss"] = pos["market_value"] - (pos["quantity"] * pos["cost_price"])
                pos["profit_loss_pct"] = (
                    (pos["profit_loss"] / (pos["quantity"] * pos["cost_price"]) * 100)
                    if pos["cost_price"] > 0
                    else 0
                )
                updated = True
                break

        if updated:
            self._save_json(self.positions_file, positions)

    def place_order(
        self,
        symbol: str,
        name: str,
        direction: str,
        price: float,
        quantity: int,
        current_price: float,
    ) -> dict:
        """
        下单

        Args:
            symbol: 股票代码
            name: 股票名称
            direction: 方向 (buy/sell)
            price: 委托价格
            quantity: 委托数量
            current_price: 当前市场价格

        Returns:
            订单信息
        """
        # 1. 基础校验
        if quantity % 100 != 0:
            return {"success": False, "error": "委托数量必须是100的整数倍（1手=100股）"}

        if quantity <= 0:
            return {"success": False, "error": "委托数量必须大于0"}

        # 2. 涨跌停检查（简化版，实际需要获取昨收价）
        limit_up = current_price * 1.10
        limit_down = current_price * 0.90

        if price > limit_up:
            return {"success": False, "error": f"委托价格超过涨停价 ¥{limit_up:.2f}"}

        if price < limit_down:
            return {"success": False, "error": f"委托价格低于跌停价 ¥{limit_down:.2f}"}

        # 3. 资金/持仓检查
        account = self._load_json(self.account_file)

        if direction == "buy":
            # 买入：检查资金
            total_cost = price * quantity
            commission = self._calculate_commission(total_cost, "buy")
            required_cash = total_cost + commission

            if account["cash"] < required_cash:
                return {
                    "success": False,
                    "error": f"可用资金不足。需要 ¥{required_cash:.2f}，可用 ¥{account['cash']:.2f}",
                }

            # 检查单只股票仓位限制（30%）
            positions = self.get_positions()
            existing_pos = self.get_position(symbol)
            existing_value = existing_pos["market_value"] if existing_pos else 0
            new_value = existing_value + total_cost

            if new_value > account["total_assets"] * 0.30:
                return {
                    "success": False,
                    "error": f"单只股票仓位不能超过30%（当前将达到 {new_value/account['total_assets']*100:.1f}%）",
                }

        else:  # sell
            # 卖出：检查持仓
            position = self.get_position(symbol)
            if not position:
                return {"success": False, "error": f"未持有 {name}({symbol})"}

            if position["available"] < quantity:
                return {
                    "success": False,
                    "error": f"可卖数量不足。需要 {quantity} 股，可卖 {position['available']} 股（T+1规则）",
                }

        # 4. 创建订单
        order_id = self._generate_order_id()
        order = {
            "order_id": order_id,
            "symbol": symbol,
            "name": name,
            "direction": direction,
            "price": price,
            "quantity": quantity,
            "filled_quantity": quantity,  # 模拟交易立即成交
            "status": "filled",
            "order_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "filled_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "commission": self._calculate_commission(price * quantity, direction),
            "reject_reason": None,
        }

        # 5. 执行交易
        if direction == "buy":
            self._execute_buy(order)
        else:
            self._execute_sell(order)

        # 6. 保存订单
        orders = self._load_json(self.orders_file)
        orders.append(order)
        self._save_json(self.orders_file, orders)

        # 7. 记录日志
        self._log_trade("place_order", order)

        return {"success": True, "order": order}

    def _execute_buy(self, order: dict):
        """执行买入"""
        account = self._load_json(self.account_file)
        positions = self.get_positions()

        # 扣除资金
        total_cost = order["price"] * order["quantity"] + order["commission"]
        account["cash"] -= total_cost
        self._save_json(self.account_file, account)

        # 更新持仓
        existing_pos = None
        for pos in positions:
            if pos["symbol"] == order["symbol"]:
                existing_pos = pos
                break

        if existing_pos:
            # 已有持仓，更新成本价
            total_quantity = existing_pos["quantity"] + order["quantity"]
            total_cost_value = (existing_pos["cost_price"] * existing_pos["quantity"]) + (
                order["price"] * order["quantity"]
            )
            new_cost_price = total_cost_value / total_quantity

            existing_pos["quantity"] = total_quantity
            existing_pos["cost_price"] = new_cost_price
            existing_pos["current_price"] = order["price"]
            existing_pos["market_value"] = total_quantity * order["price"]
            existing_pos["profit_loss"] = 0.0
            existing_pos["profit_loss_pct"] = 0.0
            # T+1: 今天买入的不能卖
            # existing_pos["available"] 保持不变
        else:
            # 新建持仓
            new_pos = {
                "symbol": order["symbol"],
                "name": order["name"],
                "quantity": order["quantity"],
                "available": 0,  # T+1: 今天买入明天才能卖
                "cost_price": order["price"],
                "current_price": order["price"],
                "market_value": order["price"] * order["quantity"],
                "profit_loss": 0.0,
                "profit_loss_pct": 0.0,
                "buy_date": datetime.now().strftime("%Y-%m-%d"),
            }
            positions.append(new_pos)

        self._save_json(self.positions_file, positions)

    def _execute_sell(self, order: dict):
        """执行卖出"""
        account = self._load_json(self.account_file)
        positions = self.get_positions()

        # 增加资金
        total_income = order["price"] * order["quantity"] - order["commission"]
        account["cash"] += total_income
        self._save_json(self.account_file, account)

        # 更新持仓
        for i, pos in enumerate(positions):
            if pos["symbol"] == order["symbol"]:
                pos["quantity"] -= order["quantity"]
                pos["available"] -= order["quantity"]

                if pos["quantity"] <= 0:
                    # 清仓，删除持仓
                    positions.pop(i)
                else:
                    # 更新市值
                    pos["market_value"] = pos["quantity"] * pos["current_price"]
                    pos["profit_loss"] = pos["market_value"] - (pos["quantity"] * pos["cost_price"])
                    pos["profit_loss_pct"] = (
                        (pos["profit_loss"] / (pos["quantity"] * pos["cost_price"]) * 100)
                        if pos["cost_price"] > 0
                        else 0
                    )

                break

        self._save_json(self.positions_file, positions)

    def cancel_order(self, order_id: str) -> dict:
        """
        撤单（模拟交易中已成交订单无法撤销）
        """
        orders = self._load_json(self.orders_file)

        for order in orders:
            if order["order_id"] == order_id:
                if order["status"] == "filled":
                    return {"success": False, "error": "订单已成交，无法撤销"}

                order["status"] = "cancelled"
                self._save_json(self.orders_file, orders)
                self._log_trade("cancel_order", {"order_id": order_id})

                return {"success": True, "message": f"订单 {order_id} 已撤销"}

        return {"success": False, "error": f"订单 {order_id} 不存在"}

    def update_t1_available(self):
        """
        更新 T+1 可卖数量
        每日开盘前调用，将昨日买入的股票设为可卖
        """
        positions = self.get_positions()
        today = datetime.now().date()

        for pos in positions:
            buy_date = datetime.strptime(pos["buy_date"], "%Y-%m-%d").date()
            if buy_date < today:
                # 昨天或更早买入的，可以卖出
                pos["available"] = pos["quantity"]

        self._save_json(self.positions_file, positions)
        self._log_trade("update_t1", {"date": today.strftime("%Y-%m-%d")})

    def reset_account(self, initial_cash: float = 1000000.0):
        """重置账户（清空所有数据）"""
        account = {
            "account_id": "mock_account_001",
            "cash": initial_cash,
            "total_assets": initial_cash,
            "frozen_cash": 0.0,
            "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        }
        self._save_json(self.account_file, account)
        self._save_json(self.positions_file, [])
        self._save_json(self.orders_file, [])
        self._save_json(self.trade_log_file, [])

        return {"success": True, "message": f"账户已重置，初始资金 ¥{initial_cash:,.2f}"}

    def get_risk_alerts(self, stop_loss_pct: float = -15.0, take_profit_pct: float = 30.0) -> dict:
        """
        获取风险警报 — 检查所有持仓的盈亏状态

        Args:
            stop_loss_pct: 止损阈值（负数，默认-15%）
            take_profit_pct: 止盈提醒阈值（正数，默认30%）

        Returns:
            风险警报字典
        """
        positions = self.get_positions()
        account = self.get_account_info()

        stop_loss_alerts = []
        take_profit_alerts = []
        total_unrealized_pnl = 0.0

        for pos in positions:
            pnl_pct = pos.get("profit_loss_pct", 0)
            pnl_amount = pos.get("profit_loss", 0)
            total_unrealized_pnl += pnl_amount

            if pnl_pct <= stop_loss_pct:
                stop_loss_alerts.append(
                    {
                        "symbol": pos["symbol"],
                        "name": pos["name"],
                        "quantity": pos["quantity"],
                        "cost_price": pos["cost_price"],
                        "current_price": pos.get("current_price", 0),
                        "pnl_pct": round(pnl_pct, 2),
                        "pnl_amount": round(pnl_amount, 2),
                        "severity": "critical" if pnl_pct <= -20 else "warning",
                        "suggested_action": "stop_loss" if pnl_pct <= -20 else "review",
                    }
                )

            if pnl_pct >= take_profit_pct:
                take_profit_alerts.append(
                    {
                        "symbol": pos["symbol"],
                        "name": pos["name"],
                        "quantity": pos["quantity"],
                        "cost_price": pos["cost_price"],
                        "current_price": pos.get("current_price", 0),
                        "pnl_pct": round(pnl_pct, 2),
                        "pnl_amount": round(pnl_amount, 2),
                        "suggested_action": "take_profit_partial",
                    }
                )

        return {
            "account_total_pnl_pct": (
                round((total_unrealized_pnl / account["total_assets"] * 100), 2)
                if account["total_assets"] > 0
                else 0
            ),
            "total_unrealized_pnl": round(total_unrealized_pnl, 2),
            "position_count": len(positions),
            "stop_loss_alerts": stop_loss_alerts,
            "take_profit_alerts": take_profit_alerts,
            "has_critical": any(a["severity"] == "critical" for a in stop_loss_alerts),
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        }

    def auto_decision_log(
        self, action: str, symbol: str, name: str, price: float, quantity: int, rationale: str = ""
    ) -> dict:
        """自动记录交易决策到 .pi/decision-log.md"""
        import re

        # 使用项目根目录而非 data_dir 的 parent
        log_dir = self.data_dir.parent.parent / ".pi"
        log_dir.mkdir(parents=True, exist_ok=True)
        log_file = log_dir / "decision-log.md"

        if not log_file.exists():
            log_file.write_text(
                "# 决策日志\n\n"
                "> 每个买入/卖出/持有/回避决策必须记录于此。\n"
                "> 定期复盘：为什么对？为什么错？偏差在哪里？\n\n",
                encoding="utf-8",
            )

        today = datetime.now().strftime("%Y-%m-%d")
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M")
        content = log_file.read_text(encoding="utf-8")

        if f"## {today}" not in content:
            content += f"\n## {today}\n\n"

        today_decisions = content.split(f"## {today}")[-1].count("### 决策")
        decision_num = today_decisions + 1

        labels = {"buy": "✅ 买入", "sell": "💰 卖出", "hold": "⏸️ 持有", "avoid": "❌ 回避"}
        action_label = labels.get(action, f"📝 {action}")

        entry = (
            f"### 决策 #{decision_num}：{name}（{symbol}）— {action_label}\n\n"
            f"| 项目 | 内容 |\n"
            f"|------|------|\n"
            f"| **时间** | {timestamp} |\n"
            f"| **价格** | ¥{price:.2f} |\n"
            f"| **数量** | {quantity}股 |\n"
            f"| **决策** | {action_label} |\n"
            f"| **理由** | {rationale or '（系统自动记录）'} |\n"
            f"| **待验证** | 7天后检查走势 |\n"
            f"| **7日结果** | [待填充] |\n"
            f"| **经验教训** | [待填充] |\n\n"
        )

        content = re.sub(rf"(## {today}\n\n)", rf"\1{entry}", content)
        log_file.write_text(content, encoding="utf-8")

        # 同时记录到 trade_log
        self._log_trade(
            "decision_log",
            {
                "action": action,
                "symbol": symbol,
                "name": name,
                "price": price,
                "quantity": quantity,
                "rationale": rationale,
            },
        )

        return {
            "success": True,
            "message": f"决策已记录: {name}({symbol}) {action_label}",
            "log_file": str(log_file),
        }

    def verify_past_decisions(self, days_ago: int = 7) -> dict:
        """
        验证 N 天前的决策 — 回填决策日志中的「7日结果」和「经验教训」

        读取 decision-log.md，找到 N 天前「7日结果」为 [待填充] 的决策，
        获取当前股价，计算涨跌幅，自动填充结果。
        """
        import re

        log_dir = self.data_dir.parent.parent / ".pi"
        log_file = log_dir / "decision-log.md"

        if not log_file.exists():
            return {"success": False, "error": "决策日志不存在，无法验证"}

        content = log_file.read_text(encoding="utf-8")
        target_date = (datetime.now() - timedelta(days=days_ago)).strftime("%Y-%m-%d")

        # 查找目标日期的所有决策块
        # 决策格式: ### 决策 #N：名称（代码）— 标签
        decision_pattern = re.compile(
            r"### 决策 #\d+：(.+?)（(\d{5,6})）— (.+?)\n\n"
            r"(.*?)"
            r"\|\s*\*\*7日结果\*\*\s*\|\s*\[待填充\]\s*\|",
            re.DOTALL,
        )

        verified_count = 0
        results = []

        # 找到目标日期的section
        date_match = re.search(rf"## {target_date}\n\n(.*?)(?=\n## |\Z)", content, re.DOTALL)
        if not date_match:
            return {
                "success": True,
                "message": f"{target_date} 无待验证决策",
                "verified": 0,
                "results": [],
            }

        section = date_match.group(1)
        decisions = list(decision_pattern.finditer(section))

        if not decisions:
            return {
                "success": True,
                "message": f"{target_date} 的决策均已验证或无需验证",
                "verified": 0,
                "results": [],
            }

        offset = date_match.start()

        for decision in decisions:
            name = decision.group(1)
            symbol = decision.group(2)
            action = decision.group(3)
            table = decision.group(4)

            # 从表格中提取决策价格
            price_match = re.search(r"\|\s*\*\*价格\*\*\s*\|\s*[¥￥]?([\d.]+)", table)
            if not price_match:
                continue

            decision_price = float(price_match.group(1))

            # 获取当前股价
            try:
                current_price = _fetch_current_price(symbol)
            except Exception as e:
                results.append({"symbol": symbol, "name": name, "error": str(e), "verified": False})
                continue

            if current_price is None:
                results.append(
                    {"symbol": symbol, "name": name, "error": "无法获取当前价格", "verified": False}
                )
                continue

            # 计算涨跌幅
            change_pct = (current_price - decision_price) / decision_price * 100
            direction = "上涨" if change_pct >= 0 else "下跌"

            # 判断决策是否正确
            if "买入" in action or "买入" in action:
                correct = change_pct >= 0
            elif "回避" in action or "回避" in action:
                correct = change_pct <= 0
            elif "卖出" in action or "卖出" in action:
                correct = change_pct <= 0
            else:
                correct = True  # '持有' 不判断对错

            verdict = "✅ 正确" if correct else "❌ 偏差"

            # 生成经验教训
            if change_pct >= 5:
                lesson = f"正向偏离+{change_pct:.1f}%，判断准确，可放大仓位"
            elif change_pct >= 0:
                lesson = f"微涨{change_pct:.1f}%，方向正确，但幅度不足需审视逻辑"
            elif change_pct >= -5:
                lesson = f"微跌{change_pct:.1f}%，偏差可控，关注后续走势"
            elif change_pct >= -10:
                lesson = f"跌{abs(change_pct):.1f}%，明显偏差，检查判断逻辑"
            else:
                lesson = f"大跌{abs(change_pct):.1f}%，严重偏差，需复盘核心假设"

            # 在决策块中替换 [待填充] 为实际结果
            old_result_line = f"| **7日结果** | [待填充] |"
            new_result_line = f"| **7日结果** | {verdict}：{direction} {abs(change_pct):.1f}%（¥{decision_price:.2f} → ¥{current_price:.2f}） |"
            content = content.replace(old_result_line, new_result_line, 1)

            old_lesson_line = f"| **经验教训** | [待填充] |"
            new_lesson_line = f"| **经验教训** | {lesson} |"
            content = content.replace(old_lesson_line, new_lesson_line, 1)

            verified_count += 1
            results.append(
                {
                    "symbol": symbol,
                    "name": name,
                    "decision_price": decision_price,
                    "current_price": current_price,
                    "change_pct": round(change_pct, 2),
                    "verdict": verdict,
                    "lesson": lesson,
                }
            )

        if verified_count > 0:
            log_file.write_text(content, encoding="utf-8")
            self._log_trade(
                "verify_decisions",
                {"date": target_date, "verified": verified_count, "results": results},
            )

        return {
            "success": True,
            "message": f"已验证 {target_date} 的 {verified_count} 条决策",
            "verified": verified_count,
            "results": results,
        }

    def sync_portfolio_risk_alerts(
        self, stop_loss_pct: float = -15.0, take_profit_pct: float = 30.0
    ) -> dict:
        """
        通过读取 .pi/portfolio.json + 实时价格 生成风控警报

        解决 mock_trading positions 与真实 portfolio 脱节的问题：
        直接用 portfolio.json 作为数据源，实时获取价格计算盈亏。
        """
        portfolio_file = self.data_dir.parent.parent / ".pi" / "portfolio.json"

        if not portfolio_file.exists():
            return {"success": False, "error": ".pi/portfolio.json 不存在"}

        portfolio = json.loads(portfolio_file.read_text(encoding="utf-8"))
        holdings = portfolio.get("holdings", [])

        if not holdings:
            return {
                "success": True,
                "position_count": 0,
                "stop_loss_alerts": [],
                "take_profit_alerts": [],
                "has_critical": False,
            }

        stop_loss_alerts = []
        take_profit_alerts = []
        total_unrealized_pnl = 0.0
        total_cost = 0.0
        total_value = 0.0

        for h in holdings:
            symbol = h["symbol"]
            avg_cost = h.get("avg_cost", 0)
            quantity = h.get("quantity", 0)

            if quantity <= 0 or avg_cost <= 0:
                continue

            # 获取当前价格
            try:
                current_price = _fetch_current_price(symbol)
            except Exception:
                current_price = None

            if current_price is None:
                continue

            pnl_amount = (current_price - avg_cost) * quantity
            pnl_pct = (current_price - avg_cost) / avg_cost * 100

            total_cost += avg_cost * quantity
            total_value += current_price * quantity
            total_unrealized_pnl += pnl_amount

            if pnl_pct <= stop_loss_pct:
                stop_loss_alerts.append(
                    {
                        "symbol": symbol,
                        "name": h.get("name", ""),
                        "quantity": quantity,
                        "cost_price": round(avg_cost, 2),
                        "current_price": round(current_price, 2),
                        "pnl_pct": round(pnl_pct, 2),
                        "pnl_amount": round(pnl_amount, 2),
                        "severity": "critical" if pnl_pct <= -20 else "warning",
                        "suggested_action": "stop_loss" if pnl_pct <= -20 else "review",
                    }
                )

            if pnl_pct >= take_profit_pct:
                take_profit_alerts.append(
                    {
                        "symbol": symbol,
                        "name": h.get("name", ""),
                        "quantity": quantity,
                        "cost_price": round(avg_cost, 2),
                        "current_price": round(current_price, 2),
                        "pnl_pct": round(pnl_pct, 2),
                        "pnl_amount": round(pnl_amount, 2),
                        "suggested_action": "take_profit_partial",
                    }
                )

        total_pnl_pct = (total_unrealized_pnl / total_cost * 100) if total_cost > 0 else 0

        return {
            "success": True,
            "account_total_pnl_pct": round(total_pnl_pct, 2),
            "total_unrealized_pnl": round(total_unrealized_pnl, 2),
            "total_cost": round(total_cost, 2),
            "total_value": round(total_value, 2),
            "position_count": len(holdings),
            "stop_loss_alerts": stop_loss_alerts,
            "take_profit_alerts": take_profit_alerts,
            "has_critical": any(a["severity"] == "critical" for a in stop_loss_alerts),
            "source": "portfolio.json",
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        }


def _fetch_current_price(symbol: str) -> Optional[float]:
    """通过 akshare 获取当前股价（独立函数，不依赖引擎实例）"""
    # 尝试 akshare 网络获取
    try:
        import akshare as ak

        if len(symbol) == 5 or symbol.startswith("0"):
            params = {
                "symbol": symbol,
                "period": "daily",
                "start_date": "20250501",
                "end_date": "20500101",
                "adjust": "qfq",
            }
            df = ak.stock_hk_hist(**params)
            if df is not None and not df.empty:
                return float(df.iloc[-1]["收盘"])

        params = {
            "symbol": symbol,
            "period": "daily",
            "start_date": "20250501",
            "end_date": "20500101",
            "adjust": "qfq",
        }
        df = ak.stock_zh_a_hist(**params)
        if df is not None and not df.empty:
            return float(df.iloc[-1]["收盘"])
    except Exception:
        pass

    # 降级：从 mock_trading positions 读取（可能已有手动更新）
    try:
        from pathlib import Path

        positions_file = Path("data/mock_trading/positions.json")
        if positions_file.exists():
            positions = json.loads(positions_file.read_text())
            for pos in positions:
                if pos["symbol"] == symbol and pos.get("current_price", 0) > 0:
                    return float(pos["current_price"])
    except Exception:
        pass

    return None


# ===== CLI 接口 =====


def main():
    """命令行接口"""
    import sys

    if len(sys.argv) < 2:
        print("Usage: python trading_engine.py <command> [args...]")
        print("Commands:")
        print("  get_account_info")
        print("  get_positions")
        print("  get_orders [status]")
        print("  place_order <symbol> <name> <direction> <price> <quantity> <current_price>")
        print("  cancel_order <order_id>")
        print("  update_t1_available")
        print("  get_risk_alerts [stop_loss_pct] [take_profit_pct]")
        print("  reset_account [initial_cash]")
        sys.exit(1)

    engine = TradingEngine()
    command = sys.argv[1]

    try:
        if command == "get_account_info":
            result = engine.get_account_info()

        elif command == "get_positions":
            result = engine.get_positions()

        elif command == "get_orders":
            status = sys.argv[2] if len(sys.argv) > 2 else None
            result = engine.get_orders(status)

        elif command == "place_order":
            if len(sys.argv) < 8:
                print(
                    "Usage: place_order <symbol> <name> <direction> <price> <quantity> <current_price>"
                )
                sys.exit(1)

            result = engine.place_order(
                symbol=sys.argv[2],
                name=sys.argv[3],
                direction=sys.argv[4],
                price=float(sys.argv[5]),
                quantity=int(sys.argv[6]),
                current_price=float(sys.argv[7]),
            )

        elif command == "cancel_order":
            if len(sys.argv) < 3:
                print("Usage: cancel_order <order_id>")
                sys.exit(1)
            result = engine.cancel_order(sys.argv[2])

        elif command == "update_t1_available":
            engine.update_t1_available()
            result = {"success": True, "message": "T+1 可卖数量已更新"}

        elif command == "get_risk_alerts":
            stop_loss_pct = float(sys.argv[2]) if len(sys.argv) > 2 else -15.0
            take_profit_pct = float(sys.argv[3]) if len(sys.argv) > 3 else 30.0
            result = engine.get_risk_alerts(stop_loss_pct, take_profit_pct)

        elif command == "reset_account":
            initial_cash = float(sys.argv[2]) if len(sys.argv) > 2 else 1000000.0
            result = engine.reset_account(initial_cash)

        else:
            result = {"error": f"Unknown command: {command}"}

        print(json.dumps(result, ensure_ascii=False, indent=2))

    except Exception as e:
        print(json.dumps({"error": str(e)}, ensure_ascii=False, indent=2))
        import traceback

        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
