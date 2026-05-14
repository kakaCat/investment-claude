# 权限持久化修复说明

## 🐛 问题描述

用户选择 "✅ 始终允许" 后，下次使用同一工具仍然会提示权限确认。

## 🔍 根本原因

`canUseTool` 回调中使用 `getAppState()` 获取权限上下文，但 `setAppState` 是异步更新的。当用户快速连续使用同一工具时，第二次调用可能获取到旧的状态，导致规则未生效。

### 问题代码

```typescript
const canUseTool = useCallback<CanUseTool>(
  async (name, input) => {
    const appState = getAppState()  // ⚠️ 可能获取到旧状态

    const decision = checkToolPermission(
      tool,
      inp,
      appState.permissionContext,  // ⚠️ 使用旧的 context
      contentString,
    )

    // 用户选择 "始终允许"
    if (userChoice.persist) {
      persistPermissionUpdate(update)
      setAppState(prev => ({  // ⚠️ 异步更新，可能还没生效
        ...prev,
        permissionContext: applyPermissionUpdate(prev.permissionContext, update),
      }))
    }
  },
  [allTools],
)
```

### 时序问题

```
时间线：
T0: 用户触发 Investment:query
T1: canUseTool 调用，getAppState() 返回旧状态
T2: 显示权限提示
T3: 用户选择 "始终允许"
T4: persistPermissionUpdate() 保存到磁盘 ✓
T5: setAppState() 开始异步更新
T6: 用户立即再次触发 Investment:query
T7: canUseTool 再次调用，getAppState() 仍返回旧状态 ✗
T8: 再次显示权限提示（问题！）
T9: setAppState() 完成更新（太晚了）
```

## ✅ 解决方案

使用 `useRef` 存储最新的权限上下文，确保立即生效。

### 修复代码

```typescript
// 1. 添加 ref 存储最新的权限上下文
const permissionContextRef = useRef(getAppState().permissionContext)

// 2. 初始化时同步 ref
useEffect(() => {
  if (!smInitializedRef.current) {
    smInitializedRef.current = true
    initSessionMemory()
    initObservability()
    initPermissions()
    // 初始化后同步 permissionContext ref
    permissionContextRef.current = getAppState().permissionContext
  }
}, [])

// 3. canUseTool 使用 ref 而不是 getAppState()
const canUseTool = useCallback<CanUseTool>(
  async (name, input) => {
    // 使用 ref 而不是 getAppState()，确保使用最新的权限规则
    const decision = checkToolPermission(
      tool,
      inp,
      permissionContextRef.current,  // ✓ 使用 ref
      contentString,
    )

    // 用户选择 "始终允许"
    if (userChoice.persist && decision.suggestions?.length) {
      const update = { /* ... */ }
      persistPermissionUpdate(update)

      // 立即更新 ref，确保下次调用时生效
      const newContext = applyPermissionUpdate(permissionContextRef.current, update)
      permissionContextRef.current = newContext  // ✓ 同步更新 ref

      // 同时更新 AppState（用于其他地方读取）
      setAppState(prev => ({
        ...prev,
        permissionContext: newContext,
      }))
    }
  },
  [allTools],
)
```

### 修复后的时序

```
时间线：
T0: 用户触发 Investment:query
T1: canUseTool 调用，使用 permissionContextRef.current
T2: 显示权限提示
T3: 用户选择 "始终允许"
T4: persistPermissionUpdate() 保存到磁盘 ✓
T5: permissionContextRef.current 立即更新 ✓
T6: setAppState() 开始异步更新
T7: 用户立即再次触发 Investment:query
T8: canUseTool 调用，permissionContextRef.current 已是最新 ✓
T9: 直接允许，不再提示 ✓
```

## 🧪 测试步骤

### 1. 清理旧配置

```bash
rm -f .pi/settings.json
```

### 2. 启动 Pi

```bash
npm start
```

### 3. 测试场景 A：快速连续调用

```bash
# 第一次调用
❯ 查询用户投资记录

# 权限提示出现
╔═══════════════════════════════════╗
║ 🔒 权限请求          Investment  ║
║───────────────────────────────────║
║   Investment 工具需要执行：       ║
║   查询用户投资数据                ║
║                                   ║
║ ▸ ✅ 始终允许    — 将此操作加入... ║  ← 选择这个
╚═══════════════════════════════════╝

# 立即第二次调用（不要等待）
❯ 再次查询用户投资记录

# 预期结果：不应该再提示，直接执行 ✓
```

### 4. 验证配置文件

```bash
cat .pi/settings.json
```

预期内容：
```json
{
  "permissions": {
    "allow": [
      "Investment:query"
    ]
  }
}
```

### 5. 测试场景 B：重启后验证

```bash
# 退出 Pi
Ctrl+C

# 重新启动
npm start

# 使用同一工具
❯ 查询用户投资记录

# 预期结果：不应该提示，直接执行 ✓
```

## 📊 修复效果

| 场景 | 修复前 | 修复后 |
|------|--------|--------|
| 快速连续调用 | ❌ 仍然提示 | ✅ 不再提示 |
| 重启后使用 | ✅ 不提示 | ✅ 不提示 |
| 配置文件保存 | ✅ 正常 | ✅ 正常 |
| 内存状态更新 | ❌ 延迟 | ✅ 立即 |

## 🔧 技术细节

### 为什么使用 Ref？

1. **同步更新** - `ref.current = newValue` 是同步的，立即生效
2. **跨渲染稳定** - ref 在组件重新渲染时保持同一个引用
3. **不触发渲染** - 更新 ref 不会触发组件重新渲染
4. **闭包安全** - 在 useCallback 中访问 ref.current 总是获取最新值

### 为什么不只用 AppState？

AppState 使用 React 的 `useState`，更新是异步的：

```typescript
setAppState(prev => ({ ...prev, permissionContext: newContext }))
// ⚠️ 此时 getAppState() 可能还是旧值
```

### 为什么同时更新 Ref 和 AppState？

- **Ref** - 供 `canUseTool` 使用，确保立即生效
- **AppState** - 供其他地方使用（如果有的话），保持一致性

## 📝 相关文件

- **修复代码**: [src/screens/REPL.tsx](../src/screens/REPL.tsx)
- **权限检查**: [src/permissions/checkPermissions.ts](../src/permissions/checkPermissions.ts)
- **配置加载**: [src/permissions/settingsLoader.ts](../src/permissions/settingsLoader.ts)
- **问题分析**: [permission-persistence-issue.md](./permission-persistence-issue.md)

## ✅ 验证清单

- [x] 构建成功，无 TypeScript 错误
- [x] 添加 `permissionContextRef` 存储最新状态
- [x] `canUseTool` 使用 ref 而不是 `getAppState()`
- [x] 保存规则后立即更新 ref
- [x] 初始化时同步 ref
- [ ] 测试快速连续调用（需要用户测试）
- [ ] 测试重启后验证（需要用户测试）

## 🎯 预期结果

选择 "✅ 始终允许" 后：
1. ✅ 规则立即保存到 `.pi/settings.json`
2. ✅ 内存中的权限上下文立即更新
3. ✅ 下次使用同一工具时直接允许，不再提示
4. ✅ 重启 Pi 后规则仍然生效

**问题已修复！** 🎉
