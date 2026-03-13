const API_BASE = import.meta.env.VITE_API_URL || '/api';

export async function apiFetch(path, options = {}) {
  // Token can be passed explicitly in options.token, or in the Authorization header
  const token = options.token || null;
  const { token: _removed, ...restOptions } = options;

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...restOptions.headers,
  };
  const response = await fetch(`${API_BASE}${path}`, { ...restOptions, headers });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `API error: ${response.status}`);
  }
  return response.json();
}
