const TOKEN_KEY = 'token';
const USER_KEY = 'user';
export const AUTH_EVENT = 'auth-change';

const emitAuthChange = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(AUTH_EVENT));
  }
};

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const getUser = () => {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
  } catch {
    return null;
  }
};
export const setAuth = (token, user) => {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  emitAuthChange();
};
export const clearAuth = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  emitAuthChange();
};

export const apiFetch = async (path, { method = 'GET', body, headers = {} } = {}) => {
  const token = getToken();
  const res = await fetch(path.startsWith('/') ? path : `/${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json.message || `${res.status} ${res.statusText}`);
    err.status = res.status;
    err.payload = json;
    throw err;
  }
  return json;
};
