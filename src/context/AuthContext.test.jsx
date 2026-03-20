import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useContext } from "react";
import { AuthContext, AuthProvider } from "./AuthContext";
import api from "../services/api";

jest.mock("../services/api", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

function AuthProbe() {
  const { user, authChecked, login, logout } = useContext(AuthContext);

  return (
    <div>
      <span data-testid="auth-checked">{String(authChecked)}</span>
      <span data-testid="user-name">{user?.nome || ""}</span>
      <button
        type="button"
        onClick={() => login({
          user: { id: 1, nome: "Karina", perfil: "admin" },
          accessToken: "token-valido",
          refreshToken: "refresh-valido",
        })}
      >
        login
      </button>
      <button type="button" onClick={() => logout()}>
        logout
      </button>
    </div>
  );
}

describe("AuthContext", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  test("salva user, token e refresh token no login", () => {
    api.get.mockResolvedValue({ data: { data: null } });

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    fireEvent.click(screen.getByText("login"));

    expect(localStorage.getItem("token")).toBe("token-valido");
    expect(localStorage.getItem("refreshToken")).toBe("refresh-valido");
    expect(JSON.parse(localStorage.getItem("user"))).toMatchObject({
      nome: "Karina",
      perfil: "admin",
    });
  });

  test("restaura sessao ao recarregar e chama /auth/me", async () => {
    localStorage.setItem("token", "token-antigo");
    localStorage.setItem("refreshToken", "refresh-antigo");
    localStorage.setItem("user", JSON.stringify({ id: 7, nome: "Usuário Local", perfil: "encarregado" }));

    api.get.mockResolvedValueOnce({
      data: {
        data: { id: 7, nome: "Usuário API", perfil: "encarregado" },
      },
    });

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith("/auth/me");
    });

    expect(await screen.findByTestId("auth-checked")).toHaveTextContent("true");
    expect(screen.getByTestId("user-name")).toHaveTextContent("Usuário API");
    expect(JSON.parse(localStorage.getItem("user"))).toMatchObject({ nome: "Usuário API" });
  });

  test("limpa sessao quando user salvo no storage esta corrompido", async () => {
    localStorage.setItem("token", "token-antigo");
    localStorage.setItem("refreshToken", "refresh-antigo");
    localStorage.setItem("user", "{json invalido");

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("auth-checked")).toHaveTextContent("true");
    });

    expect(localStorage.getItem("user")).toBeNull();
    expect(localStorage.getItem("token")).toBeNull();
    expect(localStorage.getItem("refreshToken")).toBeNull();
    expect(api.get).not.toHaveBeenCalled();
  });

  test("limpa sessao parcial quando existe token sem user salvo", async () => {
    localStorage.setItem("token", "token-antigo");
    localStorage.setItem("refreshToken", "refresh-antigo");

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("auth-checked")).toHaveTextContent("true");
    });

    expect(screen.getByTestId("user-name")).toHaveTextContent("");
    expect(localStorage.getItem("user")).toBeNull();
    expect(localStorage.getItem("token")).toBeNull();
    expect(localStorage.getItem("refreshToken")).toBeNull();
    expect(api.get).not.toHaveBeenCalled();
  });

  test("remove dados no logout mesmo se /auth/logout falhar", async () => {
    localStorage.setItem("token", "token-antigo");
    localStorage.setItem("refreshToken", "refresh-antigo");
    localStorage.setItem("user", JSON.stringify({ id: 1, nome: "Karina", perfil: "admin" }));

    api.get.mockResolvedValueOnce({
      data: { data: { id: 1, nome: "Karina", perfil: "admin" } },
    });
    api.post.mockRejectedValueOnce(new Error("network down"));

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("user-name")).toHaveTextContent("Karina");
    });

    await act(async () => {
      fireEvent.click(screen.getByText("logout"));
    });

    expect(localStorage.getItem("user")).toBeNull();
    expect(localStorage.getItem("token")).toBeNull();
    expect(localStorage.getItem("refreshToken")).toBeNull();
  });
});