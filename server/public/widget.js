/**
 * Agent-in-a-Box Embeddable Widget
 * Include this script and call AgentWidget.init() to add the chat widget to your site.
 */
(function() {
  'use strict';

  // Prevent double initialization
  if (window.AgentWidget && window.AgentWidget._initialized) {
    return;
  }

  const DEFAULT_CONFIG = {
    agentId: 'default-agent',
    apiBaseUrl: '',
    position: 'bottom-right',
    primaryColor: '#3b82f6',
    title: 'Chat with us',
    placeholder: 'Type your message...',
    welcomeMessage: 'Hello! How can I help you today?'
  };

  let config = { ...DEFAULT_CONFIG };
  let isOpen = false;
  let conversationId = null;
  let container = null;
  let messages = [];

  // CSS Styles
  const styles = `
    .aiab-widget-container {
      position: fixed;
      z-index: 99999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    .aiab-widget-container.bottom-right {
      bottom: 24px;
      right: 24px;
    }
    .aiab-widget-container.bottom-left {
      bottom: 24px;
      left: 24px;
    }
    .aiab-trigger {
      width: 60px;
      height: 60px;
      border-radius: 50%;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .aiab-trigger:hover {
      transform: scale(1.05);
      box-shadow: 0 6px 16px rgba(0,0,0,0.2);
    }
    .aiab-trigger svg {
      width: 28px;
      height: 28px;
      fill: white;
    }
    .aiab-panel {
      position: absolute;
      bottom: 72px;
      right: 0;
      width: 380px;
      height: 520px;
      background: white;
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.15);
      display: none;
      flex-direction: column;
      overflow: hidden;
    }
    .aiab-panel.open {
      display: flex;
    }
    .aiab-header {
      padding: 16px 20px;
      color: white;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .aiab-header-title {
      font-weight: 600;
      font-size: 16px;
    }
    .aiab-close {
      background: none;
      border: none;
      color: white;
      cursor: pointer;
      padding: 4px;
      opacity: 0.8;
    }
    .aiab-close:hover {
      opacity: 1;
    }
    .aiab-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .aiab-message {
      max-width: 85%;
      padding: 10px 14px;
      border-radius: 12px;
      font-size: 14px;
      line-height: 1.5;
    }
    .aiab-message.user {
      align-self: flex-end;
      color: white;
    }
    .aiab-message.assistant {
      align-self: flex-start;
      background: #f1f5f9;
      color: #1e293b;
    }
    .aiab-message.typing {
      background: #f1f5f9;
    }
    .aiab-typing-dots {
      display: flex;
      gap: 4px;
    }
    .aiab-typing-dots span {
      width: 8px;
      height: 8px;
      background: #94a3b8;
      border-radius: 50%;
      animation: aiab-bounce 1.4s infinite ease-in-out;
    }
    .aiab-typing-dots span:nth-child(1) { animation-delay: 0s; }
    .aiab-typing-dots span:nth-child(2) { animation-delay: 0.2s; }
    .aiab-typing-dots span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes aiab-bounce {
      0%, 80%, 100% { transform: translateY(0); }
      40% { transform: translateY(-6px); }
    }
    .aiab-input-area {
      padding: 12px 16px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      gap: 8px;
    }
    .aiab-input {
      flex: 1;
      padding: 10px 14px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      font-size: 14px;
      outline: none;
      transition: border-color 0.2s;
    }
    .aiab-input:focus {
      border-color: #3b82f6;
    }
    .aiab-send {
      padding: 10px 16px;
      border: none;
      border-radius: 8px;
      color: white;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: opacity 0.2s;
    }
    .aiab-send:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .aiab-send:not(:disabled):hover {
      opacity: 0.9;
    }
    .aiab-powered {
      padding: 8px;
      text-align: center;
      font-size: 11px;
      color: #94a3b8;
      background: #f8fafc;
    }
    .aiab-powered a {
      color: #64748b;
      text-decoration: none;
    }
    .aiab-powered a:hover {
      text-decoration: underline;
    }
  `;

  function injectStyles() {
    const styleEl = document.createElement('style');
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);
  }

  function createWidget() {
    container = document.createElement('div');
    container.className = `aiab-widget-container ${config.position}`;

    container.innerHTML = `
      <div class="aiab-panel" id="aiab-panel">
        <div class="aiab-header" style="background: ${config.primaryColor}">
          <span class="aiab-header-title">${escapeHtml(config.title)}</span>
          <button class="aiab-close" id="aiab-close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div class="aiab-messages" id="aiab-messages"></div>
        <div class="aiab-input-area">
          <input type="text" class="aiab-input" id="aiab-input" placeholder="${escapeHtml(config.placeholder)}">
          <button class="aiab-send" id="aiab-send" style="background: ${config.primaryColor}">Send</button>
        </div>
        <div class="aiab-powered">
          Powered by <a href="https://agenticledger.com" target="_blank">AgenticLedger</a>
        </div>
      </div>
      <button class="aiab-trigger" id="aiab-trigger" style="background: ${config.primaryColor}">
        <svg viewBox="0 0 24 24">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
        </svg>
      </button>
    `;

    document.body.appendChild(container);

    // Event listeners
    document.getElementById('aiab-trigger').addEventListener('click', togglePanel);
    document.getElementById('aiab-close').addEventListener('click', closePanel);
    document.getElementById('aiab-send').addEventListener('click', sendMessage);
    document.getElementById('aiab-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function togglePanel() {
    isOpen = !isOpen;
    document.getElementById('aiab-panel').classList.toggle('open', isOpen);
    if (isOpen && !conversationId) {
      startConversation();
    }
  }

  function closePanel() {
    isOpen = false;
    document.getElementById('aiab-panel').classList.remove('open');
  }

  async function startConversation() {
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/chat/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: config.agentId })
      });

      if (!response.ok) throw new Error('Failed to start conversation');

      const data = await response.json();
      conversationId = data.conversationId;

      // Show welcome message
      if (config.welcomeMessage) {
        addMessage('assistant', config.welcomeMessage);
      }
    } catch (error) {
      console.error('AgentWidget: Failed to start conversation', error);
      addMessage('assistant', 'Sorry, I\'m having trouble connecting. Please try again later.');
    }
  }

  function addMessage(role, content) {
    messages.push({ role, content });
    renderMessages();
  }

  function renderMessages() {
    const container = document.getElementById('aiab-messages');
    container.innerHTML = messages.map(msg => `
      <div class="aiab-message ${msg.role}" ${msg.role === 'user' ? `style="background: ${config.primaryColor}"` : ''}>
        ${msg.isTyping ? `
          <div class="aiab-typing-dots">
            <span></span><span></span><span></span>
          </div>
        ` : escapeHtml(msg.content)}
      </div>
    `).join('');
    container.scrollTop = container.scrollHeight;
  }

  async function sendMessage() {
    const input = document.getElementById('aiab-input');
    const sendBtn = document.getElementById('aiab-send');
    const message = input.value.trim();

    if (!message || !conversationId) return;

    input.value = '';
    input.disabled = true;
    sendBtn.disabled = true;

    addMessage('user', message);

    // Show typing indicator
    messages.push({ role: 'assistant', content: '', isTyping: true });
    renderMessages();

    try {
      const response = await fetch(`${config.apiBaseUrl}/api/chat/${conversationId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });

      if (!response.ok) throw new Error('Failed to send message');

      const data = await response.json();

      // Remove typing indicator and add response
      messages = messages.filter(m => !m.isTyping);
      addMessage('assistant', data.reply);
    } catch (error) {
      console.error('AgentWidget: Failed to send message', error);
      messages = messages.filter(m => !m.isTyping);
      addMessage('assistant', 'Sorry, I couldn\'t process your message. Please try again.');
    } finally {
      input.disabled = false;
      sendBtn.disabled = false;
      input.focus();
    }
  }

  // Public API
  window.AgentWidget = {
    _initialized: false,

    init: function(userConfig = {}) {
      if (this._initialized) {
        console.warn('AgentWidget: Already initialized');
        return;
      }

      config = { ...DEFAULT_CONFIG, ...userConfig };

      // Auto-detect apiBaseUrl from script src if not provided
      if (!config.apiBaseUrl) {
        const scripts = document.getElementsByTagName('script');
        for (let i = 0; i < scripts.length; i++) {
          const src = scripts[i].src;
          if (src && src.includes('widget.js')) {
            config.apiBaseUrl = new URL(src).origin;
            break;
          }
        }
      }

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
          injectStyles();
          createWidget();
        });
      } else {
        injectStyles();
        createWidget();
      }

      this._initialized = true;
      console.log('AgentWidget: Initialized', config);
    },

    open: function() {
      if (!isOpen) togglePanel();
    },

    close: function() {
      if (isOpen) closePanel();
    },

    destroy: function() {
      if (container) {
        container.remove();
        container = null;
      }
      conversationId = null;
      messages = [];
      isOpen = false;
      this._initialized = false;
    }
  };
})();
