import React, { useEffect, useRef, useState } from 'react';
import { AgentTheme, defaultTheme, applyTheme } from './theme';

export type AgentChatWidgetMode = 'inline' | 'launcher';

export interface AgentChatWidgetProps {
  apiBaseUrl: string;
  agentId?: string;
  externalUserId?: string;
  theme?: Partial<AgentTheme>;
  mode?: AgentChatWidgetMode;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export const AgentChatWidget: React.FC<AgentChatWidgetProps> = ({
  apiBaseUrl,
  agentId,
  externalUserId,
  theme,
  mode = 'inline',
}) => {
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [loadingStartTime, setLoadingStartTime] = useState<number | null>(null);
  const [isOpen, setIsOpen] = useState(mode === 'inline');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const mergedTheme: AgentTheme = { ...defaultTheme, ...(theme || {}) };

  // Helper to resolve avatar URL (handles relative paths from uploads)
  const resolvedAvatarUrl = mergedTheme.avatarUrl
    ? mergedTheme.avatarUrl.startsWith('/')
      ? `${apiBaseUrl}${mergedTheme.avatarUrl}`
      : mergedTheme.avatarUrl
    : undefined;

  useEffect(() => {
    if (containerRef.current) {
      applyTheme(containerRef.current, mergedTheme);
    }
  }, [mergedTheme.primaryColor, mergedTheme.secondaryColor, mergedTheme.backgroundColor, mergedTheme.textColor, mergedTheme.borderRadius, mergedTheme.fontFamily]);

  useEffect(() => {
    // Start a conversation on mount
    const start = async () => {
      const res = await fetch(`${apiBaseUrl}/api/chat/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, externalUserId }),
      });
      const data = await res.json();
      setConversationId(data.conversationId);
    };
    start().catch(console.error);
  }, [apiBaseUrl, agentId, externalUserId]);

  // Auto-apply theme when it changes
  useEffect(() => {
    if (containerRef.current) {
      applyTheme(containerRef.current, mergedTheme);
    }
  }, [
    mergedTheme.primaryColor,
    mergedTheme.secondaryColor,
    mergedTheme.backgroundColor,
    mergedTheme.textColor,
    mergedTheme.borderRadius,
    mergedTheme.fontFamily,
  ]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Track elapsed streaming time (for "working" indicator)
  useEffect(() => {
    if (isStreaming && !loadingStartTime) {
      setLoadingStartTime(Date.now());
      setElapsedTime(0);
    } else if (!isStreaming) {
      setLoadingStartTime(null);
      setElapsedTime(0);
    }
  }, [isStreaming, loadingStartTime]);

  useEffect(() => {
    if (isStreaming && loadingStartTime) {
      const interval = window.setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - loadingStartTime) / 1000));
      }, 1000);
      return () => window.clearInterval(interval);
    }
  }, [isStreaming, loadingStartTime]);

  const formatElapsedTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const sendMessage = async () => {
    if (!conversationId || !input.trim() || isStreaming) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input,
    };
    setMessages((prev) => [...prev, userMessage]);

    const currentConversationId = conversationId;
    const text = input;
    setInput('');
    setIsStreaming(true);

    try {
      const res = await fetch(`${apiBaseUrl}/api/chat/${currentConversationId}/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });

      if (!res.body) {
        setIsStreaming(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');

      let assistantContent = '';
      const assistantId = `assistant-${Date.now()}`;

      setMessages((prev) => [...prev, { id: assistantId, role: 'assistant', content: '' }]);

      const processChunk = (chunk: string) => {
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const json = line.replace(/^data:\s*/, '');
          if (!json) continue;
          try {
            const payload = JSON.parse(json);
            if (payload.event === 'delta') {
              assistantContent += payload.delta;
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, content: assistantContent } : m))
              );
            } else if (payload.event === 'end') {
              if (payload.full && typeof payload.full === 'string') {
                assistantContent = payload.full;
                setMessages((prev) =>
                  prev.map((m) => (m.id === assistantId ? { ...m, content: assistantContent } : m))
                );
              }
            }
          } catch (e) {
            // ignore parse errors
          }
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunkText = decoder.decode(value, { stream: true });
        processChunk(chunkText);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsStreaming(false);
    }
  };

