// src/pages/MeusRelatorios.jsx
// Relatórios de Medições — painel gerencial exclusivo para Admin e Supervisor.
// Mostra visão consolidada das obras, resumo de status por medição e exportação em CSV.
// Filtros avançados: obra, responsável, período, status, tipo de serviço.
import { useEffect, useState, useCallback, useContext } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import PaginationControls from "../components/PaginationControls";
import { listAllMedicoesPaginado, listMedicoesPaginado } from "../services/medicoesService";
import {
  downloadManagementCsv,
  downloadMedicoesCsv,
} from "../services/managementService";
import { listUsers } from "../services/usersService";
import { API_ORIGIN } from "../services/apiConfig";
import { AuthContext } from "../context/AuthContext";
import { PERFIS } from "../constants/permissions";
import { TIPOS_SERVICO, getTipoServicoLabel, STATUS_CLASS, STATUS_LABEL } from "../constants/medicao";
import { normalizeMedicao } from "../utils/normalizeMedicao";
import useObras from "../hooks/useObras";
import { PAGE_LIMIT_RELATORIOS } from "../constants/pagination";
import api from "../services/api";
import "../styles/pages.css";

// Resolve URL de arquivo (relativa ou absoluta)
function toAbsoluteUrl(source) {
  if (!source) return null;
  if (source.startsWith("http")) return source;
  return `${API_ORIGIN}${source.startsWith("/") ? "" : "/"}${source}`;
}

function getFotoSources(m) {
  const rawSources = [m.foto, m.fotoUrl, m.arquivo, m.arquivoUrl, m.resolvedFotoUrl].filter(Boolean);
  return [...new Set(rawSources.map(toAbsoluteUrl).filter(Boolean))];
}

function getInitialSummary() {
  return { enviada: 0, aprovada: 0, rejeitada: 0 };
}

