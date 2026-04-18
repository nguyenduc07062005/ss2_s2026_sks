const TOKEN_KEY = 'token';

const canUseStorage = () => {
  try {
    return (
      typeof window !== 'undefined' &&
      typeof window.localStorage !== 'undefined'
    );
  } catch {
    return false;
  }
};

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
  if (!canUseStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Ignore browser storage failures and fall back to unauthenticated mode.
  }
};

export const getToken = () => {
  if (!canUseStorage()) {
    return null;
  }

  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

export const clearToken = () => {
  if (!canUseStorage()) {
    return;
  }

  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Ignore browser storage failures and keep the app responsive.
  }
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
