import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

api.interceptors.response.use(
  (response) => {
    // blob 响应直接返回，不走 JSON 解析
    if (response.config.responseType === 'blob') {
      return response.data;
    }
    const { data } = response;
    if (data.code !== 200) {
      return Promise.reject(new Error(data.message || '请求失败'));
    }
    return data.data;
  },
  (error) => Promise.reject(error)
);

export default api;
