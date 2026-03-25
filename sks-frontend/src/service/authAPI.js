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

const getProfile = async () => {
  const response = await apiClient.get('/auth/profile');
  return response.data;
};

export { getProfile, postLogin, postRegister };
