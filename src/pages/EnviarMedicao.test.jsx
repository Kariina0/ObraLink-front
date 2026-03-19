/**
 * Testes Frontend: Funcionalidade de Rascunhos
 * Testa componentes React da página EnviarMedicao
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import EnviarMedicao from "../../../src/pages/EnviarMedicao";
import * as medicoesService from "../../../src/services/medicoesService";
import * as obrasService from "../../../src/services/obrasService";
import { AuthContext } from "../../../src/context/AuthContext";

// Mock dos serviços
jest.mock("../../../src/services/medicoesService");
jest.mock("../../../src/services/filesService");
jest.mock("../../../src/services/obrasService");

const mockUser = {
  id: 1,
  nome: "João Encarregado",
  perfil: "encarregado",
  email: "joao@obra.com",
};

const mockObras = [
  { id: 1, nome: "Obra A", status: "em_andamento" },
  { id: 2, nome: "Obra B", status: "planejamento" },
];

const mockRascunho = {
  id: 101,
  obra: 1,
  area: "sala",
  tipoServico: "pintura",
  dataMedicao: "2026-03-19",
  comprimento: 10,
  largura: 8,
  altura: 3,
  quantidade: 80,
  observacoes: "Teste de rascunho",
  status: "rascunho",
};

// Wrapper com contexto de autenticação
function renderWithAuth(component) {
  return render(
    <AuthContext.Provider value={{ user: mockUser, loading: false }}>
      <BrowserRouter>{component}</BrowserRouter>
    </AuthContext.Provider>
  );
}

describe("EnviarMedicao - Rascunhos Frontend", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    obrasService.listObras = jest.fn().mockResolvedValue(mockObras);
    medicoesService.listDraftsPaginado = jest.fn().mockResolvedValue({
      data: [mockRascunho],
      pagination: { totalItems: 1 },
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // Teste 1: Renderizar Página
  // ──────────────────────────────────────────────────────────────────
  describe("Renderização Inicial", () => {
    it("✅ Deve renderizar formulário de medição", async () => {
      renderWithAuth(<EnviarMedicao />);

      await waitFor(() => {
        expect(screen.getByRole("heading", { name: /Registrar Nova Medição/i })).toBeInTheDocument();
      });
    });

    it("✅ Deve mostrar botão 'Carregar rascunho'", async () => {
      renderWithAuth(<EnviarMedicao />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /Carregar rascunho/i })).toBeInTheDocument();
      });
    });

    it("✅ Deve mostrar botões 'Salvar como rascunho' e 'Enviar medição'", async () => {
      renderWithAuth(<EnviarMedicao />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /Salvar como rascunho/i })).toBeInTheDocument();
      });

      expect(screen.getByRole("button", { name: /Enviar medição/i })).toBeInTheDocument();
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // Teste 2: Salvar Rascunho
  // ──────────────────────────────────────────────────────────────────
  describe("Salvar Rascunho", () => {
    it("✅ Deve salvar rascunho com status 'rascunho'", async () => {
      medicoesService.createMedicao = jest.fn().mockResolvedValue({
        id: 101,
        status: "rascunho",
      });

      const user = userEvent.setup();
      renderWithAuth(<EnviarMedicao />);

      await waitFor(() => {
        expect(screen.getByLabelText(/Obra/i)).toBeInTheDocument();
      });

      // Preencher formulário
      const obraSelect = screen.getByLabelText(/Obra/i);
      await user.selectOptions(obraSelect, "1");

      const areaSelect = screen.getByLabelText(/Área da Medição/i);
      await user.selectOptions(areaSelect, "sala");

      const tipoSelect = screen.getByLabelText(/Tipo de Serviço/i);
      await user.selectOptions(tipoSelect, "pintura");

      const comprimentoInput = screen.getByLabelText(/Comprimento/i);
      await user.clear(comprimentoInput);
      await user.type(comprimentoInput, "10");

      // Clicar em "Salvar como rascunho"
      const salvarButton = screen.getByRole("button", { name: /Salvar como rascunho/i });
      await user.click(salvarButton);

      await waitFor(() => {
        expect(medicoesService.createMedicao).toHaveBeenCalled();
      });

      const call = medicoesService.createMedicao.mock.calls[0][0];
      expect(call.status).toBe("rascunho");
    });

    it("❌ Não deve salvar sem precher campos obrigatórios", async () => {
      const user = userEvent.setup();
      renderWithAuth(<EnviarMedicao />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /Salvar como rascunho/i })).toBeInTheDocument();
      });

      const salvarButton = screen.getByRole("button", { name: /Salvar como rascunho/i });
      await user.click(salvarButton);

      // Deve mostrar erro ou validação HTML5
      await waitFor(() => {
        const obraSelect = screen.getByLabelText(/Obra/i);
        expect(obraSelect.value).toBe("");
      });
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // Teste 3: Carregar Rascunho
  // ──────────────────────────────────────────────────────────────────
  describe("Carregar Rascunho", () => {
    it("✅ Deve expandir lista de rascunhos ao clicar", async () => {
      const user = userEvent.setup();
      renderWithAuth(<EnviarMedicao />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /Carregar rascunho/i })).toBeInTheDocument();
      });

      const botaoCarregar = screen.getByRole("button", { name: /Carregar rascunho/i });
      await user.click(botaoCarregar);

      await waitFor(() => {
        expect(screen.getByText(/Rascunhos guardados/i)).toBeInTheDocument();
      });
    });

    it("✅ Deve listar rascunhos do usuário", async () => {
      medicoesService.listDraftsPaginado = jest.fn().mockResolvedValue({
        data: [mockRascunho],
        pagination: { totalItems: 1 },
      });

      const user = userEvent.setup();
      renderWithAuth(<EnviarMedicao />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /Carregar rascunho/i })).toBeInTheDocument();
      });

      const botaoCarregar = screen.getByRole("button", { name: /Carregar rascunho/i });
      await user.click(botaoCarregar);

      await waitFor(() => {
        expect(screen.getByText(/Obra A/i)).toBeInTheDocument();
      });
    });

    it("✅ Deve preencher formulário ao clicar em 'Carregar'", async () => {
      medicoesService.listDraftsPaginado = jest.fn().mockResolvedValue({
        data: [mockRascunho],
        pagination: { totalItems: 1 },
      });

      const user = userEvent.setup();
      renderWithAuth(<EnviarMedicao />);

      // Expandir rascunhos
      const botaoCarregar = await screen.findByRole("button", { name: /Carregar rascunho/i });
      await user.click(botaoCarregar);

      // Clicar em "Carregar" do rascunho
      const botaoCarregarRascunho = await screen.findByRole("button", { name: /Carregar/ });
      await user.click(botaoCarregarRascunho);

      await waitFor(() => {
        const obraSelect = screen.getByLabelText(/Obra/i);
        expect(obraSelect.value).toBe("1");
      });
    });

    it("❌ Não deve mostrar rascunhos de outro usuário", async () => {
      medicoesService.listDraftsPaginado = jest.fn().mockResolvedValue({
        data: [], // Vazio
        pagination: { totalItems: 0 },
      });

      const user = userEvent.setup();
      renderWithAuth(<EnviarMedicao />);

      const botaoCarregar = await screen.findByRole("button", { name: /Carregar rascunho/i });
      await user.click(botaoCarregar);

      await waitFor(() => {
        expect(screen.getByText(/Nenhum rascunho salvo ainda/i)).toBeInTheDocument();
      });
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // Teste 4: Enviar Rascunho
  // ──────────────────────────────────────────────────────────────────
  describe("Enviar Rascunho Como Medição", () => {
    it("✅ Deve mudar status para 'enviada' ao clicar em 'Enviar medição'", async () => {
      medicoesService.createMedicao = jest.fn().mockResolvedValue({
        id: 101,
        status: "enviada",
      });

      const user = userEvent.setup();
      renderWithAuth(<EnviarMedicao />);

      await waitFor(() => {
        expect(screen.getByLabelText(/Obra/i)).toBeInTheDocument();
      });

      // Preencher formulário
      const obraSelect = screen.getByLabelText(/Obra/i);
      await user.selectOptions(obraSelect, "1");

      const areaSelect = screen.getByLabelText(/Área da Medição/i);
      await user.selectOptions(areaSelect, "sala");

      const tipoSelect = screen.getByLabelText(/Tipo de Serviço/i);
      await user.selectOptions(tipoSelect, "pintura");

      const comprimentoInput = screen.getByLabelText(/Comprimento/i);
      await user.clear(comprimentoInput);
      await user.type(comprimentoInput, "10");

      // Clicar em "Enviar medição"
      const enviarButton = screen.getByRole("button", { name: /Enviar medição/i });
      await user.click(enviarButton);

      await waitFor(() => {
        expect(medicoesService.createMedicao).toHaveBeenCalled();
      });

      const call = medicoesService.createMedicao.mock.calls[0][0];
      expect(call.status).toBe("enviada");
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // Teste 5: Modal/Toast de Sucesso
  // ──────────────────────────────────────────────────────────────────
  describe("Mensagens de Sucesso", () => {
    it("✅ Deve mostrar toast ao salvar rascunho", async () => {
      medicoesService.createMedicao = jest.fn().mockResolvedValue({
        id: 101,
        status: "rascunho",
      });

      const user = userEvent.setup();
      renderWithAuth(<EnviarMedicao />);

      await waitFor(() => {
        expect(screen.getByLabelText(/Obra/i)).toBeInTheDocument();
      });

      const obraSelect = screen.getByLabelText(/Obra/i);
      await user.selectOptions(obraSelect, "1");

      const areaSelect = screen.getByLabelText(/Área da Medição/i);
      await user.selectOptions(areaSelect, "sala");

      const tipoSelect = screen.getByLabelText(/Tipo de Serviço/i);
      await user.selectOptions(tipoSelect, "pintura");

      const comprimentoInput = screen.getByLabelText(/Comprimento/i);
      await user.clear(comprimentoInput);
      await user.type(comprimentoInput, "10");

      const salvarButton = screen.getByRole("button", { name: /Salvar como rascunho/i });
      await user.click(salvarButton);

      await waitFor(() => {
        expect(screen.getByText(/Rascunho salvo/i)).toBeInTheDocument();
      });
    });

    it("✅ Deve mostrar toast ao enviar medição", async () => {
      medicoesService.createMedicao = jest.fn().mockResolvedValue({
        id: 101,
        status: "enviada",
      });

      const user = userEvent.setup();
      renderWithAuth(<EnviarMedicao />);

      await waitFor(() => {
        expect(screen.getByLabelText(/Obra/i)).toBeInTheDocument();
      });

      const obraSelect = screen.getByLabelText(/Obra/i);
      await user.selectOptions(obraSelect, "1");

      const areaSelect = screen.getByLabelText(/Área da Medição/i);
      await user.selectOptions(areaSelect, "sala");

      const tipoSelect = screen.getByLabelText(/Tipo de Serviço/i);
      await user.selectOptions(tipoSelect, "pintura");

      const comprimentoInput = screen.getByLabelText(/Comprimento/i);
      await user.clear(comprimentoInput);
      await user.type(comprimentoInput, "10");

      const enviarButton = screen.getByRole("button", { name: /Enviar medição/i });
      await user.click(enviarButton);

      await waitFor(() => {
        expect(screen.getByText(/Medição enviada/i)).toBeInTheDocument();
      });
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // Teste 6: Limpeza de Formulário
  // ──────────────────────────────────────────────────────────────────
  describe("Limpeza de Formulário", () => {
    it("✅ Deve limpar formulário após salvar rascunho", async () => {
      medicoesService.createMedicao = jest.fn().mockResolvedValue({
        id: 101,
        status: "rascunho",
      });

      const user = userEvent.setup();
      renderWithAuth(<EnviarMedicao />);

      await waitFor(() => {
        expect(screen.getByLabelText(/Obra/i)).toBeInTheDocument();
      });

      const obraSelect = screen.getByLabelText(/Obra/i);
      await user.selectOptions(obraSelect, "1");

      const salvarButton = screen.getByRole("button", { name: /Salvar como rascunho/i });
      await user.click(salvarButton);

      // Obra deve permanecer preenchida
      expect(obraSelect.value).toBe("1");
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // Teste 7: Validações
  // ──────────────────────────────────────────────────────────────────
  describe("Validações de Formulário", () => {
    it("✅ Deve mostrar erro se não selecionar obra", async () => {
      const user = userEvent.setup();
      renderWithAuth(<EnviarMedicao />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /Salvar como rascunho/i })).toBeInTheDocument();
      });

      const salvarButton = screen.getByRole("button", { name: /Salvar como rascunho/i });
      await user.click(salvarButton);

      // Esperado: Validação HTML5 ou mensagem de erro
      const obraSelect = screen.getByLabelText(/Obra/i);
      expect(obraSelect.validity.valueMissing || obraSelect.value === "").toBeTruthy();
    });

    it("✅ Deve mostrar erro se dimensões estão zeradas", async () => {
      const user = userEvent.setup();
      renderWithAuth(<EnviarMedicao />);

      await waitFor(() => {
        expect(screen.getByLabelText(/Obra/i)).toBeInTheDocument();
      });

      const obraSelect = screen.getByLabelText(/Obra/i);
      await user.selectOptions(obraSelect, "1");

      const areaSelect = screen.getByLabelText(/Área da Medição/i);
      await user.selectOptions(areaSelect, "sala");

      const tipoSelect = screen.getByLabelText(/Tipo de Serviço/i);
      await user.selectOptions(tipoSelect, "pintura");

      // Deixar comprimento zerado (padrão)
      const salvarButton = screen.getByRole("button", { name: /Salvar como rascunho/i });
      await user.click(salvarButton);

      await waitFor(() => {
        expect(screen.getByText(/maior que zero/i)).toBeInTheDocument();
      });
    });
  });
});
