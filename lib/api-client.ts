/**
 * Client-side API helper that adds auth headers automatically.
 */

export function getStoredToken(): string | null {
  try {
    const stored = localStorage.getItem('phantom_auth');
    if (!stored) return null;
    return JSON.parse(stored).token || null;
  } catch {
    return null;
  }
}

export async function apiFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) {
    headers['authorization'] = `Bearer ${token}`;
  }
  if (options.body && typeof options.body === 'string') {
    headers['content-type'] = headers['content-type'] || 'application/json';
  }
  return fetch(path, { ...options, headers });
}
