import React, { useMemo } from "react";
import { Box, Text } from "ink";
import { parseDocument } from "htmlparser2";
import type { ChildNode, AnyNode } from "domhandler";
import { isTag, isText, isComment } from "domhandler";

type Props = {
  html: string;
};

// ── tag sets ─────────────────────────────────────────────────────

const BLOCK_TAGS = new Set([
  "div", "p", "h1", "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li", "pre", "blockquote", "hr",
  "table", "tr", "section", "article", "header", "footer", "main",
  "br", "form", "fieldset",
  "html", "head", "body", "script", "style", "title", "meta", "link",
]);

const INLINE_TAGS = new Set([
  "span", "strong", "b", "em", "i", "a", "code", "sub", "sup",
  "del", "s", "u", "small", "mark",
]);

// ── render ────────────────────────────────────────────────────────

function RenderNode({ node }: { node: ChildNode }): React.ReactElement | null {
  if (isText(node)) {
    const t = node.data;
    if (!t) return null;
    return <Text>{t}</Text>;
  }

  if (isComment(node)) return null;

  if (!isTag(node)) return null;

  const name = node.name;
  const children = node.children.length > 0
    ? node.children.map((c, i) => <RenderNode key={i} node={c} />)
    : null;

  // ── block elements ──────────────────────────────────────────

  if (name === "br") return <Text>{"\n"}</Text>;

  if (name === "hr") return <Text dimColor>{"─".repeat(40)}</Text>;

  if (name === "h1") return <Text bold>{"\n"}{children}{"\n"}</Text>;
  if (name === "h2") return <Text bold>{"\n"}{children}{"\n"}</Text>;
  if (name === "h3") return <Text bold>{children}</Text>;
  if (name === "h4") return <Text bold>{children}</Text>;
  if (name === "h5") return <Text bold dimColor>{children}</Text>;
  if (name === "h6") return <Text bold dimColor>{children}</Text>;

  if (name === "p") return (
    <Box flexDirection="column">
      <Text>{children}</Text>
    </Box>
  );

  if (name === "pre") return (
    <Box flexDirection="column" marginLeft={1}>
      <Text dimColor>{children}</Text>
    </Box>
  );

  if (name === "code" && !isInsidePre(node)) {
    return <Text dimColor>{children}</Text>;
  }

  if (name === "blockquote") return (
    <Box
      flexDirection="column"
      marginLeft={2}
      borderStyle="round"
      borderColor="gray"
    >
      <Text dimColor>{children}</Text>
    </Box>
  );

  if (name === "li") return <Text>  • {children}{"\n"}</Text>;

  if (name === "ul" || name === "ol") return (
    <Box flexDirection="column">{children}</Box>
  );

  // ── inline formatting ────────────────────────────────────────

  if (name === "strong" || name === "b") return <Text bold>{children}</Text>;
  if (name === "em" || name === "i") return <Text italic>{children}</Text>;
  if (name === "s" || name === "del") return <Text strikethrough>{children}</Text>;
  if (name === "u") return <Text underline>{children}</Text>;
  if (name === "mark") return <Text inverse>{children}</Text>;

  if (name === "a") return <Text color="blue" underline>{children}</Text>;

  // ── table ────────────────────────────────────────────────────

  if (name === "table") return (
    <Box flexDirection="column" marginY={1}>
      {children}
    </Box>
  );
  if (name === "tr") return (
    <Box flexDirection="row" columnGap={2}>{children}</Box>
  );
  if (name === "th") return <Text bold underline>{children}{" "}</Text>;
  if (name === "td") return <Text>{children}{"  "}</Text>;

  // ── fallback ─────────────────────────────────────────────────
  if (INLINE_TAGS.has(name)) return <Text>{children}</Text>;
  if (BLOCK_TAGS.has(name)) return <Box flexDirection="column">{children}</Box>;
  return <Text>{children}</Text>;
}

// ── helpers ──────────────────────────────────────────────────────

function isInsidePre(el: AnyNode): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let p: any = (el as any).parent;
  while (p) {
    if (p.name === "pre") return true;
    p = p.parent;
  }
  return false;
}

// ── public component ─────────────────────────────────────────────

export function HtmlView({ html }: Props) {
  const doc = useMemo(() => parseDocument(html, { decodeEntities: true }), [html]);

  return (
    <Box flexDirection="column">
      {doc.children.map((node, i) => (
        <RenderNode key={i} node={node} />
      ))}
    </Box>
  );
}

// ── HTML detection ──────────────────────────────────────────────────

const HTML_DOCTYPE_RE = /<!DOCTYPE\s+html/i;
const HTML_TAG_RE = /<\/(?:html|body|div|table|head|script)[\s>]/i;
const HTML_START_RE = /^<(?:html|div|table|h[1-6]|p|ul|ol|pre|blockquote|head|body)\b/i;

/**
 * Lightweight check — returns true if text looks like HTML markup.
 * Does NOT parse; fast enough to run on every message.
 */
export function isHTML(text: string): boolean {
  if (text.length < 10) return false;
  const trimmed = text.trimStart();
  return HTML_DOCTYPE_RE.test(trimmed) ||
    HTML_START_RE.test(trimmed) ||
    HTML_TAG_RE.test(trimmed);
}

// ── SmartContent ────────────────────────────────────────────────────

const HTML_BLOCK_RE =
  /(<!DOCTYPE\s+html[\s>][\s\S]*?<\/html>)|(<html[\s>][\s\S]*?<\/html>)/gi;

