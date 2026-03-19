import { useContext, useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import {
  aprovarPurchase,
  listPurchases,
  rejeitarPurchase,
} from "../services/purchasesService";
import { SOLICITACAO_STATUS_LABELS } from "../constants";
import { extractApiMessage } from "../services/response";
import { AuthContext } from "../context/AuthContext";
import { isReviewer } from "../constants/permissions";
import { PAGE_LIMIT_SOLICITACOES } from "../constants/pagination";
import useObras from "../hooks/useObras";
import "../styles/pages.css";

const PRIORIDADE_LABELS = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  urgente: "Urgente",
};

const PENDENTE_STATUS = new Set(["pendente"]);
const REJEITADO_STATUS = new Set(["rejeitada", "rejeitado"]);

// Carrega todas as solicitações de uma vez (paginação é feita no cliente)
const LOAD_LIMIT = 200;

function PaginacaoControles({ displayPage, totalPages, loading, onChangePage }) {
  if (totalPages <= 1) return null;
  return (
    <div className="paginacao-controles">
      <button
        className="button-secondary"
        onClick={() => onChangePage(Math.max(1, displayPage - 1))}
        disabled={displayPage <= 1 || loading}
      >
        Anterior
      </button>
      <span className="paginacao-info">Página {displayPage} de {totalPages}</span>
      <button
        className="button-secondary"
        onClick={() => onChangePage(Math.min(totalPages, displayPage + 1))}
        disabled={displayPage >= totalPages || loading}
      >
        Próxima
      </button>
    </div>
  );
}

