# 权限持久化说明

## 概述

当你选择 **"✅ 始终允许"** 或 **"❌ 始终拒绝"** 时，Pi 会将规则保存到配置文件中，之后不再需要验证。

## 📁 配置文件位置

权限规则会保存到 `settings.json` 文件中：

### 项目级别（推荐）
```
/Users/mac/Documents/ai/investment-claude/.pi/settings.json
```
- 只对当前项目生效
- 适合项目特定的权限规则

### 用户级别（全局）
```
~/.pi/settings.json
```
- 对所有项目生效
- 适合通用的权限规则

## 📝 配置文件格式

```json
{
  "permissions": {
    "defaultMode": "ask",
    "allow": [
      "Investment:query",
      "Investment:update",
      "Read:*"
    ],
    "deny": [
      "Bash:rm -rf"
    ],
    "ask": [
      "Write:*"
    ]
  }
}
```

## 🔄 工作流程

### 1. 首次使用工具

```
╔═══════════════════════════════════╗
║ 🔒 权限请求          Investment  ║
║───────────────────────────────────║
║   Investment 工具需要执行：       ║
║   查询用户投资数据                ║
║                                   ║
║ ▸ ✅ 允许        — 允许本次操作   ║ [选择这个：仅本次]
║   ✅ 始终允许    — 将此操作加入... ║ [选择这个：永久记住]
║   ❌ 拒绝        — 拒绝本次操作   ║
║   ❌ 始终拒绝    — 将此操作加入... ║
║                                   ║
║ ┌─────────────────────────────┐   ║
║ │ 规则预览: Investment:query  │   ║
║ └─────────────────────────────┘   ║
╚═══════════════════════════════════╝
```

### 2. 选择 "✅ 始终允许"

Pi 会自动：
1. 将规则 `Investment:query` 添加到 `.pi/settings.json`
2. 保存到磁盘
3. 下次使用时直接允许，不再提示

### 3. 之后使用

```bash
❯ 查询用户投资记录

Pi ▸ 好的，我来查询用户的投资记录。

● Investment  查询用户投资数据
  ✓ 已完成（无需确认，自动允许）
```

## 🎯 规则匹配

### 精确匹配
```json
"allow": ["Investment:query"]
```
- 只允许 `Investment` 工具的 `query` 操作
- 其他操作（如 `update`）仍需确认

### 通配符匹配
```json
"allow": ["Investment:*"]
```
- 允许 `Investment` 工具的所有操作
- `query`、`update`、`delete` 等都自动允许

### 工具级别匹配
```json
"allow": ["Read:*"]
```
- 允许 `Read` 工具的所有操作
- 读取任何文件都不需要确认

## 🔧 手动编辑配置

你也可以直接编辑 `.pi/settings.json` 文件：

```bash
# 创建项目配置文件
mkdir -p .pi
cat > .pi/settings.json << 'EOF'
{
  "permissions": {
    "defaultMode": "ask",
    "allow": [
      "Investment:query",
      "Investment:update",
      "Read:*"
    ]
  }
}
EOF
```

## 📊 优先级

配置文件的优先级（从高到低）：

1. **项目级别** - `.pi/settings.json`（当前项目）
2. **用户级别** - `~/.pi/settings.json`（全局）

项目级别的规则会覆盖用户级别的规则。

## 🗑️ 删除规则

### 方法 1：手动编辑
直接编辑 `.pi/settings.json`，删除对应的规则字符串。

### 方法 2：重置配置
```bash
# 删除项目配置
rm .pi/settings.json

# 删除用户配置
rm ~/.pi/settings.json
```

## 💡 最佳实践

### 推荐做法

1. **项目特定规则** → 保存到项目级别
   ```json
   // .pi/settings.json
   {
     "permissions": {
       "allow": ["Investment:*"]
     }
   }
   ```

2. **通用规则** → 保存到用户级别
   ```json
   // ~/.pi/settings.json
   {
     "permissions": {
       "allow": ["Read:*"]
     }
   }
   ```

3. **敏感操作** → 始终使用 "ask" 模式
   ```json
   {
     "permissions": {
       "ask": ["Bash:rm*", "Write:*.env"]
     }
   }
   ```

### 不推荐做法

❌ 不要对所有工具使用 `*:*`（太宽松）
❌ 不要对敏感操作使用 "始终允许"（如删除文件）
❌ 不要在多人协作项目中使用用户级别配置（会影响其他项目）

## 🔍 查看当前规则

目前 Pi 没有内置命令查看规则，但你可以：

```bash
# 查看项目规则
cat .pi/settings.json

# 查看用户规则
cat ~/.pi/settings.json
```

## 🚀 示例场景

### 场景 1：开发环境

```json
// .pi/settings.json
{
  "permissions": {
    "defaultMode": "ask",
    "allow": [
      "Investment:query",
      "Investment:update",
      "Read:*",
      "Bash:npm*",
      "Bash:git*"
    ],
    "deny": [
      "Bash:rm -rf /",
      "Write:.env"
    ]
  }
}
```

### 场景 2：生产环境

```json
// .pi/settings.json
{
  "permissions": {
    "defaultMode": "deny",
    "allow": [
      "Investment:query"
    ]
  }
}
```

## 📚 相关文件

- **实现代码**: [src/permissions/settingsLoader.ts](../src/permissions/settingsLoader.ts)
- **权限检查**: [src/permissions/index.ts](../src/permissions/index.ts)
- **UI 组件**: [src/components/PermissionPrompt.tsx](../src/components/PermissionPrompt.tsx)

## ❓ 常见问题

### Q: 规则会立即生效吗？
A: 是的，选择 "始终允许" 后立即保存到磁盘，下次使用时直接生效。

### Q: 可以撤销 "始终允许" 吗？
A: 可以，手动编辑 `.pi/settings.json` 删除对应规则即可。

### Q: 规则会同步到其他机器吗？
A: 不会。如果你把 `.pi/settings.json` 提交到 Git，其他人拉取后会共享这些规则。

### Q: 用户级别和项目级别冲突怎么办？
A: 项目级别优先。如果项目配置允许某个操作，即使用户配置拒绝也会允许。
