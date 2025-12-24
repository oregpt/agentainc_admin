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
  const [creatingTextDoc, setCreatingTextDoc] = useState(false);

  const [textTitle, setTextTitle] = useState('');
  const [textContent, setTextContent] = useState('');
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBaseUrl, agentId]);

  const handleCreateTextDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textContent.trim()) return;

    setCreatingTextDoc(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/kb/text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId,
          title: textTitle || 'Untitled',
          text: textContent,
        }),
      });
      if (!res.ok) {
        throw new Error(`Failed to create document: ${res.status}`);
      }
      const data = await res.json();
      setDocuments((prev) => [data.document, ...prev]);
      setTextTitle('');
      setTextContent('');
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Failed to create document');
    } finally {
      setCreatingTextDoc(false);
    }
  };

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
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header, inspired by AdvancedFileManager */}
      <div
        style={{
          padding: '10px 12px',
          borderBottom: '1px solid rgba(148,163,184,0.35)',
          background:
            'linear-gradient(135deg, rgba(59,130,246,0.06), rgba(16,185,129,0.08))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: '999px',
              backgroundColor: 'rgba(16,185,129,0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
            }}
          >
            KB
          </div>
          <div>
            <div
              style={{
                margin: 0,
                fontSize: 14,
                fontWeight: 600,
                color: 'rgb(21,128,61)',
              }}
            >
              Knowledge Base Manager
            </div>
            <p
              style={{
                margin: 0,
                fontSize: 11,
                color: '#6b7280',
              }}
            >
              Upload reference files or add text snippets that ground the assistant.
            </p>
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            fontSize: 11,
            color: '#64748b',
          }}
        >
          <span>{documents.length} document{documents.length === 1 ? '' : 's'}</span>
        </div>
      </div>

      <div style={{ padding: 12, paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>

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
          marginBottom: 8,
        }}
      >
        <form onSubmit={handleCreateTextDoc} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 12, fontWeight: 500 }}>Add text document</label>
          <input
            type="text"
            placeholder="Title (optional)"
            value={textTitle}
            onChange={(e) => setTextTitle(e.target.value)}
            style={{
              padding: '4px 6px',
              borderRadius: 6,
              border: '1px solid var(--agent-secondary)',
              fontSize: 12,
              fontFamily: 'inherit',
            }}
          />
          <textarea
            placeholder="Paste reference text here"
            value={textContent}
            onChange={(e) => setTextContent(e.target.value)}
            rows={3}
            style={{
              padding: '4px 6px',
              borderRadius: 6,
              border: '1px solid var(--agent-secondary)',
              fontSize: 12,
              fontFamily: 'inherit',
              resize: 'vertical',
            }}
          />
          <button
            type="submit"
            disabled={creatingTextDoc || !textContent.trim()}
            style={{
              alignSelf: 'flex-end',
              padding: '4px 10px',
              borderRadius: 999,
              border: 'none',
              backgroundColor: 'var(--agent-primary)',
              color: '#ffffff',
              fontSize: 12,
              cursor: creatingTextDoc || !textContent.trim() ? 'default' : 'pointer',
              opacity: creatingTextDoc || !textContent.trim() ? 0.6 : 1,
            }}
          >
            {creatingTextDoc ? 'Adding…' : 'Add text'}
          </button>
        </form>

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
          marginTop: 4,
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