function StatusSolicitacao() {
  const { user } = useContext(AuthContext);
  const reviewer = isReviewer(user?.perfil);
  const { obras } = useObras(200);

  const [solicitacoes, setSolicitacoes] = useState([]);
  const [erro, setErro] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  const INITIAL_FILTERS = {
    status: "",
    prioridade: "",
    obra: "",
    responsavel: "",
    periodoInicio: "",
    periodoFim: "",
  };

  // Filtros de edição (formulário) e filtros aplicados (busca explícita)
  const [draftFilters, setDraftFilters] = useState(INITIAL_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(INITIAL_FILTERS);

  // Paginação client-side
  const DISPLAY_LIMIT = PAGE_LIMIT_SOLICITACOES;
  const [displayPage, setDisplayPage] = useState(1);

  // Estado do formulário de rejeição inline (uma por card)
  const [rejectTarget, setRejectTarget] = useState(null);
  const [motivoRejeicao, setMotivoRejeicao] = useState("");
  const [expandedCards, setExpandedCards] = useState({});

  const getRequestId = (s, idx) => String(s.id ?? s._id ?? idx);

  const normalizeStatus = (status) => String(status || "pendente").toLowerCase();

  const isPendingStatus  = (status) => PENDENTE_STATUS.has(normalizeStatus(status));
  const isRejectedStatus = (status) => REJEITADO_STATUS.has(normalizeStatus(status));

  const load = async () => {
    try {
      setLoading(true);
      setErro(null);
      const res = await listPurchases({ page: 1, limit: LOAD_LIMIT });
      const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
      setSolicitacoes(list);
    } catch (err) {
      setErro("Não foi possível carregar as solicitações.");
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  // Todos os cards iniciam recolhidos ao carregar a tela
  useEffect(() => {
    setExpandedCards((prev) => {
      const next = {};
      solicitacoes.forEach((s, idx) => {
        const requestId = getRequestId(s, idx);
        if (prev[requestId] !== undefined) {
          next[requestId] = prev[requestId];
          return;
        }
        next[requestId] = false;
      });
      return next;
    });
  }, [solicitacoes]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleApprove = async (id) => {
    try {
      setActionLoadingId(id);
      setErro(null);
      await aprovarPurchase(id);
      await load();
    } catch (error) {
      setErro(extractApiMessage(error, "Não foi possível aprovar a solicitação."));
    } finally {
      setActionLoadingId(null);
    }
  };

  const openRejectForm = (id) => {
    setRejectTarget(id);
    setMotivoRejeicao("");
  };

  const cancelReject = () => {
    setRejectTarget(null);
    setMotivoRejeicao("");
  };

  // No card fechado: expande o card E abre o formulário de rejeição
  const quickReject = (requestId) => {
    setExpandedCards((prev) => ({ ...prev, [requestId]: true }));
    openRejectForm(requestId);
  };

  const confirmReject = async (id) => {
    try {
      setActionLoadingId(id);
      setErro(null);
      await rejeitarPurchase(id, motivoRejeicao.trim());
      setRejectTarget(null);
      setMotivoRejeicao("");
      await load();
    } catch (error) {
      setErro(extractApiMessage(error, "Não foi possível rejeitar a solicitação."));
    } finally {
      setActionLoadingId(null);
    }
  };

  const getItems = (s) => {
    if (!s || typeof s !== 'object') {
      console.warn('getItems called with invalid solicitacao:', s);
      return [];
    }
    if (typeof s.itens === "string") {
      try {
        const parsed = JSON.parse(s.itens);
        if (Array.isArray(parsed)) return parsed;
      } catch (_) { /* continua */ }
    }
    if (Array.isArray(s.itens)) return s.itens;
    if (Array.isArray(s.items)) return s.items;
    if (Array.isArray(s.descricao)) return s.descricao;
    if (s.descricao) return [{ descricao: s.descricao }];
    return [];
  };

  const getObraLabel = (s) => {
    if (!s || typeof s !== 'object') return "Obra não informada";
    if (s.obraNome) return s.obraNome;
    if (s.nomeObra) return s.nomeObra;
    if (s.obra?.nome) return s.obra.nome;
    if (typeof s.obra === "string") return s.obra;
    if (typeof s.obra === "number") return `Obra #${s.obra}`;
    return "Obra não informada";
  };

  const getResponsavelLabel = (s) => {
    if (s.responsavelNome) return s.responsavelNome;
    if (s.solicitanteNome) return s.solicitanteNome;
    if (s.usuarioNome) return s.usuarioNome;
    if (s.responsavel?.nome) return s.responsavel.nome;
    if (s.usuario?.nome) return s.usuario.nome;
    if (s.solicitante?.nome) return s.solicitante.nome;
    if (s.criador?.nome) return s.criador.nome;
    if (s.user?.nome) return s.user.nome;
    return null;
  };

  const getJustificativa = (s) =>
    s.justificativa || s.observacao || s.observações || null;

  const getObraId = (s) => {
    if (s.obra?.id != null) return String(s.obra.id);
    if (s.obraId     != null) return String(s.obraId);
    if (typeof s.obra === "number") return String(s.obra);
    if (typeof s.obra === "string") return s.obra;
    return null;
  };

  const formatDate = (dateValue) => {
    if (!dateValue) return "Não informada";
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return "Não informada";
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const getPrioridadeLabel = (prioridade) => {
    const value = String(prioridade || "media").toLowerCase();
    return PRIORIDADE_LABELS[value] || prioridade || "Média";
  };

  const toggleCardExpansion = (requestId) => {
    setExpandedCards((prev) => ({
      ...prev,
      [requestId]: !prev[requestId],
    }));
  };

  const statusLabel = (s) =>
    SOLICITACAO_STATUS_LABELS[s.status] || s.status || "Pendente";

  const applyFilters = () => {
    setAppliedFilters({
      ...draftFilters,
      responsavel: draftFilters.responsavel.trim(),
    });
    setDisplayPage(1);
  };

  const clearFilters = () => {
    setDraftFilters(INITIAL_FILTERS);
    setAppliedFilters(INITIAL_FILTERS);
    setDisplayPage(1);
  };

  const hasDraftFilters = !!(
    draftFilters.status || draftFilters.prioridade || draftFilters.obra ||
    draftFilters.responsavel || draftFilters.periodoInicio || draftFilters.periodoFim
  );

  const hasAppliedFilters = !!(
    appliedFilters.status || appliedFilters.prioridade || appliedFilters.obra ||
    appliedFilters.responsavel || appliedFilters.periodoInicio || appliedFilters.periodoFim
  );

  // ── Filtragem e ordenação (client-side) ───────────────────────────────
  const filteredSolicitacoes = useMemo(() => solicitacoes.filter((s) => {
    const st = normalizeStatus(s.status);
    if (appliedFilters.status     && st !== appliedFilters.status) return false;
    if (appliedFilters.prioridade && String(s.prioridade || "media").toLowerCase() !== appliedFilters.prioridade) return false;
    if (appliedFilters.obra       && getObraId(s) !== appliedFilters.obra) return false;
    if (appliedFilters.responsavel) {
      const resp = (getResponsavelLabel(s) || "").toLowerCase();
      if (!resp.includes(appliedFilters.responsavel.toLowerCase())) return false;
    }
    if (appliedFilters.periodoInicio || appliedFilters.periodoFim) {
      const raw = s.dataSolicitacao || s.createdAt || s.updatedAt;
      const itemDate = raw ? new Date(raw) : null;
      if (itemDate && !isNaN(itemDate)) {
        if (appliedFilters.periodoInicio && itemDate < new Date(appliedFilters.periodoInicio)) return false;
        if (appliedFilters.periodoFim) {
          const fim = new Date(appliedFilters.periodoFim);
          fim.setHours(23, 59, 59, 999);
          if (itemDate > fim) return false;
        }
      }
    }
    return true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [solicitacoes, appliedFilters]);

  const sortedFiltered = useMemo(() => [...filteredSolicitacoes].sort((a, b) => {
    const da = new Date(a.dataSolicitacao || a.createdAt || 0);
    const db = new Date(b.dataSolicitacao || b.createdAt || 0);
    return db - da;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [filteredSolicitacoes]);

  const totalDisplayPages = Math.max(1, Math.ceil(sortedFiltered.length / DISPLAY_LIMIT));
  const pageItems = sortedFiltered.slice(
    (displayPage - 1) * DISPLAY_LIMIT,
    displayPage * DISPLAY_LIMIT,
  );

  const paginacaoProps = { displayPage, totalPages: totalDisplayPages, loading, onChangePage: setDisplayPage };

  return (
    <Layout>
      <div className="page-container" style={{ maxWidth: "1200px" }}>
        <h1 className="page-title">Solicitações de Materiais</h1>
        <p className="page-description">
          Acompanhe o andamento das solicitações de materiais.
          {reviewer && " Como supervisor, você pode aprovar ou reprovar solicitações que estão aguardando avaliação."}
        </p>

        <div
          className="form-container"
          style={{ marginBottom: "var(--espacamento-lg)", padding: "var(--espacamento-md)" }}
        >
          <p style={{ fontWeight: 700, marginBottom: "var(--espacamento-md)", color: "var(--cor-texto-principal)" }}>
            Filtros
          </p>
          <div className="ss-filters-grid">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="status-filter">Status</label>
              <select
                id="status-filter"
                value={draftFilters.status}
                onChange={(e) => setDraftFilters((prev) => ({ ...prev, status: e.target.value }))}
                aria-label="Filtrar por status"
              >
                <option value="">Todos os status</option>
                <option value="pendente">Pendente</option>
                <option value="aprovada">Aprovada</option>
                <option value="rejeitada">Rejeitada</option>
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="prioridade-filter">Prioridade</label>
              <select
                id="prioridade-filter"
                value={draftFilters.prioridade}
                onChange={(e) => setDraftFilters((prev) => ({ ...prev, prioridade: e.target.value }))}
                aria-label="Filtrar por prioridade"
              >
                <option value="">Todas as prioridades</option>
                <option value="urgente">Urgente</option>
                <option value="alta">Alta</option>
                <option value="media">Média</option>
                <option value="baixa">Baixa</option>
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="obra-filter">Obra</label>
              <select
                id="obra-filter"
                value={draftFilters.obra}
                onChange={(e) => setDraftFilters((prev) => ({ ...prev, obra: e.target.value }))}
                aria-label="Filtrar por obra"
              >
                <option value="">Todas as obras</option>
                {obras.map((o) => (
                  <option key={o.id} value={String(o.id)}>
                    {o.nome || o.name || `Obra #${o.id}`}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="responsavel-filter">Responsável</label>
              <input
                id="responsavel-filter"
                type="text"
                placeholder="Digite o nome"
                value={draftFilters.responsavel}
                onChange={(e) => setDraftFilters((prev) => ({ ...prev, responsavel: e.target.value }))}
                aria-label="Filtrar por responsável"
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="periodo-inicio-filter">Data início</label>
              <input
                id="periodo-inicio-filter"
                type="date"
                value={draftFilters.periodoInicio}
                onChange={(e) => setDraftFilters((prev) => ({ ...prev, periodoInicio: e.target.value }))}
                aria-label="Data inicial"
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="periodo-fim-filter">Data fim</label>
              <input
                id="periodo-fim-filter"
                type="date"
                value={draftFilters.periodoFim}
                onChange={(e) => setDraftFilters((prev) => ({ ...prev, periodoFim: e.target.value }))}
                aria-label="Data final"
              />
            </div>

            <div className="ss-filter-buttons">
              <button
                type="button"
                className="button-primary"
                onClick={applyFilters}
                style={{ width: "100%", padding: "15px 12px", marginTop: 0 }}
              >
                Pesquisar
              </button>
              <button
                type="button"
                className="button-secondary"
                onClick={clearFilters}
                disabled={!hasDraftFilters && !hasAppliedFilters}
                style={{ width: "100%", marginTop: 0, padding: "15px 12px" }}
              >
                Limpar filtros
              </button>
            </div>
          </div>
        </div>

        {erro && <p className="erro-msg">{erro}</p>}
        {loading && (
          <p style={{ textAlign: "center", padding: "var(--espacamento-xl)" }}>
            Carregando solicitações...
          </p>
        )}

        {!erro && !loading && sortedFiltered.length === 0 && (
          <div className="card" style={{ textAlign: "center", padding: "var(--espacamento-xl)" }}>
            <p>
              {hasAppliedFilters
                ? "Nenhuma solicitação encontrada para os filtros aplicados."
                : "Nenhuma solicitação encontrada."}
            </p>
          </div>
        )}

        {!loading && sortedFiltered.length > 0 && (
          <>
            <p className="ss-results-info">
              Exibindo {pageItems.length} de {sortedFiltered.length} {sortedFiltered.length === 1 ? "solicitação" : "solicitações"}
              {hasAppliedFilters ? " (filtros ativos)" : ""}.
            </p>

            <div className="status-solicitacao-list">
              {pageItems.map((s, idx) => {
                const originalIndex = solicitacoes.indexOf(s);
                const requestId      = getRequestId(s, originalIndex === -1 ? idx : originalIndex);
                const currentStatus  = normalizeStatus(s.status);
                const dataSolicitacao = formatDate(s.dataSolicitacao || s.createdAt || s.updatedAt);
                const isPending      = isPendingStatus(currentStatus);
                const isExpanded     = expandedCards[requestId] ?? false;
                const itens          = getItems(s);
                const loadingAction  = actionLoadingId === requestId;
                const justificativa  = getJustificativa(s);

                return (
                  <article key={requestId} className="card status-solicitacao-card-clean">
                    <div className="ss-card-header">
                      <div className="ss-card-main">
                        <div className="ss-card-title-row">
                          <strong className="ss-card-title">{getObraLabel(s)}</strong>
                          <span className={`ss-priority-badge ss-priority-badge--${String(s.prioridade || "media").toLowerCase()}`}>
                            Prioridade: {getPrioridadeLabel(s.prioridade)}
                          </span>
                        </div>
                        <p className="ss-card-meta-line">
                          <span>
                            <strong>Responsável:</strong>{" "}
                            {getResponsavelLabel(s) || "Responsável não informado"}
                          </span>
                          <span><strong>Data:</strong> {dataSolicitacao}</span>
                        </p>
                      </div>

                      <div className="ss-card-right">
                        <span className={`status-badge ss-status-badge ${currentStatus || "pendente"}`}>
                          {statusLabel(s)}
                        </span>
                        <button
                          type="button"
                          className="button-secondary ss-toggle-button"
                          onClick={() => toggleCardExpansion(requestId)}
                          aria-expanded={isExpanded}
                        >
                          {isExpanded ? "Ocultar detalhes" : "Ver detalhes"}
                        </button>
                      </div>
                    </div>

                    {!isExpanded && (
                      <p className="ss-card-summary">
                        {itens.length > 0
                          ? `${itens.length} ${itens.length === 1 ? "item solicitado" : "itens solicitados"}`
                          : "Sem itens cadastrados"}
                        {justificativa ? " · Com justificativa" : ""}
                      </p>
                    )}

                    {/* Ações rápidas no card fechado (apenas reviewer + pendente) */}
                    {!isExpanded && reviewer && isPending && rejectTarget !== requestId && (
                      <div className="ss-card-actions">
                        <button
                          className="button-success"
                          onClick={() => handleApprove(requestId)}
                          disabled={loadingAction}
                          title="Aprovar solicitação"
                        >
                          {loadingAction ? "..." : "Aprovar"}
                        </button>
                        <button
                          className="button-danger"
                          onClick={() => quickReject(requestId)}
                          disabled={loadingAction}
                          title="Rejeitar solicitação"
                        >
                          Rejeitar
                        </button>
                      </div>
                    )}

                    {/* Formulário de rejeição no card fechado */}
                    {!isExpanded && reviewer && rejectTarget === requestId && (
                      <div className="reject-form">
                        <label htmlFor={`motivo-quick-${requestId}`}>
                          Informe o motivo da rejeição (opcional):
                        </label>
                        <textarea
                          id={`motivo-quick-${requestId}`}
                          value={motivoRejeicao}
                          onChange={(e) => setMotivoRejeicao(e.target.value)}
                          placeholder="Ex: Material fora do orçamento aprovado..."
                          rows={3}
                        />
                        <div className="reject-form-buttons ss-card-actions">
                          <button
                            className="button-danger"
                            onClick={() => confirmReject(requestId)}
                            disabled={loadingAction}
                          >
                            {loadingAction ? "Rejeitando..." : "Confirmar Rejeição"}
                          </button>
                          <button
                            className="button-secondary"
                            onClick={cancelReject}
                            disabled={loadingAction}
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Conteúdo expandido */}
                    {isExpanded && (
                      <>
                        <div className="ss-card-section">
                          <p className="ss-card-section-title">Materiais solicitados</p>
                          {itens.length > 0 ? (
                            <ul className="ss-card-items-list">
                              {itens.map((item, i) => (
                                <li key={i}>{item.descricao || item.nome || item}</li>
                              ))}
                            </ul>
                          ) : (
                            <p className="ss-card-empty">Nenhum material informado.</p>
                          )}
                        </div>

                        {justificativa && (
                          <div className="ss-info-box">
                            <strong>Justificativa / observações</strong>
                            <p>{justificativa}</p>
                          </div>
                        )}

                        {isRejectedStatus(currentStatus) && s.motivoRejeicao && (
                          <div className="ss-info-box ss-info-box--danger">
                            <strong>Motivo da rejeição</strong>
                            <p>{s.motivoRejeicao}</p>
                          </div>
                        )}

                        {reviewer && isPending && rejectTarget !== requestId && (
                          <div className="ss-card-actions">
                            <button
                              className="button-success"
                              onClick={() => handleApprove(requestId)}
                              disabled={loadingAction}
                            >
                              {loadingAction ? "Processando..." : "Aprovar"}
                            </button>
                            <button
                              className="button-danger"
                              onClick={() => openRejectForm(requestId)}
                              disabled={loadingAction}
                            >
                              Rejeitar
                            </button>
                          </div>
                        )}

                        {reviewer && rejectTarget === requestId && (
                          <div className="reject-form">
                            <label htmlFor={`motivo-${requestId}`}>
                              Informe o motivo da rejeição (opcional):
                            </label>
                            <textarea
                              id={`motivo-${requestId}`}
                              value={motivoRejeicao}
                              onChange={(e) => setMotivoRejeicao(e.target.value)}
                              placeholder="Ex: Material fora do orçamento aprovado..."
                              rows={3}
                            />
                            <div className="reject-form-buttons ss-card-actions">
                              <button
                                className="button-danger"
                                onClick={() => confirmReject(requestId)}
                                disabled={loadingAction}
                              >
                                {loadingAction ? "Rejeitando..." : "Confirmar Rejeição"}
                              </button>
                              <button
                                className="button-secondary"
                                onClick={cancelReject}
                                disabled={loadingAction}
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </article>
                );
              })}
            </div>

            {/* Paginação no rodapé */}
            <PaginacaoControles {...paginacaoProps} />
          </>
        )}
      </div>
    </Layout>
  );
}

export default StatusSolicitacao;
