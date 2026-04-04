# Command Palette 设计文档

**日期**: 2026-04-28  
**状态**: 已批准，待实现  
**参考**: Claude Code `useTypeahead` + `commandSuggestions` 架构

---

## 背景

pi 当前的命令面板（`CommandPalette.tsx`）功能完整但简化：
- 搜索用简单 `includes` 匹配
- Tab 和 Enter 都立即执行命令（无法追加参数）
- 逻辑与 UI 耦合在 `PromptInput.tsx` 中
- 无 Esc 防重弹
- Skills 无使用频率排序

本次重构对齐 Claude Code 架构，实现模糊搜索、Tab 填入、逻辑分离、使用频率排序。

---

## 方案选择

选择**方案 B（精简移植）**：取 Claude Code 架构核心骨架，去掉 pi 暂不需要的部分（bash 补全、@文件、#频道、MCP 资源等）。

---

## 架构

### 文件结构变更

```
src/
├── hooks/
│   └── useTypeahead.ts             # 新增：搜索状态 + 键盘逻辑（纯逻辑，无 JSX）
├── utils/
│   ├── commandSuggestions.ts       # 新增：Fuse.js 搜索 + 排序 + CommandItem 定义
│   └── skillUsage.ts               # 新增：使用频率读写
├── components/
│   ├── PromptInputSuggestions.tsx  # 新增：下拉列表纯 UI 渲染
│   ├── PromptInput.tsx             # 修改：精简为薄壳，调用 hook
│   └── CommandPalette.tsx          # 删除
```

### 职责划分

| 文件 | 职责 | 依赖 |
|------|------|------|
| `commandSuggestions.ts` | Fuse 索引构建、建议生成、排序 | fuse.js |
| `skillUsage.ts` | 读写 `~/.claude/skill-usage.json` | fs/promises |
| `useTypeahead.ts` | 建议状态、键盘事件、调用搜索 | commandSuggestions, skillUsage |
| `PromptInputSuggestions.tsx` | 接收数据渲染下拉列表，无状态 | Ink |
| `PromptInput.tsx` | 管理 value，调用 hook，组合渲染 | useTypeahead, PromptInputSuggestions |

### 数据流

```
用户输入字符
    ↓
PromptInput setValue()
    ↓
useTypeahead useEffect 监听 value → updateSuggestions()
    ↓
commandSuggestions.ts：Fuse 搜索 + skillUsage 排序
    ↓
setSuggestionsState({ items, selectedIndex, argumentHint })
    ↓
PromptInputSuggestions 渲染下拉列表
    ↓
Tab  → applySelection(shouldExecute=false) → 填入命令名到输入框
Enter → applySelection(shouldExecute=true) → onSubmit() + recordUsage()
```

---

## 数据类型

### CommandItem

```typescript
type CommandSource = 'builtin' | 'skill-user' | 'skill-project'

type CommandItem = {
  id: string           // 唯一 ID，如 "builtin:clear" / "skill:commit"
  command: string      // 填入输入框的完整文本，如 "/clear" 或 "/commit"
  label: string        // 显示名，如 "clear"
  description: string
  source: CommandSource
  argumentHint?: string // 有此字段时 Tab 填入后追加空格，允许用户继续输入参数
}
```

### SuggestionsState

```typescript
type SuggestionsState = {
  items: CommandItem[]
  selectedIndex: number    // -1 表示无选中
  argumentHint?: string    // 当前选中项的 argumentHint
}
```

### SkillUsageRecord（持久化格式）

```typescript
// ~/.claude/skill-usage.json
type SkillUsageRecord = {
  [skillName: string]: {
    count: number     // 累计调用次数
    lastUsed: number  // Unix timestamp（毫秒）
  }
}
```

### 内置命令列表

```typescript
const BUILTIN_COMMANDS: CommandItem[] = [
  { id: 'builtin:help',            command: '/help',            label: 'help',            description: 'Show available commands',                  source: 'builtin' },
  { id: 'builtin:clear',           command: '/clear',           label: 'clear',           description: 'Clear the conversation',                   source: 'builtin' },
  { id: 'builtin:compact',         command: '/compact',         label: 'compact',         description: 'Compress conversation to save tokens',     source: 'builtin' },
  { id: 'builtin:compact-partial', command: '/compact partial', label: 'compact partial', description: 'Select pivot for partial compact',         source: 'builtin' },
  { id: 'builtin:exit',            command: '/exit',            label: 'exit',            description: 'Exit the session',                         source: 'builtin' },
]
```

---

## commandSuggestions.ts

### Fuse.js 索引

```typescript
type SearchItem = {
  item: CommandItem
  labelParts: string[]   // label 按 [-_:/] 分割，提升分词匹配质量
  description: string
}

const fuseOptions = {
  includeScore: true,
  threshold: 0.4,
  keys: [
    { name: 'item.label',  weight: 3 },
    { name: 'labelParts',  weight: 2 },
    { name: 'description', weight: 0.5 },
  ],
}
```

### generateSuggestions()

```typescript
function generateSuggestions(
  input: string,
  allCommands: CommandItem[],
  usageMap: SkillUsageRecord,
): CommandItem[]
```

**仅输入 `/`（无查询词）时**，按以下顺序返回：
1. 有使用记录的 skills，按 `lastUsed` 降序，最多 5 个
2. 所有内置命令（builtin）
3. 未使用过的 skills，按字母排序

