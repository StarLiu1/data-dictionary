/**
 * SignInButton
 * 
 * Displays in the header area. Shows:
 * - "Sign in with GitHub" when unauthenticated
 * - Device code modal during authentication
 * - User avatar + name when authenticated
 */
import { useState } from 'react';
import { useAuth } from './GitHubAuthProvider.jsx';

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  signInBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 14px',
    backgroundColor: '#24292e',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background-color 0.15s',
  },
  signInBtnHover: {
    backgroundColor: '#2f363d',
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    color: '#24292e',
  },
  avatar: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    border: '2px solid #e1e4e8',
  },
  userName: {
    fontWeight: 500,
    maxWidth: '120px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  signOutBtn: {
    padding: '4px 10px',
    backgroundColor: 'transparent',
    color: '#586069',
    border: '1px solid #d1d5da',
    borderRadius: '4px',
    fontSize: '12px',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  // Device code modal
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
    padding: '32px',
    maxWidth: '420px',
    width: '90%',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
    textAlign: 'center',
  },
  modalTitle: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#24292e',
    marginBottom: '8px',
  },
  modalText: {
    fontSize: '14px',
    color: '#586069',
    lineHeight: 1.5,
    marginBottom: '20px',
  },
  codeBox: {
    display: 'inline-block',
    padding: '12px 24px',
    backgroundColor: '#f6f8fa',
    border: '2px dashed #d0d7de',
    borderRadius: '8px',
    fontSize: '28px',
    fontWeight: 700,
    fontFamily: 'monospace',
    letterSpacing: '4px',
    color: '#24292e',
    marginBottom: '20px',
    cursor: 'pointer',
    userSelect: 'all',
  },
  copiedHint: {
    fontSize: '12px',
    color: '#2da44e',
    marginTop: '4px',
    marginBottom: '12px',
    minHeight: '18px',
  },
  openGitHubBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '10px 20px',
    backgroundColor: '#2da44e',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    textDecoration: 'none',
    marginBottom: '12px',
  },
  waitingText: {
    fontSize: '13px',
    color: '#8b949e',
    marginTop: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
  spinner: {
    display: 'inline-block',
    width: '14px',
    height: '14px',
    border: '2px solid #d0d7de',
    borderTopColor: '#586069',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  cancelBtn: {
    padding: '6px 16px',
    backgroundColor: 'transparent',
    color: '#586069',
    border: '1px solid #d1d5da',
    borderRadius: '6px',
    fontSize: '13px',
    cursor: 'pointer',
    marginTop: '16px',
  },
  errorText: {
    fontSize: '13px',
    color: '#cf222e',
    marginTop: '8px',
  },
  githubIcon: {
    width: '16px',
    height: '16px',
    fill: 'currentColor',
  },
};

// Inline spinner keyframes (injected once)
const spinnerCSS = `@keyframes spin { to { transform: rotate(360deg); } }`;

function GitHubIcon() {
  return (
    <svg style={styles.githubIcon} viewBox="0 0 16 16">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

export default function SignInButton() {
  const { user, isAuthenticated, isAuthenticating, deviceCode, authError, signIn, cancelSignIn, signOut } = useAuth();
  const [hovered, setHovered] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyCode = async () => {
    if (deviceCode?.userCode) {
      try {
        await navigator.clipboard.writeText(deviceCode.userCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // Fallback: the user can manually select from the code box
      }
    }
  };

  if (isAuthenticated && user) {
    return (
      <div style={styles.container}>
        <div style={styles.userInfo}>
          <img src={user.avatarUrl} alt={user.login} style={styles.avatar} />
          <span style={styles.userName}>{user.name || user.login}</span>
        </div>
        <button style={styles.signOutBtn} onClick={signOut}>
          Sign out
        </button>
      </div>
    );
  }

  return (
    <>
      <style>{spinnerCSS}</style>
      <button
        style={{ ...styles.signInBtn, ...(hovered ? styles.signInBtnHover : {}) }}
        onClick={signIn}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        disabled={isAuthenticating}
      >
        <GitHubIcon />
        {isAuthenticating ? 'Signing in…' : 'Sign in with GitHub'}
      </button>

      {/* Device code modal */}
      {isAuthenticating && deviceCode && (
        <div style={styles.overlay} onClick={(e) => e.target === e.currentTarget && cancelSignIn()}>
          <div style={styles.modal}>
            <div style={styles.modalTitle}>Sign in with GitHub</div>
            <p style={styles.modalText}>
              Copy the code below, then click the button to open GitHub and enter it.
            </p>
            <div style={styles.codeBox} onClick={copyCode} title="Click to copy">
              {deviceCode.userCode}
            </div>
            <div style={styles.copiedHint}>
              {copied ? '✓ Copied to clipboard' : 'Click code to copy'}
            </div>
            <div>
              <a
                href={deviceCode.verificationUri}
                target="_blank"
                rel="noopener noreferrer"
                style={styles.openGitHubBtn}
                onClick={copyCode}
              >
                <GitHubIcon /> Open GitHub
              </a>
            </div>
            <div style={styles.waitingText}>
              <span style={styles.spinner}></span>
              Waiting for authorization…
            </div>
            {authError && <div style={styles.errorText}>{authError}</div>}
            <button style={styles.cancelBtn} onClick={cancelSignIn}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Error state (no modal) */}
      {authError && !isAuthenticating && (
        <span style={{ ...styles.errorText, marginLeft: '8px' }}>{authError}</span>
      )}
    </>
  );
}
