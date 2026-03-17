import api from "./api";
import { extractApiData } from "./response";

export async function createDiario(payload) {
  const response = await api.post("/diarios", payload);
  return extractApiData(response.data);
}

export async function listMeusDiarios(params = {}) {
  const response = await api.get("/diarios/minhas", { params });
  const raw = response.data;
  return {
    data: raw?.data ?? [],
    pagination: raw?.meta ?? raw?.pagination ?? null,
  };
}

export async function getDiario(id) {
  const response = await api.get(`/diarios/${id}`);
  return extractApiData(response.data);
}

export async function updateDiario(id, payload) {
  const response = await api.put(`/diarios/${id}`, payload);
  return extractApiData(response.data);
}

export async function deleteDiario(id) {
  const response = await api.delete(`/diarios/${id}`);
  return extractApiData(response.data);
}

/**
 * Verifica se já existe um diário para uma obra em uma data específica.
 * Retorna { exists: boolean, id: number|null }
 */
export async function checkDuplicataDiario(obraId, data) {
  const response = await api.get("/diarios/check", { params: { obra: obraId, data } });
  return extractApiData(response.data);
}

/**
 * Lista todos os diários — para supervisores/admin.
 * Suporta filtros: obra, dataInicio, dataFim, page, limit.
 */
export async function listTodosDiarios(params = {}) {
  const response = await api.get("/diarios", { params });
  const raw = response.data;
  return {
    data: raw?.data ?? [],
    pagination: raw?.meta ?? raw?.pagination ?? null,
  };
}
