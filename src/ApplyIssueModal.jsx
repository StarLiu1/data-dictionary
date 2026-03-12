/**
 * ApplyIssueModal
 *
 * Shown to admins when they click "Apply" on an open issue.
 * Pre-fills context from the issue (table/column parsed from title tags).
 * On submit, calls the admin edit API with the github_issue_number linked,
 * then optionally closes the issue on GitHub.
 */
import { useState } from 'react';
import { useAuth } from './GitHubAuthProvider.jsx';
import { parseIssueTitle } from './github_issues.js';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    maxWidth: '620px',
    width: '90%',
    maxHeight: '90vh',
    overflow: 'auto',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
  },
  header: {
    padding: '20px 24px 16px',
    borderBottom: '1px solid #d8dee4',
  },
  headerTitle: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#24292e',
    margin: 0,
  },
  issueRef: {
    fontSize: '13px',
    color: '#8b949e',
    marginTop: '4px',
  },
  issueLink: {
    color: '#0969da',
    textDecoration: 'none',
    fontWeight: 500,
  },
  context: {
    display: 'flex',
    gap: '8px',
    marginTop: '8px',
    flexWrap: 'wrap',
  },
  contextTag: {
    display: 'inline-block',
    padding: '2px 8px',
    backgroundColor: '#ddf4ff',
    color: '#0969da',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: 500,
    fontFamily: 'monospace',
  },
  body: {
    padding: '20px 24px',
  },
  issueBody: {
    padding: '12px 16px',
    backgroundColor: '#f6f8fa',
    borderRadius: '8px',
    border: '1px solid #d0d7de',
    fontSize: '13px',
    color: '#24292e',
    lineHeight: 1.6,
    marginBottom: '20px',
    maxHeight: '200px',
    overflow: 'auto',
    whiteSpace: 'pre-wrap',
  },
  sectionLabel: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#24292e',
    marginBottom: '8px',
    display: 'block',
  },
  field: {
    marginBottom: '16px',
  },
  label: {
    display: 'block',
    fontSize: '13px',
    fontWeight: 600,
    color: '#24292e',
    marginBottom: '6px',
  },
  select: {
    width: '100%',
    padding: '8px 12px',
    fontSize: '14px',
    border: '1px solid #d0d7de',
    borderRadius: '6px',
    outline: 'none',
    boxSizing: 'border-box',
    background: '#fff',
  },
  input: {
    width: '100%',
    padding: '8px 12px',
    fontSize: '14px',
    border: '1px solid #d0d7de',
    borderRadius: '6px',
    outline: 'none',
    boxSizing: 'border-box',
  },
  textarea: {
    width: '100%',
    padding: '8px 12px',
    fontSize: '14px',
    border: '1px solid #d0d7de',
    borderRadius: '6px',
    outline: 'none',
    minHeight: '80px',
    resize: 'vertical',
    fontFamily: 'inherit',
    lineHeight: 1.5,
    boxSizing: 'border-box',
  },
  checkboxRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    color: '#24292e',
    marginTop: '12px',
  },
  footer: {
    padding: '16px 24px 20px',
    borderTop: '1px solid #d8dee4',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
  },
  cancelBtn: {
    padding: '8px 16px',
    backgroundColor: 'transparent',
    color: '#24292e',
    border: '1px solid #d0d7de',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
  },
  applyBtn: {
    padding: '8px 20px',
    backgroundColor: '#2da44e',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background-color 0.15s',
  },
  applyBtnDisabled: {
    backgroundColor: '#94d3a2',
    cursor: 'not-allowed',
  },
  successMessage: {
    padding: '32px 24px',
    textAlign: 'center',
  },
  successIcon: {
    fontSize: '48px',
    marginBottom: '12px',
  },
  successTitle: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#1a7f37',
    marginBottom: '8px',
  },
  successDetail: {
    fontSize: '13px',
    color: '#586069',
  },
  errorMessage: {
    padding: '8px 12px',
    backgroundColor: '#ffebe9',
    color: '#cf222e',
    borderRadius: '6px',
    fontSize: '13px',
    marginBottom: '12px',
  },
};

const FIELD_OPTIONS = [
  { value: 'comment', label: 'Comment / Description' },
  { value: 'source', label: 'Source' },
  { value: 'description', label: 'Description (extended)' },
  { value: 'data_type', label: 'Data Type' },
  { value: 'is_nullable', label: 'Nullable' },
];

const TABLE_FIELD_OPTIONS = [
  { value: 'Comment', label: 'Table Comment' },
  { value: 'Type', label: 'Table Type' },
  { value: 'Owner', label: 'Owner' },
];

