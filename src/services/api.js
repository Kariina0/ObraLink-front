import axios from "axios";

const baseURL = process.env.REACT_APP_API_URL || "http://localhost:5000/api";

const api = axios.create({
  baseURL,
});

// Interceptor: injeta token JWT em todas as requisicoes
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Controle de race condition no refresh de token
let isRefreshing = false;
let pendingRequests = [];

const processQueue = (error, token = null) => {
  pendingRequests.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  pendingRequests = [];
};

// Interceptor: tenta refresh token em 401 e refaz a requisicao
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;
    const refreshToken = localStorage.getItem("refreshToken");

    if (status === 401 && refreshToken && !originalRequest._retry) {
      // Se já há um refresh em andamento, enfileira esta requisição
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingRequests.push({ resolve, reject });
        })
          .then((newToken) => {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshRes = await axios.post(`${baseURL}/auth/refresh`, {
          refreshToken,
        });

        const newToken =
          refreshRes.data?.data?.accessToken || refreshRes.data?.accessToken;
        const newRefreshToken =
          refreshRes.data?.data?.refreshToken || refreshRes.data?.refreshToken;

        if (newToken) {
          localStorage.setItem("token", newToken);
          if (newRefreshToken) {
            localStorage.setItem("refreshToken", newRefreshToken);
          }
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          processQueue(null, newToken);
          return api(originalRequest);
        }
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("user");
        window.dispatchEvent(new Event("auth:logout"));
      } finally {
        isRefreshing = false;
      }
    }

    if (status === 401 && !refreshToken) {
      localStorage.removeItem("user");
      window.dispatchEvent(new Event("auth:logout"));
    }

    return Promise.reject(error);
  },
);

export default api;
