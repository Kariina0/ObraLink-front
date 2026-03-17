// src/pages/AdminPanel.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import Icon from "../components/Icons";
import api from "../services/api";
import useObras from "../hooks/useObras";
import {
  downloadManagementCsv,
  downloadMedicoesCsv,
  downloadBoletimPdf,
} from "../services/managementService";
import "../styles/pages.css";

/**
 * Painel de Administração — acesso exclusivo do perfil Admin.
 *
 * Estatísticas obtidas via GET /api/stats que usa COUNT SQL real,
 * evitando o bug anterior de limitar a 100 registros e contar localmente.
 */
function AdminPanel() {
  const navigate = useNavigate();
  const { obras } = useObras(200);
  const [exportMes, setExportMes] = useState(new Date().toISOString().slice(0, 7));
  const [exportObraId, setExportObraId] = useState("");
  const [exportPeriodo, setExportPeriodo] = useState(30);
  const [exportErro, setExportErro] = useState(null);

  const handleExport = async (fn, label) => {
    try {
      setExportErro(null);
      await fn();
    } catch (err) {
      const msg = err?.response?.data?.error?.message
        || err?.message
        || `Não foi possível exportar ${label}.`;
      setExportErro(msg);
    }
  };

  const [stats, setStats] = useState({
    totalObras: null,
    totalMedicoes: null,
    medicoesPendentes: null,
    medicoesAprovadas: null,
    totalSolicitacoes: null,
    solicitacoesPendentes: null,
    totalArquivos: null,
  });
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    const loadStats = async () => {
      try {
        setLoading(true);
        setErro(null);

        // Endpoint dedicado com COUNT SQL real — sem limite artificial
        const res = await api.get("/stats");
        const data = res.data?.data || {};

        setStats({
          totalObras:            data.totalObras            ?? null,
          totalMedicoes:         data.totalMedicoes         ?? null,
          medicoesPendentes:     data.medicoesPendentes     ?? null,
          medicoesAprovadas:     data.medicoesAprovadas     ?? null,
          totalSolicitacoes:     data.totalSolicitacoes     ?? null,
          solicitacoesPendentes: data.solicitacoesPendentes ?? null,
          totalArquivos:         data.totalArquivos         ?? null,
        });

      } catch (err) {
        setErro("Não foi possível carregar as estatísticas do sistema.");
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, []);

  const StatCard = ({ label, value, sub, destaque, variant }) => (
    <div className={`admin-stat-card${variant ? ` admin-stat-card--${variant}` : ""}`}>
      <p className="admin-stat-label">{label}</p>
      <p className={`admin-stat-value${destaque ? " admin-stat-value--destaque" : ""}`}>
        {value !== null && value !== undefined ? value : "—"}
      </p>
      {sub && <p className="admin-stat-sub">{sub}</p>}
    </div>
  );

  return (
    <Layout>
      <div className="page-container" style={{ maxWidth: "1000px" }}>
        <h1 className="page-title">Painel de Administração</h1>
        <p className="page-description">
          Visão geral do sistema. Acompanhe os principais indicadores e gerencie os recursos.
        </p>

        {erro && <p className="erro-msg">{erro}</p>}

        {loading && (
          <p className="admin-loading">Carregando estatísticas…</p>
        )}

        {!loading && (
          <>
            {/* Estatísticas */}
            <div className="admin-grid">
              <StatCard
                label="Total de obras"
                value={stats.totalObras}
                sub="obras cadastradas no sistema"
              />
              <StatCard
                label="Total de medições"
                value={stats.totalMedicoes}
                sub={`${stats.medicoesPendentes ?? "—"} aguardando aprovação · ${stats.medicoesAprovadas ?? "—"} aprovadas`}
                destaque={stats.medicoesPendentes > 0}
                variant={stats.medicoesPendentes > 0 ? "warning" : "success"}
              />
              <StatCard
                label="Total de solicitações"
                value={stats.totalSolicitacoes}
                sub={`${stats.solicitacoesPendentes ?? "—"} pendentes de aprovação`}
                destaque={stats.solicitacoesPendentes > 0}
                variant={stats.solicitacoesPendentes > 0 ? "danger" : "success"}
              />
              <StatCard
                label="Total de arquivos"
                value={stats.totalArquivos}
                sub="documentos e fotos enviados"
                variant="success"
              />
            </div>

            {/* Exportar dados */}
            <hr className="section-divider" />
            <h2 className="section-title">Exportar Dados</h2>

            <div
              className="form-container"
              style={{ marginBottom: "var(--espacamento-lg)", padding: "var(--espacamento-md)" }}
            >
              <p style={{ fontWeight: 700, marginBottom: "var(--espacamento-md)", color: "var(--cor-texto-principal)" }}>
                Filtros de exportação
              </p>
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: "var(--espacamento-md)",
                alignItems: "end",
              }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label htmlFor="adm-periodo">Período (dias)</label>
                  <select
                    id="adm-periodo"
                    value={exportPeriodo}
                    onChange={(e) => setExportPeriodo(Number(e.target.value))}
                  >
                    <option value={7}>7</option>
                    <option value={15}>15</option>
                    <option value={30}>30</option>
                    <option value={60}>60</option>
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label htmlFor="adm-obra">Obra</label>
                  <select
                    id="adm-obra"
                    value={exportObraId}
                    onChange={(e) => setExportObraId(e.target.value)}
                  >
                    <option value="">Todas as obras</option>
                    {obras.map((o) => (
                      <option key={o.id} value={o.id}>{o.nome || `Obra #${o.id}`}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label htmlFor="adm-mes">Mês de referência</label>
                  <input
                    id="adm-mes"
                    type="month"
                    value={exportMes}
                    onChange={(e) => setExportMes(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: "var(--espacamento-sm)", flexWrap: "wrap", marginTop: "var(--espacamento-md)" }}>
                <button
                  className="button-secondary"
                  onClick={() => handleExport(() => downloadManagementCsv(exportPeriodo), "visão gerencial")}
                >
                  Gerencial (CSV)
                </button>
                <button
                  className="button-secondary"
                  onClick={() => handleExport(() => downloadMedicoesCsv({ obraId: exportObraId || undefined, mes: exportMes || undefined }), "boletim CSV")}
                >
                  Boletim (CSV)
                </button>
                <button
                  className="button-secondary"
                  onClick={() => handleExport(() => downloadBoletimPdf({ obraId: exportObraId || undefined, mes: exportMes || undefined }), "boletim PDF")}
                >
                  Boletim (PDF)
                </button>
              </div>

              {exportErro && (
                <p style={{ color: "var(--cor-perigo)", fontSize: "var(--tamanho-fonte-pequena)", margin: "var(--espacamento-sm) 0 0 0" }}>
                  {exportErro}
                </p>
              )}
            </div>

            {/* Ações rápidas */}
            <hr className="section-divider" />
            <h2 className="section-title">Ações Rápidas</h2>

            <div className="buttons-container">
              <button className="topic-button" onClick={() => navigate("/obras")}>
                <span className="topic-button-icon"><Icon name="building" size={22} /></span>
                <span className="topic-button-title">Gerenciar Obras</span>
                <span className="topic-button-desc">Ver todas as obras cadastradas</span>
              </button>
              <button className="topic-button" onClick={() => navigate("/medicoes-lista")}>
                <span className="topic-button-icon"><Icon name="checklist" size={22} /></span>
                <span className="topic-button-title">Aprovar Medições</span>
                <span className="topic-button-desc">Revisar e aprovar medições pendentes</span>
              </button>
              <button className="topic-button" onClick={() => navigate("/status-solicitacoes")}>
                <span className="topic-button-icon"><Icon name="cart" size={22} /></span>
                <span className="topic-button-title">Aprovar Solicitações</span>
                <span className="topic-button-desc">Revisar e aprovar solicitações de materiais</span>
              </button>
              <button className="topic-button" onClick={() => navigate("/relatorios")}>
                <span className="topic-button-icon"><Icon name="chart" size={22} /></span>
                <span className="topic-button-title">Relatórios</span>
                <span className="topic-button-desc">Ver relatórios e indicadores das obras</span>
              </button>
              <button className="topic-button" onClick={() => navigate("/register")}>
                <span className="topic-button-icon"><Icon name="person-add" size={22} /></span>
                <span className="topic-button-title">Cadastrar Funcionário</span>
                <span className="topic-button-desc">Adicionar novo encarregado ou supervisor</span>
              </button>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}

export default AdminPanel;
