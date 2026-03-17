// src/pages/MeusRelatorios.jsx
// Meus Relatórios — exibe as medições enviadas pelo usuário logado.
// Inclui filtros por obra, período, status e tipo de serviço.
// Exibe todos os campos relevantes: área, tipo de serviço, problemas, arquivos.
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import { listMedicoesPaginado } from "../services/medicoesService";
import { TIPOS_SERVICO, getTipoServicoLabel, STATUS_CLASS, STATUS_LABEL } from "../constants/medicao";
import { normalizeMedicao } from "../utils/normalizeMedicao";
import useObras from "../hooks/useObras";
import { PAGE_LIMIT_RELATORIOS } from "../constants/pagination";
import api from "../services/api";
import "../styles/pages.css";

const BASE_URL = (process.env.REACT_APP_API_URL || "http://localhost:5000/api").replace(/\/api\/?$/, "");

// Constantes importadas de ../constants/medicao

// Resolve URL de arquivo (relativa ou absoluta)
function getFotoUrl(m) {
  const caminho = m.foto || m.fotoUrl || m.arquivo || m.arquivoUrl;
  const source = caminho || m.resolvedFotoUrl;
  if (!source) return null;
  if (source.startsWith("http")) return source;
  return `${BASE_URL}${source.startsWith("/") ? "" : "/"}${source}`;
}

