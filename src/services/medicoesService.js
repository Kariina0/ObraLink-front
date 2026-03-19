import api from "./api";
import { extractApiData } from "./response";

export async function createMedicao(payload) {
  const obraId = payload?.obra;

  if (!obraId) {
    throw new Error("Obra não selecionada. Selecione uma obra antes de enviar a medição.");
  }

  const obraNumero = Number(obraId);
  if (!Number.isInteger(obraNumero) || obraNumero <= 0) {
    throw new Error("Obra inválida. Selecione uma obra válida antes de enviar a medição.");
  }

  // Dimensões brutas — preservadas individualmente no banco
  const comprimento = payload?.comprimento != null ? Number(payload.comprimento) : null;
  const largura     = payload?.largura != null ? Number(payload.largura) : null;
  const altura      = payload?.altura != null ? Number(payload.altura) : null;
  const quantidadeDireta = payload?.quantidadeDireta != null ? Number(payload.quantidadeDireta) : null;
  const unidadeMedicao = payload?.unidadeMedicao || "m²";

  // Valores geométricos calculados (podem vir pré-calculados do componente ou calculados aqui)
  const areaCalculada = (comprimento && largura) ? comprimento * largura : (payload?.areaCalculada != null ? Number(payload.areaCalculada) : 0);
  const volume        = (comprimento && largura && altura) ? comprimento * largura * altura : (payload?.volume != null ? Number(payload.volume) : 0);
  // Determina quantidade baseado no modo de medição
  const quantidadeItem = quantidadeDireta != null ? quantidadeDireta : (volume > 0 ? volume : (areaCalculada > 0 ? areaCalculada : comprimento || 0));

  // Nome do ambiente (quarto, sala, etc.) — campo "area" da entidade Medição no back-end
  const areaNome   = payload?.area        || null;
  const tipoServico = payload?.tipoServico || null;

  const descricaoItem = areaNome
    ? `Medição geométrica — ${areaNome}`
    : "Medição geométrica";

  const body = {
    obra:         obraNumero,
    data:         payload?.data || new Date().toISOString(),
    area:         areaNome,
    tipoServico,
    observacoes:  payload?.observacoes || "",
    status:       payload?.status || "enviada",
    // Dimensões brutas — agora persistidas como colunas dedicadas no banco
    comprimento,
    largura,
    altura,
    areaCalculada: areaCalculada > 0 ? areaCalculada : null,
    volume:        volume > 0 ? volume : null,
    itens: [
      {
        descricao:    descricaoItem,
        quantidade:   quantidadeItem,
        unidade:      unidadeMedicao,
        // volume é informação geométrica, não financeira — valorUnitario não se aplica
        valorUnitario: null,
        valorTotal:    quantidadeItem,
        observacoes:   payload?.observacoes || "",
        local:         areaNome || "",
      },
    ],
  };

  if (Array.isArray(payload?.anexos)) {
    const anexoIds = payload.anexos
      .map((item) => Number(item))
      .filter((item) => Number.isInteger(item) && item > 0);

    if (anexoIds.length > 0) {
      body.anexos = anexoIds;
    }
  }

  const response = await api.post("/measurements", body);
  return extractApiData(response.data);
}

export async function listMedicoes(params = {}) {
  // Suporta filtros: page, limit, obra, status, tipoServico, area, dataInicio, dataFim
  // O back-end filtra as medições do próprio usuário logado.
  const response = await api.get("/measurements/minhas", { params });
  return extractApiData(response.data);
}

/**
 * Versão paginada de listMedicoes — retorna { data: [], pagination: {} }
 * para que os componentes possam exibir controles de navegação de página.
 * A API retorna paginação dentro de `meta` (via successResponse).
 */
export async function listMedicoesPaginado(params = {}) {
  const response = await api.get("/measurements/minhas", { params });
  const payload = response.data;
  return {
    data:         payload?.data  ?? [],
    pagination:   payload?.meta  ?? null,
    statusSummary: payload?.meta?.statusSummary ?? null,
  };
}

export async function listAllMedicoes(params = {}) {
  // Endpoint exclusivo para supervisores/admins — retorna todas as medições.
  // Suporta filtros: page, limit, obra, status, responsavel, dataInicio, dataFim, area, tipoServico
  const response = await api.get("/measurements", { params });
  return extractApiData(response.data);
}

/**
 * Versão paginada de listAllMedicoes — retorna { data: [], pagination: {} }
 * A API retorna paginação dentro de `meta` (via successResponse).
 */
