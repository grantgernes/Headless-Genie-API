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

const FAKE_ACCOUNTS = [
  { name: "Acme Corp", type: "Customer - Direct", owner: "Jane Smith", industry: "Manufacturing" },
  { name: "Global Media Inc.", type: "Customer - Channel", owner: "David Lee", industry: "Media" },
  { name: "Northwind Traders", type: "Prospect", owner: "Priya Patel", industry: "Retail" },
  { name: "Contoso Ltd.", type: "Customer - Direct", owner: "Marcus Chen", industry: "Financial Services" },
  { name: "Fabrikam Robotics", type: "Prospect", owner: "Jane Smith", industry: "Technology" },
  { name: "Adventure Works", type: "Customer - Channel", owner: "Sofia Ramirez", industry: "Travel" },
];

function formatTime(d: Date) {
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function SalesforceCloudIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path d="M9.5 7c1.66 0 3.03 1.03 3.55 2.47.44-.29.97-.47 1.55-.47 1.66 0 3 1.34 3 3 0 .18-.03.35-.06.5.34-.11.69-.17 1.06-.17 1.66 0 3 1.34 3 3s-1.34 3-3 3H5c-2.21 0-4-1.79-4-4s1.79-4 4-4c.28 0 .55.03.81.08C6.28 8.02 7.79 7 9.5 7z" />
    </svg>
  );
}

function ChevronUpIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M6 15l6-6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
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

  return (
    <div className="sf-shell">
      <nav className="sf-topnav">
        <div className="sf-topnav-inner">
          <div className="sf-logo">salesforce</div>
          <div className="sf-app-switcher">Sales</div>
          <div className="sf-topnav-search">
            <span className="sf-search-icon">⌕</span>
            <span>Search Salesforce</span>
          </div>
          <div className="sf-topnav-icons">
            <span title="Setup">⚙</span>
            <span title="Help">?</span>
            <span title="Notifications">🔔</span>
            <span className="sf-avatar">JS</span>
          </div>
        </div>
        <div className="sf-tabbar">
          <div className="sf-tab">Home</div>
          <div className="sf-tab active">Accounts</div>
          <div className="sf-tab">Contacts</div>
          <div className="sf-tab">Opportunities</div>
          <div className="sf-tab">Leads</div>
          <div className="sf-tab">Reports</div>
          <div className="sf-tab">Dashboards</div>
        </div>
      </nav>

      <main className="sf-main">
        <div className="sf-listview">
          <div className="sf-listview-header">
            <div>
              <div className="sf-listview-eyebrow">Accounts</div>
              <div className="sf-listview-title">All Accounts</div>
            </div>
            <div className="sf-listview-actions">
              <button className="sf-btn">New</button>
              <button className="sf-btn">Import</button>
            </div>
          </div>
          <div className="sf-table">
            <div className="sf-tr sf-th">
              <div>Account Name</div>
              <div>Type</div>
              <div>Industry</div>
              <div>Owner</div>
            </div>
            {FAKE_ACCOUNTS.map((a) => (
              <div className="sf-tr" key={a.name}>
                <div className="sf-link">{a.name}</div>
                <div>{a.type}</div>
                <div>{a.industry}</div>
                <div>{a.owner}</div>
              </div>
            ))}
          </div>
        </div>
      </main>

      <div className={`sf-utility ${collapsed ? "collapsed" : ""}`}>
        <button
          type="button"
          className="sf-utility-header"
          onClick={() => collapsed && setCollapsed(false)}
          aria-expanded={!collapsed}
        >
          <div className="sf-utility-title">
            <SalesforceCloudIcon />
            <span>AI Assistant</span>
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
            ) : (
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
            )}
          </div>
        </button>

        {!collapsed && (
          <>
            <div className="sf-context-bar">
              <span>
                <strong>Account:</strong> Acme Corp
              </span>
              <span className="sf-context-sep">|</span>
              <span>
                <strong>Owner:</strong> Jane Smith
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
    </div>
  );
}
