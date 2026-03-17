// src/pages/MeusRelatorios.jsx
// Relatórios de Medições — painel gerencial exclusivo para Admin e Supervisor.
// Mostra visão consolidada das obras, resumo de status por medição e exportação em CSV.
// Filtros avançados: obra, responsável, período, status, tipo de serviço.
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import { listAllMedicoesPaginado } from "../services/medicoesService";
import {
  downloadManagementCsv,
  downloadMedicoesCsv,
} from "../services/managementService";
import { listUsers } from "../services/usersService";
import { TIPOS_SERVICO, getTipoServicoLabel, STATUS_CLASS, STATUS_LABEL } from "../constants/medicao";
import { normalizeMedicao } from "../utils/normalizeMedicao";
import useObras from "../hooks/useObras";
import { PAGE_LIMIT_RELATORIOS } from "../constants/pagination";
import api from "../services/api";
import "../styles/pages.css";

const BASE_URL = (process.env.REACT_APP_API_URL || "http://localhost:5000/api").replace(/\/api\/?$/, "");

// Resolve URL de arquivo (relativa ou absoluta)
function getFotoUrl(m) {
  const caminho = m.foto || m.fotoUrl || m.arquivo || m.arquivoUrl;
  const source = caminho || m.resolvedFotoUrl;
  if (!source) return null;
  if (source.startsWith("http")) return source;
  return `${BASE_URL}${source.startsWith("/") ? "" : "/"}${source}`;
}

function getInitialSummary() {
  return { enviada: 0, aprovada: 0, rejeitada: 0, rascunho: 0 };
}

