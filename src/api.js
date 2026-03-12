const API_BASE = import.meta.env.VITE_API_URL || '/api';

export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('github_token');  // or from context
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options.headers,
  };
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `API error: ${response.status}`);
  }
  return response.json();
}