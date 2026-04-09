export function isTokenExpired(token) {
  try {
    if (!token) return true;
    const parts = token.split('.');
    if (parts.length !== 3) return true;

    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded));

    if (!payload || typeof payload.exp !== 'number') return true;
    return payload.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}

export function checkAuth() {
  const token = localStorage.getItem('jwt_token');
  if (!token || isTokenExpired(token)) {
    localStorage.removeItem('jwt_token');
    window.location.hash = '#/login';
    return false;
  }
  return true;
}

export async function fetchWithAuth(url, options = {}) {
  if (!checkAuth()) {
    // Redirect already triggered by checkAuth, block any downstream flow silently
    return new Promise(() => {});
  }
  const token = localStorage.getItem('jwt_token');
  if (isTokenExpired(token)) {
    localStorage.removeItem('jwt_token');
    window.location.hash = '#/login';
    return new Promise(() => {});
  }
  const headers = { ...options.headers, 'Authorization': `Bearer ${token}` };
  // Auto-set Content-Type for JSON bodies if not explicitly provided
  if (options.body && typeof options.body === 'string' && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401 || res.status === 403) {
    localStorage.removeItem('jwt_token');
    window.location.hash = '#/login';
    // Silent hard-redirect: stop any UI flow that would show blocking alerts
    return new Promise(() => {});
  }
  return res;
}
