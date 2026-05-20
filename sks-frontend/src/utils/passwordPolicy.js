export const PASSWORD_POLICY_MESSAGE =
  'Password must be 12-128 characters and include uppercase, lowercase, number, and symbol.';

export const isStrongPassword = (password = '') =>
  password.length >= 12 &&
  password.length <= 128 &&
  /[a-z]/.test(password) &&
  /[A-Z]/.test(password) &&
  /\d/.test(password) &&
  /[^A-Za-z0-9]/.test(password);
