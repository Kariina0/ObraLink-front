// src/pages/GerenciarObras.jsx
// Gerenciar Obras — listagem, cadastro (admin) e edição (admin) de obras.
// Administradores também podem vincular/desvincular encarregados responsáveis.
import React, { useContext, useState, useEffect, useCallback, useRef } from "react";
import Layout from "../components/Layout";
import {
  listObras,
  createObra,
  deleteObra,
  updateObra,
  vincularEncarregado,
  desvincularEncarregado,
  getEncarregadosDisponiveis,
} from "../services/obrasService";
import { extractApiMessage } from "../services/response";
import { AuthContext } from "../context/AuthContext";
import { isAdmin } from "../constants/permissions";
import { PAGE_LIMIT_OBRAS } from "../constants/pagination";
import "../styles/pages.css";
import "../styles/modal.css";

// ─── Labels de status ─────────────────────────────────────────────────────────
// Sincronizados com STATUS_OBRA do back-end (constants/index.js).
const STATUS_LABELS = {
  em_andamento: "Em andamento",
  concluida:    "Concluída",
  paralisada:   "Paralisada",
  planejamento: "Planejamento",
  pausada:      "Pausada",
  cancelada:    "Cancelada",
};

// Formulário vazio padrão para criar nova obra
const FORM_VAZIO = {
  nome:                "",
  codigo:              "",
  cliente:             "",
  endereco:            "",
  dataInicio:          "",
  dataPrevisaoTermino: "",
  dataTermino:         "",
  status:              "planejamento",
  descricao:           "",
  observacoes:         "",
};

