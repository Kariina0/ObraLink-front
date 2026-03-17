import api from "./api";
import { extractApiData, extractApiList } from "./response";

// ─── Helpers de serialização ─────────────────────────────────────────────────

function tryParseJson(value) {
  if (!value || typeof value !== "string") return value;
  try { return JSON.parse(value); } catch (_) { return value; }
}

function formatEndereco(endereco) {
  if (!endereco) return null;
  const obj = tryParseJson(endereco);
  if (typeof obj === "string") return obj;
  const parts = [
    obj.logradouro,
    obj.numero ? `nº ${obj.numero}` : null,
    obj.bairro,
    obj.cidade && obj.estado
      ? `${obj.cidade}/${obj.estado}`
      : obj.cidade || obj.estado || null,
    obj.cep ? `CEP ${obj.cep}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

function parseObra(obra) {
  return {
    ...obra,
    endereco: formatEndereco(obra.endereco),
    orcamento: tryParseJson(obra.orcamento),
    equipe: tryParseJson(obra.equipe),
    metadata: tryParseJson(obra.metadata),
    encarregados: Array.isArray(obra.encarregados) ? obra.encarregados : [],
  };
}

// ─── Listagem de obras ────────────────────────────────────────────────────────

/**
 * Lista obras com filtros opcionais paginados.
 * Encarregado vê apenas as obras às quais está vinculado (filtrado pelo back-end).
 * @param {object} params - { page, limit, status, responsavel }
 */
export async function listObras(params = {}) {
  const response = await api.get("/obras", { params });
  const payload = extractApiData(response.data);

  let obras;
  if (Array.isArray(payload)) {
    obras = payload;
  } else if (Array.isArray(payload?.data)) {
    obras = payload.data;
  } else {
    obras = extractApiList(response.data);
  }

  return obras.map(parseObra);
}

/**
 * Obtém uma obra pelo ID.
 * @param {number} id - ID da obra
 */
export async function getObra(id) {
  const response = await api.get(`/obras/${id}`);
  return parseObra(extractApiData(response.data));
}

// ─── Cadastro e edição de obra (apenas admin) ────────────────────────────────

/**
 * Cria nova obra. Apenas administradores podem cadastrar obras.
 * @param {object} dados - Campos da obra (nome, codigo, cliente, endereco, etc.)
 * Campos aceitos:
 *  - nome (obrigatório)
 *  - codigo, cliente, endereco, coordenadas
 *  - dataInicio, dataPrevisaoTermino
 *  - status: planejamento | em_andamento | pausada | concluida | cancelada
 *  - descricao, observacoes
 *  - orcamento (object)
 *  - encarregados: array de userId ou { userId, funcao }
 */
export async function createObra(dados) {
  const response = await api.post("/obras", dados);
  return parseObra(extractApiData(response.data));
}

/**
 * Atualiza uma obra existente. Apenas administradores.
 * @param {number} id - ID da obra
 * @param {object} dados - Campos a atualizar
 */
export async function updateObra(id, dados) {
  const response = await api.put(`/obras/${id}`, dados);
  return parseObra(extractApiData(response.data));
}

/**
 * Remove uma obra (soft delete). Apenas administradores.
 * @param {number} id - ID da obra
 */
export async function deleteObra(id) {
  const response = await api.delete(`/obras/${id}`);
  return extractApiData(response.data);
}

// ─── Gestão de encarregados ──────────────────────────────────────────────────

/**
 * Vincula um encarregado à obra. Apenas administradores.
 * @param {number} obraId - ID da obra
 * @param {number} userId - ID do usuário a vincular
 * @param {string} [funcao] - Função do encarregado (opcional)
 */
export async function vincularEncarregado(obraId, userId, funcao = "encarregado") {
  const response = await api.post(`/obras/${obraId}/encarregados`, { userId, funcao });
  return parseObra(extractApiData(response.data));
}

/**
 * Remove vínculo de um encarregado com a obra. Apenas administradores.
 * @param {number} obraId - ID da obra
 * @param {number} userId - ID do usuário a desvincular
 */
export async function desvincularEncarregado(obraId, userId) {
  const response = await api.delete(`/obras/${obraId}/encarregados/${userId}`);
  return parseObra(extractApiData(response.data));
}

/**
 * Lista usuários disponíveis para vincular como encarregados à obra.
 * Retorna apenas usuários ativos ainda não vinculados.
 * @param {number} obraId - ID da obra
 */
export async function getEncarregadosDisponiveis(obraId) {
  const response = await api.get(`/obras/${obraId}/encarregados/disponiveis`);
  const data = extractApiData(response.data);
  return Array.isArray(data) ? data : [];
}
