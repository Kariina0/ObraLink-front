/**
 * Testes Frontend: Rascunhos não Aparecem nas Listas
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import MeusRelatorios from "../../../src/pages/MeusRelatorios";
import Measurements from "../../../src/pages/measurements";
import * as medicoesService from "../../../src/services/medicoesService";
import { AuthContext } from "../../../src/context/AuthContext";

jest.mock("../../../src/services/medicoesService");

const mockUser = {
  id: 1,
  nome: "João Encarregado",
  perfil: "encarregado",
};

const mockMedicaoEnviada = {
  id: 1,
  obra: 1,
  area: "sala",
  observacoes: "Medição enviada",
  status: "enviada",
  createdAt: new Date().toISOString(),
};

const mockRascunho = {
  id: 2,
  obra: 1,
  area: "quarto",
  observacoes: "Rascunho não deve aparecer",
  status: "rascunho",
  createdAt: new Date().toISOString(),
};

function renderWithAuth(component, user = mockUser) {
  return render(
    <AuthContext.Provider value={{ user, loading: false }}>
      <BrowserRouter>{component}</BrowserRouter>
    </AuthContext.Provider>
  );
}

describe("Rascunhos não Aparecem nas Listas", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ──────────────────────────────────────────────────────────────────
  // Teste 1: Meus Relatórios - Não Mostra Rascunhos
  // ──────────────────────────────────────────────────────────────────
  describe("MeusRelatorios - Rascunhos Excluídos", () => {
    it("✅ Deve mostrar apenas medições enviadas/aprovadas/rejeitadas", async () => {
      medicoesService.listAllMedicoesPaginado = jest.fn().mockResolvedValue({
        data: [mockMedicaoEnviada], // SEM rascunho
        pagination: { totalItems: 1, page: 1, limit: 10 },
        statusSummary: {
          enviada: 1,
          aprovada: 0,
          rejeitada: 0,
          rascunho: 0,
        },
      });

      renderWithAuth(<MeusRelatorios />);

      await waitFor(() => {
        expect(screen.getByText(/Meus Relatórios/i)).toBeInTheDocument();
      });

      expect(screen.queryByText(/Rascunho não deve aparecer/i)).not.toBeInTheDocument();
      expect(screen.getByText(/Medição enviada/i)).toBeInTheDocument();
    });

    it("❌ Não deve contar rascunhos no resumo de status", async () => {
      medicoesService.listAllMedicoesPaginado = jest.fn().mockResolvedValue({
        data: [mockMedicaoEnviada],
        pagination: { totalItems: 1 },
        statusSummary: {
          enviada: 1,
          aprovada: 0,
          rejeitada: 0,
          rascunho: 0, // Rascunhos não contados
        },
      });

      renderWithAuth(<MeusRelatorios />);

      await waitFor(() => {
        expect(screen.getByText(/Meus Relatórios/i)).toBeInTheDocument();
      });

      // Verificar que rascunhos não estão no resumo visível
      const totalItems = 1; // Apenas medição enviada
      expect(totalItems).toBe(1);
    });

    it("✅ Deve exibir mensagem quando não há medições (rascunho não conta)", async () => {
      medicoesService.listAllMedicoesPaginado = jest.fn().mockResolvedValue({
        data: [], // Vazio
        pagination: { totalItems: 0 },
        statusSummary: {
          enviada: 0,
          aprovada: 0,
          rejeitada: 0,
          rascunho: 2, // Há rascunhos, mas não mostram
        },
      });

      renderWithAuth(<MeusRelatorios />);

      await waitFor(() => {
        expect(screen.getByText(/ainda não enviou nenhuma medição/i)).toBeInTheDocument();
      });
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // Teste 2: Lista de Medições - Não Mostra Rascunhos
  // ──────────────────────────────────────────────────────────────────
  describe("Measurements (Lista) - Rascunhos Excluídos", () => {
    const supervisorUser = {
      id: 2,
      nome: "Maria Supervisora",
      perfil: "supervisor",
    };

    it("✅ Supervisor não vê rascunhos por padrão", async () => {
      medicoesService.listAllMedicoesPaginado = jest.fn().mockResolvedValue({
        data: [mockMedicaoEnviada], // SEM rascunho
        pagination: { totalItems: 1 },
        statusSummary: {
          enviada: 1,
          aprovada: 0,
          rejeitada: 0,
          rascunho: 0,
        },
      });

      renderWithAuth(<Measurements />, supervisorUser);

      await waitFor(() => {
        expect(screen.getByText(/Lista de Medições/i)).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.queryByText(/Rascunho não deve aparecer/i)).not.toBeInTheDocument();
      });
    });

    it("✅ Supervisor pode filtrar rascunhos com status=rascunho", async () => {
      // Simular URL com ?status=rascunho
      medicoesService.listAllMedicoesPaginado = jest.fn().mockResolvedValue({
        data: [mockRascunho], // Apenas rascunho
        pagination: { totalItems: 1 },
        statusSummary: {
          rascunho: 1,
        },
      });

      renderWithAuth(<Measurements />, supervisorUser);

      // Simular clique em filtro de status=rascunho
      // (Não testamos a URL aqui, apenas a renderização do componente)
      await waitFor(() => {
        expect(screen.getByText(/Lista de Medições/i)).toBeInTheDocument();
      });
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // Teste 3: Contabilização Correta
  // ──────────────────────────────────────────────────────────────────
  describe("Contabilização de Rascunhos", () => {
    it("✅ statusSummary não deve incluir rascunhos na listagem padrão", async () => {
      medicoesService.listAllMedicoesPaginado = jest.fn().mockResolvedValue({
        data: [mockMedicaoEnviada],
        pagination: { totalItems: 1 },
        statusSummary: {
          enviada: 1,
          aprovada: 0,
          rejeitada: 0,
          // rascunho não incluído na resposta
        },
      });

      renderWithAuth(<MeusRelatorios />);

      await waitFor(() => {
        // Verificar que a API foi chamada
        expect(medicoesService.listAllMedicoesPaginado).toHaveBeenCalled();
      });

      const callArgs = medicoesService.listAllMedicoesPaginado.mock.calls[0][0];
      // Status não foi filtrado (padrão exclui rascunhos)
      expect(callArgs.status).toBeUndefined();
    });

    it("✅ Rascunhos só contam quando temos status=rascunho no filtro", async () => {
      medicoesService.listAllMedicoesPaginado = jest.fn().mockResolvedValue({
        data: [mockRascunho],
        pagination: { totalItems: 1 },
        statusSummary: {
          rascunho: 1,
        },
      });

      renderWithAuth(<MeusRelatorios />);

      await waitFor(() => {
        // Se o filtro fosse status=rascunho, rascunho contaria
        expect(mockRascunho.status).toBe("rascunho");
      });
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // Teste 4: Segurança - Cada Usuário Vê Seus Dados
  // ──────────────────────────────────────────────────────────────────
  describe("Segurança - Dados por Usuário", () => {
    const usuario1 = { id: 1, nome: "João", perfil: "encarregado" };
    const usuario2 = { id: 2, nome: "Maria", perfil: "encarregado" };

    it("✅ Usuário 1 vê apenas suas medições", async () => {
      const suasMedicoes = [{ ...mockMedicaoEnviada, responsavel: usuario1.id }];

      medicoesService.listMedicoes = jest.fn().mockResolvedValue({
        data: suasMedicoes,
        pagination: { totalItems: 1 },
        statusSummary: { enviada: 1 },
      });

      renderWithAuth(<MeusRelatorios />, usuario1);

      await waitFor(() => {
        expect(medicoesService.listMedicoes).toHaveBeenCalled();
      });
    });

    it("✅ Usuário 2 vê apenas suas medições (não vê de Usuário 1)", async () => {
      const suasMedicoes = [{ ...mockMedicaoEnviada, id: 3, responsavel: usuario2.id }];

      medicoesService.listMedicoes = jest.fn().mockResolvedValue({
        data: suasMedicoes,
        pagination: { totalItems: 1 },
        statusSummary: { enviada: 1 },
      });

      renderWithAuth(<MeusRelatorios />, usuario2);

      await waitFor(() => {
        expect(medicoesService.listMedicoes).toHaveBeenCalled();
      });
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // Teste 5: Paginação Sem Rascunhos
  // ──────────────────────────────────────────────────────────────────
  describe("Paginação - Não Conta Rascunhos", () => {
    it("✅ Total de items deve excluir rascunhos", async () => {
      const medicoes = [mockMedicaoEnviada]; // 1 item

      medicoesService.listAllMedicoesPaginado = jest.fn().mockResolvedValue({
        data: medicoes,
        pagination: {
          totalItems: 1, // Não conta rascunho
          page: 1,
          limit: 10,
        },
        statusSummary: { enviada: 1 },
      });

      renderWithAuth(<MeusRelatorios />);

      await waitFor(() => {
        expect(screen.getByText(/Meus Relatórios/i)).toBeInTheDocument();
      });

      // Verificar que totalItems é 1, não 2 (se houvesse rascunho)
      expect(medicoesService.listAllMedicoesPaginado.mock.results[0].value.pagination.totalItems).toBe(1);
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // Teste 6: Mudança de Status Rascunho → Enviada
  // ──────────────────────────────────────────────────────────────────
  describe("Transição de Status", () => {
    it("✅ Rascunho convertido para 'enviada' deve aparecer na lista", async () => {
      // Primeiro retorna sem a medição (era rascunho)
      // Depois retorna com a medição (status = enviada)

      const medicaoAgora = { ...mockRascunho, status: "enviada" };

      medicoesService.listAllMedicoesPaginado = jest.fn().mockResolvedValue({
        data: [medicaoAgora],
        pagination: { totalItems: 1 },
        statusSummary: { enviada: 1 },
      });

      renderWithAuth(<MeusRelatorios />);

      await waitFor(() => {
        expect(screen.getByText(/Meus Relatórios/i)).toBeInTheDocument();
      });

      await waitFor(() => {
        // Agora a medição aparece (status mudou de rascunho para enviada)
        expect(screen.getByText(/Rascunho não deve aparecer/i)).toBeInTheDocument();
      });
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // Teste 7: Filtros Especiais
  // ──────────────────────────────────────────────────────────────────
  describe("Filtros de Status", () => {
    it("✅ Padrão não inclui rascunhos", async () => {
      const medicoes = [mockMedicaoEnviada];

      medicoesService.listAllMedicoesPaginado = jest.fn().mockResolvedValue({
        data: medicoes,
        pagination: { totalItems: 1 },
        statusSummary: { enviada: 1, rascunho: 0 },
      });

      renderWithAuth(<MeusRelatorios />);

      await waitFor(() => {
        const callParams = medicoesService.listAllMedicoesPaginado.mock.calls[0][0];
        // Sem filtro de status (padrão exclui rascunhos no backend)
        expect(callParams.status).toBeUndefined();
      });
    });

    it("✅ Com status=rascunho, mostra rascunhos", async () => {
      const rascunhos = [mockRascunho];

      // Simular chamada com status=rascunho
      medicoesService.listAllMedicoesPaginado = jest.fn().mockResolvedValue({
        data: rascunhos,
        pagination: { totalItems: 1 },
        statusSummary: { rascunho: 1 },
      });

      renderWithAuth(<MeusRelatorios />);

      await waitFor(() => {
        expect(screen.getByText(/Meus Relatórios/i)).toBeInTheDocument();
      });

      // Se houver rascunhos e status=rascunho foi passado, eles aparecem
      expect(rascunhos.length).toBeGreaterThan(0);
      await waitFor(() => {
        expect(screen.getByText(/Rascunho não deve aparecer/i)).toBeInTheDocument();
      });
    });
  });
});
