import React, { useEffect, useRef, useState } from 'react';
import { AgentTheme, applyTheme, defaultTheme } from './theme';
import { useAdminTheme } from './AdminThemeContext';

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
  const { colors } = useAdminTheme();
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
        fontFamily: mergedTheme.fontFamily || 'inherit',
        backgroundColor: colors.bgCard,
        borderRadius: 12,
        border: `1px solid ${colors.border}`,
        width: '100%',
        maxWidth: 520,
        boxSizing: 'border-box',
        padding: 16,
        boxShadow: colors.shadow,
      }}
    >
      <div style={{ marginBottom: 12 }}>
        <h2
          style={{
            margin: 0,
            marginBottom: 4,
            fontSize: 16,
            fontWeight: 600,
            color: colors.text,
          }}
        >
          Knowledge Base
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: 12,
            color: colors.textMuted,
          }}
        >
          Upload reference files or add text snippets that the agent can use when answering questions.
        </p>
      </div>

      {error && (
        <div
          style={{
            marginBottom: 8,
            padding: '8px 12px',
            borderRadius: 6,
            backgroundColor: colors.errorLight,
            color: colors.error,
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
          marginBottom: 16,
        }}
      >
        <form onSubmit={handleUploadFile} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: colors.text }}>Upload file</label>
          <input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            style={{ fontSize: 12, color: colors.text }}
          />
          <input
            type="text"
            placeholder="Display title (optional)"
            value={fileTitle}
            onChange={(e) => setFileTitle(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: 6,
              border: `1px solid ${colors.border}`,
              backgroundColor: colors.bgInput,
              color: colors.text,
              fontSize: 12,
              fontFamily: 'inherit',
            }}
          />
          <button
            type="submit"
            disabled={uploadingFile || !file}
            style={{
              alignSelf: 'flex-end',
              padding: '6px 14px',
              borderRadius: 6,
              border: 'none',
              backgroundColor: uploadingFile || !file ? colors.primaryLight : colors.primary,
              color: '#ffffff',
              fontSize: 12,
              fontWeight: 500,
              cursor: uploadingFile || !file ? 'default' : 'pointer',
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
          marginBottom: 8,
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 500, color: colors.text }}>Documents</span>
        <button
          type="button"
          onClick={loadDocuments}
          disabled={loading}
          style={{
            padding: '4px 10px',
            borderRadius: 6,
            border: `1px solid ${colors.border}`,
            backgroundColor: colors.bgSecondary,
            color: colors.textSecondary,
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
          borderRadius: 8,
          border: `1px solid ${colors.border}`,
          backgroundColor: colors.bgSecondary,
        }}
      >
        {documents.length === 0 ? (
          <div style={{ padding: 12, fontSize: 12, color: colors.textMuted }}>
            No documents yet. Add text or upload a file to prime the knowledge base.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ backgroundColor: colors.bgHover }}>
                <th style={{ textAlign: 'left', padding: '8px 10px', color: colors.text }}>Title</th>
                <th style={{ textAlign: 'left', padding: '8px 10px', color: colors.text }}>Type</th>
                <th style={{ textAlign: 'right', padding: '8px 10px', color: colors.text }}>Size</th>
                <th style={{ textAlign: 'right', padding: '8px 10px', color: colors.text }}>Created</th>
                <th style={{ padding: '8px 10px' }}></th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.id}>
                  <td style={{ padding: '8px 10px', borderTop: `1px solid ${colors.border}`, color: colors.text }}>
                    {doc.title}
                  </td>
                  <td style={{ padding: '8px 10px', borderTop: `1px solid ${colors.border}`, color: colors.textSecondary }}>
                    {doc.sourceType || (doc.mimeType ? 'file' : 'text')}
                  </td>
                  <td
                    style={{
                      padding: '8px 10px',
                      borderTop: `1px solid ${colors.border}`,
                      textAlign: 'right',
                      whiteSpace: 'nowrap',
                      color: colors.textSecondary,
                    }}
                  >
                    {formatSize(doc.size)}
                  </td>
                  <td
                    style={{
                      padding: '8px 10px',
                      borderTop: `1px solid ${colors.border}`,
                      textAlign: 'right',
                      whiteSpace: 'nowrap',
                      color: colors.textSecondary,
                    }}
                  >
                    {formatDate(doc.createdAt)}
                  </td>
                  <td
                    style={{
                      padding: '8px 10px',
                      borderTop: `1px solid ${colors.border}`,
                      textAlign: 'center',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => handleDeleteDocument(doc.id)}
                      style={{
                        padding: '4px 8px',
                        borderRadius: 6,
                        border: 'none',
                        backgroundColor: colors.errorLight,
                        color: colors.error,
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
