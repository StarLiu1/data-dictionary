/**
 * GitHubAuthProvider — Redirect Flow
 * 
 * On mount, checks the URL fragment for a token (user just returned from GitHub).
 * If found, fetches user profile and stores auth state.
 */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { extractTokenFromUrl, fetchUser, startSignIn } from './github_auth.js';

const AuthContext = createContext(null);

export function GitHubAuthProvider({ children }) {
  const [accessToken, setAccessToken] = useState(null);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true); // loading on mount to check URL
  const [authError, setAuthError] = useState(null);

  // On mount: check URL for token
  useEffect(() => {
    async function init() {
      try {
        const result = extractTokenFromUrl();

        if (!result) {
          setIsLoading(false);
          return;
        }

        if (result.error) {
          setAuthError(result.error);
          setIsLoading(false);
          return;
        }

        // We have a token — fetch user profile
        const userData = await fetchUser(result.accessToken);
        setAccessToken(result.accessToken);

        // After fetching GitHub user profile, also check admin status:
        const authStatus = await fetch(`${API_BASE}/api/auth/me`, {
          headers: { 'Authorization': `Bearer ${result.accessToken}` }
        }).then(r => r.json());

        setUser({
          login: userData.login,
          avatarUrl: userData.avatar_url,
          name: userData.name,
          profileUrl: userData.html_url,
          isAdmin: authStatus.is_admin,
          role: authStatus.role,
        });

      } catch (err) {
        setAuthError(err.message);
      } finally {
        setIsLoading(false);
      }
    }

    init();
  }, []);

  const signIn = useCallback(() => {
    startSignIn(); // redirects the browser
  }, []);

  const signOut = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    setAuthError(null);
  }, []);

  const value = {
    accessToken,
    user,
    isAuthenticated: !!accessToken,
    isLoading,
    authError,
    signIn,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within a GitHubAuthProvider');
  }
  return ctx;
}
