import React, { useState } from 'react';
import { AgentTheme, defaultTheme } from '../theme';
import { useAdminTheme } from '../AdminThemeContext';

export interface ToolsProps {
  apiBaseUrl: string;
  theme?: Partial<AgentTheme>;
}

export const Tools: React.FC<ToolsProps> = ({ apiBaseUrl, theme }) => {
  const { colors } = useAdminTheme();
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
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8, color: colors.text }}>Tools</h1>
      <p style={{ color: colors.textSecondary, marginBottom: 24, fontSize: 14 }}>
        Embed codes, integrations, and developer tools for your agent.
      </p>

      {/* Embed Code Section */}
      <div
        style={{
          background: colors.bgCard,
          borderRadius: 16,
          padding: 24,
          boxShadow: colors.shadowLg,
          marginBottom: 24,
          border: `1px solid ${colors.border}`,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: colors.text }}>Embed Code</h2>
          <button
            onClick={handleCopy}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: `1px solid ${colors.border}`,
              background: copied ? colors.success : colors.bgSecondary,
              color: copied ? '#fff' : colors.text,
              fontSize: 12,
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
          >
            {copied ? 'Copied!' : 'Copy Code'}
          </button>
        </div>
        <p style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 16 }}>
          Use this snippet to embed the chat widget into your application. Customize the{' '}
          <code style={{ backgroundColor: colors.bgSecondary, padding: '2px 6px', borderRadius: 4, fontSize: 13, color: colors.text }}>
            apiBaseUrl
          </code>{' '}
          and theme colors as needed.
        </p>
        <pre
          style={{
            backgroundColor: colors.bgInput,
            borderRadius: 8,
            padding: 16,
            border: `1px solid ${colors.border}`,
            overflowX: 'auto',
            fontSize: 12,
            lineHeight: 1.6,
            color: colors.text,
          }}
        >
          {embedCode}
        </pre>
      </div>

      {/* API Endpoints Section */}
      <div
        style={{
          background: colors.bgCard,
          borderRadius: 16,
          padding: 24,
          boxShadow: colors.shadowLg,
          border: `1px solid ${colors.border}`,
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: colors.text }}>API Endpoints</h2>
        <p style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 16 }}>
          Use these endpoints to integrate with your agent programmatically.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div
            style={{
              backgroundColor: colors.bgSecondary,
              borderRadius: 8,
              padding: 12,
              border: `1px solid ${colors.border}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span
                style={{
                  backgroundColor: colors.success,
                  color: '#000',
                  padding: '2px 8px',
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                POST
              </span>
              <code style={{ fontSize: 13, color: colors.text }}>/api/chat</code>
            </div>
            <p style={{ fontSize: 12, color: colors.textSecondary, margin: 0 }}>Send a message and get a response</p>
          </div>

          <div
            style={{
              backgroundColor: colors.bgSecondary,
              borderRadius: 8,
              padding: 12,
              border: `1px solid ${colors.border}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span
                style={{
                  backgroundColor: colors.success,
                  color: '#000',
                  padding: '2px 8px',
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                POST
              </span>
              <code style={{ fontSize: 13, color: colors.text }}>/api/chat/stream</code>
            </div>
            <p style={{ fontSize: 12, color: colors.textSecondary, margin: 0 }}>Stream a response using Server-Sent Events</p>
          </div>

          <div
            style={{
              backgroundColor: colors.bgSecondary,
              borderRadius: 8,
              padding: 12,
              border: `1px solid ${colors.border}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span
                style={{
                  backgroundColor: colors.primary,
                  color: '#fff',
                  padding: '2px 8px',
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                GET
              </span>
              <code style={{ fontSize: 13, color: colors.text }}>/api/admin/mcp/status</code>
            </div>
            <p style={{ fontSize: 12, color: colors.textSecondary, margin: 0 }}>Get MCP Hub status and available tools</p>
          </div>

          <div
            style={{
              backgroundColor: colors.bgSecondary,
              borderRadius: 8,
              padding: 12,
              border: `1px solid ${colors.border}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span
                style={{
                  backgroundColor: colors.success,
                  color: '#000',
                  padding: '2px 8px',
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                POST
              </span>
              <code style={{ fontSize: 13, color: colors.text }}>/api/admin/mcp/execute</code>
            </div>
            <p style={{ fontSize: 12, color: colors.textSecondary, margin: 0 }}>Execute an MCP tool directly</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Tools;
