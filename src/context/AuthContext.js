// src/context/AuthContext.js
import { createContext, useState, useEffect } from "react";
import api from "../services/api";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  // null = ainda verificando; false = verificado, não autenticado; object = autenticado
  const [authChecked, setAuthChecked] = useState(false);

  const patchUser = (partial) => {
    setUser((prev) => {
      const next = { ...(prev || {}), ...(partial || {}) };
      localStorage.setItem("user", JSON.stringify(next));
      return next;
    });
  };

  const refreshUser = async () => {
    const res = await api.get("/auth/me");
    const freshUser = res.data?.data || null;
    if (freshUser) {
      setUser(freshUser);
      localStorage.setItem("user", JSON.stringify(freshUser));
    }
    return freshUser;
  };

  // Tenta carregar user do localStorage ao iniciar e valida o token com o servidor
  useEffect(() => {
    const handleExternalLogout = () => {
      setUser(null);
      localStorage.removeItem("user");
      localStorage.removeItem("token");
      localStorage.removeItem("refreshToken");
    };

    window.addEventListener("auth:logout", handleExternalLogout);

    const validateSession = async () => {
      const storedToken = localStorage.getItem("token");
      const storedUser = localStorage.getItem("user");

      if (!storedToken || !storedUser) {
        localStorage.removeItem("user");
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
        setUser(null);
        setAuthChecked(true);
        return;
      }

      // Otimisticamente usar o usuário do localStorage enquanto valida
      try {
        setUser(JSON.parse(storedUser));
      } catch (_) {
        // JSON inválido — limpar e reiniciar
        setUser(null);
        localStorage.removeItem("user");
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
        setAuthChecked(true);
        return;
      }

      // Validar token com o servidor (GET /auth/me)
      try {
        await refreshUser();
      } catch (err) {
        // Só invalida sessão em 401/403 — erros de rede ou 5xx não desconectam o usuário
        const status = err?.response?.status;
        if (status === 401 || status === 403) {
          setUser(null);
          localStorage.removeItem("user");
          localStorage.removeItem("token");
          localStorage.removeItem("refreshToken");
        }
        // Para 5xx ou falhas de rede, mantemos o usuário logado (otimista)
      } finally {
        setAuthChecked(true);
      }
    };

    validateSession();

    return () => window.removeEventListener("auth:logout", handleExternalLogout);
  }, []);

  const login = (data) => {
    const payload = data?.data || data;
    const nextUser = payload?.user || null;
    const accessToken = payload?.accessToken;
    const refreshToken = payload?.refreshToken;

    setUser(nextUser);
    if (nextUser) {
      localStorage.setItem("user", JSON.stringify(nextUser));
    }
    if (accessToken) {
      localStorage.setItem("token", accessToken);
    }
    if (refreshToken) {
      localStorage.setItem("refreshToken", refreshToken);
    }
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch (_) {
      // ignora falha de rede — sessão local sempre é limpa
    }
    setUser(null);
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    localStorage.removeItem("refreshToken");
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, authChecked, patchUser, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};