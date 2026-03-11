/**
 * GitHub OAuth — Redirect Flow
 * 
 * Flow:
 *   1. User clicks "Sign in" → redirected to Cloudflare Worker /login
 *   2. Worker redirects to GitHub authorization page
 *   3. User approves → GitHub redirects to Worker /callback
 *   4. Worker exchanges code for token → redirects back to app with token in URL fragment
 *   5. App reads token from URL fragment, fetches user profile
 * 
 * The token is passed via URL fragment (#access_token=xxx) so it never hits a server.
 */

const WORKER_URL = 'https://github-oauth-proxy.star-sd-liu.workers.dev';
const GITHUB_USER_URL = 'https://api.github.com/user';

/**
 * Start the sign-in flow — redirects the browser to the Worker /login endpoint
 */
export function startSignIn() {
  window.location.href = `${WORKER_URL}/login`;
}

/**
 * Check the URL fragment for an access token (called on app load).
 * Returns { accessToken, tokenType } if present, null otherwise.
 * Clears the fragment from the URL after reading.
 */
export function extractTokenFromUrl() {
  const hash = window.location.hash;
  if (!hash || !hash.includes('access_token')) {
    // Check for error
    if (hash.includes('error=')) {
      const params = new URLSearchParams(hash.substring(1));
      const error = params.get('error');
      // Clean up URL
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      return { error };
    }
    return null;
  }

  const params = new URLSearchParams(hash.substring(1));
  const accessToken = params.get('access_token');
  const tokenType = params.get('token_type');

  // Clean the token from the URL so it's not visible or bookmarkable
  window.history.replaceState(null, '', window.location.pathname + window.location.search);

  if (!accessToken) return null;

  return { accessToken, tokenType };
}

/**
 * Fetch the authenticated user's profile
 * @param {string} accessToken
 * Returns { login, avatar_url, name, html_url }
 */
export async function fetchUser(accessToken) {
  const response = await fetch(GITHUB_USER_URL, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/vnd.github+json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch user: ${response.status}`);
  }

  return response.json();
}
