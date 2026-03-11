/**
 * CreateIssueModal
 * 
 * Modal form for creating a new GitHub issue.
 * Pre-filled with table/column context.
 */
import { useState } from 'react';
import { useAuth } from './GitHubAuthProvider.jsx';
import { createIssue } from './github_issues.js';

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
    maxWidth: '560px',
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
  input: {
    width: '100%',
    padding: '8px 12px',
    fontSize: '14px',
    border: '1px solid #d0d7de',
    borderRadius: '6px',
    outline: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
    boxSizing: 'border-box',
  },
  inputFocus: {
    borderColor: '#0969da',
    boxShadow: '0 0 0 3px rgba(9, 105, 218, 0.15)',
  },
  textarea: {
    width: '100%',
    padding: '8px 12px',
    fontSize: '14px',
    border: '1px solid #d0d7de',
    borderRadius: '6px',
    outline: 'none',
    minHeight: '120px',
    resize: 'vertical',
    fontFamily: 'inherit',
    lineHeight: 1.5,
    boxSizing: 'border-box',
  },
  priorityGroup: {
    display: 'flex',
    gap: '8px',
  },
  priorityBtn: {
    flex: 1,
    padding: '8px 12px',
    border: '1px solid #d0d7de',
    borderRadius: '6px',
    backgroundColor: '#fff',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'all 0.15s',
  },
  prioritySelected: {
    low: {
      borderColor: '#2da44e',
      backgroundColor: '#dafbe1',
      color: '#1a7f37',
    },
    medium: {
      borderColor: '#bf8700',
      backgroundColor: '#fff8c5',
      color: '#9a6700',
    },
    high: {
      borderColor: '#cf222e',
      backgroundColor: '#ffebe9',
      color: '#cf222e',
    },
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
  submitBtn: {
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
  submitBtnDisabled: {
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
  successLink: {
    color: '#0969da',
    textDecoration: 'none',
    fontSize: '14px',
  },
  errorMessage: {
    padding: '8px 12px',
    backgroundColor: '#ffebe9',
    color: '#cf222e',
    borderRadius: '6px',
    fontSize: '13px',
    marginBottom: '12px',
  },
  notSignedIn: {
    padding: '32px 24px',
    textAlign: 'center',
  },
  notSignedInText: {
    fontSize: '14px',
    color: '#586069',
    marginBottom: '16px',
  },
};

export default function CreateIssueModal({ tableName, columnName, onClose, onIssueCreated }) {
  const { accessToken, isAuthenticated, signIn, isAuthenticating } = useAuth();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState('medium');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [createdIssue, setCreatedIssue] = useState(null);
  const [focusedField, setFocusedField] = useState(null);

  const handleSubmit = async () => {
    if (!title.trim() || !body.trim()) return;

    setSubmitting(true);
    setError(null);

    try {
      const issue = await createIssue(accessToken, {
        title: title.trim(),
        body: body.trim(),
        tableName,
        columnName,
        priority,
      });
      setCreatedIssue(issue);
      if (onIssueCreated) onIssueCreated(issue);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = title.trim() && body.trim() && !submitting;

  return (
    <div style={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={styles.modal}>
        {/* Success state */}
        {createdIssue ? (
          <div style={styles.successMessage}>
            <div style={styles.successIcon}>✅</div>
            <div style={styles.successTitle}>Feedback submitted!</div>
            <a
              href={createdIssue.html_url}
              target="_blank"
              rel="noopener noreferrer"
              style={styles.successLink}
            >
              View on GitHub →
            </a>
            <div style={{ marginTop: '20px' }}>
              <button style={styles.cancelBtn} onClick={onClose}>Close</button>
            </div>
          </div>
        ) : !isAuthenticated ? (
          /* Not signed in state */
          <div style={styles.notSignedIn}>
            <div style={styles.successIcon}>🔐</div>
            <div style={styles.notSignedInText}>
              Sign in with GitHub to submit feedback.
            </div>
            <button
              style={styles.submitBtn}
              onClick={signIn}
              disabled={isAuthenticating}
            >
              {isAuthenticating ? 'Signing in…' : 'Sign in with GitHub'}
            </button>
            <div style={{ marginTop: '12px' }}>
              <button style={styles.cancelBtn} onClick={onClose}>Cancel</button>
            </div>
          </div>
        ) : (
          /* Form state */
          <>
            <div style={styles.header}>
              <h3 style={styles.headerTitle}>
                {columnName ? 'Column Feedback' : 'Table Feedback'}
              </h3>
              <div style={styles.context}>
                {tableName && <span style={styles.contextTag}>table: {tableName}</span>}
                {columnName && <span style={styles.contextTag}>column: {columnName}</span>}
              </div>
            </div>

            <div style={styles.body}>
              {error && <div style={styles.errorMessage}>{error}</div>}

              <div style={styles.field}>
                <label style={styles.label}>Title</label>
                <input
                  style={{
                    ...styles.input,
                    ...(focusedField === 'title' ? styles.inputFocus : {}),
                  }}
                  placeholder="Brief summary of your feedback"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onFocus={() => setFocusedField('title')}
                  onBlur={() => setFocusedField(null)}
                  autoFocus
                />
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Description</label>
                <textarea
                  style={{
                    ...styles.textarea,
                    ...(focusedField === 'body' ? styles.inputFocus : {}),
                  }}
                  placeholder={
                    columnName
                      ? 'Describe the issue, suggest a better description, flag a data quality concern, etc.'
                      : 'Describe the issue, request a new column, flag missing data, etc.'
                  }
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  onFocus={() => setFocusedField('body')}
                  onBlur={() => setFocusedField(null)}
                />
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Priority</label>
                <div style={styles.priorityGroup}>
                  {['low', 'medium', 'high'].map((p) => (
                    <button
                      key={p}
                      style={{
                        ...styles.priorityBtn,
                        ...(priority === p ? styles.prioritySelected[p] : {}),
                      }}
                      onClick={() => setPriority(p)}
                    >
                      {p === 'low' ? '🟢 Low' : p === 'medium' ? '🟡 Medium' : '🔴 High'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={styles.footer}>
              <button style={styles.cancelBtn} onClick={onClose}>Cancel</button>
              <button
                style={{
                  ...styles.submitBtn,
                  ...(!canSubmit ? styles.submitBtnDisabled : {}),
                }}
                onClick={handleSubmit}
                disabled={!canSubmit}
              >
                {submitting ? 'Submitting…' : 'Submit Feedback'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
