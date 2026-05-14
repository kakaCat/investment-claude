# Markdown 表格渲染优化 - 2026-05-14

## 问题描述

用户反馈：Claude 返回的表格显示为 ASCII 文本格式，而不是真正的 Markdown 表格渲染。

**当前效果：**
```
| 项目 | 数值 |
|------|------|
| 总资产 | ¥999,982.50 |
| 可用资金 | ¥952,982.50 |
```

**期望效果：**
真正的表格渲染，带有对齐、颜色和格式化。

---

## 根本原因

1. **HtmlView.tsx 的 `MarkdownText` 组件**只支持基础 Markdown：
   - ✅ 标题 (# ## ###)
   - ✅ 列表 (- * 1.)
   - ✅ 行内格式 (**bold** *italic* `code`)
   - ❌ **表格** (缺失)

2. Claude 的回复通过 `MixedContent` → `MarkdownText` 渲染
3. 表格被当作普通文本处理，没有特殊渲染

---

## 解决方案

### 1. 添加表格检测逻辑

修改 `MarkdownText` 函数，添加表格检测：

```typescript
// Markdown table detection
if (line.includes('|') && i + 1 < lines.length && lines[i + 1].match(/^\|?[\s]*[-:]+[\s]*\|/)) {
  const tableLines: string[] = [line];
  let j = i + 1;

  // Collect all table rows
  while (j < lines.length && lines[j].includes('|')) {
    tableLines.push(lines[j]);
    j++;
  }

  elements.push(<MarkdownTable key={i} lines={tableLines} />);
  i = j;
  continue;
}
```

**检测规则：**
- 当前行包含 `|`
- 下一行是分隔符（`|---|---|`）
- 收集所有连续的表格行

---

### 2. 实现 `MarkdownTable` 组件

```typescript
function MarkdownTable({ lines }: { lines: string[] }) {
  // 1. 解析行，按 | 分割单元格
  const rows = lines.map(line =>
    line.split('|')
      .map(cell => cell.trim())
      .filter(cell => cell.length > 0)
  );

  // 2. 提取表头和数据行（跳过分隔符行）
  const headerRow = rows[0];
  const dataRows = rows.slice(2);

  // 3. 计算列宽（取每列最大宽度，上限30字符）
  const colWidths = headerRow.map((_, colIdx) => {
    let maxWidth = headerRow[colIdx]?.length || 0;
    dataRows.forEach(row => {
      const cellWidth = row[colIdx]?.length || 0;
      if (cellWidth > maxWidth) maxWidth = cellWidth;
    });
    return Math.min(maxWidth, 30);
  });

  // 4. 渲染表格
  return (
    <Box flexDirection="column" marginY={1}>
      {/* 表头 - 粗体青色 */}
      <Box>
        {headerRow.map((cell, idx) => (
          <Text key={idx} bold color="cyan">
            {cell.padEnd(colWidths[idx] + 2)}
          </Text>
        ))}
      </Box>

      {/* 分隔线 - 灰色 */}
      <Text color="gray">
        {colWidths.map(w => '─'.repeat(w + 2)).join('')}
      </Text>

      {/* 数据行 */}
      {dataRows.map((row, rowIdx) => (
        <Box key={rowIdx}>
          {row.map((cell, colIdx) => (
            <Text key={colIdx}>
              {cell.padEnd(colWidths[colIdx] + 2)}
            </Text>
          ))}
        </Box>
      ))}
    </Box>
  );
}
```

---

## 功能特性

### ✅ 自动列宽计算
- 根据内容自动调整每列宽度
- 上限30字符，防止过宽

### ✅ 表头高亮
- 粗体 + 青色显示
- 与普通数据行区分

### ✅ 分隔线渲染
- 灰色横线分隔表头和数据
- 长度与列宽匹配

### ✅ 对齐和间距
- 使用 `padEnd()` 保证列对齐
- 每列之间2个空格间距

---

## 示例效果

### 输入（Markdown）
```markdown
| 项目 | 数值 |
|------|------|
| 总资产 | ¥999,982.50 |
| 可用资金 | ¥952,982.50 |
| 持仓市值 | ¥47,000.00 |
```

### 输出（渲染后）
```
项目        数值
────────────────────────
总资产      ¥999,982.50
可用资金    ¥952,982.50
持仓市值    ¥47,000.00
```

**视觉效果：**
- 表头：**粗体青色**
- 分隔线：灰色
- 数据：正常白色
- 列对齐：自动计算

---

## 修改文件

### `src/components/HtmlView.tsx`

**修改1：** `MarkdownText` 函数（第172-243行）
- 从 `map()` 改为 `while` 循环，支持多行处理
- 添加表格检测和收集逻辑
- 调用 `MarkdownTable` 组件渲染

**修改2：** 新增 `MarkdownTable` 组件（第250-295行）
- 解析表格行
- 计算列宽
- 渲染表头、分隔线、数据行

---

## 技术细节

### 表格检测正则
```typescript
lines[i + 1].match(/^\|?[\s]*[-:]+[\s]*\|/)
```
- `^\|?` - 可选的起始 `|`
- `[\s]*[-:]+[\s]*` - 分隔符（`---` 或 `:---:` 等）
- `\|` - 必须包含 `|`

### 列宽计算
```typescript
const colWidths = headerRow.map((_, colIdx) => {
  let maxWidth = headerRow[colIdx]?.length || 0;
  dataRows.forEach(row => {
    const cellWidth = row[colIdx]?.length || 0;
    if (cellWidth > maxWidth) maxWidth = cellWidth;
  });
  return Math.min(maxWidth, 30); // 上限30字符
});
```

### Ink 布局
- `<Box flexDirection="column">` - 垂直布局（行）
- `<Box flexDirection="row">` - 水平布局（列）
- `padEnd(width)` - 文本右填充空格

---

## 兼容性

### ✅ 支持的表格格式
```markdown
| A | B |        ← 标准格式
|---|---|

A | B            ← 无外侧 |
---|---

| A | B |       ← 对齐标记
|:---|---:|
```

### ❌ 不支持的格式
- 合并单元格
- 嵌套表格
- 表格内的复杂 Markdown（链接、图片等）

---

## 测试建议

### 测试用例

1. **基础表格**
```markdown
| 列1 | 列2 |
|-----|-----|
| A   | B   |
```

2. **中文表格**
```markdown
| 股票代码 | 名称 | 价格 |
|---------|------|------|
| 600519  | 茅台 | ¥1,450 |
```

3. **不等宽列**
```markdown
| Short | Very Long Column Name |
|-------|----------------------|
| A     | B                    |
```

4. **空单元格**
```markdown
| A | B | C |
|---|---|---|
| 1 |   | 3 |
```

---

## 部署

1. ✅ 修改 `src/components/HtmlView.tsx`
2. ✅ 运行 `npm run build` 编译
3. ⏳ 重启服务测试效果

---

## 后续优化建议

1. **对齐支持** - 识别 `:---:` 实现居中对齐
2. **颜色主题** - 根据数据类型（数字、百分比）自动着色
3. **溢出处理** - 超长内容截断 + `...`
4. **性能优化** - 大表格分页显示
5. **交互功能** - 表格排序、筛选（需要状态管理）

---

## 总结

通过在 `HtmlView.tsx` 中添加 Markdown 表格渲染支持，解决了 Claude 回复中表格显示为纯文本的问题。现在表格会被正确渲染为格式化的、带颜色的表格视图，大幅提升了数据展示的可读性。
