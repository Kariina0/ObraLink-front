// src/components/PrivateRoute.jsx
import { Navigate } from "react-router-dom";
import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import { canAccessRoute } from "../constants/permissions";

const PrivateRoute = ({ children, routePath }) => {
  const { user, authChecked } = useContext(AuthContext);

  // Aguarda a verificação de token com o servidor antes de redirecionar.
  // Evita flash de redirect para /login quando o token ainda está sendo validado.
  if (!authChecked) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <p style={{ color: "var(--cor-texto-secundario, #6c757d)", fontSize: "1rem" }}>Verificando sessão...</p>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (routePath && !canAccessRoute(user?.perfil, routePath)) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default PrivateRoute;