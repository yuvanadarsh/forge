"use client";

import {
  isValidElement,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Components } from "react-markdown";

const CODE_FONT = "var(--font-jetbrains-mono), var(--font-geist-mono), ui-monospace, monospace";

/** Language from the highlighted <code> child's className ("hljs language-ts"). */
function languageOf(children: ReactNode): string {
  for (const child of Array.isArray(children) ? children : [children]) {
    if (!isValidElement(child)) continue;
    const { className } = child.props as { className?: string };
    const match = /language-([\w+#-]+)/.exec(className ?? "");
    if (match) return match[1];
  }
  return "text";
}

interface CodeBlockProps {
  language: string;
  /** The rehype-highlight-processed <code> element (spans already colored). */
  children: ReactNode;
}

export default function CodeBlock({ language, children }: CodeBlockProps) {
  const preRef = useRef<HTMLPreElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  async function handleCopy() {
    const text = preRef.current?.textContent ?? "";
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard API needs a secure context — textarea fallback otherwise.
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setCopied(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="my-2 rounded-lg overflow-hidden border" style={{ borderColor: "#2a2a2a" }}>
      <div
        className="flex items-center justify-between px-4 py-2 border-b"
        style={{ background: "#1a1a1a", borderColor: "#2a2a2a" }}
      >
        <span className="text-xs" style={{ color: "#f59e0b", fontFamily: CODE_FONT }}>
          {language}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="text-xs font-medium transition-colors duration-150"
          style={{ color: copied ? "#22c55e" : "#71717a" }}
          onMouseEnter={(e) => {
            if (!copied) (e.currentTarget as HTMLButtonElement).style.color = "#f5f5f5";
          }}
          onMouseLeave={(e) => {
            if (!copied) (e.currentTarget as HTMLButtonElement).style.color = "#71717a";
          }}
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre
        ref={preRef}
        className="p-4 overflow-x-auto text-sm leading-relaxed"
        style={{ background: "#0d0d0d", margin: 0, borderRadius: 0, fontFamily: CODE_FONT }}
      >
        {children}
      </pre>
    </div>
  );
}

/** Shared ReactMarkdown overrides for chat renderers: Claude-style code
 *  blocks with a header bar + copy button, a subtle solid `---` rule, inline
 *  code styling, and GFM table styling (used with remarkGfm — that plugin
 *  already requires a proper header-separator row before it parses anything
 *  as a table, so mid-sentence `|` characters or a missing `---` row stay
 *  plain text instead of becoming a broken table). */
export const chatMarkdownComponents: Components = {
  pre: ({ children }) => <CodeBlock language={languageOf(children)}>{children}</CodeBlock>,
  hr: () => <hr style={{ border: "none", borderTop: "1px solid #2a2a2a", margin: "1em 0" }} />,
  // Cell/row styling (header background, alternating rows, borders) lives in
  // globals.css under .markdown-body — this only adds the overflow-x wrapper
  // so wide tables scroll instead of blowing out the chat bubble.
  table: ({ children }) => (
    <div className="overflow-x-auto rounded-lg border" style={{ borderColor: "#2a2a2a" }}>
      <table>{children}</table>
    </div>
  ),
};
