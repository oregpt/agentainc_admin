import React, { useEffect, useRef, useState } from 'react';
import { AgentTheme, applyTheme, defaultTheme } from './theme';

export interface KnowledgeBaseManagerProps {
  apiBaseUrl: string;
  agentId?: string;
  theme?: Partial<AgentTheme>;
}

interface KBDocument {
  id: number;
  title: string;
  sourceType?: string;
  mimeType?: string | null;
  size?: number | null;
  createdAt?: string | null;
}

export const KnowledgeBaseManager: React.FC<KnowledgeBaseManagerProps> = ({
  apiBaseUrl,
  agentId,
  theme,
}) => {
  const [documents, setDocuments] = useState<KBDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [fileTitle, setFileTitle] = useState('');

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mergedTheme: AgentTheme = { ...defaultTheme, ...(theme || {}) };

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

  const loadDocuments = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = new URL(`${apiBaseUrl}/api/kb`);
      if (agentId) {
        url.searchParams.set('agentId', agentId);
      }
      const res = await fetch(url.toString());
      if (!res.ok) {
        throw new Error(`Failed to load documents: ${res.status}`);
      }
      const data = await res.json();
      setDocuments(data.documents || []);
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments().catch(() => undefined);
  }, [apiBaseUrl, agentId]);

  const handleUploadFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setUploadingFile(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (fileTitle) formData.append('title', fileTitle);
      if (agentId) formData.append('agentId', agentId);

      const res = await fetch(`${apiBaseUrl}/api/kb/files`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        throw new Error(`Failed to upload file: ${res.status}`);
      }
      const data = await res.json();
      setDocuments((prev) => [data.document, ...prev]);
      setFile(null);
      setFileTitle('');
      (e.target as HTMLFormElement).reset();
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Failed to upload file');
    } finally {
      setUploadingFile(false);
    }
  };

  const handleDeleteDocument = async (id: number) => {
    if (!window.confirm('Remove this document from the knowledge base?')) return;
    try {
      const res = await fetch(`${apiBaseUrl}/api/kb/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        throw new Error(`Failed to delete document: ${res.status}`);
      }
      setDocuments((prev) => prev.filter((d) => d.id !== id));
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Failed to delete document');
    }
  };

  const formatSize = (size?: number | null) => {
    if (!size || size <= 0) return '-';
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (value?: string | null) => {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleString();
  };

  return (
    <div
      ref={containerRef}
      className="agentinabox-kb-root"
      style={{
        fontFamily: 'var(--agent-font)',
        backgroundColor: 'var(--agent-bg)',
        borderRadius: 'var(--agent-radius)',
        border: '1px solid var(--agent-secondary)',
        width: '100%',
        maxWidth: 520,
        boxSizing: 'border-box',
        padding: 12,
      }}
    >
      <div style={{ marginBottom: 8 }}>
        <h2
          style={{
            margin: 0,
            marginBottom: 4,
            fontSize: 16,
            fontWeight: 600,
            color: 'var(--agent-text)',
          }}
        >
          Knowledge Base
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: 12,
            color: '#6b7280',
          }}
        >
          Upload reference files or add text snippets that the agent can use when answering questions.
        </p>
      </div>

      {error && (
        <div
          style={{
            marginBottom: 8,
            padding: '6px 8px',
            borderRadius: 6,
            backgroundColor: '#fef2f2',
            color: '#b91c1c',
            fontSize: 12,
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          marginBottom: 12,
        }}
      >
        <form onSubmit={handleUploadFile} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 12, fontWeight: 500 }}>Upload file</label>
          <input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            style={{ fontSize: 12 }}
          />
          <input
            type="text"
            placeholder="Display title (optional)"
            value={fileTitle}
            onChange={(e) => setFileTitle(e.target.value)}
            style={{
              padding: '4px 6px',
              borderRadius: 6,
              border: '1px solid var(--agent-secondary)',
              fontSize: 12,
              fontFamily: 'inherit',
            }}
          />
          <button
            type="submit"
            disabled={uploadingFile || !file}
            style={{
              alignSelf: 'flex-end',
              padding: '4px 10px',
              borderRadius: 999,
              border: 'none',
              backgroundColor: 'var(--agent-primary)',
              color: '#ffffff',
              fontSize: 12,
              cursor: uploadingFile || !file ? 'default' : 'pointer',
              opacity: uploadingFile || !file ? 0.6 : 1,
            }}
          >
            {uploadingFile ? 'Uploading…' : 'Upload file'}
          </button>
        </form>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 4,
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 500 }}>Documents</span>
        <button
          type="button"
          onClick={loadDocuments}
          disabled={loading}
          style={{
            padding: '2px 8px',
            borderRadius: 999,
            border: '1px solid var(--agent-secondary)',
            backgroundColor: '#f9fafb',
            fontSize: 11,
            cursor: loading ? 'default' : 'pointer',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <div
        style={{
          maxHeight: 220,
          overflowY: 'auto',
          borderRadius: 6,
          border: '1px solid var(--agent-secondary)',
          backgroundColor: '#f9fafb',
        }}
      >
        {documents.length === 0 ? (
          <div style={{ padding: 8, fontSize: 12, color: '#6b7280' }}>
            No documents yet. Add text or upload a file to prime the knowledge base.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ backgroundColor: '#e5e7eb' }}>
                <th style={{ textAlign: 'left', padding: '4px 6px' }}>Title</th>
                <th style={{ textAlign: 'left', padding: '4px 6px' }}>Type</th>
                <th style={{ textAlign: 'right', padding: '4px 6px' }}>Size</th>
                <th style={{ textAlign: 'right', padding: '4px 6px' }}>Created</th>
                <th style={{ padding: '4px 6px' }}></th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.id}>
                  <td style={{ padding: '4px 6px', borderTop: '1px solid #e5e7eb' }}>
                    {doc.title}
                  </td>
                  <td style={{ padding: '4px 6px', borderTop: '1px solid #e5e7eb' }}>
                    {doc.sourceType || (doc.mimeType ? 'file' : 'text')}
                  </td>
                  <td
                    style={{
                      padding: '4px 6px',
                      borderTop: '1px solid #e5e7eb',
                      textAlign: 'right',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {formatSize(doc.size)}
                  </td>
                  <td
                    style={{
                      padding: '4px 6px',
                      borderTop: '1px solid #e5e7eb',
                      textAlign: 'right',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {formatDate(doc.createdAt)}
                  </td>
                  <td
                    style={{
                      padding: '4px 6px',
                      borderTop: '1px solid #e5e7eb',
                      textAlign: 'center',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => handleDeleteDocument(doc.id)}
                      style={{
                        padding: '2px 6px',
                        borderRadius: 999,
                        border: 'none',
                        backgroundColor: '#fee2e2',
                        color: '#b91c1c',
                        fontSize: 11,
                        cursor: 'pointer',
                      }}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default KnowledgeBaseManager;
