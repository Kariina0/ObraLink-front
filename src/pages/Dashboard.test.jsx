import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import Dashboard from "./Dashboard";

jest.mock("../components/Layout", () => ({
  __esModule: true,
  default: ({ children }) => <div data-testid="layout-mock">{children}</div>,
}));

jest.mock("../components/Icons", () => ({
  __esModule: true,
  default: ({ name }) => <span data-testid={`icon-${name}`}>{name}</span>,
}));

function renderDashboard(user, patchUser = jest.fn()) {
  return render(
    <AuthContext.Provider value={{ user, patchUser }}>
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe("Dashboard", () => {
  test("exibe atalhos administrativos para perfil admin e permite limpar notificacoes", () => {
    const patchUser = jest.fn();

    renderDashboard(
      {
        id: 1,
        nome: "Karina Silva",
        perfil: "admin",
        notificacoesPendentes: 3,
      },
      patchUser,
    );

    expect(screen.getByText("Olá, Karina!")).toBeInTheDocument();
    expect(screen.getByText("Painel Administrativo")).toBeInTheDocument();
    expect(screen.getByText("Cadastrar Funcionário")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Marcar como lidas" }));
    expect(patchUser).toHaveBeenCalledWith({ notificacoesPendentes: 0 });
  });

  test("omite atalhos administrativos para perfil encarregado", () => {
    renderDashboard({
      id: 2,
      nome: "João Souza",
      perfil: "encarregado",
      notificacoesPendentes: 0,
    });

    expect(screen.getByText("Nova Medição")).toBeInTheDocument();
    expect(screen.getByText("Lista de Medições")).toBeInTheDocument();
    expect(screen.queryByText("Painel Administrativo")).not.toBeInTheDocument();
    expect(screen.queryByText("Cadastrar Funcionário")).not.toBeInTheDocument();
  });
});