export default function ApplyIssueModal({ issue, dictId = 1, onClose, onApplied }) {
  const { accessToken } = useAuth();
  const parsed = parseIssueTitle(issue.title);

  const [fieldName, setFieldName] = useState('comment');
  const [newValue, setNewValue] = useState('');
  const [closeIssue, setCloseIssue] = useState(true);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState(null);
  const [applied, setApplied] = useState(false);

  const isColumnLevel = !!parsed.columnName;
  const fieldOptions = isColumnLevel ? FIELD_OPTIONS : TABLE_FIELD_OPTIONS;

  async function handleApply() {
    if (!newValue.trim()) return;

    setApplying(true);
    setError(null);

    try {
      const token = accessToken;

      // 1. Apply the edit via admin API
      let url;
      if (isColumnLevel) {
        url = `${API_BASE}/admin/${dictId}/tables/${parsed.tableName}/columns/${parsed.columnName}`;
      } else {
        url = `${API_BASE}/admin/${dictId}/tables/${parsed.tableName}`;
      }

      const editResp = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          field_name: fieldName,
          new_value: newValue.trim(),
          github_issue_number: issue.number,
        }),
      });

      if (!editResp.ok) {
        const err = await editResp.json().catch(() => ({}));
        throw new Error(err.detail || `Failed to apply edit: ${editResp.status}`);
      }

      // 2. Optionally close the GitHub issue
      if (closeIssue && token) {
        try {
          await fetch(`https://api.github.com/repos/StarLiu1/data-dictionary/issues/${issue.number}`, {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/vnd.github+json',
            },
            body: JSON.stringify({ state: 'closed' }),
          });

          // Add a comment noting the resolution
          await fetch(`https://api.github.com/repos/StarLiu1/data-dictionary/issues/${issue.number}/comments`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/vnd.github+json',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              body: `**Resolved via Data Dictionary Admin UI**\n\n- **Field:** \`${fieldName}\`\n- **New value:** ${newValue.trim()}\n- **Applied to:** \`deid.derived.${parsed.tableName}${parsed.columnName ? '.' + parsed.columnName : ''}\``,
            }),
          });
        } catch (ghErr) {
          // Don't fail the whole operation if GitHub close fails
          console.warn('Failed to close GitHub issue:', ghErr);
        }
      }

      setApplied(true);
      if (onApplied) onApplied();
    } catch (err) {
      setError(err.message);
    } finally {
      setApplying(false);
    }
  }

  return (
    <div style={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={styles.modal}>
        {applied ? (
          <div style={styles.successMessage}>
            <div style={styles.successIcon}>✅</div>
            <div style={styles.successTitle}>Change applied!</div>
            <div style={styles.successDetail}>
              Updated <code>{fieldName}</code> on{' '}
              <code>
                {parsed.tableName}
                {parsed.columnName ? `.${parsed.columnName}` : ''}
              </code>
              {closeIssue && (
                <>
                  <br />
                  Issue #{issue.number} has been closed on GitHub.
                </>
              )}
            </div>
            <div style={{ marginTop: '20px' }}>
              <button style={styles.cancelBtn} onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        ) : (
          <>
            <div style={styles.header}>
              <h3 style={styles.headerTitle}>Apply Issue Feedback</h3>
              <div style={styles.issueRef}>
                <a
                  href={issue.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={styles.issueLink}
                >
                  #{issue.number}
                </a>{' '}
                — {parsed.cleanTitle}
              </div>
              <div style={styles.context}>
                {parsed.tableName && (
                  <span style={styles.contextTag}>table: {parsed.tableName}</span>
                )}
                {parsed.columnName && (
                  <span style={styles.contextTag}>column: {parsed.columnName}</span>
                )}
              </div>
            </div>

            <div style={styles.body}>
              {error && <div style={styles.errorMessage}>{error}</div>}

              {/* Show the original issue body */}
              <div style={{ marginBottom: '16px' }}>
                <span style={styles.sectionLabel}>Original feedback:</span>
                <div style={styles.issueBody}>
                  {issue.body || 'No description provided.'}
                </div>
              </div>

              {/* Field to edit */}
              <div style={styles.field}>
                <label style={styles.label}>Field to update</label>
                <select
                  style={styles.select}
                  value={fieldName}
                  onChange={(e) => setFieldName(e.target.value)}
                >
                  {fieldOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* New value */}
              <div style={styles.field}>
                <label style={styles.label}>New value</label>
                <textarea
                  style={styles.textarea}
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  placeholder="Enter the corrected or new value…"
                />
              </div>

              {/* Close issue checkbox */}
              <label style={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={closeIssue}
                  onChange={(e) => setCloseIssue(e.target.checked)}
                />
                Close this issue on GitHub after applying
              </label>
            </div>

            <div style={styles.footer}>
              <button style={styles.cancelBtn} onClick={onClose}>
                Cancel
              </button>
              <button
                style={{
                  ...styles.applyBtn,
                  ...(!newValue.trim() || applying ? styles.applyBtnDisabled : {}),
                }}
                onClick={handleApply}
                disabled={!newValue.trim() || applying}
              >
                {applying ? 'Applying…' : 'Apply Change'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