**有查询词（如 `/cl`）时**：
1. 精确前缀匹配（label.startsWith(query)），短名优先
2. Fuse 模糊匹配结果，按评分排序

### applySelection()

```typescript
function applySelection(
  item: CommandItem,
  shouldExecute: boolean,     // true = Enter，false = Tab
  onInputChange: (v: string) => void,
  onSubmit: (v: string) => void,
  recordUsage: (name: string) => void,
): void
```

- `shouldExecute = true`：调用 `onSubmit(item.command)`，若非 builtin 则 `recordUsage(item.label)`
- `shouldExecute = false`：填入 `item.command + (argumentHint ? ' ' : '')` 到输入框，光标置尾

---

## skillUsage.ts

- 路径：`~/.claude/skill-usage.json`
- `readUsage(): Promise<SkillUsageRecord>` — 文件不存在返回 `{}`，不抛错
- `recordUsage(skillName: string): Promise<void>` — 原子读写，`count += 1`，`lastUsed = Date.now()`
- 写操作在调用方 fire-and-forget（`void recordUsage(...)`），不阻塞输入

---

## useTypeahead hook

```typescript
type UseTypeaheadOptions = {
  value: string
  onInputChange: (v: string) => void
  onSubmit: (v: string) => void
  skills: Skill[]
}

type UseTypeaheadResult = {
  suggestions: SuggestionsState
  isOpen: boolean
  handleKeyDown: (input: string, key: Key) => boolean
  // 返回 true 表示已消费此按键，PromptInput 不再处理
}
```

### 内部状态

```typescript
const [suggestions, setSuggestions] = useState<SuggestionsState>({ items: [], selectedIndex: -1 })
const [usageMap, setUsageMap] = useState<SkillUsageRecord>({})
const dismissedForRef = useRef<string | null>(null)  // Esc 时记录，防止相同输入重新弹出
```

### value 变化监听

```typescript
useEffect(() => {
  if (!value.startsWith('/')) {
    setSuggestions({ items: [], selectedIndex: -1 })
    return
  }
  if (dismissedForRef.current === value) return  // Esc 防重弹
  const allCommands = buildCommandList(skills)
  const items = generateSuggestions(value, allCommands, usageMap)
  setSuggestions({ items, selectedIndex: items.length > 0 ? 0 : -1 })
}, [value, skills, usageMap])
```

### handleKeyDown 键盘消费规则

| 按键 | 条件 | 行为 | 返回 |
|------|------|------|------|
| ↑ | 面板开启 | selectedIndex - 1 | true |
| ↓ | 面板开启 | selectedIndex + 1 | true |
| Tab | 面板开启 | applySelection(false) | true |
| Enter | 面板开启 且 有选中项 | applySelection(true) | true |
| Esc | 面板开启 | 清空建议，dismissedForRef = value | true |
| 其他 | 任意 | dismissedForRef 清空 | false |

---

## PromptInputSuggestions.tsx

**Props**：`{ items, selectedIndex, argumentHint? }`（无状态）

**渲染规则**：
- 最多显示 **6 条**，以选中项为中心滚动
- 渲染在输入框**上方**（Ink `flexDirection="column"`，Suggestions 先渲染）
- 每行：`▶ /label   description   [argumentHint?]`
  - 来源图标：builtin = 灰色 `/`，skill-user = 品红 `◆`，skill-project = 蓝色 `◆`
  - 选中行：白色加粗；非选中行：灰色暗淡
  - `argumentHint` 显示在描述右侧，颜色 yellow
- 超出 6 条：底部显示 `… N total`
- 底部固定提示行：`↑↓ navigate   Tab fill   Enter execute   Esc cancel`

---

## PromptInput.tsx 修改

精简为薄壳：

```typescript
export function PromptInput({ onSubmit, isLoading, onExit, skills = [] }: Props) {
  const [value, setValue] = useState('')
  const { suggestions, isOpen, handleKeyDown } = useTypeahead({
    value,
    onInputChange: setValue,
    onSubmit: (v) => { onSubmit(v); setValue('') },
    skills,
  })

  useInput((input, key) => {
    if (isLoading) return
    if (handleKeyDown(input, key)) return  // typeahead 已消费

    if (key.return)                       { if (value.trim()) { onSubmit(value.trim()); setValue('') }; return }
    if (key.backspace || key.delete)      { setValue(v => v.slice(0, -1)); return }
    if (key.ctrl && input === 'c')        { onExit ? void onExit() : process.exit(0); return }
    if (!key.ctrl && !key.meta && input)  { setValue(v => v + input) }
  })

  return (
    <Box flexDirection="column">
      {isOpen && <PromptInputSuggestions {...suggestions} />}
      <Box>
        <Text color="green" bold>{'> '}</Text>
        <Text>{value}</Text>
        {!isLoading && <Text color="gray">█</Text>}
      </Box>
    </Box>
  )
}
```

---

## 依赖变更

```bash
npm install fuse.js
```

fuse.js v7+，ESM 兼容，~25KB，零依赖。

---

## 删除文件

- `src/components/CommandPalette.tsx` — 功能由 `commandSuggestions.ts` + `PromptInputSuggestions.tsx` 完全替代

---

## 不在本次范围内

- Bash 模式 shell 历史补全
- `@文件` 建议
- `#Slack频道` 建议
- 中间输入斜杠命令鬼文本（inline ghost text）
- 多 `argumentHint` 参数的交互式填写
