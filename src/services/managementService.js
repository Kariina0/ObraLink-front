import api from "./api";

export async function getManagementOverview(periodo = 30) {
  const response = await api.get("/management/overview", { params: { periodo } });
  return response?.data?.data || { resumoGeral: {}, obras: [], alertas: [] };
}

function buildExportParams({ periodo, obraId, mes } = {}) {
  const params = {};

  if (periodo !== undefined && periodo !== null && periodo !== "") {
    params.periodo = Number(periodo);
  }

  if (obraId !== undefined && obraId !== null && obraId !== "") {
    params.obraId = obraId;
  }

  if (mes) {
    params.mes = mes;
  }

  return params;
}

function triggerBlobDownload(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export async function downloadManagementCsv({ periodo = 30, obraId, mes } = {}) {
  const response = await api.get("/management/exports/obras.csv", {
    params: buildExportParams({ periodo, obraId, mes }),
    responseType: "blob",
  });
  triggerBlobDownload(response.data, `painel-gerencial-obras-${new Date().toISOString().slice(0, 10)}.csv`);
}

export async function downloadMedicoesCsv({ obraId, mes } = {}) {
  const response = await api.get("/management/exports/medicoes.csv", {
    params: buildExportParams({ obraId, mes }),
    responseType: "blob",
  });
  triggerBlobDownload(response.data, `boletim-medicoes-${mes || "geral"}.csv`);
}

export async function downloadBoletimPdf({ obraId, mes } = {}) {
  const response = await api.get("/management/exports/boletim.pdf", {
    params: buildExportParams({ obraId, mes }),
    responseType: "blob",
    validateStatus: (status) => status < 500 || status === 501,
  });

  // Backend retorna 501 Not Implemented - tratar gracefully
  if (response.status === 501) {
    throw new Error("Exportação em PDF ainda não está disponível. Use a exportação CSV como alternativa.");
  }

  triggerBlobDownload(response.data, `boletim-medicoes-${mes || "geral"}.pdf`);
}
