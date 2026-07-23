// Conversation export — Markdown download and print-to-PDF via the browser.

import type { BackendMessage } from "@/types";

export interface ConversationExportInput {
  title: string;
  statusLabel: string;
  workspacePath: string;
  /** Agent names in agent_sequence order. */
  agentNames: string[];
  /** completed_at of the latest run when available, else pipeline created_at. */
  dateIso: string | null;
  planMd: string;
  messages: BackendMessage[];
  agentNameById: (id: string | null) => string | undefined;
}

interface ParsedToolCall {
  tool: string;
  argSummary: string;
  resultSummary?: string;
}

function parseToolCallContent(content: string): ParsedToolCall {
  try {
    const data = JSON.parse(content) as {
      tool_name?: string;
      args?: Record<string, unknown>;
      result_summary?: string;
    };
    const args = data.args ?? {};
    const argSummary =
      typeof args.path === "string"
        ? args.path
        : typeof args.command === "string"
          ? args.command
          : typeof args.query === "string"
            ? args.query
            : Object.keys(args).length > 0
              ? JSON.stringify(args)
              : "";
    return { tool: data.tool_name ?? "tool", argSummary, resultSummary: data.result_summary };
  } catch {
    return { tool: "tool", argSummary: content.slice(0, 120) };
  }
}

function timestamp(iso: string): string {
  return new Date(iso).toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function imageCount(m: BackendMessage): number {
  if (m.images.length > 0) return m.images.length;
  return m.image_data ? 1 : 0;
}

const EXPORTED_ROLES = new Set(["user", "assistant", "approval_gate", "tool_call", "system"]);

export function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "pipeline"
  );
}

export function exportFilename(title: string, dateIso: string | null, ext: string): string {
  const date = (dateIso ? new Date(dateIso) : new Date()).toISOString().slice(0, 10);
  return `${slugify(title)}-${date}.${ext}`;
}

export function buildConversationMarkdown(input: ConversationExportInput): string {
  const lines: string[] = [
    `# ${input.title}`,
    `**Status:** ${input.statusLabel}`,
    `**Workspace:** ${input.workspacePath}`,
    `**Agents:** ${input.agentNames.join(" → ") || "—"}`,
    `**Date:** ${input.dateIso ? timestamp(input.dateIso) : "—"}`,
    "",
    "## Execution Plan",
    input.planMd || "_No execution plan._",
    "",
    "## Conversation",
  ];

  const exportable = input.messages.filter((m) => EXPORTED_ROLES.has(m.role));
  exportable.forEach((m, i) => {
    if (i > 0) lines.push("", "---", "");
    const when = timestamp(m.created_at);
    if (m.role === "user") {
      lines.push(`**You** · ${when}`, m.content);
    } else if (m.role === "assistant") {
      const name = input.agentNameById(m.agent_id) ?? "Agent";
      lines.push(`**${name}** · ${when}`, m.content);
    } else if (m.role === "approval_gate") {
      lines.push(
        `**Approval Gate**${m.gate_status ? ` (${m.gate_status})` : ""} · ${when}`,
        m.content,
      );
    } else if (m.role === "system") {
      lines.push(`_${m.content}_ · ${when}`);
    } else {
      // tool_call — shown as a code block
      const name = input.agentNameById(m.agent_id) ?? "Agent";
      const call = parseToolCallContent(m.content);
      lines.push(
        `**${name}** ran a tool · ${when}`,
        "```",
        `${call.tool}(${call.argSummary})`,
        ...(call.resultSummary ? [`→ ${call.resultSummary}`] : []),
        "```",
      );
    }
    const imgs = imageCount(m);
    if (imgs > 0) lines.push("", `_[${imgs} image${imgs === 1 ? "" : "s"} attached]_`);
  });

  return lines.join("\n") + "\n";
}

export function downloadMarkdown(input: ConversationExportInput): void {
  const blob = new Blob([buildConversationMarkdown(input)], {
    type: "text/markdown;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = exportFilename(input.title, input.dateIso, "md");
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildPrintHtml(input: ConversationExportInput): string {
  const exportable = input.messages.filter((m) => EXPORTED_ROLES.has(m.role));
  const blocks = exportable
    .map((m) => {
      const when = escapeHtml(timestamp(m.created_at));
      const imgs = imageCount(m);
      const imgNote =
        imgs > 0 ? `<p class="img-note">[${imgs} image${imgs === 1 ? "" : "s"} attached]</p>` : "";
      if (m.role === "tool_call") {
        const name = escapeHtml(input.agentNameById(m.agent_id) ?? "Agent");
        const call = parseToolCallContent(m.content);
        const result = call.resultSummary ? `\n→ ${call.resultSummary}` : "";
        return `<div class="msg"><p class="speaker">${name} ran a tool <span class="time">· ${when}</span></p><pre class="tool">${escapeHtml(`${call.tool}(${call.argSummary})${result}`)}</pre>${imgNote}</div>`;
      }
      const speaker =
        m.role === "user"
          ? "You"
          : m.role === "system"
            ? "System"
            : m.role === "approval_gate"
              ? `Approval Gate${m.gate_status ? ` (${m.gate_status})` : ""}`
              : (input.agentNameById(m.agent_id) ?? "Agent");
      return `<div class="msg"><p class="speaker">${escapeHtml(speaker)} <span class="time">· ${when}</span></p><div class="content">${escapeHtml(m.content)}</div>${imgNote}</div>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(input.title)} — Forge conversation</title>
<style>
  body { background: #ffffff; color: #111111; font: 14px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; max-width: 760px; margin: 0 auto; padding: 32px 24px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 16px; margin: 28px 0 10px; border-bottom: 1px solid #dddddd; padding-bottom: 4px; }
  .meta { color: #444444; font-size: 12px; margin: 2px 0; }
  .meta strong { color: #111111; }
  pre { background: #f5f5f5; border: 1px solid #e0e0e0; border-radius: 6px; padding: 10px 12px; font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; white-space: pre-wrap; word-break: break-word; }
  .msg { border-bottom: 1px solid #eeeeee; padding: 12px 0; page-break-inside: avoid; }
  .speaker { font-weight: 700; margin: 0 0 4px; font-size: 13px; }
  .time { color: #888888; font-weight: 400; font-size: 11px; }
  .content { white-space: pre-wrap; word-break: break-word; }
  .img-note { color: #888888; font-size: 11px; font-style: italic; margin: 6px 0 0; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
<h1>${escapeHtml(input.title)}</h1>
<p class="meta"><strong>Status:</strong> ${escapeHtml(input.statusLabel)}</p>
<p class="meta"><strong>Workspace:</strong> ${escapeHtml(input.workspacePath)}</p>
<p class="meta"><strong>Agents:</strong> ${escapeHtml(input.agentNames.join(" → ") || "—")}</p>
<p class="meta"><strong>Date:</strong> ${escapeHtml(input.dateIso ? timestamp(input.dateIso) : "—")}</p>
<h2>Execution Plan</h2>
<pre>${escapeHtml(input.planMd || "No execution plan.")}</pre>
<h2>Conversation</h2>
${blocks || '<p class="meta">No messages.</p>'}
<script>window.onload = function () { window.print(); };</script>
</body>
</html>`;
}

/** Opens a print-formatted copy in a new window and triggers the browser's
 *  print dialog — the user saves as PDF from there. No PDF library needed. */
export function exportAsPdf(input: ConversationExportInput): boolean {
  const win = window.open("", "_blank");
  if (!win) return false; // popup blocked
  win.document.write(buildPrintHtml(input));
  win.document.close();
  return true;
}
