/**
 * EditableField — Inline edit component for admin users.
 *
 * Shows text normally. For admins, a pencil icon appears on hover.
 * Clicking switches to an input/textarea with save/cancel.
 * On save, calls the API and updates local state.
 */
import { useState, useRef, useEffect } from 'react';
import { useAuth } from './GitHubAuthProvider.jsx';

const styles = {
  wrapper: {
    display: 'inline-flex',
    alignItems: 'flex-start',
    gap: '6px',
    width: '100%',
    position: 'relative',
  },
  displayText: {
    fontSize: '13px',
    color: '#64748b',
    lineHeight: 1.5,
    flex: 1,
    minHeight: '20px',
  },
  placeholder: {
    color: '#cbd5e1',
    fontStyle: 'italic',
  },
  editBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#94a3b8',
    padding: '2px 4px',
    fontSize: '13px',
    borderRadius: '4px',
    transition: 'all 0.15s',
    flexShrink: 0,
    opacity: 0,
  },
  editBtnVisible: {
    opacity: 1,
  },
  editBtnHover: {
    color: '#3b82f6',
    background: '#eff6ff',
  },
  editContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    width: '100%',
  },
  input: {
    width: '100%',
    padding: '6px 10px',
    fontSize: '13px',
    border: '2px solid #3b82f6',
    borderRadius: '6px',
    outline: 'none',
    fontFamily: 'inherit',
    lineHeight: 1.5,
    boxSizing: 'border-box',
    background: '#fff',
  },
  textarea: {
    width: '100%',
    padding: '6px 10px',
    fontSize: '13px',
    border: '2px solid #3b82f6',
    borderRadius: '6px',
    outline: 'none',
    fontFamily: 'inherit',
    lineHeight: 1.5,
    resize: 'vertical',
    minHeight: '60px',
    boxSizing: 'border-box',
    background: '#fff',
  },
  buttonRow: {
    display: 'flex',
    gap: '6px',
    justifyContent: 'flex-end',
  },
  saveBtn: {
    padding: '4px 12px',
    fontSize: '12px',
    fontWeight: 600,
    color: '#fff',
    background: '#2da44e',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'background 0.15s',
  },
  saveBtnDisabled: {
    background: '#94d3a2',
    cursor: 'not-allowed',
  },
  cancelBtn: {
    padding: '4px 12px',
    fontSize: '12px',
    fontWeight: 500,
    color: '#24292e',
    background: 'transparent',
    border: '1px solid #d0d7de',
    borderRadius: '4px',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  saving: {
    fontSize: '12px',
    color: '#8b949e',
    fontStyle: 'italic',
  },
  error: {
    fontSize: '12px',
    color: '#cf222e',
  },
  success: {
    fontSize: '11px',
    color: '#2da44e',
    fontWeight: 500,
  },
};

/**
 * @param {string} value - Current field value
 * @param {string} placeholder - Text shown when value is empty
 * @param {boolean} multiline - Use textarea instead of input
 * @param {function} onSave - async (newValue) => void — called when user saves
 * @param {object} [displayStyle] - Override styles for display text
 */
export default function EditableField({ value, placeholder, multiline = false, onSave, displayStyle = {} }) {
  const { user } = useAuth();
  const isAdmin = user?.isAdmin || false;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [hovered, setHovered] = useState(false);
  const inputRef = useRef(null);

  // Focus input when entering edit mode
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      // Move cursor to end
      const len = inputRef.current.value.length;
      inputRef.current.setSelectionRange(len, len);
    }
  }, [editing]);

  // Sync external value changes
  useEffect(() => {
    if (!editing) {
      setDraft(value || '');
    }
  }, [value, editing]);

  function startEditing() {
    setDraft(value || '');
    setEditing(true);
    setError(null);
    setShowSuccess(false);
  }

  function cancelEditing() {
    setEditing(false);
    setDraft(value || '');
    setError(null);
  }

  async function handleSave() {
    const trimmed = draft.trim();
    // Allow saving empty string (clearing a field)
    if (trimmed === (value || '').trim()) {
      setEditing(false);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await onSave(trimmed);
      setEditing(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
    } catch (err) {
      setError(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      cancelEditing();
    }
    // Save on Enter for single-line inputs
    if (e.key === 'Enter' && !multiline && !saving) {
      e.preventDefault();
      handleSave();
    }
    // Save on Cmd/Ctrl+Enter for textareas
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !saving) {
      e.preventDefault();
      handleSave();
    }
  }

  // Editing mode
  if (editing) {
    const InputComponent = multiline ? 'textarea' : 'input';
    return (
      <div style={styles.editContainer}>
        <InputComponent
          ref={inputRef}
          style={multiline ? styles.textarea : styles.input}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || 'Enter value…'}
        />
        <div style={styles.buttonRow}>
          {error && <span style={{ ...styles.error, marginRight: 'auto' }}>{error}</span>}
          {saving && <span style={{ ...styles.saving, marginRight: 'auto' }}>Saving…</span>}
          <button style={styles.cancelBtn} onClick={cancelEditing} disabled={saving}>
            Cancel
          </button>
          <button
            style={{ ...styles.saveBtn, ...(saving ? styles.saveBtnDisabled : {}) }}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
        {multiline && (
          <span style={{ fontSize: '11px', color: '#94a3b8' }}>
            Press Esc to cancel · {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+Enter to save
          </span>
        )}
      </div>
    );
  }

  // Display mode
  return (
    <span
      style={styles.wrapper}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span style={{ ...styles.displayText, ...displayStyle }}>
        {value || <span style={styles.placeholder}>{placeholder || '—'}</span>}
      </span>
      {isAdmin && (
        <button
          style={{
            ...styles.editBtn,
            ...(hovered ? styles.editBtnVisible : {}),
          }}
          onClick={(e) => {
            e.stopPropagation();
            startEditing();
          }}
          onMouseEnter={(e) => Object.assign(e.currentTarget.style, styles.editBtnHover)}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.background = 'none'; }}
          title="Edit this field"
        >
          ✏️
        </button>
      )}
      {showSuccess && <span style={styles.success}>✓ Saved</span>}
    </span>
  );
}