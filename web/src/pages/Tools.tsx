import React, { useState } from 'react';
import { AgentTheme, defaultTheme } from '../theme';

export interface ToolsProps {
  apiBaseUrl: string;
  theme?: Partial<AgentTheme>;
}

export const Tools: React.FC<ToolsProps> = ({ apiBaseUrl, theme }) => {
  const mergedTheme: AgentTheme = { ...defaultTheme, ...(theme || {}) };
  const [copied, setCopied] = useState(false);

  const embedCode = `// Install the widget package
// npm install @your-org/agentinabox-widget

import React from 'react';
import ReactDOM from 'react-dom/client';
import { AgentInABoxWidget } from 'agentinabox-widget';

ReactDOM.createRoot(document.getElementById('agentinabox-root')).render(
  <AgentInABoxWidget.AgentChatWidget
    apiBaseUrl="${apiBaseUrl || 'https://your-api.railway.app'}"
    mode="launcher"
    theme={{
      primaryColor: '${mergedTheme.primaryColor}',
      secondaryColor: '${mergedTheme.secondaryColor}',
      backgroundColor: '${mergedTheme.backgroundColor}',
      textColor: '${mergedTheme.textColor}',
      borderRadius: '${mergedTheme.borderRadius}',
      fontFamily: '${mergedTheme.fontFamily}',
    }}
  />
);`;

  const handleCopy = () => {
    navigator.clipboard.writeText(embedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>Tools</h1>
      <p style={{ color: '#9ca3af', marginBottom: 24, fontSize: 14 }}>
        Embed codes, integrations, and developer tools for your agent.
      </p>

      {/* Embed Code Section */}
      <div
        style={{
          background: '#020617',
          borderRadius: 16,
          padding: 24,
          boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
          marginBottom: 24,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600 }}>Embed Code</h2>
          <button
            onClick={handleCopy}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: '1px solid #374151',
              background: copied ? '#22c55e' : '#1f2937',
              color: '#e5e7eb',
              fontSize: 12,
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
          >
            {copied ? 'Copied!' : 'Copy Code'}
          </button>
        </div>
        <p style={{ fontSize: 14, color: '#9ca3af', marginBottom: 16 }}>
          Use this snippet to embed the chat widget into your application. Customize the{' '}
          <code style={{ backgroundColor: '#1e293b', padding: '2px 6px', borderRadius: 4, fontSize: 13 }}>
            apiBaseUrl
          </code>{' '}
          and theme colors as needed.
        </p>
        <pre
          style={{
            backgroundColor: '#0f172a',
            borderRadius: 8,
            padding: 16,
            border: '1px solid #1f2937',
            overflowX: 'auto',
            fontSize: 12,
            lineHeight: 1.6,
          }}
        >
          {embedCode}
        </pre>
      </div>

      {/* API Endpoints Section */}
      <div
        style={{
          background: '#020617',
          borderRadius: 16,
          padding: 24,
          boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>API Endpoints</h2>
        <p style={{ fontSize: 14, color: '#9ca3af', marginBottom: 16 }}>
          Use these endpoints to integrate with your agent programmatically.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div
            style={{
              backgroundColor: '#0f172a',
              borderRadius: 8,
              padding: 12,
              border: '1px solid #1f2937',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span
                style={{
                  backgroundColor: '#22c55e',
                  color: '#000',
                  padding: '2px 8px',
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                POST
              </span>
              <code style={{ fontSize: 13, color: '#e5e7eb' }}>/api/chat</code>
            </div>
            <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>Send a message and get a response</p>
          </div>

          <div
            style={{
              backgroundColor: '#0f172a',
              borderRadius: 8,
              padding: 12,
              border: '1px solid #1f2937',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span
                style={{
                  backgroundColor: '#22c55e',
                  color: '#000',
                  padding: '2px 8px',
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                POST
              </span>
              <code style={{ fontSize: 13, color: '#e5e7eb' }}>/api/chat/stream</code>
            </div>
            <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>Stream a response using Server-Sent Events</p>
          </div>

          <div
            style={{
              backgroundColor: '#0f172a',
              borderRadius: 8,
              padding: 12,
              border: '1px solid #1f2937',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span
                style={{
                  backgroundColor: '#3b82f6',
                  color: '#fff',
                  padding: '2px 8px',
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                GET
              </span>
              <code style={{ fontSize: 13, color: '#e5e7eb' }}>/api/admin/mcp/status</code>
            </div>
            <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>Get MCP Hub status and available tools</p>
          </div>

          <div
            style={{
              backgroundColor: '#0f172a',
              borderRadius: 8,
              padding: 12,
              border: '1px solid #1f2937',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span
                style={{
                  backgroundColor: '#22c55e',
                  color: '#000',
                  padding: '2px 8px',
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                POST
              </span>
              <code style={{ fontSize: 13, color: '#e5e7eb' }}>/api/admin/mcp/execute</code>
            </div>
            <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>Execute an MCP tool directly</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Tools;
