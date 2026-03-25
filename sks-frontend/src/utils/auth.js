const TOKEN_KEY = 'token';

const decodeBase64Url = (value) => {
  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
};

const getTokenPayload = () => {
  const token = getToken();

  if (!token) {
    return null;
  }

  const [, payload] = token.split('.');

  if (!payload) {
    return null;
  }

  return decodeBase64Url(payload);
};

export const setToken = (token) => {
  localStorage.setItem(TOKEN_KEY, token);
};

export const getToken = () => {
  return localStorage.getItem(TOKEN_KEY);
};

export const clearToken = () => {
  localStorage.removeItem(TOKEN_KEY);
};

export const isAuthenticated = () => {
  return Boolean(getToken());
};

export const getRoleFromToken = () => {
  const payload = getTokenPayload();

  return payload?.role || payload?.roles || payload?.userRole || null;
};

export const getUserIdFromToken = () => {
  const payload = getTokenPayload();

  return payload?.sub || payload?.userId || null;
};

export const logout = () => {
  clearToken();
};
