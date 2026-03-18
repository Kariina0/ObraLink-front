import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import AdminPanel from "./AdminPanel";

jest.mock("../components/Layout", () => ({ children }) => <div>{children}</div>);

const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockNavigate,
}));

jest.mock("../hooks/useObras", () => () => ({
  obras: [
    { id: "obra-1", nome: "Obra Centro" },
    { id: "obra-2", nome: "Obra Sul" },
  ],
}));

const mockApiGet = jest.fn();
jest.mock("../services/api", () => ({
  __esModule: true,
  default: {
    get: (...args) => mockApiGet(...args),
  },
}));

const mockDownloadManagementCsv = jest.fn();
const mockDownloadMedicoesCsv = jest.fn();
const mockDownloadBoletimPdf = jest.fn();

jest.mock("../services/managementService", () => ({
  downloadManagementCsv: (...args) => mockDownloadManagementCsv(...args),
  downloadMedicoesCsv: (...args) => mockDownloadMedicoesCsv(...args),
  downloadBoletimPdf: (...args) => mockDownloadBoletimPdf(...args),
}));

describe("AdminPanel", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiGet.mockResolvedValue({
      data: {
        data: {
          totalObras: 2,
          totalMedicoes: 8,
          medicoesPendentes: 1,
          medicoesAprovadas: 7,
          totalSolicitacoes: 3,
          solicitacoesPendentes: 1,
          totalArquivos: 15,
        },
      },
    });
    mockDownloadManagementCsv.mockResolvedValue(undefined);
    mockDownloadMedicoesCsv.mockResolvedValue(undefined);
    mockDownloadBoletimPdf.mockResolvedValue(undefined);
  });

  it("aplica filtros selecionados e chama exportação gerencial", async () => {
    render(<AdminPanel />);

    await screen.findByText("Exportar Dados");

    fireEvent.change(screen.getByLabelText("Período (dias)"), { target: { value: "15" } });
    fireEvent.change(screen.getByLabelText("Obra"), { target: { value: "obra-2" } });
    fireEvent.change(screen.getByLabelText("Mês de referência"), { target: { value: "2026-02" } });

    fireEvent.click(screen.getByRole("button", { name: "Gerencial (CSV)" }));

    await waitFor(() => {
      expect(mockDownloadManagementCsv).toHaveBeenCalledWith({
        periodo: 15,
        obraId: "obra-2",
        mes: "2026-02",
      });
    });

    expect(
      await screen.findByText("Exportação de visão gerencial iniciada com sucesso."),
    ).toBeInTheDocument();
  });

  it("mostra erro de exportação quando serviço falha", async () => {
    mockDownloadMedicoesCsv.mockRejectedValueOnce(new Error("Falha no boletim"));

    render(<AdminPanel />);

    await screen.findByText("Exportar Dados");
    fireEvent.click(screen.getByRole("button", { name: "Boletim (CSV)" }));

    expect(await screen.findByText("Falha no boletim")).toBeInTheDocument();
  });

  it("navega em ações rápidas ao clicar no card", async () => {
    render(<AdminPanel />);

    await screen.findByText("Ações Rápidas");
    fireEvent.click(screen.getByRole("button", { name: /Gerenciar Obras/i }));

    expect(mockNavigate).toHaveBeenCalledWith("/obras");
  });
});
