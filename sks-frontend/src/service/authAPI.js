import apiClient from '../services/apiClient.js';

const postLogin = async (email, password) => {
  const response = await apiClient.post('/auth/login', {
    email,
    password,
  });

  return response.data;
};

const postRegister = async (data) => {
  const response = await apiClient.post('/auth/register', data);
  return response.data;
};

const completeRegistration = async (token, password) => {
  const response = await apiClient.post('/auth/complete-registration', {
    token,
    password,
  });
  return response.data;
};

const requestPasswordReset = async (email) => {
  const response = await apiClient.post('/auth/forgot-password', { email });
  return response.data;
};

const resetPassword = async (token, password) => {
  const response = await apiClient.post('/auth/reset-password', {
    token,
    password,
  });
  return response.data;
};

const getProfile = async () => {
  const response = await apiClient.get('/auth/profile');
  return response.data;
};

const updateProfile = async ({ name }) => {
  const response = await apiClient.patch('/auth/profile', { name });
  return response.data;
};

const changePassword = async ({ currentPassword, newPassword }) => {
  const response = await apiClient.patch('/auth/password', {
    currentPassword,
    newPassword,
  });
  return response.data;
};

export {
  changePassword,
  completeRegistration,
  getProfile,
  postLogin,
  postRegister,
  requestPasswordReset,
  resetPassword,
  updateProfile,
};
