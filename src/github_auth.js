/**
 * GitHub Device Flow OAuth
 * 
 * No backend required — works with any static site host.
 * Flow: 
 *   1. Request device + user codes from GitHub
 *   2. User visits github.com/login/device and enters the code
 *   3. Poll GitHub until the user completes authorization
 *   4. Receive access token
 * 
 * Docs: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#device-flow
 */

const CLIENT_ID = 'Ov23lisJDBtDNukA4X3o';
const GITHUB_DEVICE_URL = 'https://github.com/login/device/code';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_USER_URL = 'https://api.github.com/user';

// Scopes: public_repo allows creating issues on public repos
const SCOPE = 'public_repo';

/**
 * Step 1: Request device and user codes
 * Returns { device_code, user_code, verification_uri, expires_in, interval }
 */
export async function requestDeviceCode() {
  const response = await fetch(GITHUB_DEVICE_URL, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      scope: SCOPE,
    }),
  });

  if (!response.ok) {
    throw new Error(`Device code request failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Step 2: Poll for the access token
 * Polls at the interval specified by GitHub until user authorizes or code expires.
 * Returns { access_token, token_type, scope } on success.
 * 
 * @param {string} deviceCode - The device_code from requestDeviceCode()
 * @param {number} interval - Polling interval in seconds (from requestDeviceCode())
 * @param {number} expiresIn - Code expiration in seconds (from requestDeviceCode())
 * @param {AbortSignal} [signal] - Optional abort signal to cancel polling
 */
export async function pollForToken(deviceCode, interval, expiresIn, signal) {
  const startTime = Date.now();
  const expiresAt = startTime + expiresIn * 1000;
  let pollInterval = interval * 1000; // convert to ms

  while (Date.now() < expiresAt) {
    if (signal?.aborted) {
      throw new Error('Authentication cancelled');
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval));

    try {
      const response = await fetch(GITHUB_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: CLIENT_ID,
          device_code: deviceCode,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        }),
      });

      const data = await response.json();

      if (data.access_token) {
        return data;
      }

      switch (data.error) {
        case 'authorization_pending':
          // User hasn't entered the code yet — keep polling
          break;
        case 'slow_down':
          // GitHub wants us to slow down — increase interval by 5s
          pollInterval += 5000;
          break;
        case 'expired_token':
          throw new Error('Device code expired. Please try signing in again.');
        case 'access_denied':
          throw new Error('Authorization was denied by the user.');
        default:
          throw new Error(`Unexpected error: ${data.error_description || data.error}`);
      }
    } catch (err) {
      if (err.message.includes('cancelled') || err.message.includes('denied') || 
          err.message.includes('expired') || err.message.includes('Unexpected')) {
        throw err;
      }
      // Network error — keep trying
      console.warn('Poll network error, retrying:', err.message);
    }
  }

  throw new Error('Device code expired. Please try signing in again.');
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

/**
 * Full device flow authentication
 * 
 * @param {function} onCodeReady - Called with { user_code, verification_uri } 
 *   when the user needs to enter the code. Show these to the user.
 * @param {AbortSignal} [signal] - Optional abort signal to cancel
 * @returns {{ accessToken: string, user: object }}
 */
export async function authenticate(onCodeReady, signal) {
  const deviceData = await requestDeviceCode();

  // Notify the UI to show the code to the user
  onCodeReady({
    userCode: deviceData.user_code,
    verificationUri: deviceData.verification_uri,
  });

  // Poll until user completes auth
  const tokenData = await pollForToken(
    deviceData.device_code,
    deviceData.interval,
    deviceData.expires_in,
    signal
  );

  // Fetch user profile
  const user = await fetchUser(tokenData.access_token);

  return {
    accessToken: tokenData.access_token,
    user: {
      login: user.login,
      avatarUrl: user.avatar_url,
      name: user.name,
      profileUrl: user.html_url,
    },
  };
}