function MeusRelatorios() {
  const navigate = useNavigate();
  const [medicoes, setMedicoes]       = useState([]);
  const { obras }                     = useObras(200);
  const [responsaveis, setResponsaveis] = useState([]);
  const [erro, setErro]               = useState(null);
  const [loading, setLoading]         = useState(true);
  const [expandedId, setExpandedId]   = useState(null);
  const [fotoUrls, setFotoUrls]       = useState({});
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

  const totalPages      = Math.ceil(totalItems / PAGE_LIMIT_RELATORIOS);
  const temFiltroAtivo  = Object.values(filtros).some(Boolean);

  // Carrega lista de encarregados uma vez
  useEffect(() => {
    listUsers({ perfil: "encarregado", limit: 200 })
      .then(setResponsaveis)
      .catch(() => setResponsaveis([]));
  }, []);

  // Carrega medições aplicando filtros
  const load = useCallback(async () => {
    try {
      setLoading(true);
      setErro(null);

      const params = { page: currentPage, limit: PAGE_LIMIT_RELATORIOS };
      if (filtros.obra)        params.obra        = filtros.obra;
      if (filtros.responsavel) params.responsavel = filtros.responsavel;
      if (filtros.status)      params.status      = filtros.status;
      if (filtros.tipoServico) params.tipoServico = filtros.tipoServico;
      if (filtros.dataInicio)  params.dataInicio  = `${filtros.dataInicio}T00:00:00`;
      if (filtros.dataFim)     params.dataFim     = `${filtros.dataFim}T23:59:59`;

      const res = await listAllMedicoesPaginado(params);
      const raw = Array.isArray(res.data) ? res.data : [];
      setMedicoes(raw.map(normalizeMedicao));
      setTotalItems(res.pagination?.totalItems ?? raw.length);
      setStatusSummary({ ...getInitialSummary(), ...(res.statusSummary || {}) });
    } catch {
      setErro("Não foi possível carregar as medições. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, [filtros, currentPage]);

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

    if (fotoUrls[med.id] !== undefined) return;

    const diretUrl = getFotoUrl(med);
    if (diretUrl) {
      setFotoUrls((prev) => ({ ...prev, [med.id]: diretUrl }));
      return;
    }

    const firstAnexoId = Array.isArray(med.anexos) ? med.anexos[0] : null;
    if (!firstAnexoId || typeof firstAnexoId !== "number") {
      setFotoUrls((prev) => ({ ...prev, [med.id]: null }));
      return;
    }

    try {
      const fileRes = await api.get(`/files/${firstAnexoId}`);
      setFotoUrls((prev) => ({ ...prev, [med.id]: fileRes?.data?.data?.url || null }));
    } catch {
      setFotoUrls((prev) => ({ ...prev, [med.id]: null }));
    }
  }, [fotoUrls]);

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
      await downloadManagementCsv(exportPeriodo);
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
    statusSummary.rejeitada + statusSummary.rascunho;

  return (
    <Layout>
      <div className="page-container">
        <h1 className="page-title">Relatórios de Medições</h1>
        <p className="page-description">
          Acompanhe as medições enviadas pela equipe de campo e exporte relatórios.
        </p>

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
            {/* Filtro por Obra */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="rf-obra">Obra</label>
              <select id="rf-obra" name="obra" value={filtros.obra} onChange={handleFiltro}>
                <option value="">Todas</option>
                {obras.map((o) => (
                  <option key={o.id} value={o.id}>{o.nome || `Obra #${o.id}`}</option>
                ))}
              </select>
            </div>

            {/* Filtro por Responsável */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="rf-resp">Responsável</label>
              <select id="rf-resp" name="responsavel" value={filtros.responsavel} onChange={handleFiltro}>
                <option value="">Todos</option>
                {responsaveis.map((u) => (
                  <option key={u.id} value={u.id}>{u.nome}</option>
                ))}
              </select>
            </div>

            {/* Filtro por Status */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="rf-status">Status</label>
              <select id="rf-status" name="status" value={filtros.status} onChange={handleFiltro}>
                <option value="">Todos</option>
                <option value="enviada">Aguardando revisão</option>
                <option value="aprovada">Aprovada</option>
                <option value="rejeitada">Rejeitada</option>
                <option value="rascunho">Rascunho</option>
              </select>
            </div>

            {/* Filtro por Tipo de Serviço */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="rf-tipo">Tipo de serviço</label>
              <select id="rf-tipo" name="tipoServico" value={filtros.tipoServico} onChange={handleFiltro}>
                <option value="">Todos</option>
                {TIPOS_SERVICO.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            {/* Filtro Data Início */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="rf-ini">Data início</label>
              <input id="rf-ini" type="date" name="dataInicio" value={filtros.dataInicio} onChange={handleFiltro} />
            </div>

            {/* Filtro Data Fim */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="rf-fim">Data fim</label>
              <input id="rf-fim" type="date" name="dataFim" value={filtros.dataFim} onChange={handleFiltro} />
            </div>

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

        {/* ── Exportação CSV ───────────────────────────────────────────────── */}
        <div
          className="form-container"
          style={{ marginBottom: "var(--espacamento-lg)", padding: "var(--espacamento-md)" }}
        >
          <p style={{ fontWeight: 700, marginBottom: "var(--espacamento-md)", color: "var(--cor-texto-principal)" }}>
            Exportar dados
          </p>
          <div style={{ display: "flex", gap: "var(--espacamento-md)", flexWrap: "wrap", alignItems: "flex-end" }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="rf-periodo">Período (painel de obras)</label>
              <select
                id="rf-periodo"
                value={exportPeriodo}
                onChange={(e) => setExportPeriodo(Number(e.target.value))}
                style={{ minWidth: 160 }}
              >
                <option value={7}>Últimos 7 dias</option>
                <option value={30}>Últimos 30 dias</option>
                <option value={60}>Últimos 60 dias</option>
                <option value={90}>Últimos 90 dias</option>
              </select>
            </div>
            <button
              className="button-secondary"
              onClick={handleExportObras}
              disabled={exportLoading}
              style={{ padding: "10px 18px" }}
            >
              {exportLoading ? "Gerando..." : "⬇ Painel de obras (CSV)"}
            </button>
            <button
              className="button-secondary"
              onClick={handleExportMedicoes}
              disabled={exportLoading}
              style={{ padding: "10px 18px" }}
            >
              {exportLoading ? "Gerando..." : "⬇ Boletim de medições (CSV)"}
            </button>
          </div>
          {exportErro && (
            <p className="erro-msg" style={{ marginTop: "var(--espacamento-sm)", marginBottom: 0 }}>
              {exportErro}
            </p>
          )}
          <p style={{
            marginTop: "var(--espacamento-sm)",
            marginBottom: 0,
            fontSize: "var(--tamanho-fonte-pequena)",
            color: "var(--cor-texto-secundario)",
          }}>
            O boletim de medições aplica os filtros de obra e período ativos nesta tela.
          </p>
        </div>

        {/* ── Resumo de status (clicável para filtrar) ─────────────────────── */}
        {!loading && totalSummary > 0 && (
          <div style={{
            display: "flex",
            gap: "var(--espacamento-sm)",
            flexWrap: "wrap",
            marginBottom: "var(--espacamento-md)",
          }}>
            {[
              { key: "enviada",   label: "Aguardando revisão", bg: "var(--cor-aviso-clara)",   color: "var(--cor-aviso)"            },
              { key: "aprovada",  label: "Aprovadas",           bg: "var(--cor-sucesso-clara)", color: "var(--cor-sucesso)"          },
              { key: "rejeitada", label: "Rejeitadas",          bg: "var(--cor-perigo-clara)",  color: "var(--cor-perigo)"           },
              { key: "rascunho",  label: "Rascunhos",           bg: "var(--cor-fundo)",         color: "var(--cor-texto-secundario)" },
            ].map(({ key, label, bg, color }) =>
              statusSummary[key] > 0 && (
                <button
                  key={key}
                  onClick={() => toggleStatusFiltro(key)}
                  title={filtros.status === key ? "Remover filtro" : `Filtrar por: ${label}`}
                  style={{
                    padding: "5px 14px",
                    borderRadius: "20px",
                    cursor: "pointer",
                    border: filtros.status === key ? `2px solid ${color}` : "2px solid transparent",
                    background: bg,
                    color,
                    fontWeight: 700,
                    fontSize: "var(--tamanho-fonte-pequena)",
                  }}
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
              <p style={{
                marginBottom: "var(--espacamento-md)",
                color: "var(--cor-texto-secundario)",
                fontSize: "var(--tamanho-fonte-pequena)",
              }}>
                Exibindo {medicoes.length} de {totalItems} {totalItems !== 1 ? "medições" : "medição"}
                {temFiltroAtivo ? " (filtros ativos)" : ""}.
              </p>

            {medicoes.map((m) => {
              const fotoUrl   = fotoUrls[m.id] !== undefined ? fotoUrls[m.id] : getFotoUrl(m);
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
                <div key={m.id} className="card" style={{ marginBottom: "var(--espacamento-md)" }}>
                  {/* ── Cabeçalho do card ────────────────────────────────── */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      cursor: "pointer",
                      marginBottom: expanded ? "var(--espacamento-md)" : 0,
                    }}
                    onClick={() => toggleExpand(m)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && toggleExpand(m)}
                  >
                    <div>
                      <p style={{ fontWeight: 700, fontSize: "var(--tamanho-fonte-grande)", margin: 0 }}>
                        {m.obraNome
                          ? `Obra: ${m.obraNome}`
                          : m.obra
                            ? `Obra #${m.obra}`
                            : "Obra não identificada"}
                      </p>
                      <p style={{ margin: "2px 0 0 0", color: "var(--cor-texto-secundario)", fontSize: "var(--tamanho-fonte-pequena)" }}>
                        {dataMedicao && <>Medição: {dataMedicao}{dataEnvio && ` · Enviado em: ${dataEnvio}`}</>}
                        {!dataMedicao && dataEnvio && <>Enviado em: {dataEnvio}</>}
                        {tipoLabel && ` · ${tipoLabel}`}
                      </p>
                      {m.responsavelNome && (
                        <p style={{ margin: "2px 0 0 0", color: "var(--cor-texto-secundario)", fontSize: "var(--tamanho-fonte-pequena)" }}>
                          Responsável: {m.responsavelNome}
                        </p>
                      )}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "var(--espacamento-sm)" }}>
                      <span
                        className={`status-badge ${STATUS_CLASS[m.status] || "pendente"}`}
                        style={{
                          display: "inline-block",
                          padding: "5px 12px",
                          borderRadius: "20px",
                          fontSize: "var(--tamanho-fonte-pequena)",
                          fontWeight: 700,
                          whiteSpace: "nowrap",
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
                        {STATUS_LABEL[m.status] || m.status || "Enviada"}
                      </span>
                      <span style={{ fontSize: "18px", color: "var(--cor-texto-secundario)" }}>
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
                      {fotoUrl ? (
                        <div style={{ marginTop: "var(--espacamento-md)" }}>
                          <p style={{ fontWeight: 700, marginBottom: "var(--espacamento-sm)" }}>
                            Arquivo anexado:
                          </p>
                          <img
                            src={fotoUrl}
                            alt="Foto da medição"
                            style={{
                              maxWidth: "100%",
                              width: "320px",
                              borderRadius: "var(--borda-radius)",
                              border: "1px solid var(--cor-borda)",
                            }}
                            onError={(e) => { e.target.style.display = "none"; }}
                          />
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

            {/* ── Paginação ──────────────────────────────────────────── */}
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
    </Layout>
  );
}

export default MeusRelatorios;