/**
 * Simple markdown renderer for TUI
 * Handles: headings, horizontal rules, bold, italic, lists, tables
 */
function MarkdownText({ text, color }: { text: string; color?: string }) {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Horizontal rule
    if (line.trim() === '---' || line.trim() === '***') {
      elements.push(<Text key={i} color="gray">{'─'.repeat(40)}</Text>);
      i++;
      continue;
    }

    // Headings
    if (line.startsWith('### ')) {
      elements.push(<Text key={i} bold color="cyan">{line.slice(4)}</Text>);
      i++;
      continue;
    }
    if (line.startsWith('## ')) {
      elements.push(<Text key={i} bold color="cyan">{'\n' + line.slice(3)}</Text>);
      i++;
      continue;
    }
    if (line.startsWith('# ')) {
      elements.push(<Text key={i} bold color="cyan">{'\n' + line.slice(2) + '\n'}</Text>);
      i++;
      continue;
    }

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

    // List items
    if (line.match(/^[\s]*[-*]\s/)) {
      const content = line.replace(/^[\s]*[-*]\s/, '');
      elements.push(<Text key={i}>  • {renderInlineMarkdown(content)}</Text>);
      i++;
      continue;
    }

    // Numbered lists
    if (line.match(/^[\s]*\d+\.\s/)) {
      elements.push(<Text key={i}>  {renderInlineMarkdown(line)}</Text>);
      i++;
      continue;
    }

    // Regular text with inline formatting
    elements.push(<Text key={i}>{renderInlineMarkdown(line)}</Text>);
    i++;
  }

  return <Box flexDirection="column">{elements}</Box>;
}

/**
 * Render inline markdown: **bold**, *italic*, `code`
 */
function renderInlineMarkdown(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  // Match **bold**, *italic*, `code`
  const regex = /(\*\*[^*]+\*\*)|(\*[^*]+\*)|(`[^`]+`)/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    // Add text before match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const matched = match[0];
    if (matched.startsWith('**')) {
      parts.push(<Text key={match.index} bold>{matched.slice(2, -2)}</Text>);
    } else if (matched.startsWith('*')) {
      parts.push(<Text key={match.index} italic>{matched.slice(1, -1)}</Text>);
    } else if (matched.startsWith('`')) {
      parts.push(<Text key={match.index} color="cyan">{matched.slice(1, -1)}</Text>);
    }

    lastIndex = match.index + matched.length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}

/**
 * Render a Markdown table
 */
function MarkdownTable({ lines }: { lines: string[] }) {
  if (lines.length < 2) return null;

  // Parse rows
  const rows = lines.map(line =>
    line.split('|')
      .map(cell => cell.trim())
      .filter(cell => cell.length > 0)
  );

  // Skip separator row (index 1)
  const headerRow = rows[0];
  const dataRows = rows.slice(2);

  if (!headerRow || dataRows.length === 0) return null;

  // Calculate column widths
  const colWidths = headerRow.map((_, colIdx) => {
    let maxWidth = headerRow[colIdx]?.length || 0;
    dataRows.forEach(row => {
      const cellWidth = row[colIdx]?.length || 0;
      if (cellWidth > maxWidth) maxWidth = cellWidth;
    });
    return Math.min(maxWidth, 30); // Cap at 30 chars
  });

  // Render table
  return (
    <Box flexDirection="column" marginY={1}>
      {/* Header */}
      <Box>
        {headerRow.map((cell, idx) => (
          <Text key={idx} bold color="cyan">
            {cell.padEnd(colWidths[idx] + 2)}
          </Text>
        ))}
      </Box>

      {/* Separator */}
      <Text color="gray">
        {colWidths.map(w => '─'.repeat(w + 2)).join('')}
      </Text>

      {/* Data rows */}
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

/**
 * Splits text into alternating text/HTML segments.
 * Pi can embed <html>...</html> blocks inside markdown replies.
 */
export function MixedContent({ text, color }: { text: string; color?: string }) {
  const segments = useMemo(() => {
    const parts: Array<{ type: "text" | "html"; content: string }> = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    const re = new RegExp(HTML_BLOCK_RE.source, "gi");
    while ((match = re.exec(text)) !== null) {
      const before = text.slice(lastIndex, match.index);
      if (before) parts.push({ type: "text", content: before });
      parts.push({ type: "html", content: match[0] });
      lastIndex = match.index + match[0].length;
    }

    const remainder = text.slice(lastIndex);
    if (remainder) parts.push({ type: "text", content: remainder });

    if (parts.length === 0) parts.push({ type: "text", content: text });
    return parts;
  }, [text]);

  return (
    <Box flexDirection="column">
      {segments.map((seg, i) =>
        seg.type === "html" || isHTML(seg.content) ? (
          <SafeHtmlView key={i} html={seg.content} />
        ) : (
          <MarkdownText key={i} text={seg.content} color={color} />
        ),
      )}
    </Box>
  );
}

function SafeHtmlView({ html }: { html: string }) {
  try {
    return <HtmlView html={html} />;
  } catch {
    return <Text>{html}</Text>;
  }
}

/**
 * Drop-in for plain content — auto-detects HTML vs text.
 * Use MixedContent when the text may contain embedded HTML blocks.
 */
export function SmartContent({ text }: { text: string }) {
  if (isHTML(text)) {
    try {
      return <HtmlView html={text} />;
    } catch {
      return <Text>{text}</Text>;
    }
  }
  return <Text>{text}</Text>;
}
