import React, { useState, useCallback } from 'react';
import { useAdminTheme } from '../AdminThemeContext';

export interface Folder {
  id: number;
  name: string;
  parentId: number | null;
  children?: Folder[];
}

interface FolderTreeProps {
  folders: Folder[];
  selectedFolderId: number | null;
  onSelectFolder: (folderId: number | null) => void;
  onCreateFolder: (parentId: number | null) => void;
  onRenameFolder: (folder: Folder) => void;
  onDeleteFolder: (folder: Folder) => void;
  onMoveFolder?: (folderId: number, newParentId: number | null) => void;
}

interface FolderNodeProps {
  folder: Folder;
  level: number;
  selectedFolderId: number | null;
  expandedIds: Set<number>;
  onToggleExpand: (id: number) => void;
  onSelectFolder: (folderId: number | null) => void;
  onCreateFolder: (parentId: number | null) => void;
  onRenameFolder: (folder: Folder) => void;
  onDeleteFolder: (folder: Folder) => void;
  colors: any;
}

const FolderNode: React.FC<FolderNodeProps> = ({
  folder,
  level,
  selectedFolderId,
  expandedIds,
  onToggleExpand,
  onSelectFolder,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  colors,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const isExpanded = expandedIds.has(folder.id);
  const isSelected = selectedFolderId === folder.id;
  const hasChildren = folder.children && folder.children.length > 0;

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowMenu(true);
  };

  const handleClick = () => {
    onSelectFolder(folder.id);
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleExpand(folder.id);
  };

  return (
    <div>
      <div
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 8px',
          paddingLeft: 8 + level * 16,
          cursor: 'pointer',
          borderRadius: 6,
          backgroundColor: isSelected ? colors.bgSecondary : 'transparent',
          color: isSelected ? colors.primary : colors.text,
          fontSize: 13,
          transition: 'background 0.15s',
          position: 'relative',
        }}
        onMouseEnter={(e) => {
          if (!isSelected) e.currentTarget.style.backgroundColor = colors.bgHover;
        }}
        onMouseLeave={(e) => {
          if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
          setShowMenu(false);
        }}
      >
        {/* Expand/Collapse Arrow */}
        <span
          onClick={handleToggle}
          style={{
            width: 16,
            height: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: colors.textSecondary,
            visibility: hasChildren ? 'visible' : 'hidden',
          }}
        >
          {isExpanded ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          )}
        </span>

        {/* Folder Icon */}
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill={isExpanded ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="2"
          style={{ color: isSelected ? colors.primary : colors.textSecondary, flexShrink: 0 }}
        >
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
        </svg>

        {/* Folder Name */}
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{folder.name}</span>

        {/* Context Menu */}
        {showMenu && (
          <div
            style={{
              position: 'absolute',
              right: 8,
              top: '50%',
              transform: 'translateY(-50%)',
              display: 'flex',
              gap: 4,
              zIndex: 10,
            }}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCreateFolder(folder.id);
                setShowMenu(false);
              }}
              style={{
                padding: '2px 6px',
                borderRadius: 4,
                border: `1px solid ${colors.border}`,
                background: colors.bgCard,
                color: colors.text,
                fontSize: 10,
                cursor: 'pointer',
              }}
              title="New subfolder"
            >
              +
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRenameFolder(folder);
                setShowMenu(false);
              }}
              style={{
                padding: '2px 6px',
                borderRadius: 4,
                border: `1px solid ${colors.border}`,
                background: colors.bgCard,
                color: colors.text,
                fontSize: 10,
                cursor: 'pointer',
              }}
              title="Rename"
            >
              Edit
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteFolder(folder);
                setShowMenu(false);
              }}
              style={{
                padding: '2px 6px',
                borderRadius: 4,
                border: `1px solid ${colors.border}`,
                background: colors.bgCard,
                color: colors.error,
                fontSize: 10,
                cursor: 'pointer',
              }}
              title="Delete"
            >
              Del
            </button>
          </div>
        )}
      </div>

      {/* Children */}
      {isExpanded && hasChildren && (
        <div>
          {folder.children!.map((child) => (
            <FolderNode
              key={child.id}
              folder={child}
              level={level + 1}
              selectedFolderId={selectedFolderId}
              expandedIds={expandedIds}
              onToggleExpand={onToggleExpand}
              onSelectFolder={onSelectFolder}
              onCreateFolder={onCreateFolder}
              onRenameFolder={onRenameFolder}
              onDeleteFolder={onDeleteFolder}
              colors={colors}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const FolderTree: React.FC<FolderTreeProps> = ({
  folders,
  selectedFolderId,
  onSelectFolder,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
}) => {
  const { colors } = useAdminTheme();
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const handleToggleExpand = useCallback((id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* All Documents (Root) */}
      <div
        onClick={() => onSelectFolder(null)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 8px',
          cursor: 'pointer',
          borderRadius: 6,
          backgroundColor: selectedFolderId === null ? colors.bgSecondary : 'transparent',
          color: selectedFolderId === null ? colors.primary : colors.text,
          fontSize: 13,
          fontWeight: 500,
          transition: 'background 0.15s',
          marginBottom: 4,
        }}
        onMouseEnter={(e) => {
          if (selectedFolderId !== null) e.currentTarget.style.backgroundColor = colors.bgHover;
        }}
        onMouseLeave={(e) => {
          if (selectedFolderId !== null) e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
          <polyline points="9 22 9 12 15 12 15 22"></polyline>
        </svg>
        All Documents
      </div>

      {/* Folder List */}
      <div style={{ flex: 1, overflowY: 'auto', marginBottom: 8 }}>
        {folders.map((folder) => (
          <FolderNode
            key={folder.id}
            folder={folder}
            level={0}
            selectedFolderId={selectedFolderId}
            expandedIds={expandedIds}
            onToggleExpand={handleToggleExpand}
            onSelectFolder={onSelectFolder}
            onCreateFolder={onCreateFolder}
            onRenameFolder={onRenameFolder}
            onDeleteFolder={onDeleteFolder}
            colors={colors}
          />
        ))}
      </div>

      {/* New Folder Button */}
      <button
        onClick={() => onCreateFolder(null)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          padding: '8px 12px',
          borderRadius: 6,
          border: `1px dashed ${colors.border}`,
          background: 'transparent',
          color: colors.textSecondary,
          fontSize: 12,
          cursor: 'pointer',
          transition: 'all 0.15s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = colors.primary;
          e.currentTarget.style.color = colors.primary;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = colors.border;
          e.currentTarget.style.color = colors.textSecondary;
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        New Folder
      </button>
    </div>
  );
};

export default FolderTree;