function MeusRelatorios() {
  const navigate = useNavigate();
  const { user }                     = useContext(AuthContext);
  const perfil                       = user?.perfil;
  const isEncarregado                = perfil === PERFIS.ENCARREGADO;
  const [medicoes, setMedicoes]       = useState([]);
  const { obras }                     = useObras(200);
  const [responsaveis, setResponsaveis] = useState([]);
  const [erro, setErro]               = useState(null);
  const [loading, setLoading]         = useState(true);
  const [expandedId, setExpandedId]   = useState(null);
  const [fotosPorMedicao, setFotosPorMedicao] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems]   = useState(0);
  const [statusSummary, setStatusSummary] = useState(getInitialSummary());

  // Exportação
  const [exportPeriodo, setExportPeriodo] = useState(30);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportErro, setExportErro]       = useState(null);

  // ── Filtros ─────────────────────────────────────────────────────────────────
  const [filtros, setFiltros] = useState({
    obra:        "",
    responsavel: "",
    status:      "",
    tipoServico: "",
    dataInicio:  "",
    dataFim:     "",
  });

  const totalPages      = Math.max(1, Math.ceil(totalItems / PAGE_LIMIT_RELATORIOS));
  const temFiltroAtivo  = Object.values(filtros).some(Boolean);

  // Carrega lista de encarregados uma vez
  useEffect(() => {
    if (isEncarregado) {
      setResponsaveis([]);
      return;
    }

    listUsers({ perfil: "encarregado", limit: 200 })
      .then(setResponsaveis)
      .catch(() => setResponsaveis([]));
  }, [isEncarregado]);

  // Carrega medições aplicando filtros
  const load = useCallback(async () => {
    try {
      setLoading(true);
      setErro(null);

      const params = { page: currentPage, limit: PAGE_LIMIT_RELATORIOS };
      if (filtros.obra)        params.obra        = filtros.obra;
      if (!isEncarregado && filtros.responsavel) params.responsavel = filtros.responsavel;
      if (filtros.status)      params.status      = filtros.status;
      if (filtros.tipoServico) params.tipoServico = filtros.tipoServico;
      if (filtros.dataInicio)  params.dataInicio  = `${filtros.dataInicio}T00:00:00`;
      if (filtros.dataFim)     params.dataFim     = `${filtros.dataFim}T23:59:59`;

      const res = isEncarregado
        ? await listMedicoesPaginado(params)
        : await listAllMedicoesPaginado(params);
      const raw = Array.isArray(res.data) ? res.data : [];
      setMedicoes(raw.map(normalizeMedicao));
      setTotalItems(res.pagination?.totalItems ?? raw.length);
      setStatusSummary({ ...getInitialSummary(), ...(res.statusSummary || {}) });
    } catch {
      setErro("Não foi possível carregar as medições. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, [filtros, currentPage, isEncarregado]);

  useEffect(() => { load(); }, [load]);

  const handleFiltro = (e) => {
    const { name, value } = e.target;
    setCurrentPage(1);
    setFiltros((prev) => ({ ...prev, [name]: value }));
  };

  const limparFiltros = () => {
    setCurrentPage(1);
    setFiltros({ obra: "", responsavel: "", status: "", tipoServico: "", dataInicio: "", dataFim: "" });
  };

  // Clique em badge de status aplica/remove filtro
  const toggleStatusFiltro = (key) => {
    setCurrentPage(1);
    setFiltros((prev) => ({ ...prev, status: prev.status === key ? "" : key }));
  };

  /**
   * Expande/recolhe o card e, ao expandir, resolve a URL do anexo sob demanda.
   */
  const toggleExpand = useCallback(async (med) => {
    setExpandedId((prev) => (prev === med.id ? null : med.id));

    if (fotosPorMedicao[med.id] !== undefined) return;

    const directUrls = getFotoSources(med);
    const ids = Array.isArray(med.anexos)
      ? med.anexos
        .map((anexo) => Number(anexo))
        .filter((anexo) => Number.isInteger(anexo) && anexo > 0)
      : [];

    if (ids.length === 0) {
      setFotosPorMedicao((prev) => ({ ...prev, [med.id]: directUrls.length > 0 ? directUrls : null }));
      return;
    }

    try {
      const settled = await Promise.allSettled(ids.map((anexoId) => api.get(`/files/${anexoId}`)));
      const fileUrls = settled
        .filter((result) => result.status === "fulfilled")
        .map((result) => toAbsoluteUrl(result.value?.data?.data?.url))
        .filter(Boolean);

      const mergedUrls = [...new Set([...directUrls, ...fileUrls])];
      setFotosPorMedicao((prev) => ({ ...prev, [med.id]: mergedUrls.length > 0 ? mergedUrls : null }));
    } catch (err) {
      console.warn(`Não foi possível carregar anexos da medição ${med.id}:`, err.message);
      setFotosPorMedicao((prev) => ({ ...prev, [med.id]: directUrls.length > 0 ? directUrls : null }));
    }
  }, [fotosPorMedicao]);

  // Deriva mês (YYYY-MM) a partir do filtro de data início para exportação
  function derivarMesExport() {
    if (filtros.dataInicio && /^\d{4}-\d{2}/.test(filtros.dataInicio)) {
      return filtros.dataInicio.substring(0, 7);
    }
    return undefined;
  }

  const handleExportObras = async () => {
    setExportErro(null);
    setExportLoading(true);
    try {
      await downloadManagementCsv({ periodo: exportPeriodo });
    } catch {
      setExportErro("Não foi possível gerar o arquivo. Tente novamente.");
    } finally {
      setExportLoading(false);
    }
  };

  const handleExportMedicoes = async () => {
    setExportErro(null);
    setExportLoading(true);
    try {
      await downloadMedicoesCsv({
        obraId: filtros.obra || undefined,
        mes:    derivarMesExport(),
      });
    } catch {
      setExportErro("Não foi possível gerar o arquivo. Tente novamente.");
    } finally {
      setExportLoading(false);
    }
  };

  const totalSummary = statusSummary.enviada + statusSummary.aprovada +
    statusSummary.rejeitada;

  return (
    <Layout>
      <div className="page-container">
        <h1 className="page-title">Relatórios de Medições</h1>
        <p className="page-description">
          Acompanhe as medições enviadas pela equipe de campo e exporte relatórios.
        </p>

        {/* ── Painel de Filtros ─────────────────────────────────────────────── */}
        <div className="ss-filters">
          <div className="ss-filters-grid">
            {/* Obra */}
            <div className="ss-filter-field">
              <label className="ss-filter-label" htmlFor="rf-obra">Obra</label>
              <select id="rf-obra" name="obra" className="ss-filter-select" value={filtros.obra} onChange={handleFiltro}>
                <option value="">Todas as obras</option>
                {obras.map((o) => (
                  <option key={o.id} value={o.id}>{o.nome || `Obra #${o.id}`}</option>
                ))}
              </select>
            </div>

            {/* Responsável */}
            {!isEncarregado && (
              <div className="ss-filter-field">
                <label className="ss-filter-label" htmlFor="rf-resp">Responsável</label>
                <select id="rf-resp" name="responsavel" className="ss-filter-select" value={filtros.responsavel} onChange={handleFiltro}>
                  <option value="">Todos</option>
                  {responsaveis.map((u) => (
                    <option key={u.id} value={u.id}>{u.nome}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Status */}
            <div className="ss-filter-field">
              <label className="ss-filter-label" htmlFor="rf-status">Status</label>
              <select id="rf-status" name="status" className="ss-filter-select" value={filtros.status} onChange={handleFiltro}>
                <option value="">Todos os status</option>
                <option value="enviada">Aguardando revisão</option>
                <option value="aprovada">Aprovada</option>
                <option value="rejeitada">Rejeitada</option>
              </select>
            </div>

            {/* Tipo de serviço */}
            <div className="ss-filter-field">
              <label className="ss-filter-label" htmlFor="rf-tipo">Tipo de serviço</label>
              <select id="rf-tipo" name="tipoServico" className="ss-filter-select" value={filtros.tipoServico} onChange={handleFiltro}>
                <option value="">Todos os tipos</option>
                {TIPOS_SERVICO.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            {/* Período */}
            <div className="ss-filter-field ss-filter-field--date">
              <label className="ss-filter-label">Período</label>
              <div className="ss-filter-date-group">
                <input
                  id="rf-ini"
                  type="date"
                  name="dataInicio"
                  className="ss-filter-select ss-filter-date"
                  value={filtros.dataInicio}
                  onChange={handleFiltro}
                  aria-label="Data inicial"
                />
                <span className="ss-filter-date-sep">até</span>
                <input
                  id="rf-fim"
                  type="date"
                  name="dataFim"
                  className="ss-filter-select ss-filter-date"
                  value={filtros.dataFim}
                  onChange={handleFiltro}
                  aria-label="Data final"
                />
              </div>
            </div>

            {/* Ações */}
            <div className="ss-filter-actions">
              {temFiltroAtivo && (
                <button type="button" className="ss-filter-clear" onClick={limparFiltros}>
                  Limpar filtros
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Exportação CSV ───────────────────────────────────────────────── */}
        <div className="mr-export">
          <p className="mr-export-title">Exportar dados</p>
          <p className="mr-export-desc">
            O boletim de medições aplica os filtros de obra e período ativos nesta tela.
          </p>
          <div className="mr-export-row">
            <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
              <label className="ss-filter-label" htmlFor="rf-periodo">Período — painel de obras</label>
              <select
                id="rf-periodo"
                className="mr-export-select"
                value={exportPeriodo}
                onChange={(e) => setExportPeriodo(Number(e.target.value))}
              >
                <option value={7}>Últimos 7 dias</option>
                <option value={30}>Últimos 30 dias</option>
                <option value={60}>Últimos 60 dias</option>
                <option value={90}>Últimos 90 dias</option>
              </select>
            </div>
            <button
              className="mr-export-btn"
              onClick={handleExportObras}
              disabled={exportLoading}
            >
              {exportLoading ? "Gerando..." : "⬇ Painel de obras (CSV)"}
            </button>
            <button
              className="mr-export-btn"
              onClick={handleExportMedicoes}
              disabled={exportLoading}
            >
              {exportLoading ? "Gerando..." : "⬇ Boletim de medições (CSV)"}
            </button>
          </div>
          {exportErro && (
            <p className="erro-msg" style={{ marginTop: "8px", marginBottom: 0 }}>
              {exportErro}
            </p>
          )}
        </div>

        {/* ── Resumo de status (clicável para filtrar) ─────────────────────── */}
        {!loading && totalSummary > 0 && (
          <div className="mr-status-chips">
            {[
              { key: "enviada",   label: "Aguardando revisão", bg: "var(--cor-aviso-clara)",   color: "var(--cor-aviso)"            },
              { key: "aprovada",  label: "Aprovadas",           bg: "var(--cor-sucesso-clara)", color: "var(--cor-sucesso)"          },
              { key: "rejeitada", label: "Rejeitadas",          bg: "var(--cor-perigo-clara)",  color: "var(--cor-perigo)"           },
            ].map(({ key, label, bg, color }) =>
              statusSummary[key] > 0 && (
                <button
                  key={key}
                  onClick={() => toggleStatusFiltro(key)}
                  className={`mr-status-chip${filtros.status === key ? " is-active" : ""}`}
                  style={{ background: bg, color }}
                  title={filtros.status === key ? "Remover filtro" : `Filtrar por: ${label}`}
                >
                  {statusSummary[key]} {label}
                </button>
              )
            )}
          </div>
        )}

        {/* ── Feedbacks ────────────────────────────────────────────────────── */}
        {erro && <p className="erro-msg">{erro}</p>}
        {loading && (
          <p style={{ textAlign: "center", padding: "var(--espacamento-xl)" }}>
            Carregando medições...
          </p>
        )}

        {!erro && !loading && medicoes.length === 0 && (
          <div className="card" style={{ textAlign: "center", padding: "var(--espacamento-xl)" }}>
            <p style={{ marginBottom: 0, color: "var(--cor-texto-secundario)" }}>
              {temFiltroAtivo
                ? "Nenhuma medição encontrada para os filtros selecionados. Tente ajustar os critérios de busca."
                : "Nenhuma medição registrada ainda."}
            </p>
          </div>
        )}

        {!loading && medicoes.length > 0 && (
          <>
            <p className="mr-listagem-info">
              Exibindo {medicoes.length} de {totalItems} {totalItems !== 1 ? "medições" : "medição"}
              {temFiltroAtivo ? " (filtros ativos)" : ""}.
            </p>

            <div key={`reports-page-${currentPage}`} className="page-transition-fade page-transition-fade--stack">
              {medicoes.map((m) => {
                const fotosMedicao = fotosPorMedicao[m.id] !== undefined ? fotosPorMedicao[m.id] : getFotoSources(m);
                const expanded  = expandedId === m.id;
                const tipoLabel = getTipoServicoLabel(m.tipoServico);

              // Data da medição (campo data) e data de envio (createdAt)
              const dataMedicao = m.data
                ? new Date(m.data).toLocaleDateString("pt-BR")
                : null;
              const dataEnvio = m.createdAt
                ? `${new Date(m.createdAt).toLocaleDateString("pt-BR")} às ${new Date(m.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
                : null;

                return (
                  <div key={m.id} className="mr-card">
                  {/* ── Cabeçalho do card ────────────────────────────────── */}
                  <div
                    className={`mr-card-header${expanded ? " is-expanded" : ""}`}
                    onClick={() => toggleExpand(m)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && toggleExpand(m)}
                  >
                    <div className="mr-card-info">
                      <p className="mr-card-title">
                        {m.obraNome
                          ? `Obra: ${m.obraNome}`
                          : m.obra
                            ? `Obra #${m.obra}`
                            : "Obra não identificada"}
                      </p>
                      <p className="mr-card-meta">
                        {dataMedicao && <>Medição: {dataMedicao}{dataEnvio && ` · Enviado: ${dataEnvio}`}</>}
                        {!dataMedicao && dataEnvio && <>Enviado em: {dataEnvio}</>}
                        {tipoLabel && ` · ${tipoLabel}`}
                      </p>
                      {m.responsavelNome && (
                        <p className="mr-card-meta">Responsável: {m.responsavelNome}</p>
                      )}
                    </div>

                    <div className="mr-card-right">
                      <span className={`mr-badge ${STATUS_CLASS[m.status] || "enviada"}`}>
                        {STATUS_LABEL[m.status] || m.status || "Enviada"}
                      </span>
                      <span className="mr-card-toggle" aria-hidden="true">
                        {expanded ? "▲" : "▼"}
                      </span>
                    </div>
                  </div>

                  {/* ── Detalhes expandidos ──────────────────────────────── */}
                  {expanded && (
                    <>
                      {/* Motivo de rejeição */}
                      {m.status === "rejeitada" && m.motivoRejeicao && (
                        <div style={{
                          padding: "var(--espacamento-md)",
                          background: "var(--cor-fundo-erro, #fef2f2)",
                          border: "1px solid var(--cor-erro, #ef4444)",
                          borderRadius: "var(--borda-radius)",
                          marginBottom: "var(--espacamento-md)",
                        }}>
                          <strong>Motivo da rejeição:</strong>
                          <p style={{ margin: "4px 0 0 0" }}>{m.motivoRejeicao}</p>
                        </div>
                      )}

                      {/* Área e Serviço */}
                      <div className="details-grid-2">
                        {m.areaNome && (
                          <p style={{ margin: 0 }}>
                            <strong>Ambiente:</strong> {m.areaNome}
                          </p>
                        )}
                        {m.area != null && !isNaN(m.area) && (
                          <p style={{ margin: 0 }}>
                            <strong>Área calculada:</strong> {Number(m.area).toFixed(2)} m²
                          </p>
                        )}
                        {m.volume != null && !isNaN(m.volume) && m.volume > 0 && (
                          <p style={{ margin: 0 }}>
                            <strong>Volume:</strong> {Number(m.volume).toFixed(2)} m³
                          </p>
                        )}
                        {tipoLabel && (
                          <p style={{ margin: 0 }}>
                            <strong>Tipo de serviço:</strong> {tipoLabel}
                          </p>
                        )}
                      </div>

                      {/* Itens da medição (tabela com valor) */}
                      {m.itens.length > 0 && (
                        <div style={{ marginBottom: "var(--espacamento-md)" }}>
                          <p style={{ fontWeight: 700, marginBottom: "var(--espacamento-sm)" }}>
                            Itens medidos:
                          </p>
                          <div style={{ overflowX: "auto" }}>
                            <table className="measurements-table" style={{ fontSize: "var(--tamanho-fonte-pequena)" }}>
                              <thead>
                                <tr>
                                  <th>Descrição</th>
                                  <th>Quantidade</th>
                                  <th>Unidade</th>
                                  <th>Ambiente/Local</th>
                                </tr>
                              </thead>
                              <tbody>
                                {m.itens.map((item, idx) => (
                                  <tr key={idx}>
                                    <td>{item.descricao || "—"}</td>
                                    <td>
                                      {item.quantidade != null && !isNaN(item.quantidade)
                                        ? Number(item.quantidade).toFixed(2)
                                        : "—"}
                                    </td>
                                    <td>{item.unidade || "—"}</td>
                                    <td>{item.local || "—"}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Observações */}
                      {m.observacoes && (
                        <div style={{
                          padding: "var(--espacamento-md)",
                          background: "var(--cor-fundo)",
                          borderRadius: "var(--borda-radius)",
                          marginBottom: "var(--espacamento-md)",
                        }}>
                          <strong>Observações / Problemas identificados:</strong>
                          <p style={{ marginTop: "var(--espacamento-xs)", marginBottom: 0 }}>
                            {m.observacoes}
                          </p>
                        </div>
                      )}

                      {/* Botão de edição para rascunhos e medições rejeitadas */}
                      {(m.status === "rascunho" || m.status === "rejeitada") && (
                        <div style={{ marginTop: "var(--espacamento-md)", display: "flex", gap: "var(--espacamento-sm)" }}>
                          <button
                            className="button-secondary"
                            onClick={(e) => { e.stopPropagation(); navigate(`/medicoes?editar=${m.id}`); }}
                            style={{ padding: "8px 18px" }}
                          >
                            {m.status === "rascunho" ? "Continuar rascunho" : "Corrigir e reenviar"}
                          </button>
                        </div>
                      )}

                      {/* Arquivo/Foto anexada */}
                      {Array.isArray(fotosMedicao) && fotosMedicao.length > 0 ? (
                        <div style={{ marginTop: "var(--espacamento-md)" }}>
                          <p style={{ fontWeight: 700, marginBottom: "var(--espacamento-sm)" }}>
                            Fotos anexadas ({fotosMedicao.length}):
                          </p>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "var(--espacamento-sm)" }}>
                            {fotosMedicao.map((fotoUrl, idx) => (
                              <img
                                key={`${m.id}-foto-${idx}`}
                                src={fotoUrl}
                                alt={`Foto da medição ${idx + 1}`}
                                style={{
                                  width: "100%",
                                  maxWidth: "180px",
                                  aspectRatio: "1 / 1",
                                  objectFit: "cover",
                                  borderRadius: "var(--borda-radius)",
                                  border: "1px solid var(--cor-borda)",
                                }}
                                onError={(e) => { e.target.style.display = "none"; }}
                              />
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p style={{ color: "var(--cor-texto-secundario)", fontSize: "var(--tamanho-fonte-pequena)", marginTop: "var(--espacamento-sm)" }}>
                          Sem arquivo anexado.
                        </p>
                      )}
                    </>
                  )}
                  </div>
                );
              })}
            </div>

            {/* ── Paginação ──────────────────────────────────────────── */}
            {totalPages > 1 && (
              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                loading={loading}
                onChangePage={setCurrentPage}
                className="measurements-pagination"
              />
            )}
          </>
        )}
      </div>
    </Layout>
  );
}

export default MeusRelatorios;
