/**
 * SignInButton — Redirect Flow
 * 
 * Simple button: click to redirect to GitHub, shows user info when authenticated.
 * No modal needed since the redirect flow handles everything in-browser.
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
  errorText: {
    fontSize: '13px',
    color: '#cf222e',
    marginLeft: '8px',
  },
  githubIcon: {
    width: '16px',
    height: '16px',
    fill: 'currentColor',
  },
};

function GitHubIcon() {
  return (
    <svg style={styles.githubIcon} viewBox="0 0 16 16">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

export default function SignInButton() {
  const { user, isAuthenticated, isLoading, authError, signIn, signOut } = useAuth();
  const [hovered, setHovered] = useState(false);

  if (isLoading) {
    return <span style={{ fontSize: '12px', color: '#8b949e' }}>Loading…</span>;
  }

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
    <div style={styles.container}>
      <button
        style={{ ...styles.signInBtn, ...(hovered ? styles.signInBtnHover : {}) }}
        onClick={signIn}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <GitHubIcon />
        Sign in with GitHub
      </button>
      {authError && <span style={styles.errorText}>{authError}</span>}
    </div>
  );
}
