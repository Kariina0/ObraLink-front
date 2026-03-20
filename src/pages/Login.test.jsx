import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import Login from "./Login";
import api from "../services/api";

jest.mock("../services/api", () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
  },
}));

jest.mock("../services/authRecoveryService", () => ({
  requestPasswordReset: jest.fn(),
  resetPasswordWithCode: jest.fn(),
}));

function renderLogin(loginMock = jest.fn()) {
  return {
    loginMock,
    ...render(
      <AuthContext.Provider value={{ login: loginMock, user: null, authChecked: true }}>
        <MemoryRouter initialEntries={["/login"]}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<div>Página inicial</div>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    ),
  };
}

describe("Login", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("envia credenciais e navega para a pagina inicial em caso de sucesso", async () => {
    const { loginMock } = renderLogin();
    const resposta = {
      data: {
        user: { id: 1, nome: "Karina", perfil: "admin" },
        accessToken: "token-valido",
        refreshToken: "refresh-valido",
      },
    };

    api.post.mockResolvedValueOnce(resposta);

    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "karina@obralink.com" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "SenhaForte123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar no Sistema" }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/auth/login", {
        email: "karina@obralink.com",
        senha: "SenhaForte123",
      });
    });

    expect(loginMock).toHaveBeenCalledWith(resposta.data);
    expect(await screen.findByText("Página inicial")).toBeInTheDocument();
  });

  test("redireciona para a página inicial quando já existe sessão ativa", async () => {
    render(
      <AuthContext.Provider value={{ login: jest.fn(), user: { id: 1, nome: "Karina", perfil: "admin" }, authChecked: true }}>
        <MemoryRouter initialEntries={["/login"]}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<div>Página inicial</div>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    );

    expect(await screen.findByText("Página inicial")).toBeInTheDocument();
  });

  test("mostra mensagem de erro quando a autenticacao falha", async () => {
    renderLogin();

    api.post.mockRejectedValueOnce({
      response: {
        data: {
          message: "Credenciais inválidas.",
        },
      },
    });

    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "karina@obralink.com" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "senha-errada" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar no Sistema" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Credenciais inválidas.");
  });
});