function MeusRelatorios() {
  const navigate = useNavigate();
  const [medicoes, setMedicoes]     = useState([]);
  const { obras }                   = useObras(200);
  const [erro, setErro]             = useState(null);
  const [loading, setLoading]       = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [fotoUrls, setFotoUrls]     = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems]   = useState(0);

  // ── filtros ─────────────────────────────────────────────────────────────────
  const [filtros, setFiltros] = useState({
    obra:        "",
    status:      "",
    tipoServico: "",
    dataInicio:  "",
    dataFim:     "",
  });

  // Carrega medições aplicando filtros
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setErro(null);

        // Monta apenas filtros não-vazios
        const params = { page: currentPage, limit: PAGE_LIMIT_RELATORIOS };
        if (filtros.obra)        params.obra        = filtros.obra;
        if (filtros.status)      params.status      = filtros.status;
        if (filtros.tipoServico) params.tipoServico = filtros.tipoServico;
        if (filtros.dataInicio)  params.dataInicio  = `${filtros.dataInicio}T00:00:00`;
        if (filtros.dataFim)     params.dataFim     = `${filtros.dataFim}T23:59:59`;

        const res = await listMedicoesPaginado(params);
        const raw = Array.isArray(res) ? res : res?.data || [];
        setMedicoes(raw.map(normalizeMedicao));
        setTotalItems(res?.pagination?.totalItems ?? raw.length);
      } catch (err) {

        setErro("Não foi possível carregar as medições.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [filtros, currentPage]); // re-executa ao mudar filtro ou página

  const handleFiltro = (e) => {
    const { name, value } = e.target;
    setCurrentPage(1);
    setFiltros((prev) => ({ ...prev, [name]: value }));
  };

  const limparFiltros = () => {
    setCurrentPage(1);
    setFiltros({ obra: "", status: "", tipoServico: "", dataInicio: "", dataFim: "" });
  };

  const temFiltroAtivo = Object.values(filtros).some(Boolean);

  /**
   * Expande/recolhe o card e, ao expandir, resolve a URL do anexo sob demanda.
   * Elimina o problema de N+1 requests ao carregar a lista.
   */
  const toggleExpand = useCallback(async (med) => {
    setExpandedId((prev) => {
      if (prev === med.id) return null;
      return med.id;
    });

    // Resolve a URL do arquivo apenas uma vez por medição
    if (fotoUrls[med.id] !== undefined) return; // já resolvido anteriormente

    const firstAnexoId = Array.isArray(med.anexos) ? med.anexos[0] : null;
    // Tenta resolver a URL via campo direto da medição (foto, fotoUrl, etc.)
    const diretUrl = getFotoUrl(med);
    if (diretUrl) {
      setFotoUrls((prev) => ({ ...prev, [med.id]: diretUrl }));
      return;
    }

    if (!firstAnexoId || typeof firstAnexoId !== "number") {
      setFotoUrls((prev) => ({ ...prev, [med.id]: null }));
      return;
    }

    // Busca a URL pelo ID do arquivo (apenas quando o card é expandido)
    try {
      const fileRes = await api.get(`/files/${firstAnexoId}`);
      const url = fileRes?.data?.data?.url || null;
      setFotoUrls((prev) => ({ ...prev, [med.id]: url }));
    } catch (_) {
      setFotoUrls((prev) => ({ ...prev, [med.id]: null }));
    }
  }, [fotoUrls]);

  return (
    <Layout>
      <div className="page-container">
        <h1 className="page-title">Meus Relatórios</h1>
        <p style={{
          fontSize: "var(--tamanho-fonte-base)",
          color: "var(--cor-texto-secundario)",
          marginBottom: "var(--espacamento-lg)",
        }}>
          Visualize as medições que você enviou com todos os detalhes.
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
            gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
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

            {/* Filtro por Status */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="rf-status">Status</label>
              <select id="rf-status" name="status" value={filtros.status} onChange={handleFiltro}>
                <option value="">Todos</option>
                <option value="enviada">Enviada</option>
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

        {/* ── Feedbacks ────────────────────────────────────────────────────── */}
        {erro && <p className="erro-msg">{erro}</p>}
        {loading && (
          <p style={{ textAlign: "center", padding: "var(--espacamento-xl)" }}>
            Carregando medições...
          </p>
        )}

        {!erro && !loading && medicoes.length === 0 && (
          <div className="card" style={{ textAlign: "center", padding: "var(--espacamento-xl)" }}>
            <p style={{ color: "var(--cor-texto-secundario)" }}>
              {temFiltroAtivo
                ? "Nenhuma medição corresponde aos filtros informados."
                : "Você ainda não enviou nenhuma medição."}
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
              {medicoes.length} de {totalItems} {totalItems !== 1 ? "medições" : "medição"}
              {temFiltroAtivo ? " (filtros ativos)" : ""}.
            </p>

            {medicoes.map((m) => {
              // URL resolvida sob demanda ao expandir o card (fotoUrls[m.id] === undefined = ainda não requisitado)
              const fotoUrl   = fotoUrls[m.id] !== undefined ? fotoUrls[m.id] : getFotoUrl(m);
              const expanded  = expandedId === m.id;
              const tipoLabel = getTipoServicoLabel(m.tipoServico);

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
                      {/* Nome da obra (vem do JOIN) ou ID */}
                      <p style={{ fontWeight: 700, fontSize: "var(--tamanho-fonte-grande)", margin: 0 }}>
                        {m.obraNome
                          ? `Obra: ${m.obraNome}`
                          : m.obra
                            ? `Obra #${m.obra}`
                            : "Obra não identificada"}
                      </p>
                      <p style={{ margin: "4px 0 0 0", color: "var(--cor-texto-secundario)", fontSize: "var(--tamanho-fonte-pequena)" }}>
                        {m.createdAt
                          ? `${new Date(m.createdAt).toLocaleDateString("pt-BR")} às ${new Date(m.createdAt).toLocaleTimeString("pt-BR")}`
                          : "Data não disponível"}
                        {tipoLabel && ` · ${tipoLabel}`}
                      </p>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "var(--espacamento-sm)" }}>
                      <span
                        className={`status-badge ${STATUS_CLASS[m.status] || "pendente"}`}
                        style={{
                          padding: "5px 12px",
                          borderRadius: "20px",
                          fontSize: "var(--tamanho-fonte-pequena)",
                          fontWeight: 700,
                          whiteSpace: "nowrap",
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
                      {/* Área e Serviço */}
                      <div className="details-grid-2">
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
                        {m.descricao && (
                          <p style={{ margin: 0 }}>
                            <strong>Descrição:</strong> {m.descricao}
                          </p>
                        )}
                      </div>

                      {/* Itens da medição (tabela resumida) */}
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
                                  <th>Qtd.</th>
                                  <th>Unidade</th>
                                  <th>Local</th>
                                </tr>
                              </thead>
                              <tbody>
                                {m.itens.map((item, idx) => (
                                  <tr key={idx}>
                                    <td>{item.descricao || "—"}</td>
                                    <td>{item.quantidade != null && !isNaN(item.quantidade) ? Number(item.quantidade).toFixed(2) : "—"}</td>
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
                            {m.status === "rascunho" ? "Editar rascunho" : "Corrigir e reenviar"}
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
            {Math.ceil(totalItems / 20) > 1 && (
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
                  Página {currentPage} de {Math.ceil(totalItems / 20)}
                </span>
                <button
                  className="button-secondary"
                  onClick={() => setCurrentPage((p) => Math.min(Math.ceil(totalItems / 20), p + 1))}
                  disabled={currentPage === Math.ceil(totalItems / 20) || loading}
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