  const onKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const chatPanel = (
    <div
      className="agentinabox-chat"
      style={{
        backgroundColor: 'var(--agent-bg)',
        borderRadius: 'var(--agent-radius)',
        border: '1px solid var(--agent-secondary)',
        width: '100%',
        maxWidth: 520,
        maxHeight: 'min(540px, 90vh)',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
        {/* Header - fully themeable */}
        <div
          style={{
            padding: '10px 12px',
            borderBottom: '1px solid rgba(148, 163, 184, 0.4)',
            background: `linear-gradient(135deg, var(--agent-header-gradient-from), var(--agent-header-gradient-to))`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                position: 'relative',
                width: 28,
                height: 28,
                borderRadius: '999px',
                background: resolvedAvatarUrl ? 'transparent' : 'var(--agent-avatar-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--agent-avatar-text)',
                fontSize: 14,
                fontWeight: 600,
                overflow: 'hidden',
              }}
            >
              {resolvedAvatarUrl ? (
                <img
                  src={resolvedAvatarUrl}
                  alt="Avatar"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                mergedTheme.avatarLabel
              )}
              <span
                style={{
                  position: 'absolute',
                  bottom: -1,
                  right: -1,
                  width: 8,
                  height: 8,
                  borderRadius: '999px',
                  border: '2px solid white',
                  backgroundColor: 'var(--agent-status-active)',
                }}
              />
            </div>
            <div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: 'var(--agent-header-title-color)',
                }}
              >
                {mergedTheme.headerTitle}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--agent-header-subtitle-color)',
                }}
              >
                {mergedTheme.headerSubtitle}
              </div>
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 10,
              color: '#64748b',
            }}
          >
            {isStreaming ? (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '2px 8px',
                  borderRadius: 999,
                  backgroundColor: 'rgba(59,130,246,0.12)',
                  color: 'var(--agent-status-working)',
                  fontWeight: 500,
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '999px',
                    backgroundColor: 'var(--agent-status-active)',
                    boxShadow: '0 0 0 3px rgba(34,197,94,0.35)',
                    animation: 'agentinabox-pulse 1.4s ease-in-out infinite',
                  }}
                />
                Working {formatElapsedTime(elapsedTime)}
              </span>
            ) : (
              <span style={{ fontSize: 10, color: '#94a3b8' }}>
                Ready for your question
              </span>
            )}
          </div>
        </div>

        {/* Messages area */}
        <div
          className="agentinabox-messages"
          style={{
            maxHeight: 'min(360px, 60vh)',
            minHeight: 200,
            overflowY: 'auto',
            padding: '10px 10px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            background:
              'radial-gradient(circle at top, rgba(191,219,254,0.35), transparent 55%)',
          }}
        >
          {messages.length === 0 && (
            <div
              style={{
                fontSize: 12,
                color: '#64748b',
                backgroundColor: 'rgba(255,255,255,0.8)',
                borderRadius: 12,
                padding: '10px 12px',
                border: '1px dashed rgba(148,163,184,0.5)',
              }}
            >
              <div style={{ fontWeight: 500, marginBottom: 4 }}>{mergedTheme.welcomeTitle}</div>
              <div>{mergedTheme.welcomeMessage}</div>
            </div>
          )}

          {messages.map((m) => (
            <div
              key={m.id}
              style={{
                display: 'flex',
                justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
                gap: 8,
              }}
            >
              {m.role === 'assistant' && (
                <div style={{ flexShrink: 0 }}>
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: '999px',
                      background: resolvedAvatarUrl ? 'transparent' : 'var(--agent-avatar-bg)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      color: 'var(--agent-avatar-text)',
                      fontWeight: 600,
                      overflow: 'hidden',
                    }}
                  >
                    {resolvedAvatarUrl ? (
                      <img
                        src={resolvedAvatarUrl}
                        alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      mergedTheme.avatarLabel
                    )}
                  </div>
                </div>
              )}

              <div
                style={{
                  maxWidth: '78%',
                  borderRadius: 14,
                  padding: '8px 10px',
                  fontSize: 13,
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  background:
                    m.role === 'user'
                      ? 'var(--agent-user-bubble)'
                      : 'var(--agent-assistant-bubble)',
                  color:
                    m.role === 'user'
                      ? 'var(--agent-user-bubble-text)'
                      : 'var(--agent-assistant-bubble-text)',
                  boxShadow:
                    m.role === 'assistant'
                      ? '0 8px 24px rgba(15,23,42,0.08)'
                      : '0 4px 12px rgba(15,23,42,0.12)',
                }}
              >
                {m.content}
              </div>

              {m.role === 'user' && (
                <div style={{ flexShrink: 0 }}>
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: '999px',
                      backgroundColor: 'var(--agent-user-avatar-bg)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      color: 'var(--agent-user-avatar-text)',
                      fontWeight: 600,
                    }}
                  >
                    {mergedTheme.userAvatarLabel}
                  </div>
                </div>
              )}
            </div>
          ))}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div
          style={{
            borderTop: '1px solid rgba(148,163,184,0.35)',
            padding: 10,
            backgroundColor: 'rgba(255,255,255,0.98)',
          }}
        >
          <div style={{ marginBottom: 4, fontSize: 10, color: '#94a3b8' }}>
            Press Enter to send, Shift+Enter for a new line.
          </div>
          <div style={{ display: 'flex', flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              rows={2}
              placeholder={isStreaming ? 'Streaming response…' : mergedTheme.placeholderText}
              style={{
                resize: 'none',
                width: '100%',
                boxSizing: 'border-box',
                borderRadius: 10,
                border: '1px solid var(--agent-input-border)',
                padding: '6px 8px',
                fontFamily: 'inherit',
                fontSize: 13,
                backgroundColor: 'var(--agent-input-bg)',
              }}
            />
            <button
              type="button"
              onClick={sendMessage}
              disabled={!conversationId || !input.trim() || isStreaming}
              style={{
                padding: '6px 12px',
                borderRadius: 999,
                border: 'none',
                cursor:
                  !conversationId || !input.trim() || isStreaming ? 'default' : 'pointer',
                opacity: !conversationId || !input.trim() || isStreaming ? 0.6 : 1,
                background:
                  'linear-gradient(135deg, var(--agent-primary), #4f46e5)',
                color: '#ffffff',
                fontSize: 13,
                fontWeight: 500,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: '0 8px 20px rgba(37,99,235,0.35)',
                whiteSpace: 'nowrap',
              }}
            >
              {isStreaming ? 'Generating…' : 'Send'}
            </button>
          </div>
        </div>
        <div
          style={{
            padding: '4px 10px',
            fontSize: 10,
            color: '#9ca3af',
            textAlign: 'right',
            backgroundColor: 'rgba(248,250,252,0.95)',
            borderTop: '1px solid rgba(148,163,184,0.25)',
          }}
        >
          Powered by AgenticLedger
        </div>
      </div>
  );

  if (mode === 'launcher') {
    return (
      <div
        ref={containerRef}
        style={{
          fontFamily: 'var(--agent-font)',
          position: 'fixed',
          bottom: 16,
          right: 16,
          zIndex: 9999,
          maxWidth: '100vw',
        }}
        className="agentinabox-root"
      >
        {isOpen && (
          <div
            style={{
              marginBottom: 8,
              maxWidth: 'min(420px, 100vw - 32px)',
            }}
          >
            {chatPanel}
          </div>
        )}
        <button
          type="button"
          onClick={() => setIsOpen((v) => !v)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: '10px 14px',
            borderRadius: 999,
            border: 'none',
            background:
              'linear-gradient(135deg, var(--agent-primary), rgba(79,70,229,1))',
            color: '#ffffff',
            fontSize: 13,
            fontWeight: 500,
            boxShadow: '0 18px 40px rgba(15,23,42,0.45)',
            cursor: 'pointer',
          }}
        >
          <span
            style={{
              width: 20,
              height: 20,
              borderRadius: 999,
              backgroundColor: 'rgba(15,23,42,0.9)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
            }}
          >
            AI
          </span>
          <span>{isOpen ? 'Close assistant' : 'Chat with agent'}</span>
        </button>
      </div>
    );
  }

  // inline mode
  return (
    <div
      ref={containerRef}
      style={{ fontFamily: 'var(--agent-font)' }}
      className="agentinabox-root"
    >
      {chatPanel}
    </div>
  );
};

export default AgentChatWidget;
