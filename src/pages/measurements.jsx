// src/pages/measurements.jsx
// Acompanhamento de Medições — visível para todos os perfis.
// Encarregados veem apenas suas próprias medições; supervisores e admins veem todas.
// Filtros são enviados ao back-end via query params para evitar tráfego desnecessário.

import React, { useCallback, useContext, useEffect, useState } from "react";
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

function formatPercent(value, total) {
  if (!total) return "0%";
  const percent = (value / total) * 100;
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(percent)}%`;
}

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
  const [loading, setLoading]                   = useState(true);
  const [actionLoadingId, setActionLoadingId]   = useState(null);
  const [fotoUrls, setFotoUrls]                 = useState({});
  const [lightbox, setLightbox]                 = useState(null);
  const [expandedMeasurementId, setExpandedMeasurementId] = useState(null);

  // ── Ação inline: rejeição ou confirmação de aprovação ─────────────────────
  // inlineAction: { type: 'approve' | 'reject', id: number } | null
  const [inlineAction, setInlineAction]         = useState(null);
  const [motivoRejeicao, setMotivoRejeicao]     = useState("");

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems]   = useState(0);
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

  // Carrega medições; re-executa sempre que os filtros ou página mudam
  const load = useCallback(async () => {
    try {
      setLoading(true);
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
      setStatusSummary({ ...getInitialStatusSummary(), ...(res.statusSummary || {}) });
    } catch (err) {
      setErro("Não foi possível carregar as medições. Tente novamente.");
      setStatusSummary(getInitialStatusSummary());
    } finally {
      setLoading(false);
    }
  }, [reviewer, filtros, currentPage]); // eslint-disable-line react-hooks/exhaustive-deps

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
    const firstId = Array.isArray(m.anexos) ? m.anexos.find((id) => typeof id === "number") : null;
    if (!firstId) {
      setFotoUrls((prev) => ({ ...prev, [m.id]: null }));
      return;
    }
    try {
      const res = await api.get(`/files/${firstId}`);
      const url = res?.data?.data?.url || null;
      setFotoUrls((prev) => ({ ...prev, [m.id]: url }));
      if (openLightbox && url) setLightbox(url);
    } catch {
      setFotoUrls((prev) => ({ ...prev, [m.id]: null }));
    }
  }, [fotoUrls]);

  // Pré-carrega miniaturas de foto para a lista atual (sem abrir lightbox)
  useEffect(() => {
    if (!measurements.length) return;

    measurements.forEach((m) => {
      const directUrl = getFotoMedUrl(m);
      const hasAnexo = Array.isArray(m.anexos) && m.anexos.some((id) => typeof id === "number");
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

  const legendItems = chartItems.filter((item) => item.value > 0);
  const displayItems = legendItems.length > 0 ? legendItems : chartItems;
  const chartTotal = chartItems.reduce((sum, item) => sum + item.value, 0);

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
      <div className="page-container" style={{ maxWidth: "1200px" }}>
        {/* ── Título e descrição — largura total para a borda ficar completa ── */}
        <h1 className="page-title">Medições</h1>
        <p className="page-description">
          {reviewer
            ? "Revise e aprove as medições registradas pelos encarregados."
            : "Acompanhe o status das suas medições enviadas."}
        </p>

        {/* ── Barra de ação: resumo visual de status + botão ───────────────── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "var(--espacamento-md)", marginBottom: "var(--espacamento-lg)" }}>
          {!loading && (
            <section className="measurement-status-overview" aria-label="Resumo de status das medições">
              <div className="measurement-overview-card">
                <div className="measurement-overview-card__left">
                  <span className="measurement-overview-card__title">Total de medições</span>
                  <strong className="measurement-overview-card__total">{totalItems}</strong>
                  <p className="measurement-overview-card__subtitle">medições totais</p>

                  <ul className="measurement-overview-card__legend">
                    {displayItems.map((item) => (
                      <li key={item.key} className={`measurement-overview-card__legend-item measurement-overview-card__legend-item--${item.key}`}>
                        <span className="measurement-overview-card__dot" style={{ backgroundColor: item.color }} />
                        <span className="measurement-overview-card__label">
                          {item.value} {item.label.toLowerCase()}
                        </span>
                        <span className="measurement-overview-card__percent">
                          {formatPercent(item.value, chartTotal)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="measurement-overview-card__chart-wrap" aria-hidden="true">
                  <div className="measurement-overview-card__chart" style={{ background: donutGradient }} />
                </div>
              </div>
            </section>
          )}

          <a
            href="/medicoes"
            className="button-primary"
            style={{ textDecoration: "none", padding: "10px 24px", whiteSpace: "nowrap", flexShrink: 0, marginLeft: "auto" }}
          >
            + Registrar nova medição
          </a>
        </div>

        {/* ── Painel de Filtros ─────────────────────────────────────────────── */}
        <div
          className="form-container"
          style={{ marginBottom: "var(--espacamento-lg)", padding: "var(--espacamento-md)" }}
        >
          <p style={{ fontWeight: 700, marginBottom: "var(--espacamento-md)", color: "var(--cor-texto-principal)" }}>
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

            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <button
                className="button-secondary"
                onClick={limparFiltros}
                disabled={!temFiltroAtivo}
                style={{ width: "100%", padding: "15px 12px" }}
              >
                Limpar filtros
              </button>
            </div>
          </div>
        </div>

        {/* ── Feedbacks globais ─────────────────────────────────────────────── */}
        {erro    && <p className="erro-msg">{erro}</p>}
        {sucesso && <p className="success-msg">{sucesso}</p>}
        {loading && (
          <p style={{ textAlign: "center", padding: "var(--espacamento-xl)" }}>
            Carregando medições...
          </p>
        )}

        {!erro && !loading && measurements.length === 0 && (
          <div className="card" style={{ textAlign: "center", padding: "var(--espacamento-xl)" }}>
            <p style={{ marginBottom: "var(--espacamento-md)" }}>
              {temFiltroAtivo
                ? "Nenhuma medição encontrada para os filtros selecionados. Tente ajustar os critérios de busca."
                : "Nenhuma medição registrada ainda."}
            </p>
            {!reviewer && (
              <a href="/medicoes" className="button-primary" style={{ textDecoration: "none" }}>
                Registrar primeira medição
              </a>
            )}
          </div>
        )}

        {/* ── Tabela ───────────────────────────────────────────────────────── */}
        {!loading && measurements.length > 0 && (
          <>
            <p style={{
              marginBottom: "var(--espacamento-md)",
              color: "var(--cor-texto-secundario)",
              fontSize: "var(--tamanho-fonte-pequena)",
            }}>
              Exibindo {measurements.length} de {totalItems} {totalItems !== 1 ? "medições" : "medição"}
              {temFiltroAtivo ? " (filtros ativos)" : ""}.
            </p>

            <div className="measurements-table-wrap">
              <table className="measurements-table">
                <thead>
                  <tr>
                    {reviewer && <th>Obra</th>}
                    {reviewer && <th>Responsável</th>}
                    <th>Ambiente</th>
                    <th>Área (m²)</th>
                    <th>Status</th>
                    <th>Foto</th>
                    <th>Detalhes</th>
                    <th>{reviewer ? "Aprovação" : "Ações"}</th>
                  </tr>
                </thead>
                <tbody>
                  {measurements.map((m, idx) => (
                    <React.Fragment key={m.id || idx}>
                      {/* ── Linha da medição ──────────────────────────────── */}
                      <tr>
                        {reviewer && (
                          <td>{m.obraNome || (m.obra ? `Obra #${m.obra}` : "—")}</td>
                        )}
                        {reviewer && (
                          <td>{m.responsavelNome || (m.responsavel ? `#${m.responsavel}` : "—")}</td>
                        )}
                        <td>{m.areaNome || "—"}</td>
                        <td>
                          <strong>
                            {m.area != null && !isNaN(m.area) ? Number(m.area).toFixed(2) : "—"}
                          </strong>
                        </td>
                        <td>
                          <span
                            className={`status-badge ${STATUS_CLASS[m.status] || "pendente"}`}
                            style={{
                              display: "inline-block",
                              padding: "5px 12px",
                              borderRadius: "20px",
                              fontSize: "var(--tamanho-fonte-pequena)",
                              fontWeight: 700,
                              background: STATUS_CLASS[m.status] === "aprovada"  ? "var(--cor-sucesso-clara)"
                                        : STATUS_CLASS[m.status] === "rejeitada" ? "var(--cor-perigo-clara)"
                                        : STATUS_CLASS[m.status] === "rascunho"  ? "var(--cor-fundo)"
                                        : "var(--cor-aviso-clara)",
                              color:      STATUS_CLASS[m.status] === "aprovada"  ? "var(--cor-sucesso)"
                                        : STATUS_CLASS[m.status] === "rejeitada" ? "var(--cor-perigo)"
                                        : STATUS_CLASS[m.status] === "rascunho"  ? "var(--cor-texto-secundario)"
                                        : "var(--cor-aviso)",
                            }}
                          >
                            {STATUS_LABEL[m.status] || m.status || "Aguardando revisão"}
                          </span>
                        </td>

                        <td className="measurements-photo-cell">
                          {(() => {
                            const directUrl = getFotoMedUrl(m);
                            const hasAnexo  = Array.isArray(m.anexos) && m.anexos.some((id) => typeof id === "number");
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
                            className="button-secondary"
                            onClick={() => toggleExpandedMeasurement(m.id)}
                            style={{ padding: "8px 12px" }}
                          >
                            {expandedMeasurementId === m.id ? "Ocultar" : "Ver detalhes"}
                          </button>
                        </td>

                        <td className="measurements-actions-cell">
                          <div style={{ display: "flex", gap: "var(--espacamento-xs)", flexWrap: "wrap" }}>
                            {/* Botão Editar — para encarregado em rascunho/rejeitada */}
                            {(m.status === "rascunho" || m.status === "rejeitada") && !reviewer && (
                              <button
                                className="button-secondary"
                                onClick={() => navigate(`/medicoes?editar=${m.id}`)}
                                disabled={actionLoadingId === m.id}
                                style={{ padding: "8px 14px" }}
                              >
                                Editar
                              </button>
                            )}
                            {/* Ações do revisor */}
                            {reviewer && (
                              <div className="measurement-approval-actions">
                                <button
                                  className="button-success"
                                  disabled={
                                    actionLoadingId === m.id
                                    || m.status === "aprovada"
                                    || (inlineAction !== null && inlineAction.id !== m.id)
                                  }
                                  onClick={() => handleApproveClick(m.id)}
                                  style={{ padding: "8px 14px" }}
                                >
                                  {inlineAction?.type === "approve" && inlineAction.id === m.id
                                    ? "Confirmando..."
                                    : "Aprovar"}
                                </button>
                                <button
                                  className="button-danger"
                                  disabled={
                                    actionLoadingId === m.id
                                    || m.status === "rejeitada"
                                    || (inlineAction !== null && inlineAction.id !== m.id)
                                  }
                                  onClick={() => handleRejectClick(m.id)}
                                  style={{ padding: "8px 14px" }}
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
                            <div className="measurement-details-grid">
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

                              <div style={{ gridColumn: "1 / -1" }}>
                                <p className="measurement-details-label">Observações</p>
                                <p className="measurement-details-value">{m.observacoes || "Sem observações."}</p>
                              </div>

                              {m.status === "rejeitada" && m.motivoRejeicao && (
                                <div style={{ gridColumn: "1 / -1" }}>
                                  <p className="measurement-details-label">Motivo da rejeição</p>
                                  <p className="measurement-details-value measurement-details-value--danger">{m.motivoRejeicao}</p>
                                </div>
                              )}

                              <div style={{ gridColumn: "1 / -1" }}>
                                <p className="measurement-details-label">Foto</p>
                                <p className="measurement-details-value">Use a miniatura da coluna “Foto” para ampliar a imagem.</p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}

                      {/* ── Linha expandida de confirmação (próxima ao contexto) ─── */}
                      {inlineAction !== null && inlineAction.id === m.id && (
                        <tr style={{ background: inlineAction.type === "reject" ? "#fef2f2" : "#f0fdf4" }}>
                          <td colSpan={reviewer ? 8 : 6} style={{ padding: "var(--espacamento-md)" }}>
                            {inlineAction.type === "approve" ? (
                              <div style={{ display: "flex", alignItems: "center", gap: "var(--espacamento-md)", flexWrap: "wrap" }}>
                                <span style={{ fontWeight: 600, color: "var(--cor-sucesso)" }}>
                                  Confirmar aprovação desta medição?
                                </span>
                                <button
                                  className="button-success"
                                  onClick={() => confirmApprove(m.id)}
                                  disabled={actionLoadingId === m.id}
                                  style={{ padding: "8px 18px" }}
                                >
                                  {actionLoadingId === m.id ? "Aprovando..." : "Sim, aprovar"}
                                </button>
                                <button
                                  className="button-secondary"
                                  onClick={cancelInlineAction}
                                  disabled={actionLoadingId === m.id}
                                  style={{ padding: "8px 18px" }}
                                >
                                  Cancelar
                                </button>
                              </div>
                            ) : (
                              <div>
                                <label
                                  htmlFor={`motivo-rejeicao-${m.id}`}
                                  style={{ fontWeight: 600, color: "var(--cor-perigo)", display: "block", marginBottom: "var(--espacamento-xs)" }}
                                >
                                  Informe o motivo da rejeição (opcional):
                                </label>
                                <textarea
                                  id={`motivo-rejeicao-${m.id}`}
                                  value={motivoRejeicao}
                                  onChange={(e) => setMotivoRejeicao(e.target.value)}
                                  placeholder="Ex: Medição incompleta, dimensões inconsistentes com o projeto..."
                                  rows={2}
                                  style={{ width: "100%", maxWidth: "500px", marginBottom: "var(--espacamento-xs)" }}
                                />
                                <div style={{ display: "flex", gap: "var(--espacamento-xs)" }}>
                                  <button
                                    className="button-danger"
                                    onClick={() => confirmReject(m.id)}
                                    disabled={actionLoadingId === m.id}
                                    style={{ padding: "8px 18px" }}
                                  >
                                    {actionLoadingId === m.id ? "Rejeitando..." : "Confirmar rejeição"}
                                  </button>
                                  <button
                                    className="button-secondary"
                                    onClick={cancelInlineAction}
                                    disabled={actionLoadingId === m.id}
                                    style={{ padding: "8px 18px" }}
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
            </div>

            {/* ── Controles de Paginação ────────────────────────────────── */}
            {totalPages > 1 && (
              <div style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: "var(--espacamento-md)",
                marginTop: "var(--espacamento-xl)",
              }}>
                <button
                  className="button-secondary"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1 || loading}
                  style={{ padding: "8px 18px" }}
                >
                  ← Anterior
                </button>
                <span style={{ fontSize: "var(--tamanho-fonte-base)", color: "var(--cor-texto-secundario)" }}>
                  Página {currentPage} de {totalPages}
                </span>
                <button
                  className="button-secondary"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages || loading}
                  style={{ padding: "8px 18px" }}
                >
                  Próxima →
                </button>
              </div>
            )}
          </>
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
            style={{ position: "relative", maxWidth: "90vw", maxHeight: "90vh", display: "flex", flexDirection: "column", alignItems: "center" }}
          >
            <button
              onClick={() => setLightbox(null)}
              aria-label="Fechar"
              style={{
                position: "absolute",
                top: "-14px",
                right: "-14px",
                background: "white",
                border: "none",
                borderRadius: "50%",
                width: "36px",
                height: "36px",
                fontSize: "22px",
                lineHeight: 1,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                zIndex: 1,
              }}
            >
              ×
            </button>
            <img
              src={lightbox}
              alt="Foto da medição ampliada"
              style={{
                maxWidth: "90vw",
                maxHeight: "85vh",
                borderRadius: "8px",
                objectFit: "contain",
                boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
              }}
            />
          </div>
        </div>
      )}
    </Layout>
  );
}

export default Measurements;

