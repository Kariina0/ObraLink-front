// src/pages/measurements.jsx
// Acompanhamento de Medições — visível para todos os perfis.
// Encarregados veem apenas suas próprias medições; supervisores e admins veem todas.
// Filtros são enviados ao back-end via query params para evitar tráfego desnecessário.

import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import {
  aprovarMedicao,
  listAllMedicoesPaginado,
  listMedicoesPaginado,
  rejeitarMedicao,
} from "../services/medicoesService";
import { extractApiMessage } from "../services/response";
import useObras from "../hooks/useObras";
import { AuthContext } from "../context/AuthContext";
import { isReviewer, isAdmin } from "../constants/permissions";
import { TIPOS_SERVICO, STATUS_CLASS, STATUS_LABEL } from "../constants/medicao";
import { normalizeMedicao } from "../utils/normalizeMedicao";
import { PAGE_LIMIT_MEDICOES } from "../constants/pagination";
import api from "../services/api";
import "../styles/pages.css";
import "../styles/modal.css";

const BASE_URL = (process.env.REACT_APP_API_URL || "http://localhost:5000/api").replace(/\/api\/?$/, "");

function getFotoMedUrl(m) {
  const caminho = m.foto || m.fotoUrl || m.arquivo || m.arquivoUrl;
  if (!caminho) return null;
  if (caminho.startsWith("http")) return caminho;
  return `${BASE_URL}${caminho.startsWith("/") ? "" : "/"}${caminho}`;
}

const PAGE_LIMIT = PAGE_LIMIT_MEDICOES;

function getInitialStatusSummary() {
  return {
    enviada: 0,
    aprovada: 0,
    rejeitada: 0,
    rascunho: 0,
  };
}

