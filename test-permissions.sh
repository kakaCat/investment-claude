#!/bin/bash
# 测试权限持久化功能

set -e

PROJECT_DIR="/Users/mac/Documents/ai/investment-claude"
SETTINGS_FILE="$PROJECT_DIR/.pi/settings.json"

echo "🧪 测试权限持久化功能"
echo "================================"

# 1. 清理旧配置
echo ""
echo "1️⃣ 清理旧配置..."
if [ -f "$SETTINGS_FILE" ]; then
  echo "   删除现有配置: $SETTINGS_FILE"
  rm "$SETTINGS_FILE"
fi

# 2. 创建测试配置
echo ""
echo "2️⃣ 创建测试配置..."
mkdir -p "$PROJECT_DIR/.pi"
cat > "$SETTINGS_FILE" << 'EOF'
{
  "permissions": {
    "defaultMode": "ask",
    "allow": [
      "Read:*"
    ]
  }
}
EOF
echo "   ✓ 创建配置文件: $SETTINGS_FILE"
cat "$SETTINGS_FILE"

# 3. 验证配置文件
echo ""
echo "3️⃣ 验证配置文件..."
if [ -f "$SETTINGS_FILE" ]; then
  echo "   ✓ 配置文件存在"
  echo "   ✓ 内容:"
  cat "$SETTINGS_FILE" | jq '.'
else
  echo "   ✗ 配置文件不存在"
  exit 1
fi

# 4. 说明
echo ""
echo "4️⃣ 测试说明:"
echo "   现在启动 Pi，尝试使用 Investment 工具"
echo "   选择 '✅ 始终允许' 后，配置文件应该更新"
echo ""
echo "   启动命令: npm start"
echo ""
echo "   测试步骤:"
echo "   1. 输入: 查询用户投资记录"
echo "   2. 选择: ✅ 始终允许"
echo "   3. 检查配置文件是否更新:"
echo "      cat .pi/settings.json"
echo ""
echo "   预期结果:"
echo "   配置文件应该包含: \"Investment:query\""
echo ""

# 5. 监控配置文件变化
echo "5️⃣ 监控配置文件变化..."
echo "   按 Ctrl+C 停止监控"
echo ""

# 使用 fswatch 或 inotifywait 监控文件变化（如果可用）
if command -v fswatch &> /dev/null; then
  echo "   使用 fswatch 监控..."
  fswatch -o "$SETTINGS_FILE" | while read; do
    echo ""
    echo "   📝 配置文件已更新！"
    echo "   新内容:"
    cat "$SETTINGS_FILE" | jq '.'
    echo ""
  done
else
  echo "   fswatch 未安装，手动检查配置文件"
  echo "   运行: watch -n 1 'cat $SETTINGS_FILE | jq .'"
fi
