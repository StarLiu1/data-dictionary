/**
 * DismissIssueModal
 *
 * Shown to admins when they click "Dismiss" on an open issue.
 * Closes the issue on GitHub with a comment explaining no change was needed.
 */
import { useState } from 'react';
import { useAuth } from './GitHubAuthProvider.jsx';
import { parseIssueTitle } from './github_issues.js';

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
    maxWidth: '520px',
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
  body: {
    padding: '20px 24px',
  },
  label: {
    display: 'block',
    fontSize: '13px',
    fontWeight: 600,
    color: '#24292e',
    marginBottom: '6px',
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
  hint: {
    fontSize: '12px',
    color: '#8b949e',
    marginTop: '6px',
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
  dismissBtn: {
    padding: '8px 20px',
    backgroundColor: '#6e7781',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background-color 0.15s',
  },
  dismissBtnDisabled: {
    backgroundColor: '#afb8c1',
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
    color: '#24292e',
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

export default function DismissIssueModal({ issue, onClose, onDismissed }) {
  const { accessToken } = useAuth();
  const parsed = parseIssueTitle(issue.title);

  const [reason, setReason] = useState('');
  const [dismissing, setDismissing] = useState(false);
  const [error, setError] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  async function handleDismiss() {
    setDismissing(true);
    setError(null);

    try {
      const token = accessToken;
      const reasonText = reason.trim() || 'No change needed.';

      // 1. Add a comment explaining the dismissal
      await fetch(`https://api.github.com/repos/StarLiu1/data-dictionary/issues/${issue.number}/comments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          body: `**Dismissed — No Change Needed**\n\n${reasonText}\n\n---\n*Dismissed via Data Dictionary Admin UI*`,
        }),
      });

      // 2. Close the issue
      const closeResp = await fetch(`https://api.github.com/repos/StarLiu1/data-dictionary/issues/${issue.number}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          state: 'closed',
          state_reason: 'not_planned',
        }),
      });

      if (!closeResp.ok) {
        const err = await closeResp.json().catch(() => ({}));
        throw new Error(err.message || `Failed to close issue: ${closeResp.status}`);
      }

      setDismissed(true);
      if (onDismissed) onDismissed();
    } catch (err) {
      setError(err.message);
    } finally {
      setDismissing(false);
    }
  }

  return (
    <div style={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={styles.modal}>
        {dismissed ? (
          <div style={styles.successMessage}>
            <div style={styles.successIcon}>✅</div>
            <div style={styles.successTitle}>Issue dismissed</div>
            <div style={styles.successDetail}>
              Issue #{issue.number} has been closed as "not planned" on GitHub.
            </div>
            <div style={{ marginTop: '20px' }}>
              <button style={styles.cancelBtn} onClick={onClose}>Close</button>
            </div>
          </div>
        ) : (
          <>
            <div style={styles.header}>
              <h3 style={styles.headerTitle}>Dismiss Issue</h3>
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
            </div>

            <div style={styles.body}>
              {error && <div style={styles.errorMessage}>{error}</div>}

              <label style={styles.label}>Reason (optional)</label>
              <textarea
                style={styles.textarea}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g., The current description is accurate, duplicate of #12, etc."
              />
              <div style={styles.hint}>
                This will close the issue on GitHub as "not planned" with your comment.
              </div>
            </div>

            <div style={styles.footer}>
              <button style={styles.cancelBtn} onClick={onClose}>
                Cancel
              </button>
              <button
                style={{
                  ...styles.dismissBtn,
                  ...(dismissing ? styles.dismissBtnDisabled : {}),
                }}
                onClick={handleDismiss}
                disabled={dismissing}
              >
                {dismissing ? 'Dismissing…' : 'Dismiss Issue'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
