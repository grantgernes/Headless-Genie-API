"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  status?: string;
  streaming?: boolean;
  timestamp: Date;
};

type GenieEvent = {
  type?: string;
  message?: string;
  skill_name?: string;
  error?: string;
  reason?: string;
};

export type GenieChatWidgetProps = {
  /** "floating" = fixed bottom-right (demo page). "fill" = fills its container (iframe/embed). */
  mode?: "floating" | "fill";
  account?: string;
  owner?: string;
  /** For the demo page you can collapse to a header bar. Embed mode ignores this. */
  initialCollapsed?: boolean;
  showChrome?: boolean;
};

function formatTime(d: Date) {
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function WorkatoLogo() {
  // Loads from /public/workato-logo.svg so the brand asset can be swapped
  // by replacing the file — no code change needed.
  return (
    <img
      src="/workato-logo.svg"
      alt="Workato"
      width={22}
      height={22}
      style={{ display: "block" }}
    />
  );
}

function ChevronUpIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M6 15l6-6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function GenieChatWidget({
  mode = "floating",
  account = "Acme Corp",
  owner = "Jane Smith",
  initialCollapsed = false,
  showChrome = true,
}: GenieChatWidgetProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(mode === "floating" ? initialCollapsed : false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, collapsed]);

  async function ensureConversation(): Promise<string> {
    if (conversationId) return conversationId;
    const res = await fetch("/api/conversation", { method: "POST" });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Failed to create conversation (${res.status}): ${body}`);
    }
    const data = await res.json();
    const id = data?.result?.conversation_id ?? data?.conversation_id ?? data?.id;
    if (!id) throw new Error(`No conversation_id in response: ${JSON.stringify(data)}`);
    setConversationId(id);
    return id;
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;
    setError(null);
    setSending(true);
    setInput("");

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      timestamp: new Date(),
    };
    const assistantId = crypto.randomUUID();
    const assistantMsg: Message = {
      id: assistantId,
      role: "assistant",
      content: "",
      status: "Thinking…",
      streaming: true,
      timestamp: new Date(),
    };
    setMessages((m) => [...m, userMsg, assistantMsg]);

    const updateAssistant = (patch: Partial<Message>) => {
      setMessages((m) => m.map((msg) => (msg.id === assistantId ? { ...msg, ...patch } : msg)));
    };

    let accContent = "";

    const handleEvent = (evt: GenieEvent) => {
      switch (evt.type) {
        case "processing.started":
          updateAssistant({ status: "Thinking…" });
          break;
        case "agent.message":
          if (evt.message) {
            accContent = accContent ? `${accContent}\n\n${evt.message}` : evt.message;
            updateAssistant({ content: accContent, status: undefined, timestamp: new Date() });
          }
          break;
        case "skill.running":
          updateAssistant({ status: `Running ${evt.skill_name ?? "skill"}…` });
          break;
        case "skill.completed":
          updateAssistant({ status: `Finished ${evt.skill_name ?? "skill"}` });
          break;
        case "skill.failed":
          updateAssistant({
            status: `${evt.skill_name ?? "skill"} failed: ${evt.error ?? "unknown error"}`,
          });
          break;
        case "skill.stopped":
          updateAssistant({ status: `${evt.skill_name ?? "skill"} stopped` });
          break;
        case "system.stream_interrupted":
          setError(`Stream interrupted: ${evt.reason ?? "unknown"}`);
          break;
        case "processing.finished":
          updateAssistant({ streaming: false, status: undefined });
          break;
      }
    };

    try {
      const convoId = await ensureConversation();
      const res = await fetch("/api/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: convoId, message: text }),
      });

      if (!res.ok || !res.body) {
        const body = await res.text().catch(() => "");
        throw new Error(`Message failed (${res.status}): ${body}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const consumeEvent = (raw: string) => {
        let dataPayload = "";
        for (const line of raw.split("\n")) {
          if (line.startsWith("data:")) {
            dataPayload += line.slice(5).replace(/^ /, "");
            dataPayload += "\n";
          }
        }
        dataPayload = dataPayload.replace(/\n$/, "");
        if (!dataPayload || dataPayload === "[DONE]") return;
        try {
          handleEvent(JSON.parse(dataPayload) as GenieEvent);
        } catch {
          accContent = accContent ? `${accContent}\n${dataPayload}` : dataPayload;
          updateAssistant({ content: accContent });
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let sepIdx: number;
        while ((sepIdx = buffer.indexOf("\n\n")) !== -1) {
          const rawEvent = buffer.slice(0, sepIdx);
          buffer = buffer.slice(sepIdx + 2);
          consumeEvent(rawEvent);
        }
      }
      if (buffer.trim()) consumeEvent(buffer);

      updateAssistant({ streaming: false, status: undefined });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      updateAssistant({
        streaming: false,
        status: undefined,
        content: accContent || "(no response)",
      });
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSend();
    }
  }

  const rootClass = `sf-utility ${mode === "fill" ? "fill" : ""} ${collapsed ? "collapsed" : ""}`;

  return (
    <div className={rootClass}>
      {showChrome && (
        <button
          type="button"
          className="sf-utility-header"
          onClick={() => collapsed && setCollapsed(false)}
          aria-expanded={!collapsed}
        >
          <div className="sf-utility-title">
            <WorkatoLogo />
            <span>Workato AI Assistant</span>
          </div>
          <div className="sf-utility-controls">
            {collapsed ? (
              <span
                className="sf-utility-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setCollapsed(false);
                }}
                aria-label="Expand chat"
                title="Expand"
              >
                <ChevronUpIcon />
              </span>
            ) : mode === "floating" ? (
              <>
                <span
                  className="sf-utility-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCollapsed(true);
                  }}
                  aria-label="Minimize"
                  title="Minimize"
                >
                  −
                </span>
                <span
                  className="sf-utility-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCollapsed(true);
                  }}
                  aria-label="Close"
                  title="Close"
                >
                  ×
                </span>
              </>
            ) : null}
          </div>
        </button>
      )}

      {!collapsed && (
        <>
          <div className="sf-context-bar">
            <span>
              <strong>Account:</strong> {account}
            </span>
            <span className="sf-context-sep">|</span>
            <span>
              <strong>Owner:</strong> {owner}
            </span>
          </div>

          <div className="sf-messages" ref={listRef}>
            {messages.length === 0 && (
              <div className="sf-empty-hint">
                Ask me about accounts, opportunities, or next-best actions.
              </div>
            )}
            {messages.map((m) => (
              <div key={m.id} className={`sf-message-row ${m.role}`}>
                <div className={`sf-bubble ${m.role}${m.streaming ? " streaming" : ""}`}>
                  {m.role === "assistant" ? (
                    <div className="sf-md">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                    </div>
                  ) : (
                    m.content
                  )}
                  {m.status && <div className="sf-status">{m.status}</div>}
                </div>
                <div className="sf-timestamp">{formatTime(m.timestamp)}</div>
              </div>
            ))}
            {error && <div className="sf-error">{error}</div>}
          </div>

          <div className="sf-composer">
            <input
              type="text"
              placeholder="Type a message…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={sending}
            />
            <button onClick={handleSend} disabled={sending || !input.trim()} className="sf-send-btn">
              {sending ? "…" : "Send"}
            </button>
          </div>

          <div className="sf-footer">Sales Agent (powered by Workato)</div>
        </>
      )}
    </div>
  );
}
