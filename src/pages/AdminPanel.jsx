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
  const [exportPeriodo, setExportPeriodo] = useState("30");
  const [exportErro, setExportErro] = useState(null);
  const [exportSucesso, setExportSucesso] = useState(null);
  const [exportLoadingKey, setExportLoadingKey] = useState(null);

  const handleExport = async (fn, label, loadingKey) => {
    try {
      setExportLoadingKey(loadingKey);
      setExportErro(null);
      setExportSucesso(null);
      await fn();
      setExportSucesso(`Exportação de ${label} iniciada com sucesso.`);
    } catch (err) {
      const msg = err?.response?.data?.error?.message
        || err?.message
        || `Não foi possível exportar ${label}.`;
      setExportErro(msg);
      setExportSucesso(null);
    } finally {
      setExportLoadingKey(null);
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
      <div className="page-container admin-page">
        <div className="admin-header-row">
          <h1 className="page-title admin-page-title">Painel de Administração</h1>
        </div>
        <p className="page-description admin-page-description">
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
            <section className="admin-section admin-section--spaced" aria-label="Exportar dados">
              <h2 className="section-title admin-section-title">Exportar Dados</h2>

            <div className="form-container admin-export-card">
              <p className="admin-export-section-title">
                Filtros de exportação
              </p>
              <div className="admin-export-grid">
                <div className="form-group admin-export-field">
                  <label className="ss-filter-label" htmlFor="adm-periodo">Período (dias)</label>
                  <select
                    className="ss-filter-select"
                    id="adm-periodo"
                    value={exportPeriodo}
                    onChange={(e) => setExportPeriodo(e.target.value)}
                  >
                    <option value="7">7</option>
                    <option value="15">15</option>
                    <option value="30">30</option>
                    <option value="60">60</option>
                  </select>
                </div>

                <div className="form-group admin-export-field">
                  <label className="ss-filter-label" htmlFor="adm-obra">Obra</label>
                  <select
                    className="ss-filter-select"
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

                <div className="form-group admin-export-field">
                  <label className="ss-filter-label" htmlFor="adm-mes">Mês de referência</label>
                  <input
                    className="ss-filter-input"
                    id="adm-mes"
                    type="month"
                    value={exportMes}
                    onChange={(e) => setExportMes(e.target.value)}
                  />
                </div>
              </div>

              <div className="admin-export-buttons">
                <button
                  className="button-secondary admin-export-button"
                  disabled={exportLoadingKey !== null}
                  onClick={() => handleExport(() => downloadManagementCsv({
                    periodo: Number(exportPeriodo),
                    obraId: exportObraId || undefined,
                    mes: exportMes || undefined,
                  }), "visão gerencial", "gerencial")}
                >
                  {exportLoadingKey === "gerencial" ? "Exportando..." : "Gerencial (CSV)"}
                </button>
                <button
                  className="button-secondary admin-export-button"
                  disabled={exportLoadingKey !== null}
                  onClick={() => handleExport(() => downloadMedicoesCsv({ obraId: exportObraId || undefined, mes: exportMes || undefined }), "boletim CSV", "boletimCsv")}
                >
                  {exportLoadingKey === "boletimCsv" ? "Exportando..." : "Boletim (CSV)"}
                </button>
                <button
                  className="button-secondary admin-export-button"
                  disabled={exportLoadingKey !== null}
                  onClick={() => handleExport(() => downloadBoletimPdf({ obraId: exportObraId || undefined, mes: exportMes || undefined }), "boletim PDF", "boletimPdf")}
                >
                  {exportLoadingKey === "boletimPdf" ? "Exportando..." : "Boletim (PDF)"}
                </button>
              </div>

              {exportErro && (
                <p className="admin-export-error" role="alert">
                  {exportErro}
                </p>
              )}

              {exportSucesso && (
                <p className="admin-export-success" role="status" aria-live="polite">
                  {exportSucesso}
                </p>
              )}
            </div>
            </section>

            {/* Ações rápidas */}
            <section className="admin-section" aria-label="Ações rápidas">
            <h2 className="section-title admin-section-title">Ações Rápidas</h2>

            <div className="buttons-container admin-quick-actions-grid">
              <button className="topic-button admin-topic-button" onClick={() => navigate("/obras")}>
                <span className="topic-button-icon admin-topic-button-icon"><Icon name="building" size={20} /></span>
                <span className="topic-button-title">Gerenciar Obras</span>
                <span className="topic-button-desc">Ver todas as obras cadastradas</span>
              </button>
              <button className="topic-button admin-topic-button" onClick={() => navigate("/medicoes-lista")}>
                <span className="topic-button-icon admin-topic-button-icon"><Icon name="checklist" size={20} /></span>
                <span className="topic-button-title">Aprovar Medições</span>
                <span className="topic-button-desc">Revisar e aprovar medições pendentes</span>
              </button>
              <button className="topic-button admin-topic-button" onClick={() => navigate("/status-solicitacoes")}>
                <span className="topic-button-icon admin-topic-button-icon"><Icon name="cart" size={20} /></span>
                <span className="topic-button-title">Aprovar Solicitações</span>
                <span className="topic-button-desc">Revisar e aprovar solicitações de materiais</span>
              </button>
              <button className="topic-button admin-topic-button" onClick={() => navigate("/relatorios")}>
                <span className="topic-button-icon admin-topic-button-icon"><Icon name="chart" size={20} /></span>
                <span className="topic-button-title">Relatórios</span>
                <span className="topic-button-desc">Ver relatórios e indicadores das obras</span>
              </button>
              <button className="topic-button admin-topic-button" onClick={() => navigate("/register")}>
                <span className="topic-button-icon admin-topic-button-icon"><Icon name="person-add" size={20} /></span>
                <span className="topic-button-title">Cadastrar Funcionário</span>
                <span className="topic-button-desc">Adicionar novo encarregado ou supervisor</span>
              </button>
            </div>
            </section>
          </>
        )}
      </div>
    </Layout>
  );
}

export default AdminPanel;
