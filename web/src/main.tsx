import React from 'react';
import ReactDOM from 'react-dom/client';
import { AgentChatWidget } from './AgentChatWidget';
import { KnowledgeBaseManager } from './KnowledgeBaseManager';

const apiBaseUrl = 'http://localhost:4000';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <div style={{ padding: 16 }}>
      <h1>Agent-in-a-Box Demo</h1>
      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <AgentChatWidget apiBaseUrl={apiBaseUrl} />
        <KnowledgeBaseManager apiBaseUrl={apiBaseUrl} />
      </div>
    </div>
  </React.StrictMode>
);
