/**
 * GitHubAuthProvider
 * 
 * React context that manages GitHub authentication state.
 * Wrap your app with <GitHubAuthProvider> and use useAuth() in child components.
 */
import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { authenticate } from './github_auth.js';

const AuthContext = createContext(null);

export function GitHubAuthProvider({ children }) {
  const [accessToken, setAccessToken] = useState(null);
  const [user, setUser] = useState(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [deviceCode, setDeviceCode] = useState(null); // { userCode, verificationUri }
  const [authError, setAuthError] = useState(null);
  const abortRef = useRef(null);

  const signIn = useCallback(async () => {
    setIsAuthenticating(true);
    setAuthError(null);
    setDeviceCode(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const result = await authenticate(
        (codeData) => setDeviceCode(codeData),
        controller.signal
      );
      setAccessToken(result.accessToken);
      setUser(result.user);
      setDeviceCode(null);
    } catch (err) {
      if (!controller.signal.aborted) {
        setAuthError(err.message);
      }
    } finally {
      setIsAuthenticating(false);
      abortRef.current = null;
    }
  }, []);

  const cancelSignIn = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    setIsAuthenticating(false);
    setDeviceCode(null);
    setAuthError(null);
  }, []);

  const signOut = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    setDeviceCode(null);
    setAuthError(null);
  }, []);

  const value = {
    accessToken,
    user,
    isAuthenticated: !!accessToken,
    isAuthenticating,
    deviceCode,
    authError,
    signIn,
    cancelSignIn,
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
