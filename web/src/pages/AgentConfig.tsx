import React, { useEffect, useState } from 'react';

interface ModelOption {
  id: string;
  name: string;
  provider: string;
}

interface Agent {
  id: string;
  slug: string;
  name: string;
  description: string;
  instructions: string;
  defaultModel: string;
  modelMode?: 'single' | 'multi';
  allowedModels?: string[] | null;
}

export interface AgentConfigProps {
  apiBaseUrl: string;
}

export const AgentConfig: React.FC<AgentConfigProps> = ({ apiBaseUrl }) => {
  // Agent list and selection
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [loadingAgents, setLoadingAgents] = useState(true);

  // Current agent config
  const [agentName, setAgentName] = useState('');
  const [agentDescription, setAgentDescription] = useState('');
  const [model, setModel] = useState('claude-sonnet-4-20250514');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [modelMode, setModelMode] = useState<'single' | 'multi'>('single');
  const [allowedModels, setAllowedModels] = useState<string[]>([]);

  // UI state
  const [savingAgent, setSavingAgent] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [availableModels, setAvailableModels] = useState<ModelOption[]>([]);

  // New agent modal
  const [showNewAgentModal, setShowNewAgentModal] = useState(false);
  const [newAgentName, setNewAgentName] = useState('');
  const [creatingAgent, setCreatingAgent] = useState(false);

  // Platform API Keys
  const [platformKeysExpanded, setPlatformKeysExpanded] = useState(false);
  const [platformSettings, setPlatformSettings] = useState<
    { key: string; configured: boolean; fromEnv: boolean }[]
  >([]);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [keyValue, setKeyValue] = useState('');
  const [savingKey, setSavingKey] = useState(false);

  // Load agents list and available models
  useEffect(() => {
    const loadAgents = async () => {
      try {
        setLoadingAgents(true);
        const [agentsRes, modelsRes] = await Promise.all([
          fetch(`${apiBaseUrl}/api/admin/agents`),
          fetch(`${apiBaseUrl}/api/admin/models`),
        ]);

        if (agentsRes.ok) {
          const data = await agentsRes.json();
          const agentList = data.agents || [];
          setAgents(agentList);

          // Select first agent by default
          if (agentList.length > 0 && !selectedAgentId) {
            setSelectedAgentId(agentList[0].id);
          }
        }

        if (modelsRes.ok) {
          const data = await modelsRes.json();
          setAvailableModels(data.models || []);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingAgents(false);
      }
    };
    loadAgents();
  }, [apiBaseUrl]);

  // Load selected agent config and API keys
  useEffect(() => {
    if (!selectedAgentId) return;

    const loadAgentConfig = async () => {
      try {
        // Load agent config and API keys in parallel
        const [agentRes, keysRes] = await Promise.all([
          fetch(`${apiBaseUrl}/api/admin/agents/${selectedAgentId}`),
          fetch(`${apiBaseUrl}/api/admin/agents/${selectedAgentId}/api-keys`),
        ]);

        if (agentRes.ok) {
          const data = await agentRes.json();
          const a = data.agent || {};
          setAgentName(a.name || '');
          setAgentDescription(a.description || '');
          setModel(a.defaultModel || 'claude-sonnet-4-20250514');
          setSystemPrompt(a.instructions || '');
          setModelMode(a.modelMode || 'single');
          setAllowedModels(a.allowedModels || []);
        }

        if (keysRes.ok) {
          const data = await keysRes.json();
          setPlatformSettings(data.settings || []);
        }
      } catch (e) {
        console.error(e);
      }
    };
    loadAgentConfig();
  }, [apiBaseUrl, selectedAgentId]);

  const handleSaveAgent = async () => {
    if (!selectedAgentId) return;

    try {
      setSavingAgent(true);
      setSaveMessage(null);
      const res = await fetch(`${apiBaseUrl}/api/admin/agents/${selectedAgentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: agentName,
          description: agentDescription,
          instructions: systemPrompt,
          defaultModel: model,
          modelMode,
          allowedModels: modelMode === 'multi' ? allowedModels : null,
        }),
      });
      if (!res.ok) {
        setSaveMessage('Failed to save configuration');
        return;
      }

      // Update local agents list
      setAgents((prev) =>
        prev.map((a) => (a.id === selectedAgentId ? { ...a, name: agentName } : a))
      );

      setSaveMessage('Saved successfully!');
      setTimeout(() => setSaveMessage(null), 2000);
    } catch (e) {
      console.error(e);
      setSaveMessage('Failed to save configuration');
    } finally {
      setSavingAgent(false);
    }
  };

  const handleCreateAgent = async () => {
    if (!newAgentName.trim()) return;

    try {
      setCreatingAgent(true);
      const res = await fetch(`${apiBaseUrl}/api/admin/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newAgentName }),
      });

      if (res.ok) {
        const data = await res.json();
        const newAgent = data.agent;
        setAgents((prev) => [...prev, newAgent]);
        setSelectedAgentId(newAgent.id);
        setNewAgentName('');
        setShowNewAgentModal(false);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCreatingAgent(false);
    }
  };

  const handleDeleteAgent = async () => {
    if (!selectedAgentId) return;
    if (agents.length <= 1) {
      alert('Cannot delete the last agent');
      return;
    }
    if (!confirm(`Delete agent "${agentName}"? This cannot be undone.`)) return;

    try {
      const res = await fetch(`${apiBaseUrl}/api/admin/agents/${selectedAgentId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        const remaining = agents.filter((a) => a.id !== selectedAgentId);
        setAgents(remaining);
        if (remaining.length > 0) {
          setSelectedAgentId(remaining[0].id);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveApiKey = async () => {
    if (!editingKey || !keyValue.trim() || !selectedAgentId) return;

    try {
      setSavingKey(true);
      const res = await fetch(`${apiBaseUrl}/api/admin/agents/${selectedAgentId}/api-keys/${editingKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: keyValue }),
      });

      if (res.ok) {
        setPlatformSettings((prev) =>
          prev.map((s) => (s.key === editingKey ? { ...s, configured: true } : s))
        );
        setEditingKey(null);
        setKeyValue('');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSavingKey(false);
    }
  };

  const handleDeleteApiKey = async (key: string) => {
    if (!selectedAgentId) return;
    if (!confirm('Remove this API key? The agent will fall back to environment variables if set.')) return;

    try {
      const res = await fetch(`${apiBaseUrl}/api/admin/agents/${selectedAgentId}/api-keys/${key}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setPlatformSettings((prev) =>
          prev.map((s) => (s.key === key ? { ...s, configured: false } : s))
        );
      }
    } catch (e) {
      console.error(e);
    }
  };

  const getKeyDisplayName = (key: string): string => {
    const names: Record<string, string> = {
      anthropic_api_key: 'Anthropic API Key',
      openai_api_key: 'OpenAI API Key',
      gemini_api_key: 'Google Gemini API Key',
      grok_api_key: 'xAI Grok API Key',
    };
    return names[key] || key;
  };

  if (loadingAgents) {
    return (
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <div style={{ color: '#9ca3af', padding: 40, textAlign: 'center' }}>Loading agents...</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>Agent Configuration</h1>
      <p style={{ color: '#9ca3af', marginBottom: 24, fontSize: 14 }}>
        Configure how your AI assistant behaves. Select an agent or create a new one.
      </p>

      {/* Agent Selector */}
      <div
        style={{
          background: '#020617',
          borderRadius: 16,
          padding: 20,
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <label style={{ fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap' }}>Select Agent:</label>
        <select
          value={selectedAgentId}
          onChange={(e) => setSelectedAgentId(e.target.value)}
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: 8,
            border: '1px solid #374151',
            backgroundColor: '#0f172a',
            color: '#e5e7eb',
            fontSize: 14,
          }}
        >
          {agents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.name}
            </option>
          ))}
        </select>
        <button
          onClick={() => setShowNewAgentModal(true)}
          style={{
            padding: '10px 16px',
            borderRadius: 8,
            border: 'none',
            backgroundColor: '#22c55e',
            color: '#fff',
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          + New Agent
        </button>
        {agents.length > 1 && (
          <button
            onClick={handleDeleteAgent}
            style={{
              padding: '10px 16px',
              borderRadius: 8,
              border: '1px solid #dc2626',
              backgroundColor: 'transparent',
              color: '#dc2626',
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Delete
          </button>
        )}
      </div>

      {/* Configuration Form */}
      <div
        style={{
          background: '#020617',
          borderRadius: 16,
          padding: 24,
          boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Agent Name */}
          <div>
            <label style={{ fontSize: 14, fontWeight: 500, display: 'block', marginBottom: 8 }}>
              Agent Name
            </label>
            <input
              type="text"
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              placeholder="Enter agent name..."
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: 8,
                border: '1px solid #1f2937',
                backgroundColor: '#0f172a',
                color: '#e5e7eb',
                fontSize: 14,
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Description */}
          <div>
            <label style={{ fontSize: 14, fontWeight: 500, display: 'block', marginBottom: 8 }}>
              Short Description
            </label>
            <input
              type="text"
              value={agentDescription}
              onChange={(e) => setAgentDescription(e.target.value)}
              placeholder="Brief description of the agent..."
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: 8,
                border: '1px solid #1f2937',
                backgroundColor: '#0f172a',
                color: '#e5e7eb',
                fontSize: 14,
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Model Mode Selection */}
          <div>
            <label style={{ fontSize: 14, fontWeight: 500, display: 'block', marginBottom: 8 }}>
              Model Mode
            </label>
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              <button
                type="button"
                onClick={() => setModelMode('single')}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  borderRadius: 8,
                  border: modelMode === 'single' ? '2px solid #3b82f6' : '1px solid #374151',
                  backgroundColor: modelMode === 'single' ? '#1e3a8a' : '#0f172a',
                  color: '#e5e7eb',
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                Single Model
              </button>
              <button
                type="button"
                onClick={() => setModelMode('multi')}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  borderRadius: 8,
                  border: modelMode === 'multi' ? '2px solid #3b82f6' : '1px solid #374151',
                  backgroundColor: modelMode === 'multi' ? '#1e3a8a' : '#0f172a',
                  color: '#e5e7eb',
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                Multi Model
              </button>
            </div>
            <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
              {modelMode === 'single'
                ? 'Agent will use a single fixed model for all conversations.'
                : 'Users can choose from allowed models in the chat interface.'}
            </p>
          </div>

          {/* Default/Single Model Selection */}
          <div>
            <label style={{ fontSize: 14, fontWeight: 500, display: 'block', marginBottom: 8 }}>
              {modelMode === 'single' ? 'AI Model' : 'Default Model'}
            </label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: 8,
                border: '1px solid #1f2937',
                backgroundColor: '#0f172a',
                color: '#e5e7eb',
                fontSize: 14,
                boxSizing: 'border-box',
              }}
            >
              {availableModels.length > 0 ? (
                availableModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.provider})
                  </option>
                ))
              ) : (
                <option value={model}>{model}</option>
              )}
            </select>
          </div>

          {/* Allowed Models (Multi-select for Multi Mode) */}
          {modelMode === 'multi' && (
            <div>
              <label style={{ fontSize: 14, fontWeight: 500, display: 'block', marginBottom: 8 }}>
                Allowed Models
              </label>
              <div
                style={{
                  border: '1px solid #1f2937',
                  borderRadius: 8,
                  backgroundColor: '#0f172a',
                  padding: 8,
                  maxHeight: 200,
                  overflowY: 'auto',
                }}
              >
                {availableModels.map((m) => (
                  <label
                    key={m.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 12px',
                      borderRadius: 6,
                      cursor: 'pointer',
                      backgroundColor: allowedModels.includes(m.id) ? '#1e3a8a' : 'transparent',
                      marginBottom: 4,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={allowedModels.includes(m.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setAllowedModels((prev) => [...prev, m.id]);
                        } else {
                          setAllowedModels((prev) => prev.filter((id) => id !== m.id));
                        }
                      }}
                      style={{ accentColor: '#3b82f6' }}
                    />
                    <span style={{ fontSize: 14, color: '#e5e7eb' }}>
                      {m.name} ({m.provider})
                    </span>
                  </label>
                ))}
              </div>
              <p style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>
                {allowedModels.length} model(s) selected. Users will see a dropdown in chat.
              </p>
            </div>
          )}

          {/* System Prompt */}
          <div>
            <label style={{ fontSize: 14, fontWeight: 500, display: 'block', marginBottom: 8 }}>
              System Prompt
            </label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={6}
              placeholder="Instructions for how the agent should behave..."
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: 8,
                border: '1px solid #1f2937',
                backgroundColor: '#0f172a',
                color: '#e5e7eb',
                fontSize: 14,
                resize: 'vertical',
                boxSizing: 'border-box',
                lineHeight: 1.5,
              }}
            />
          </div>

          {/* Save Button */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 13, color: saveMessage?.includes('success') ? '#22c55e' : '#9ca3af' }}>
              {saveMessage || '\u00A0'}
            </div>
            <button
              type="button"
              onClick={handleSaveAgent}
              disabled={savingAgent}
              style={{
                padding: '10px 24px',
                borderRadius: 8,
                border: 'none',
                backgroundColor: savingAgent ? '#1f2937' : '#3b82f6',
                color: '#fff',
                fontSize: 14,
                fontWeight: 500,
                cursor: savingAgent ? 'default' : 'pointer',
                transition: 'background-color 0.2s',
              }}
            >
              {savingAgent ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </div>
      </div>

      {/* Agent API Keys (Collapsible) */}
      <div
        style={{
          background: '#020617',
          borderRadius: 16,
          marginTop: 24,
          overflow: 'hidden',
        }}
      >
        <button
          onClick={() => setPlatformKeysExpanded(!platformKeysExpanded)}
          style={{
            width: '100%',
            padding: '16px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'transparent',
            border: 'none',
            color: '#e5e7eb',
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          <span>Agent API Keys</span>
          <span style={{ color: '#6b7280', fontSize: 18 }}>
            {platformKeysExpanded ? '▲' : '▼'}
          </span>
        </button>

        {platformKeysExpanded && (
          <div style={{ padding: '0 24px 24px', borderTop: '1px solid #1e293b' }}>
            <p style={{ color: '#9ca3af', fontSize: 13, margin: '16px 0' }}>
              Configure API keys for this agent. Keys are encrypted before storage.
              If not set, environment variables are used as fallback.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {platformSettings.map((setting) => (
                <div
                  key={setting.key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderRadius: 8,
                    backgroundColor: '#0f172a',
                    border: '1px solid #1e293b',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 2 }}>
                      {getKeyDisplayName(setting.key)}
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>
                      {setting.configured ? (
                        <span style={{ color: '#22c55e' }}>✓ Configured (encrypted)</span>
                      ) : setting.fromEnv ? (
                        <span style={{ color: '#3b82f6' }}>↳ Using environment variable (fallback)</span>
                      ) : (
                        <span style={{ color: '#f59e0b' }}>Not configured</span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => {
                        setEditingKey(setting.key);
                        setKeyValue('');
                      }}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 6,
                        border: '1px solid #374151',
                        background: 'transparent',
                        color: '#9ca3af',
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      {setting.configured ? 'Update' : 'Add'}
                    </button>
                    {setting.configured && (
                      <button
                        onClick={() => handleDeleteApiKey(setting.key)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 6,
                          border: '1px solid #dc2626',
                          background: 'transparent',
                          color: '#dc2626',
                          fontSize: 12,
                          cursor: 'pointer',
                        }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* API Key Edit Modal */}
      {editingKey && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setEditingKey(null)}
        >
          <div
            style={{
              background: '#0f172a',
              borderRadius: 16,
              padding: 24,
              width: 450,
              maxWidth: '90%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
              {getKeyDisplayName(editingKey)}
            </h3>
            <p style={{ color: '#9ca3af', fontSize: 13, marginBottom: 20 }}>
              Enter your API key. It will be encrypted before storage.
            </p>

            <input
              type="password"
              value={keyValue}
              onChange={(e) => setKeyValue(e.target.value)}
              placeholder="sk-..."
              autoFocus
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: 8,
                border: '1px solid #374151',
                backgroundColor: '#020617',
                color: '#e5e7eb',
                fontSize: 14,
                marginBottom: 16,
                boxSizing: 'border-box',
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveApiKey();
              }}
            />

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => {
                  setEditingKey(null);
                  setKeyValue('');
                }}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: 8,
                  border: '1px solid #374151',
                  background: 'transparent',
                  color: '#9ca3af',
                  fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveApiKey}
                disabled={savingKey || !keyValue.trim()}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: 8,
                  border: 'none',
                  background: savingKey || !keyValue.trim() ? '#1e3a8a' : '#3b82f6',
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: savingKey || !keyValue.trim() ? 'default' : 'pointer',
                }}
              >
                {savingKey ? 'Saving...' : 'Save Key'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Agent Modal */}
      {showNewAgentModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowNewAgentModal(false)}
        >
          <div
            style={{
              background: '#0f172a',
              borderRadius: 16,
              padding: 24,
              width: 400,
              maxWidth: '90%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Create New Agent</h3>
            <input
              type="text"
              value={newAgentName}
              onChange={(e) => setNewAgentName(e.target.value)}
              placeholder="Agent name..."
              autoFocus
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: 8,
                border: '1px solid #374151',
                backgroundColor: '#020617',
                color: '#e5e7eb',
                fontSize: 14,
                marginBottom: 16,
                boxSizing: 'border-box',
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateAgent();
              }}
            />
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => setShowNewAgentModal(false)}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: 8,
                  border: '1px solid #374151',
                  background: 'transparent',
                  color: '#9ca3af',
                  fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateAgent}
                disabled={creatingAgent || !newAgentName.trim()}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: 8,
                  border: 'none',
                  background: creatingAgent || !newAgentName.trim() ? '#1e3a8a' : '#3b82f6',
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: creatingAgent || !newAgentName.trim() ? 'default' : 'pointer',
                }}
              >
                {creatingAgent ? 'Creating...' : 'Create Agent'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentConfig;
