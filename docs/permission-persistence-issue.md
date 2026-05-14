# 权限持久化问题排查

## 问题描述

用户反馈：选择 "始终允许" 后，下次使用同一工具仍然会提示权限确认。

## 代码分析

### ✅ 保存逻辑（正确）

在 `REPL.tsx` 的 `canUseTool` 回调中：

```typescript
// Handle persistence
if (userChoice.persist && decision.suggestions?.length) {
  const baseSuggestion = decision.suggestions[0]!
  const update = {
    ...baseSuggestion,
    behavior: userChoice.action as 'allow' | 'deny',
  }
  persistPermissionUpdate(update)  // ✓ 保存到磁盘
  setAppState(prev => ({
    ...prev,
    permissionContext: applyPermissionUpdate(prev.permissionContext, update),  // ✓ 更新内存
  }))
}
```

### ✅ 加载逻辑（正确）

在 `REPL.tsx` 的 `useEffect` 中：

```typescript
useEffect(() => {
  if (!smInitializedRef.current) {
    smInitializedRef.current = true
    initSessionMemory()
    initObservability()
    initPermissions()  // ✓ 启动时加载
  }
  // ...
}, [])
```

### 🔍 可能的问题

#### 1. AppState 引用问题

`canUseTool` 回调中使用了 `getAppState()`：

```typescript
const canUseTool = useCallback<CanUseTool>(
  async (name, input) => {
    const appState = getAppState()  // ⚠️ 这里获取的是最新的 AppState 吗？
    const tool = findTool(name, allTools)
    if (!tool) return 'allow'

    const decision = checkToolPermission(
      tool,
      inp,
      appState.permissionContext,  // ⚠️ 使用的是这个 context
      contentString,
    )
    // ...
  },
  [allTools],
)
```

**问题：** `getAppState()` 可能返回的是旧的状态，而不是更新后的状态。

#### 2. 时序问题

```typescript
// 1. 保存到磁盘
persistPermissionUpdate(update)

// 2. 更新内存
setAppState(prev => ({
  ...prev,
  permissionContext: applyPermissionUpdate(prev.permissionContext, update),
}))

// 3. 清除 UI
setPermissionRequest(null)

// 4. 返回结果
return userChoice.action
```

**问题：** `setAppState` 是异步的，可能在下次 `canUseTool` 调用时还没有生效。

## 🐛 根本原因

**`getAppState()` 在 `canUseTool` 回调中可能获取的是旧状态！**

因为：
1. `setAppState` 是异步更新
2. `canUseTool` 回调在下次工具调用时执行
3. 如果两次工具调用间隔很短，AppState 可能还没更新完成

## 🔧 解决方案

### 方案 1：使用 Ref 存储最新状态（推荐）

```typescript
const permissionContextRef = useRef<ToolPermissionContext>(getAppState().permissionContext)

// 同步更新 ref
useEffect(() => {
  permissionContextRef.current = getAppState().permissionContext
}, [])

const canUseTool = useCallback<CanUseTool>(
  async (name, input) => {
    // 使用 ref 而不是 getAppState()
    const permissionContext = permissionContextRef.current

    const decision = checkToolPermission(
      tool,
      inp,
      permissionContext,
      contentString,
    )

    // 更新后立即同步到 ref
    if (userChoice.persist && decision.suggestions?.length) {
      const update = { /* ... */ }
      persistPermissionUpdate(update)

      const newContext = applyPermissionUpdate(permissionContext, update)
      permissionContextRef.current = newContext  // ✓ 立即更新 ref

      setAppState(prev => ({
        ...prev,
        permissionContext: newContext,
      }))
    }
  },
  [allTools],
)
```

### 方案 2：等待 AppState 更新完成

```typescript
if (userChoice.persist && decision.suggestions?.length) {
  const update = { /* ... */ }
  persistPermissionUpdate(update)

  // 使用 Promise 等待状态更新
  await new Promise<void>((resolve) => {
    setAppState(prev => {
      const newContext = applyPermissionUpdate(prev.permissionContext, update)
      // 状态更新后立即 resolve
      setTimeout(resolve, 0)
      return {
        ...prev,
        permissionContext: newContext,
      }
    })
  })
}
```

### 方案 3：重新加载配置文件

```typescript
if (userChoice.persist && decision.suggestions?.length) {
  const update = { /* ... */ }
  persistPermissionUpdate(update)

  // 重新加载配置文件
  const newContext = loadPermissionSettings()
  setAppState(prev => ({
    ...prev,
    permissionContext: newContext,
  }))
}
```

## 🧪 测试步骤

1. 启动 Pi
2. 触发权限提示（如使用 Investment 工具）
3. 选择 "✅ 始终允许"
4. **立即再次**使用同一工具
5. 检查是否还会提示

**预期结果：** 不应该再提示

**实际结果：** 如果还提示，说明 AppState 没有及时更新

## 📝 调试日志

添加调试日志验证：

```typescript
const canUseTool = useCallback<CanUseTool>(
  async (name, input) => {
    const appState = getAppState()
    console.log('[DEBUG] canUseTool called:', {
      toolName: name,
      allowRules: appState.permissionContext.allowRules,
      denyRules: appState.permissionContext.denyRules,
    })

    const decision = checkToolPermission(/* ... */)
    console.log('[DEBUG] permission decision:', decision)

    // ...
  },
  [allTools],
)
```

## 🎯 推荐方案

**使用方案 1（Ref）**，因为：
- ✅ 性能最好（同步更新）
- ✅ 可靠性最高（不依赖异步状态）
- ✅ 实现简单
- ✅ 不需要重新读取文件