export async function listAllMedicoesPaginado(params = {}) {
  const response = await api.get("/measurements", { params });
  const payload = response.data;
  return {
    data:         payload?.data  ?? [],
    pagination:   payload?.meta  ?? null,
    statusSummary: payload?.meta?.statusSummary ?? null,
  };
}

export async function aprovarMedicao(id) {
  const response = await api.post(`/measurements/${id}/aprovar`);
  return extractApiData(response.data);
}

export async function rejeitarMedicao(id, motivoRejeicao = "") {
  const response = await api.post(`/measurements/${id}/rejeitar`, {
    motivoRejeicao,
  });
  return extractApiData(response.data);
}

export async function getMedicaoById(id) {
  const response = await api.get(`/measurements/${id}`);
  return extractApiData(response.data);
}

export async function updateMedicao(id, payload) {
  const comprimento = payload?.comprimento != null ? Number(payload.comprimento) : null;
  const largura     = payload?.largura != null ? Number(payload.largura) : null;
  const altura      = payload?.altura != null ? Number(payload.altura) : null;
  const quantidadeDireta = payload?.quantidadeDireta != null ? Number(payload.quantidadeDireta) : null;
  const unidadeMedicao = payload?.unidadeMedicao || "m²";

  const areaCalculada = (comprimento && largura) ? comprimento * largura : (payload?.areaCalculada != null ? Number(payload.areaCalculada) : 0);
  const volume        = (comprimento && largura && altura) ? comprimento * largura * altura : (payload?.volume != null ? Number(payload.volume) : 0);
  // Determina quantidade baseado no modo de medição
  const quantidadeItem = quantidadeDireta != null ? quantidadeDireta : (volume > 0 ? volume : (areaCalculada > 0 ? areaCalculada : comprimento || 0));

  const areaNome    = payload?.area        || null;
  const tipoServico = payload?.tipoServico || null;

  const body = {
    data:         payload?.data,
    area:         areaNome,
    tipoServico,
    observacoes:  payload?.observacoes || "",
    status:       payload?.status || "enviada",
    comprimento,
    largura,
    altura,
    areaCalculada: areaCalculada > 0 ? areaCalculada : null,
    volume:        volume > 0 ? volume : null,
    itens: [
      {
        descricao:     areaNome ? `Medição geométrica — ${areaNome}` : "Medição geométrica",
        quantidade:    quantidadeItem,
        unidade:       unidadeMedicao,
        valorUnitario: null,
        valorTotal:    quantidadeItem,
        observacoes:   payload?.observacoes || "",
        local:         areaNome || "",
      },
    ],
  };

  if (!body.data) {
    delete body.data;
  }

  if (Array.isArray(payload?.anexos)) {
    const anexoIds = payload.anexos
      .map((item) => Number(item))
      .filter((item) => Number.isInteger(item) && item > 0);
    if (anexoIds.length > 0) body.anexos = anexoIds;
  }

  const response = await api.put(`/measurements/${id}`, body);
  return extractApiData(response.data);
}

/**
 * Salva uma nova medição como rascunho.
 * Equivale a createMedicao com status forçado para "rascunho".
 */
export async function saveDraftMedicao(payload) {
  return createMedicao({ ...payload, status: "rascunho" });
}

/**
 * Lista os rascunhos do usuário autenticado.
 * Retorna apenas os rascunhos do próprio usuário (garantido pelo backend).
 */
export async function listDrafts(params = {}) {
  const response = await api.get("/measurements/rascunhos", { params });
  return extractApiData(response.data);
}

/**
 * Versão paginada de listDrafts — retorna { data: [], pagination: {} }.
 */
export async function listDraftsPaginado(params = {}) {
  const response = await api.get("/measurements/rascunhos", { params });
  const payload = response.data;
  return {
    data:       payload?.data ?? [],
    pagination: payload?.meta ?? null,
  };
}

/**
 * Converte um rascunho existente para status "enviada".
 * Use quando o usuário envia definitivamente a partir da lista de rascunhos.
 */
export async function submitDraft(draftId) {
  const response = await api.put(`/measurements/${draftId}`, { status: "enviada" });
  return extractApiData(response.data);
}

/**
 * Exclui um rascunho (soft delete). Só funciona para o dono do rascunho.
 */
export async function deleteMedicao(id) {
  const response = await api.delete(`/measurements/${id}`);
  return extractApiData(response.data);
}