function GerenciarObras() {
  const { user } = useContext(AuthContext);
  const admin      = isAdmin(user?.perfil);
  const supervisor = user?.perfil === "supervisor";

  // ── listagem server-side ──────────────────────────────────────────────────────────────────
  const [obras, setObras]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [erro, setErro]                 = useState(null);

  // ── filtros ──────────────────────────────────────────────────────────────────────
  const [busca, setBusca]               = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const buscaTimerRef                   = useRef(null);
  const [displayPage, setDisplayPage]   = useState(1);

  // ── seleção de obra para exibir detalhes / editar ───────────────────────────
  const [obraSelecionada, setObraSelecionada] = useState(null);

  // ── modo: "list" | "create" | "edit" | "encarregados" ──────────────────────
  const [modo, setModo] = useState("list");

  // ── formulário de obra ───────────────────────────────────────────────────────
  const [form, setForm]           = useState(FORM_VAZIO);
  const [formLoading, setFormLoading] = useState(false);
  const [formErro, setFormErro]   = useState(null);
  const [formSucesso, setFormSucesso] = useState(null);

  // ── gestão de encarregados ───────────────────────────────────────────────────
  const [usuarios, setUsuarios]       = useState([]);
  const [userLoading, setUserLoading] = useState(false);
  const [userIdNovo, setUserIdNovo]   = useState("");
  const [funcaoNova, setFuncaoNova]   = useState("encarregado");
  const [encLoading, setEncLoading]   = useState(false);
  const [encErro, setEncErro]         = useState(null);

  // ── confirmação de exclusão por modal ────────────────────────────────────────
  const [obraParaRemover, setObraParaRemover] = useState(null);
  const [removendoObraId, setRemovendoObraId] = useState(null);

  // ── carregamento de usuários disponíveis (apenas quando abre painel de encarregados) ────
  // ── Fetch de obras com filtros server-side ──────────────────────────────────────
  const carregarObras = useCallback(async (q = "", status = "") => {
    setLoading(true);
    setErro(null);
    try {
      const params = { page: 1, limit: 100 };
      if (q.trim())  params.q      = q.trim();
      if (status)    params.status = status;
      const data = await listObras(params);
      setObras(Array.isArray(data) ? data : []);
    } catch {
      setErro("Não foi possível carregar as obras. Verifique a conexão e tente novamente.");
      setObras([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // função que usa filtros atuais (para recarregar after criar/editar)
  const loadObras = useCallback(
    () => carregarObras(busca, filtroStatus),
    [busca, filtroStatus, carregarObras],
  );

  // Carga inicial + recarrega ao mudar filtros (debounce 500ms na busca textual)
  useEffect(() => {
    clearTimeout(buscaTimerRef.current);
    buscaTimerRef.current = setTimeout(
      () => carregarObras(busca, filtroStatus),
      busca ? 500 : 0,
    );
    return () => clearTimeout(buscaTimerRef.current);
  }, [busca, filtroStatus, carregarObras]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setDisplayPage(1);
  }, [busca, filtroStatus]);

  const loadUsuarios = async (obraId) => {
    try {
      setUserLoading(true);
      setEncErro(null);
      const data = await getEncarregadosDisponiveis(obraId);
      setUsuarios(Array.isArray(data) ? data : []);
    } catch (err) {
      setEncErro("Não foi possível carregar os usuários disponíveis. Tente novamente.");
      setUsuarios([]);
    } finally {
      setUserLoading(false);
    }
  };

  // Filtros aplicados via API — `obras` já reflete busca e status atuais.

  // ── Abre formulário de criação ───────────────────────────────────────────────
  const abrirCriar = () => {
    setForm(FORM_VAZIO);
    setFormErro(null);
    setFormSucesso(null);
    setModo("create");
  };

  // ── Abre formulário de edição ───────────────────────────────────────────────
  const abrirEditar = (obra) => {
    setObraSelecionada(obra);
    setForm({
      nome:                obra.nome                || "",
      codigo:              obra.codigo              || "",
      cliente:             obra.cliente             || "",
      endereco:            typeof obra.endereco === "string" ? obra.endereco : "",
      dataInicio:          obra.dataInicio
        ? obra.dataInicio.substring(0, 10)
        : "",
      dataPrevisaoTermino: obra.dataPrevisaoTermino
        ? obra.dataPrevisaoTermino.substring(0, 10)
        : "",
      dataTermino:         obra.dataTermino
        ? obra.dataTermino.substring(0, 10)
        : "",
      status:              obra.status              || "planejamento",
      descricao:           obra.descricao           || "",
      observacoes:         obra.observacoes         || "",
    });
    setFormErro(null);
    setFormSucesso(null);
    setModo("edit");
  };

  // ── Abre painel de encarregados ─────────────────────────────────────────────
  const abrirEncarregados = (obra) => {
    setObraSelecionada(obra);
    setEncErro(null);
    setUserIdNovo("");
    setFuncaoNova("");
    loadUsuarios(obra.id);
    setModo("encarregados");
  };

  // ── Voltar para a lista ─────────────────────────────────────────────────────
  const voltar = () => {
    setModo("list");
    setObraSelecionada(null);
    setFormErro(null);
    setFormSucesso(null);
  };

  // ── Alterar campo do formulário ─────────────────────────────────────────────
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // ── Salvar obra (criar ou editar) ───────────────────────────────────────────
  const handleSalvar = async (e) => {
    e.preventDefault();
    setFormErro(null);
    setFormSucesso(null);

    if (!form.nome.trim()) {
      setFormErro("O nome da obra é obrigatório.");
      return;
    }

    try {
      setFormLoading(true);
      if (modo === "create") {
        await createObra(form);
        setFormSucesso("Obra cadastrada com sucesso! Retornando para a lista...");
        setForm(FORM_VAZIO);
        await loadObras();
        setTimeout(voltar, 1800);
      } else {
        await updateObra(obraSelecionada.id, form);
        setFormSucesso("Obra atualizada com sucesso!");
        await loadObras();
      }
    } catch (err) {
      setFormErro(extractApiMessage(err, "Não foi possível salvar a obra."));
    } finally {
      setFormLoading(false);
    }
  };

  // ── Excluir obra ────────────────────────────────────────────────────────────
  const handleExcluir = (obra) => {
    setObraParaRemover(obra);
  };

  const confirmExcluir = async () => {
    if (!obraParaRemover) return;
    try {
      setRemovendoObraId(obraParaRemover.id);
      await deleteObra(obraParaRemover.id);
      setObraParaRemover(null);
      await loadObras();
    } catch (err) {
      setErro(extractApiMessage(err, "Não foi possível remover a obra."));
    } finally {
      setRemovendoObraId(null);
    }
  };

  // ── Vincular encarregado ────────────────────────────────────────────────────
  const handleVincular = async (e) => {
    e.preventDefault();
    setEncErro(null);
    if (!userIdNovo) {
      setEncErro("Selecione um encarregado.");
      return;
    }
    try {
      setEncLoading(true);
      const obraAtualizada = await vincularEncarregado(
        obraSelecionada.id,
        Number(userIdNovo),
        funcaoNova,
      );
      // Atualiza a obra selecionada com a lista de encarregados atualizada
      setObraSelecionada(obraAtualizada);
      // Recarrega usuários disponíveis (remove o vinculado do dropdown)
      await loadUsuarios(obraSelecionada.id);
      // Atualiza na lista principal
      await loadObras();
      setUserIdNovo("");
      setFuncaoNova("");
    } catch (err) {
      setEncErro(extractApiMessage(err, "Não foi possível vincular o encarregado."));
    } finally {
      setEncLoading(false);
    }
  };

  // ── Desvincular encarregado ─────────────────────────────────────────────────
  const handleDesvincular = async (userId) => {
    setEncErro(null);
    try {
      setEncLoading(true);
      const obraAtualizada = await desvincularEncarregado(obraSelecionada.id, userId);
      setObraSelecionada(obraAtualizada);
      // Recarrega usuários disponíveis (o desvinculado volta para o dropdown)
      await loadUsuarios(obraSelecionada.id);
      await loadObras();
    } catch (err) {
      setEncErro(extractApiMessage(err, "Não foi possível desvincular o encarregado."));
    } finally {
      setEncLoading(false);
    }
  };

  // ════════════════════════════════════════════════════════════════════════════
  //  RENDER
  // ════════════════════════════════════════════════════════════════════════════

  // ── Formulário de criação/edição ────────────────────────────────────────────
  if (modo === "create" || modo === "edit") {
    return (
      <Layout>
        <div className="page-container" style={{ maxWidth: "860px" }}>
          <button className="button-secondary" onClick={voltar} style={{ marginBottom: "var(--espacamento-lg)" }}>
            ← Voltar para lista
          </button>
          <h1 className="page-title">
            {modo === "create" ? "Cadastrar nova obra" : `Editar: ${obraSelecionada?.nome || `Obra #${obraSelecionada?.id}`}`}
          </h1>
          <p className="page-description">
            {modo === "create"
              ? "Preencha os dados da nova obra. Campos marcados com * são obrigatórios."
              : "Edite os dados da obra conforme necessário. Campos marcados com * são obrigatórios."}
          </p>

          {formErro   && <p className="erro-msg">{formErro}</p>}
          {formSucesso && (
            <div style={{
              background: "#d1fae5",
              border: "1px solid #6ee7b7",
              borderRadius: "var(--borda-radius)",
              padding: "var(--espacamento-md)",
              marginBottom: "var(--espacamento-lg)",
              color: "#065f46",
              fontWeight: 600,
            }}>
              {formSucesso}
            </div>
          )}

          <form className="form-container" onSubmit={handleSalvar}>
            {/* ── Dados básicos ────────────────────────────────────────── */}
            <div className="form-grid-2">
              <div className="form-group">
                <label htmlFor="o-nome">Nome da obra *</label>
                <input
                  id="o-nome"
                  name="nome"
                  type="text"
                  value={form.nome}
                  onChange={handleChange}
                  placeholder="Ex: Residencial Vista Verde"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="o-codigo">Código</label>
                <input
                  id="o-codigo"
                  name="codigo"
                  type="text"
                  value={form.codigo}
                  onChange={handleChange}
                  placeholder="Gerado automaticamente se vazio"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="o-cliente">Cliente / Contratante</label>
              <input
                id="o-cliente"
                name="cliente"
                type="text"
                value={form.cliente}
                onChange={handleChange}
                placeholder="Nome do cliente ou empresa contratante"
              />
            </div>

            <div className="form-group">
              <label htmlFor="o-endereco">Endereço / Localização</label>
              <input
                id="o-endereco"
                name="endereco"
                type="text"
                value={form.endereco}
                onChange={handleChange}
                placeholder="Rua, número, bairro, cidade/UF"
              />
            </div>

            {/* ── Datas ────────────────────────────────────────────────── */}
            <div className="form-grid-2">
              <div className="form-group">
                <label htmlFor="o-ini">Data de início</label>
                <input id="o-ini" name="dataInicio" type="date" value={form.dataInicio} onChange={handleChange} />
              </div>

              <div className="form-group">
                <label htmlFor="o-fim">Previsão de término</label>
                <input id="o-fim" name="dataPrevisaoTermino" type="date" value={form.dataPrevisaoTermino} onChange={handleChange} />
              </div>
            </div>

            {/* Data de conclusão — exibida na edição ou quando status = concluída */}
            {(modo === "edit" || form.status === "concluida") && (
              <div className="form-group">
                <label htmlFor="o-termino">Data de conclusão</label>
                <input id="o-termino" name="dataTermino" type="date" value={form.dataTermino} onChange={handleChange} />
              </div>
            )}

            {/* ── Status ───────────────────────────────────────────────── */}
            <div className="form-group">
              <label htmlFor="o-status">Status</label>
              <select id="o-status" name="status" value={form.status} onChange={handleChange}>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            {/* ── Descrição ────────────────────────────────────────────── */}
            <div className="form-group">
              <label htmlFor="o-desc">Descrição</label>
              <textarea
                id="o-desc"
                name="descricao"
                rows={3}
                value={form.descricao}
                onChange={handleChange}
                placeholder="Descrição geral da obra, escopo, finalidade..."
              />
            </div>

            {/* ── Observações ──────────────────────────────────────────── */}
            <div className="form-group">
              <label htmlFor="o-obs">Observações</label>
              <textarea
                id="o-obs"
                name="observacoes"
                rows={2}
                value={form.observacoes}
                onChange={handleChange}
                placeholder="Restrições, informações adicionais, etc."
              />
            </div>

            <button
              type="submit"
              className="button-primary"
              disabled={formLoading}
            >
              {formLoading
                ? "Salvando..."
                : modo === "create"
                  ? "Cadastrar obra"
                  : "Salvar alterações"}
            </button>
          </form>
        </div>
      </Layout>
    );
  }

  // ── Painel de Encarregados ──────────────────────────────────────────────────
  if (modo === "encarregados" && obraSelecionada) {
    const encarregadosVinculados = Array.isArray(obraSelecionada.encarregados)
      ? obraSelecionada.encarregados
      : [];

    // usuarios já vem do endpoint /disponiveis — exclui os vinculados no servidor
    // Filtro local como fallback para evitar duplicatas após estado parcial
    const idsVinculados = new Set(encarregadosVinculados.map((e) => Number(e.userId ?? e.id)));
    const usuariosDisponiveis = usuarios.filter((u) => !idsVinculados.has(Number(u.id)));

    return (
      <Layout>
        <div className="page-container" style={{ maxWidth: "760px" }}>
          <button className="button-secondary" onClick={voltar} style={{ marginBottom: "var(--espacamento-lg)" }}>
            ← Voltar para lista
          </button>

          <h1 className="page-title">
            Encarregados — {obraSelecionada.nome || `Obra #${obraSelecionada.id}`}
          </h1>
          <p className="page-description">
            Adicione ou remova os colaboradores vinculados a esta obra. A função
            exibida corresponde ao perfil do usuário no sistema.
          </p>

          {encErro && <p className="erro-msg">{encErro}</p>}

          {/* ── Lista de encarregados vinculados ──────────────────────── */}
          <div className="form-container" style={{ marginBottom: "var(--espacamento-lg)" }}>
            <p style={{ fontWeight: 700, marginBottom: "var(--espacamento-md)" }}>
              Encarregados vinculados ({encarregadosVinculados.length})
            </p>
            {encarregadosVinculados.length === 0 ? (
              <p style={{ color: "var(--cor-texto-secundario)" }}>
                Nenhum encarregado vinculado a esta obra.
              </p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="measurements-table">
                  <thead>
                    <tr>
                      <th>Nome</th>
                      <th>E-mail</th>
                      <th>Perfil no sistema</th>
                      <th>Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {encarregadosVinculados.map((enc) => (
                      <tr key={enc.userId ?? enc.id}>
                        <td>{enc.nome || `#${enc.userId ?? enc.id}`}</td>
                        <td>{enc.email || "—"}</td>
                        <td>{enc.funcao || "encarregado"}</td>
                        <td>
                          <button
                            className="button-danger"
                            disabled={encLoading}
                            onClick={() => handleDesvincular(enc.userId ?? enc.id)}
                            style={{ padding: "8px 14px" }}
                          >
                            Remover
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Formulário para vincular novo encarregado ─────────────── */}
          <div className="form-container">
            <p style={{ fontWeight: 700, marginBottom: "var(--espacamento-md)" }}>
              Adicionar encarregado
            </p>
            {userLoading ? (
              <p>Carregando usuários...</p>
            ) : (
              <form onSubmit={handleVincular}>
                <div className="form-grid-2">
                  <div className="form-group">
                    <label htmlFor="enc-user">Usuário</label>
                    <select
                      id="enc-user"
                      value={userIdNovo}
                      onChange={(e) => {
                        const selectedId = e.target.value;
                        setUserIdNovo(selectedId);
                        const selectedUser = usuariosDisponiveis.find(
                          (u) => String(u.id) === selectedId
                        );
                        setFuncaoNova(selectedUser?.perfil || "");
                      }}
                    >
                      <option value="">Selecione...</option>
                      {usuariosDisponiveis.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.nome || u.email || `#${u.id}`}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="enc-funcao">Perfil no sistema</label>
                    <input
                      id="enc-funcao"
                      type="text"
                      value={funcaoNova}
                      readOnly
                      placeholder="Preenchido automaticamente"
                      title="A função é definida pelo perfil do usuário no sistema"
                      style={{ background: "var(--cor-fundo-input-desabilitado, #f3f4f6)", cursor: "default" }}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="button-primary"
                  disabled={encLoading || !userIdNovo}
                >
                  {encLoading ? "Vinculando..." : "Vincular Encarregado"}
                </button>
              </form>
            )}
          </div>
        </div>
      </Layout>
    );
  }

  // ── Lista de obras (modo principal) ────────────────────────────────────────
  const DISPLAY_LIMIT = PAGE_LIMIT_OBRAS;
  const totalDisplayPages = Math.max(1, Math.ceil(obras.length / DISPLAY_LIMIT));
  const currentDisplayPage = Math.min(displayPage, totalDisplayPages);
  const obrasPaginadas = obras.slice(
    (currentDisplayPage - 1) * DISPLAY_LIMIT,
    currentDisplayPage * DISPLAY_LIMIT,
  );

  return (
    <Layout>
      <div className="page-container" style={{ maxWidth: "1000px" }}>
        <div className="go-header-row">
          <h1 className="page-title go-page-title">Obras</h1>

          {/* Botão de cadastro — apenas admin */}
          {admin && (
            <button
              className="button-primary go-register-button"
              onClick={abrirCriar}
            >
              + Cadastrar obra
            </button>
          )}
        </div>
        <p className="page-description go-page-description">
          Gerencie as obras e equipes de campo.
        </p>

        {/* ── Filtros de busca ─────────────────────────────────────────── */}
        <div className="ss-filters go-filters">
          <div className="ss-filters-grid go-filters-grid">
            <div className="ss-filter-field go-filter-field--search">
              <label className="ss-filter-label" htmlFor="busca">Buscar pelo nome</label>
              <input
                id="busca"
                type="text"
                className="ss-filter-input"
                placeholder="Digite o nome da obra..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>

            <div className="ss-filter-field go-filter-field--status">
              <label className="ss-filter-label" htmlFor="filtroStatus">Status</label>
              <select
                id="filtroStatus"
                className="ss-filter-select"
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value)}
              >
                <option value="">Todos os status</option>
                {Object.entries(STATUS_LABELS).map(([val, lbl]) => (
                  <option key={val} value={val}>{lbl}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ── Banner de modo visualização para supervisor ────────────── */}
        {supervisor && !admin && (
          <div style={{
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            borderRadius: "var(--borda-radius)",
            padding: "var(--espacamento-md)",
            marginBottom: "var(--espacamento-lg)",
            color: "#1e40af",
            fontSize: "0.9rem",
          }}>
            <strong>Modo visualização</strong> — Você está visualizando as obras como supervisor.
            Para criar ou editar obras, entre em contato com um administrador.
          </div>
        )}

        {/* ── Feedback ─────────────────────────────────────────────────── */}
        {erro && <p className="erro-msg">{erro}</p>}
        {loading && (
          <p style={{ textAlign: "center", padding: "var(--espacamento-xl)" }}>
            Carregando obras...
          </p>
        )}

        {!loading && !erro && obras.length === 0 && (
          <div className="card" style={{ textAlign: "center", padding: "var(--espacamento-xl)" }}>
            <p>
              {busca || filtroStatus
                ? "Nenhuma obra encontrada. Tente ajustar os filtros."
                : "Nenhuma obra cadastrada ainda."}
            </p>
            {!busca && !filtroStatus && admin && (
              <p style={{ margin: "8px 0 0", fontSize: "0.875rem", color: "var(--cor-texto-secundario)" }}>
                Clique em “Cadastrar obra” para adicionar a primeira obra.
              </p>
            )}
          </div>
        )}

        {/* ── Cards de obras ───────────────────────────────────────────── */}
        {!loading && (
          <div className="obras-list">
            {obrasPaginadas.map((obra) => (
              <div key={obra.id} className="obra-card">
                <div className="obra-card-header">
                  <h3 className="obra-card-title">
                    {obra.nome || obra.descricao || `Obra #${obra.id}`}
                  </h3>
                  <span className={`obra-status ${obra.status || "ativa"}`}>
                    {STATUS_LABELS[obra.status] || obra.status || "Ativa"}
                  </span>
                </div>

                {obra.codigo && (
                  <p className="obra-card-code">
                    <span className="obra-card-label">Código:</span> {obra.codigo}
                  </p>
                )}

                {obra.endereco && (
                  <p className="obra-card-address">
                    {obra.endereco}
                  </p>
                )}

                {(obra.dataInicio || obra.dataPrevisaoTermino) && (
                  <p className="obra-card-meta">
                    {obra.dataInicio && (
                      <>
                        <span className="obra-card-label">Início:</span>{" "}
                        {new Date(obra.dataInicio).toLocaleDateString("pt-BR")}
                      </>
                    )}
                    {obra.dataInicio && obra.dataPrevisaoTermino && " · "}
                    {obra.dataPrevisaoTermino && (
                      <>
                        <span className="obra-card-label">Previsão:</span>{" "}
                        {new Date(obra.dataPrevisaoTermino).toLocaleDateString("pt-BR")}
                      </>
                    )}
                  </p>
                )}

                {obra.descricao && (
                  <p className="obra-card-description">
                    {obra.descricao}
                  </p>
                )}

                {Array.isArray(obra.encarregados) && obra.encarregados.length > 0 && (
                  <p className="obra-card-encarregados">
                    <span className="obra-card-label">Encarregados:</span>{" "}
                    {obra.encarregados.map((e) => e.nome || `#${e.id}`).join(", ")}
                  </p>
                )}

                {/* Ações do admin */}
                {admin && (
                  <div className="obra-card-actions">
                    <button
                      className="button-secondary obra-card-btn"
                      onClick={() => abrirEditar(obra)}
                      style={{ flex: 1 }}
                    >
                      Editar
                    </button>
                    <button
                      className="button-secondary obra-card-btn"
                      onClick={() => abrirEncarregados(obra)}
                      style={{ flex: 1 }}
                    >
                      Encarregados
                    </button>
                    <button
                      className="button-danger obra-card-btn-danger"
                      onClick={() => handleExcluir(obra)}
                    >
                      Remover
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {!loading && !erro && obras.length > 0 && totalDisplayPages > 1 && (
          <div className="paginacao-controles">
            <button
              className="button-secondary"
              onClick={() => setDisplayPage((p) => Math.max(1, p - 1))}
              disabled={currentDisplayPage === 1}
            >
              ← Anterior
            </button>
            <span className="paginacao-info">
              Página {currentDisplayPage} de {totalDisplayPages}
            </span>
            <button
              className="button-secondary"
              onClick={() => setDisplayPage((p) => Math.min(totalDisplayPages, p + 1))}
              disabled={currentDisplayPage === totalDisplayPages}
            >
              Próxima →
            </button>
          </div>
        )}

        {!loading && obras.length > 0 && (
          <p style={{
            marginTop: "var(--espacamento-lg)",
            color: "var(--cor-texto-secundario)",
            fontSize: "var(--tamanho-fonte-pequena)",
          }}>
            {obras.length} {obras.length === 1 ? "obra encontrada" : "obras encontradas"}
            {(busca || filtroStatus) ? " para os filtros aplicados" : ""}.
          </p>
        )}

        {obraParaRemover && (
          <div
            className="modal-overlay"
            onClick={() => setObraParaRemover(null)}
            role="dialog"
            aria-modal="true"
            aria-label="Remover obra"
          >
            <div className="modal-content go-delete-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2 className="modal-title">Remover obra</h2>
                <button
                  type="button"
                  className="modal-close-btn"
                  onClick={() => setObraParaRemover(null)}
                  aria-label="Fechar confirmação"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              <div className="modal-body go-delete-modal-body">
                <p>Tem certeza que deseja remover esta obra? Esta ação não pode ser desfeita.</p>
              </div>
              <div className="modal-footer go-delete-modal-footer">
                <button
                  type="button"
                  className="button-secondary measurements-table-button"
                  onClick={() => setObraParaRemover(null)}
                  disabled={removendoObraId === obraParaRemover.id}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="button-danger measurements-table-button"
                  onClick={confirmExcluir}
                  disabled={removendoObraId === obraParaRemover.id}
                >
                  {removendoObraId === obraParaRemover.id ? "Removendo..." : "Sim, remover"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

export default GerenciarObras;