function Measurements() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const reviewer = isReviewer(user?.perfil);
  const admin    = isAdmin(user?.perfil);

  const [measurements, setMeasurements]         = useState([]);
  const { obras }                               = useObras(200);
  const [erro, setErro]                         = useState(null);
  const [sucesso, setSucesso]                   = useState(null);
  const [initialLoading, setInitialLoading]     = useState(true);
  const [tableLoading, setTableLoading]         = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce]       = useState(false);
  const [actionLoadingId, setActionLoadingId]   = useState(null);
  const [fotoUrls, setFotoUrls]                 = useState({});
  const [lightbox, setLightbox]                 = useState(null);
  const [expandedMeasurementId, setExpandedMeasurementId] = useState(null);
  const dashboardScopeRef                       = useRef("");

  // ── Ação inline: rejeição ou confirmação de aprovação ─────────────────────
  // inlineAction: { type: 'approve' | 'reject', id: number } | null
  const [inlineAction, setInlineAction]         = useState(null);
  const [motivoRejeicao, setMotivoRejeicao]     = useState("");

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems]   = useState(0);
  const [dashboardTotalItems, setDashboardTotalItems] = useState(0);
  const [statusSummary, setStatusSummary] = useState(getInitialStatusSummary());

  // ── Filtros — todos enviados ao back-end como query params ─────────────────
  const [filtros, setFiltros] = useState({
    obra:        "",
    status:      "",
    tipoServico: "",
    dataInicio:  "",
    dataFim:     "",
    responsavel: "",
  });

  const dashboardScopeKey = JSON.stringify({
    obra: filtros.obra || "",
    dataInicio: filtros.dataInicio || "",
    dataFim: filtros.dataFim || "",
    reviewer,
  });

  // Carrega medições; re-executa sempre que os filtros ou página mudam
  const load = useCallback(async () => {
    const isFirstLoad = !hasLoadedOnce;
    const shouldRefreshDashboard = isFirstLoad || dashboardScopeRef.current !== dashboardScopeKey;

    try {
      if (isFirstLoad) {
        setInitialLoading(true);
      } else {
        setTableLoading(true);
      }

      setErro(null);

      const params = { page: currentPage, limit: PAGE_LIMIT };
      if (filtros.obra)        params.obra        = filtros.obra;
      if (filtros.status)      params.status      = filtros.status;
      if (filtros.tipoServico) params.tipoServico = filtros.tipoServico;
      if (filtros.dataInicio)  params.dataInicio  = `${filtros.dataInicio}T00:00:00`;
      if (filtros.dataFim)     params.dataFim     = `${filtros.dataFim}T23:59:59`;
      // Responsável agora vai ao back-end (suportado por getAll via p_responsavel na RPC)
      if (filtros.responsavel) params.responsavel = filtros.responsavel;

      const res = reviewer
        ? await listAllMedicoesPaginado(params)
        : await listMedicoesPaginado(params);

      const list = Array.isArray(res.data) ? res.data : [];
      setMeasurements(list.map(normalizeMedicao));
      setTotalItems(res.pagination?.totalItems ?? list.length);

      if (shouldRefreshDashboard) {
        setDashboardTotalItems(res.pagination?.totalItems ?? list.length);
        setStatusSummary({ ...getInitialStatusSummary(), ...(res.statusSummary || {}) });
        dashboardScopeRef.current = dashboardScopeKey;
      }

      setHasLoadedOnce(true);
    } catch (err) {
      setErro("Não foi possível carregar as medições. Tente novamente.");
    } finally {
      setInitialLoading(false);
      setTableLoading(false);
    }
  }, [reviewer, filtros, currentPage, hasLoadedOnce, dashboardScopeKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  // ── Aprovação com confirmação inline ──────────────────────────────────────
  const handleApproveClick = (id) => {
    setSucesso(null);
    setErro(null);
    setInlineAction({ type: "approve", id });
    setMotivoRejeicao("");
  };

  const confirmApprove = async (id) => {
    try {
      setActionLoadingId(id);
      setErro(null);
      await aprovarMedicao(id);
      setInlineAction(null);
      setSucesso("Medição aprovada com sucesso.");
      await load();
    } catch (error) {
      setErro(extractApiMessage(error, "Erro ao aprovar a medição. Tente novamente."));
    } finally {
      setActionLoadingId(null);
    }
  };

  // ── Rejeição com motivo inline ────────────────────────────────────────────
  const handleRejectClick = (id) => {
    setSucesso(null);
    setErro(null);
    setInlineAction({ type: "reject", id });
    setMotivoRejeicao("");
  };

  const confirmReject = async (id) => {
    try {
      setActionLoadingId(id);
      setErro(null);
      await rejeitarMedicao(id, motivoRejeicao.trim());
      setInlineAction(null);
      setMotivoRejeicao("");
      setSucesso("Medição rejeitada.");
      await load();
    } catch (error) {
      setErro(extractApiMessage(error, "Erro ao rejeitar a medição. Tente novamente."));
    } finally {
      setActionLoadingId(null);
    }
  };

  const cancelInlineAction = () => {
    setInlineAction(null);
    setMotivoRejeicao("");
  };

  const toggleExpandedMeasurement = (id) => {
    setExpandedMeasurementId((prev) => (prev === id ? null : id));
  };

  // Resolve URL da foto de uma medição sob demanda (lazy)
  const resolveFotoUrl = useCallback(async (m, openLightbox = true) => {
    if (fotoUrls[m.id] !== undefined) {
      if (openLightbox && fotoUrls[m.id]) setLightbox(fotoUrls[m.id]);
      return;
    }
    // Suporta anexos como números (IDs) ou objetos ({ id, url, ... })
    const firstAnexo = Array.isArray(m.anexos)
      ? m.anexos.find((a) => typeof a === "number" || (a && typeof a === "object" && a.id))
      : null;
    if (!firstAnexo) {
      setFotoUrls((prev) => ({ ...prev, [m.id]: null }));
      return;
    }
    // Se o objeto já carrega a URL, usa diretamente sem nova requisição
    if (typeof firstAnexo === "object" && firstAnexo.url) {
      const url = firstAnexo.url.startsWith("http")
        ? firstAnexo.url
        : `${BASE_URL}${firstAnexo.url.startsWith("/") ? "" : "/"}${firstAnexo.url}`;
      setFotoUrls((prev) => ({ ...prev, [m.id]: url }));
      if (openLightbox) setLightbox(url);
      return;
    }
    const firstId = typeof firstAnexo === "number" ? firstAnexo : firstAnexo.id;
    try {
      const res = await api.get(`/files/${firstId}`);
      const url = res?.data?.data?.url || res?.data?.url || null;
      setFotoUrls((prev) => ({ ...prev, [m.id]: url }));
      if (openLightbox && url) setLightbox(url);
    } catch (err) {
      console.warn(`Não foi possível carregar anexo ${firstId} para medição ${m.id}:`, err.message);
      setFotoUrls((prev) => ({ ...prev, [m.id]: null }));
    }
  }, [fotoUrls]);

  // Pré-carrega miniaturas de foto para a lista atual (sem abrir lightbox)
  useEffect(() => {
    if (!measurements.length) return;

    measurements.forEach((m) => {
      const directUrl = getFotoMedUrl(m);
      const hasAnexo = Array.isArray(m.anexos) && m.anexos.some((a) => typeof a === "number" || (a && typeof a === "object" && a.id));
      if (!directUrl && hasAnexo && fotoUrls[m.id] === undefined) {
        resolveFotoUrl(m, false);
      }
    });
  }, [measurements, fotoUrls, resolveFotoUrl]);

  // Fecha lightbox com ESC
  useEffect(() => {
    if (!lightbox) return;
    const handler = (e) => { if (e.key === "Escape") setLightbox(null); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lightbox]);

  // Ao mudar filtros, volta para página 1
  const handleFiltro = (e) => {
    const { name, value } = e.target;
    setCurrentPage(1);
    setFiltros((prev) => ({ ...prev, [name]: value }));
  };

  const limparFiltros = () => {
    setCurrentPage(1);
    setFiltros({ obra: "", status: "", tipoServico: "", dataInicio: "", dataFim: "", responsavel: "" });
  };

  const temFiltroAtivo = Object.values(filtros).some(Boolean);
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_LIMIT));
  const isTableBusy = initialLoading || tableLoading;
  const shouldShowTableSection = hasLoadedOnce || isTableBusy;
  const shouldShowDashboardSkeleton = initialLoading && !hasLoadedOnce;

  const quantidadeAprovadas = statusSummary.aprovada || 0;
  const quantidadePendentes = statusSummary.enviada || 0;
  const quantidadeRejeitadas = statusSummary.rejeitada || 0;
  const quantidadeRascunhos = statusSummary.rascunho || 0;

  const chartItems = [
    { key: "aprovada", label: "Aprovadas", value: quantidadeAprovadas, color: "var(--cor-sucesso)" },
    { key: "enviada", label: "Aguardando", value: quantidadePendentes, color: "var(--cor-primaria)" },
    { key: "rejeitada", label: "Rejeitadas", value: quantidadeRejeitadas, color: "var(--cor-perigo)" },
    { key: "rascunho", label: "Rascunhos", value: quantidadeRascunhos, color: "var(--cor-borda)" },
  ];

  const chartTotal = chartItems.reduce((sum, item) => sum + item.value, 0);
  const displayedMeasurementsLabel = `${measurements.length} de ${totalItems} ${totalItems !== 1 ? "medições" : "medição"}`;
  const skeletonRows = Array.from({ length: 9 }, (_, index) => index);

  const donutGradient = (() => {
    if (!chartTotal) {
      return "conic-gradient(var(--cor-borda) 0deg 360deg)";
    }

    let current = 0;
    const segments = chartItems
      .filter((item) => item.value > 0)
      .map((item) => {
        const start = (current / chartTotal) * 360;
        current += item.value;
        const end = (current / chartTotal) * 360;
        return `${item.color} ${start}deg ${end}deg`;
      });

    return `conic-gradient(${segments.join(", ")})`;
  })();

  return (
    <Layout>
      <div className="page-container measurements-page">
        <div className="measurements-header-row">
          <h1 className="page-title measurements-page-title">Medições</h1>
          <a
            href="/medicoes"
            className="button-primary measurements-register-button"
          >
            + Registrar nova medição
          </a>
        </div>
        <p className="page-description measurements-page-description">
          {reviewer
            ? "Revise e aprove as medições registradas pelos encarregados."
            : "Acompanhe o status das suas medições enviadas."}
        </p>

        <section className="measurement-status-overview" aria-label="Resumo de status das medições">
          <div className={`measurement-overview-card ${shouldShowDashboardSkeleton ? "measurement-overview-card--loading" : ""}`}>
                <div className="measurement-overview-card__left">
                  <div className="measurement-overview-card__summary">
                    <span className="measurement-overview-card__title">Total de medições</span>
                    <strong className="measurement-overview-card__total">{dashboardTotalItems}</strong>
                    <p className="measurement-overview-card__subtitle">medições totais</p>
                  </div>

                  <div className="measurement-overview-card__metrics-grid">
                    <article className="measurement-overview-card__metric measurement-overview-card__metric--rejeitada">
                      <span className="measurement-overview-card__metric-label">Rejeitadas</span>
                      <strong className="measurement-overview-card__metric-value">{quantidadeRejeitadas}</strong>
                    </article>

                    <article className="measurement-overview-card__metric measurement-overview-card__metric--aprovada">
                      <span className="measurement-overview-card__metric-label">Aprovadas</span>
                      <strong className="measurement-overview-card__metric-value">{quantidadeAprovadas}</strong>
                    </article>

                    <article className="measurement-overview-card__metric measurement-overview-card__metric--rascunho">
                      <span className="measurement-overview-card__metric-label">Rascunhos</span>
                      <strong className="measurement-overview-card__metric-value">{quantidadeRascunhos}</strong>
                    </article>

                    <article className="measurement-overview-card__metric measurement-overview-card__metric--enviada">
                      <span className="measurement-overview-card__metric-label">Aguardando revisão</span>
                      <strong className="measurement-overview-card__metric-value">{quantidadePendentes}</strong>
                    </article>
                  </div>
                </div>

                <div className="measurement-overview-card__chart-wrap" aria-hidden="true">
                  <div className="measurement-overview-card__chart" style={{ background: donutGradient }} />
                </div>
          </div>
        </section>

        {/* ── Painel de Filtros ─────────────────────────────────────────────── */}
        <div
          className="form-container measurements-filter-panel"
        >
          <p className="measurements-filter-title">
            Filtros
          </p>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: "var(--espacamento-md)",
            alignItems: "end",
          }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="f-obra">Obra</label>
              <select id="f-obra" name="obra" value={filtros.obra} onChange={handleFiltro}>
                <option value="">Todas</option>
                {obras.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nome || `Obra #${o.id}`}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="f-status">Status</label>
              <select id="f-status" name="status" value={filtros.status} onChange={handleFiltro}>
                <option value="">Todos</option>
                <option value="enviada">Aguardando revisão</option>
                <option value="aprovada">Aprovada</option>
                <option value="rejeitada">Rejeitada</option>
                <option value="rascunho">Rascunho</option>
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="f-tipo">Tipo de serviço</label>
              <select id="f-tipo" name="tipoServico" value={filtros.tipoServico} onChange={handleFiltro}>
                <option value="">Todos</option>
                {TIPOS_SERVICO.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="f-ini">Data início</label>
              <input id="f-ini" type="date" name="dataInicio" value={filtros.dataInicio} onChange={handleFiltro} />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="f-fim">Data fim</label>
              <input id="f-fim" type="date" name="dataFim" value={filtros.dataFim} onChange={handleFiltro} />
            </div>

            {/* Busca por ID do responsável — somente para revisores (vai ao back-end) */}
            {(reviewer || admin) && (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="f-resp">Responsável (ID)</label>
                <input
                  id="f-resp"
                  type="number"
                  name="responsavel"
                  placeholder="ID do responsável"
                  value={filtros.responsavel}
                  onChange={handleFiltro}
                  min="1"
                />
              </div>
            )}

            <div className="measurements-filter-actions">
              <button
                className="button-secondary measurements-filter-clear"
                onClick={limparFiltros}
                disabled={!temFiltroAtivo}
              >
                Limpar filtros
              </button>
            </div>
          </div>
        </div>

        {/* ── Feedbacks globais ─────────────────────────────────────────────── */}
        {erro    && <p className="erro-msg">{erro}</p>}
        {sucesso && <p className="success-msg">{sucesso}</p>}

        {/* ── Tabela ───────────────────────────────────────────────────────── */}
        {shouldShowTableSection && (
          <section className={`measurements-list-section ${tableLoading ? "measurements-list-section--loading" : ""}`} aria-label="Lista de medições">
            <div className="measurements-list-header">
              {hasLoadedOnce ? (
                <p className="measurements-list-meta">
                  Exibindo {displayedMeasurementsLabel}
                  {temFiltroAtivo ? " (filtros ativos)" : ""}.
                </p>
              ) : (
                <div className="measurements-list-meta-skeleton" aria-hidden="true" />
              )}
            </div>

            <div className="measurements-table-wrap">
              {isTableBusy && (
                <table className="measurements-table measurements-table--skeleton" aria-hidden="true">
                  <thead>
                    <tr>
                      {reviewer && <th className="measurements-table__col-obra">Obra</th>}
                      {reviewer && <th className="measurements-table__col-responsavel">Responsável</th>}
                      <th className="measurements-table__col-item">Ambiente</th>
                      <th className="measurements-table__col-area">Área (m²)</th>
                      <th className="measurements-table__col-status">Status</th>
                      <th className="measurements-table__col-photo">Foto</th>
                      <th className="measurements-table__col-details">Detalhes</th>
                      <th className="measurements-table__col-actions">{reviewer ? "Aprovação" : "Ações"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {skeletonRows.map((row) => (
                      <tr key={`skeleton-row-${row}`} className="measurements-table__row">
                        {reviewer && (
                          <td><div className="measurements-skeleton measurements-skeleton--text" /></td>
                        )}
                        {reviewer && (
                          <td><div className="measurements-skeleton measurements-skeleton--text" /></td>
                        )}
                        <td><div className="measurements-skeleton measurements-skeleton--text" /></td>
                        <td><div className="measurements-skeleton measurements-skeleton--text" /></td>
                        <td><div className="measurements-skeleton measurements-skeleton--status" /></td>
                        <td><div className="measurements-skeleton measurements-skeleton--photo" /></td>
                        <td><div className="measurements-skeleton measurements-skeleton--button" /></td>
                        <td>
                          <div className="measurements-skeleton-actions">
                            <div className="measurements-skeleton measurements-skeleton--button" />
                            <div className="measurements-skeleton measurements-skeleton--button" />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {!isTableBusy && hasLoadedOnce && measurements.length > 0 && (
                <table className="measurements-table">
                  <thead>
                    <tr>
                      {reviewer && <th className="measurements-table__col-obra">Obra</th>}
                      {reviewer && <th className="measurements-table__col-responsavel">Responsável</th>}
                      <th className="measurements-table__col-item">Ambiente</th>
                      <th className="measurements-table__col-area">Área (m²)</th>
                      <th className="measurements-table__col-status">Status</th>
                      <th className="measurements-table__col-photo">Foto</th>
                      <th className="measurements-table__col-details">Detalhes</th>
                      <th className="measurements-table__col-actions">{reviewer ? "Aprovação" : "Ações"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {measurements.map((m, idx) => (
                      <React.Fragment key={m.id || idx}>
                      {/* ── Linha da medição ──────────────────────────────── */}
                      <tr className="measurements-table__row">
                        {reviewer && (
                          <td className="measurements-table__cell-obra">{m.obraNome || (m.obra ? `Obra #${m.obra}` : "—")}</td>
                        )}
                        {reviewer && (
                          <td className="measurements-table__cell-responsavel">{m.responsavelNome || (m.responsavel ? `#${m.responsavel}` : "—")}</td>
                        )}
                        <td className="measurements-table__cell-item">{m.areaNome || "—"}</td>
                        <td className="measurements-table__cell-area">
                          <strong className="measurements-table__metric">
                            {m.area != null && !isNaN(m.area) ? Number(m.area).toFixed(2) : "—"}
                          </strong>
                        </td>
                        <td>
                          <span
                            className={`status-badge measurements-status-badge ${STATUS_CLASS[m.status] || "pendente"}`}
                          >
                            {STATUS_LABEL[m.status] || m.status || "Aguardando revisão"}
                          </span>
                        </td>

                        <td className="measurements-photo-cell">
                          {(() => {
                            const directUrl = getFotoMedUrl(m);
                            const hasAnexo  = Array.isArray(m.anexos) && m.anexos.some((a) => typeof a === "number" || (a && typeof a === "object" && a.id));
                            if (!directUrl && !hasAnexo) {
                              return <span className="measurements-photo-empty">—</span>;
                            }
                            const resolvedUrl = directUrl || fotoUrls[m.id];
                            if (resolvedUrl) {
                              return (
                                <img
                                  src={resolvedUrl}
                                  alt="Foto da medição"
                                  onClick={() => setLightbox(resolvedUrl)}
                                  className="measurements-photo-thumb"
                                  title="Clique para ampliar"
                                />
                              );
                            }
                            if (fotoUrls[m.id] === null) {
                              return <span className="measurements-photo-empty">Sem foto</span>;
                            }
                            return <span className="measurements-photo-loading">Carregando...</span>;
                          })()}
                        </td>

                        <td className="measurements-details-cell">
                          <button
                            className="button-secondary measurements-table-button"
                            onClick={() => toggleExpandedMeasurement(m.id)}
                          >
                            {expandedMeasurementId === m.id ? "Ocultar" : "Ver detalhes"}
                          </button>
                        </td>

                        <td className="measurements-actions-cell">
                          <div className="measurements-actions-group">
                            {/* Botão Editar — para encarregado em rascunho/rejeitada */}
                            {(m.status === "rascunho" || m.status === "rejeitada") && !reviewer && (
                              <button
                                className="button-secondary measurements-table-button"
                                onClick={() => navigate(`/medicoes?editar=${m.id}`)}
                                disabled={actionLoadingId === m.id}
                              >
                                Editar
                              </button>
                            )}
                            {/* Ações do revisor */}
                            {reviewer && (
                              <div className="measurement-approval-actions">
                                <button
                                  className="button-success measurements-table-button"
                                  disabled={
                                    actionLoadingId === m.id
                                    || m.status === "aprovada"
                                    || (inlineAction !== null && inlineAction.id !== m.id)
                                  }
                                  onClick={() => handleApproveClick(m.id)}
                                >
                                  {inlineAction?.type === "approve" && inlineAction.id === m.id
                                    ? "Confirmando..."
                                    : "Aprovar"}
                                </button>
                                <button
                                  className="button-danger measurements-table-button"
                                  disabled={
                                    actionLoadingId === m.id
                                    || m.status === "rejeitada"
                                    || (inlineAction !== null && inlineAction.id !== m.id)
                                  }
                                  onClick={() => handleRejectClick(m.id)}
                                >
                                  Rejeitar
                                </button>
                              </div>
                            )}
                            {/* Sem ações para revisor em medições aprovadas/rascunho */}
                            {!reviewer && m.status !== "rascunho" && m.status !== "rejeitada" && (
                              <span style={{ color: "var(--cor-texto-secundario)", fontSize: "var(--tamanho-fonte-pequena)" }}>—</span>
                            )}
                          </div>
                        </td>
                      </tr>

                      {expandedMeasurementId === m.id && (
                        <tr className="measurement-details-row">
                          <td colSpan={reviewer ? 8 : 6}>
                            <div className="measurement-details-card">
                              <div className="measurement-details-grid">
                                <div>
                                  <p className="measurement-details-label">Obra</p>
                                  <p className="measurement-details-value">
                                    {m.obraNome || (m.obra ? `Obra #${m.obra}` : "—")}
                                  </p>
                                </div>

                                <div>
                                  <p className="measurement-details-label">Item</p>
                                  <p className="measurement-details-value">{m.areaNome || "—"}</p>
                                </div>

                                <div>
                                <p className="measurement-details-label">Tipo de serviço</p>
                                <p className="measurement-details-value">
                                  {TIPOS_SERVICO.find((t) => t.value === m.tipoServico)?.label
                                    || m.tipoServico
                                    || "—"}
                                </p>
                                </div>

                                <div>
                                  <p className="measurement-details-label">Data de registro</p>
                                  <p className="measurement-details-value">
                                    {m.createdAt
                                      ? new Date(m.createdAt).toLocaleDateString("pt-BR")
                                      : "—"}
                                  </p>
                                </div>

                                <div className="measurement-details-grid__full">
                                  <p className="measurement-details-label">Observações</p>
                                  <p className="measurement-details-value">{m.observacoes || "Sem observações."}</p>
                                </div>

                                {m.status === "rejeitada" && m.motivoRejeicao && (
                                  <div className="measurement-details-grid__full">
                                    <p className="measurement-details-label">Motivo da rejeição</p>
                                    <p className="measurement-details-value measurement-details-value--danger">{m.motivoRejeicao}</p>
                                  </div>
                                )}

                                <div className="measurement-details-grid__full">
                                  <p className="measurement-details-label">Foto</p>
                                  <p className="measurement-details-value">Use a miniatura da coluna “Foto” para ampliar a imagem.</p>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}

                      {/* ── Linha expandida de confirmação (próxima ao contexto) ─── */}
                      {inlineAction !== null && inlineAction.id === m.id && (
                        <tr className={`measurement-inline-row measurement-inline-row--${inlineAction.type}`}>
                          <td colSpan={reviewer ? 8 : 6}>
                            {inlineAction.type === "approve" ? (
                              <div className="measurement-inline-card measurement-inline-card--approve">
                                <span className="measurement-inline-card__title measurement-inline-card__title--approve">
                                  Confirmar aprovação desta medição?
                                </span>
                                <button
                                  className="button-success measurements-table-button"
                                  onClick={() => confirmApprove(m.id)}
                                  disabled={actionLoadingId === m.id}
                                >
                                  {actionLoadingId === m.id ? "Aprovando..." : "Sim, aprovar"}
                                </button>
                                <button
                                  className="button-secondary measurements-table-button"
                                  onClick={cancelInlineAction}
                                  disabled={actionLoadingId === m.id}
                                >
                                  Cancelar
                                </button>
                              </div>
                            ) : (
                              <div className="measurement-inline-card measurement-inline-card--reject">
                                <label
                                  htmlFor={`motivo-rejeicao-${m.id}`}
                                  className="measurement-inline-card__title measurement-inline-card__title--reject"
                                >
                                  Informe o motivo da rejeição (opcional):
                                </label>
                                <textarea
                                  id={`motivo-rejeicao-${m.id}`}
                                  value={motivoRejeicao}
                                  onChange={(e) => setMotivoRejeicao(e.target.value)}
                                  placeholder="Ex: Medição incompleta, dimensões inconsistentes com o projeto..."
                                  rows={2}
                                  className="measurement-inline-card__textarea"
                                />
                                <div className="measurement-inline-card__actions">
                                  <button
                                    className="button-danger measurements-table-button"
                                    onClick={() => confirmReject(m.id)}
                                    disabled={actionLoadingId === m.id}
                                  >
                                    {actionLoadingId === m.id ? "Rejeitando..." : "Confirmar rejeição"}
                                  </button>
                                  <button
                                    className="button-secondary measurements-table-button"
                                    onClick={cancelInlineAction}
                                    disabled={actionLoadingId === m.id}
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              )}

              {hasLoadedOnce && !isTableBusy && measurements.length === 0 && !erro && (
                <div className="card measurements-empty-state measurements-empty-state--table">
                  <p className="measurements-empty-state__text">
                    {temFiltroAtivo
                      ? "Nenhuma medição encontrada para os filtros selecionados. Tente ajustar os critérios de busca."
                      : "Nenhuma medição registrada ainda."}
                  </p>
                  {!reviewer && (
                    <a href="/medicoes" className="button-primary measurements-empty-state__action">
                      Registrar primeira medição
                    </a>
                  )}
                </div>
              )}

            </div>

            {/* ── Controles de Paginação ────────────────────────────────── */}
            {hasLoadedOnce && measurements.length > 0 && totalPages > 1 && (
              <div className="paginacao-controles measurements-pagination">
                <button
                  className="button-secondary"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1 || isTableBusy}
                >
                  ← Anterior
                </button>
                <span className="paginacao-info">
                  Página {currentPage} de {totalPages}
                </span>
                <button
                  className="button-secondary"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages || isTableBusy}
                >
                  Próxima →
                </button>
              </div>
            )}
          </section>
        )}
      </div>

      {/* ── Lightbox: visualizador de foto ampliada ───────────────────────── */}
      {lightbox && (
        <div
          className="modal-overlay"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Foto da medição ampliada"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="measurements-lightbox"
          >
            <button
              onClick={() => setLightbox(null)}
              aria-label="Fechar"
              className="measurements-lightbox__close"
            >
              ×
            </button>
            <div className="measurements-lightbox__viewport">
              <img
                src={lightbox}
                alt="Foto da medição ampliada"
                className="measurements-lightbox__image"
              />
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

export default Measurements;

