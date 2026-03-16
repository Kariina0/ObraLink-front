import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import PrivateRoute from "./PrivateRoute";

function renderPrivateRoute(authValue, initialPath = "/admin") {
  return render(
    <AuthContext.Provider value={authValue}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/login" element={<div>Tela de login</div>} />
          <Route path="/" element={<div>Dashboard</div>} />
          <Route
            path="/admin"
            element={(
              <PrivateRoute routePath="/admin">
                <div>Área administrativa</div>
              </PrivateRoute>
            )}
          />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe("PrivateRoute", () => {
  test("exibe estado de validacao enquanto a sessao nao foi verificada", () => {
    renderPrivateRoute({ user: null, authChecked: false });

    expect(screen.getByText("Verificando sessão...")).toBeInTheDocument();
  });

  test("redireciona para login quando nao ha usuario autenticado", async () => {
    renderPrivateRoute({ user: null, authChecked: true });

    expect(await screen.findByText("Tela de login")).toBeInTheDocument();
  });

  test("redireciona para dashboard quando o perfil nao pode acessar a rota", async () => {
    renderPrivateRoute({
      user: { id: 1, nome: "Supervisor", perfil: "supervisor" },
      authChecked: true,
    });

    expect(await screen.findByText("Dashboard")).toBeInTheDocument();
  });

  test("renderiza o conteudo quando o usuario tem permissao", () => {
    renderPrivateRoute({
      user: { id: 1, nome: "Admin", perfil: "admin" },
      authChecked: true,
    });

    expect(screen.getByText("Área administrativa")).toBeInTheDocument();
  });
});