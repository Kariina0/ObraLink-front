// src/pages/GerenciarObras.jsx
// Gerenciar Obras — listagem, cadastro (admin) e edição (admin) de obras.
// Administradores também podem vincular/desvincular encarregados responsáveis.
import React, { useContext, useState } from "react";
import Layout from "../components/Layout";
import {
  createObra,
  deleteObra,
  updateObra,
  vincularEncarregado,
  desvincularEncarregado,
} from "../services/obrasService";
import useObras from "../hooks/useObras";
import { listUsers } from "../services/usersService";
import { extractApiMessage } from "../services/response";
import { AuthContext } from "../context/AuthContext";
import { isAdmin } from "../constants/permissions";
import "../styles/pages.css";

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
  status:              "planejamento",
  descricao:           "",
  observacoes:         "",
};

function GerenciarObras() {
  const { user } = useContext(AuthContext);
  const admin = isAdmin(user?.perfil);

  // ── listagem ────────────────────────────────────────────────────────────────
  const { obras, loadingObras: loading, reload: loadObras } = useObras(200);
  const [erro, setErro]         = useState(null);

  // ── filtros ─────────────────────────────────────────────────────────────────
  const [busca, setBusca]             = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");

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

  // ── confirmação de exclusão inline (sem window.confirm) ─────────────────────
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  // ── carregamento de usuários (apenas quando abre painel de encarregados) ────
  const loadUsuarios = async () => {
    try {
      setUserLoading(true);
      const data = await listUsers({ perfil: "encarregado", limit: 200 });
      setUsuarios(Array.isArray(data) ? data : []);
    } catch (_) {
      setUsuarios([]);
    } finally {
      setUserLoading(false);
    }
  };

  // ── filtro local na lista de obras ──────────────────────────────────────────
  const obrasFiltradas = obras.filter((o) => {
    const nome = (o.nome || o.descricao || "").toLowerCase();
    const matchNome   = nome.includes(busca.toLowerCase());
    const matchStatus = filtroStatus ? o.status === filtroStatus : true;
    return matchNome && matchStatus;
  });

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
    setFuncaoNova("encarregado");
    loadUsuarios();
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
        setFormSucesso("Obra cadastrada com sucesso!");
        setForm(FORM_VAZIO);
      } else {
        await updateObra(obraSelecionada.id, form);
        setFormSucesso("Obra atualizada com sucesso!");
      }
      await loadObras();
    } catch (err) {
      setFormErro(extractApiMessage(err, "Não foi possível salvar a obra."));
    } finally {
      setFormLoading(false);
    }
  };

  // ── Excluir obra ────────────────────────────────────────────────────────────
  const handleExcluir = (obra) => {
    // Abre confirmação inline em vez de window.confirm
    setDeleteConfirmId(obra.id);
  };

  const confirmExcluir = async (obra) => {
    try {
      await deleteObra(obra.id);
      setDeleteConfirmId(null);
      await loadObras();
    } catch (err) {
      setErro(extractApiMessage(err, "Não foi possível remover a obra."));
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
      // Atualiza na lista principal
      await loadObras();
      setUserIdNovo("");
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
            {modo === "create" ? "Cadastrar Nova Obra" : `Editar: ${obraSelecionada?.nome || `Obra #${obraSelecionada?.id}`}`}
          </h1>
          <p className="page-description">
            {modo === "create"
              ? "Preencha as informações da nova obra. Apenas administradores podem cadastrar obras."
              : "Altere as informações da obra conforme necessário."}
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
                <label htmlFor="o-ini">Data de Início</label>
                <input id="o-ini" name="dataInicio" type="date" value={form.dataInicio} onChange={handleChange} />
              </div>

              <div className="form-group">
                <label htmlFor="o-fim">Previsão de Término</label>
                <input id="o-fim" name="dataPrevisaoTermino" type="date" value={form.dataPrevisaoTermino} onChange={handleChange} />
              </div>
            </div>

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
                  ? "Cadastrar Obra"
                  : "Salvar Alterações"}
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

    // Remove usuários já vinculados do select
    const usuariosDisponiveis = usuarios.filter(
      (u) => !encarregadosVinculados.some((e) => Number(e.id) === Number(u.id))
    );

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
            Gerencie os encarregados responsáveis por esta obra. Apenas usuários com
            perfil <strong>encarregado</strong> aparecem na lista.
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
                      <th>Função</th>
                      <th>Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {encarregadosVinculados.map((enc) => (
                      <tr key={enc.id}>
                        <td>{enc.nome || `#${enc.id}`}</td>
                        <td>{enc.email || "—"}</td>
                        <td>{enc.funcao || "encarregado"}</td>
                        <td>
                          <button
                            className="button-danger"
                            disabled={encLoading}
                            onClick={() => handleDesvincular(enc.id)}
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
                      onChange={(e) => setUserIdNovo(e.target.value)}
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
                    <label htmlFor="enc-funcao">Função</label>
                    <input
                      id="enc-funcao"
                      type="text"
                      value={funcaoNova}
                      onChange={(e) => setFuncaoNova(e.target.value)}
                      placeholder="encarregado"
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
  return (
    <Layout>
      <div className="page-container" style={{ maxWidth: "1000px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "var(--espacamento-md)", marginBottom: "var(--espacamento-lg)" }}>
          <div>
            <h1 className="page-title" style={{ marginBottom: "var(--espacamento-xs)" }}>Obras</h1>
            <p className="page-description" style={{ marginBottom: 0 }}>
              Lista de obras cadastradas no sistema.
            </p>
          </div>

          {/* Botão de cadastro — apenas admin */}
          {admin && (
            <button
              className="button-primary"
              onClick={abrirCriar}
              style={{ width: "auto", padding: "14px 28px" }}
            >
              + Nova Obra
            </button>
          )}
        </div>

        {/* ── Filtros de busca ─────────────────────────────────────────── */}
        <div style={{
          display: "flex",
          gap: "var(--espacamento-md)",
          flexWrap: "wrap",
          marginBottom: "var(--espacamento-lg)",
        }}>
          <div className="form-group" style={{ flex: 1, minWidth: "200px", marginBottom: 0 }}>
            <label htmlFor="busca">Buscar pelo nome</label>
            <input
              id="busca"
              type="text"
              placeholder="Digite o nome da obra..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          <div className="form-group" style={{ flex: "0 0 200px", marginBottom: 0 }}>
            <label htmlFor="filtroStatus">Status</label>
            <select
              id="filtroStatus"
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

        {/* ── Feedback ─────────────────────────────────────────────────── */}
        {erro && <p className="erro-msg">{erro}</p>}
        {loading && (
          <p style={{ textAlign: "center", padding: "var(--espacamento-xl)" }}>
            Carregando obras...
          </p>
        )}

        {!loading && !erro && obrasFiltradas.length === 0 && (
          <div className="card" style={{ textAlign: "center", padding: "var(--espacamento-xl)" }}>
            <p>
              {obras.length === 0
                ? "Nenhuma obra cadastrada."
                : "Nenhuma obra encontrada para os filtros informados."}
            </p>
          </div>
        )}

        {/* ── Cards de obras ───────────────────────────────────────────── */}
        {!loading && (
          <div className="obras-list">
            {obrasFiltradas.map((obra) => (
              <div key={obra.id} className="obra-card">
                {/* Cabeçalho do card */}
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: "var(--espacamento-sm)",
                }}>
                  <h3 style={{ margin: 0 }}>
                    {obra.nome || obra.descricao || `Obra #${obra.id}`}
                  </h3>
                  <span className={`obra-status ${obra.status || "ativa"}`}>
                    {STATUS_LABELS[obra.status] || obra.status || "Ativa"}
                  </span>
                </div>

                {/* Código */}
                {obra.codigo && (
                  <p style={{ fontSize: "var(--tamanho-fonte-pequena)", color: "var(--cor-texto-secundario)", margin: "0 0 4px 0" }}>
                    <strong>Código:</strong> {obra.codigo}
                  </p>
                )}

                {/* Cliente */}
                {obra.cliente && (
                  <p style={{ fontSize: "var(--tamanho-fonte-pequena)", color: "var(--cor-texto-secundario)", margin: "0 0 4px 0" }}>
                    <strong>Cliente:</strong> {obra.cliente}
                  </p>
                )}

                {/* Endereço */}
                {obra.endereco && (
                  <p style={{ fontSize: "var(--tamanho-fonte-pequena)", color: "var(--cor-texto-secundario)", margin: "0 0 4px 0" }}>
                    <strong>Endereço:</strong> {obra.endereco}
                  </p>
                )}

                {/* Datas */}
                {obra.dataInicio && (
                  <p style={{ fontSize: "var(--tamanho-fonte-pequena)", color: "var(--cor-texto-secundario)", margin: "0 0 4px 0" }}>
                    <strong>Início:</strong>{" "}
                    {new Date(obra.dataInicio).toLocaleDateString("pt-BR")}
                  </p>
                )}

                {obra.dataPrevisaoTermino && (
                  <p style={{ fontSize: "var(--tamanho-fonte-pequena)", color: "var(--cor-texto-secundario)", margin: "0 0 4px 0" }}>
                    <strong>Previsão de término:</strong>{" "}
                    {new Date(obra.dataPrevisaoTermino).toLocaleDateString("pt-BR")}
                  </p>
                )}

                {/* Descrição resumida */}
                {obra.descricao && (
                  <p style={{ fontSize: "var(--tamanho-fonte-pequena)", color: "var(--cor-texto-secundario)", margin: "0 0 4px 0" }}>
                    {obra.descricao.length > 120
                      ? `${obra.descricao.substring(0, 120)}...`
                      : obra.descricao}
                  </p>
                )}

                {/* Encarregados vinculados */}
                {Array.isArray(obra.encarregados) && obra.encarregados.length > 0 && (
                  <p style={{ fontSize: "var(--tamanho-fonte-pequena)", color: "var(--cor-texto-secundario)", margin: "var(--espacamento-xs) 0 0 0" }}>
                    <strong>Encarregados:</strong>{" "}
                    {obra.encarregados.map((e) => e.nome || `#${e.id}`).join(", ")}
                  </p>
                )}

                {/* Ações do admin */}
                {admin && (
                  <div style={{
                    display: "flex",
                    gap: "var(--espacamento-sm)",
                    marginTop: "var(--espacamento-md)",
                    flexWrap: "wrap",
                  }}>
                    {deleteConfirmId === obra.id ? (
                      /* ── Confirmação inline de exclusão ─────────────── */
                      <>
                        <div style={{
                          width: "100%",
                          background: "var(--cor-perigo-clara)",
                          border: "2px solid var(--cor-perigo)",
                          borderRadius: "var(--borda-radius)",
                          padding: "var(--espacamento-sm) var(--espacamento-md)",
                          marginBottom: "var(--espacamento-xs)",
                        }}>
                          <p style={{ margin: 0, fontWeight: 700, color: "var(--cor-perigo)", fontSize: "var(--tamanho-fonte-pequena)" }}>
                            Tem certeza que deseja remover a obra <em>"{obra.nome || `#${obra.id}`}"</em>? Esta ação não pode ser desfeita.
                          </p>
                        </div>
                        <button
                          className="button-danger"
                          onClick={() => confirmExcluir(obra)}
                          style={{ padding: "10px 18px", flex: 1 }}
                        >
                          Sim, remover obra
                        </button>
                        <button
                          className="button-secondary"
                          onClick={() => setDeleteConfirmId(null)}
                          style={{ padding: "10px 18px", flex: 1 }}
                        >
                          Cancelar
                        </button>
                      </>
                    ) : (
                      /* ── Botões normais ──────────────────────────────── */
                      <>
                        <button
                          className="button-secondary"
                          onClick={() => abrirEditar(obra)}
                          style={{ padding: "10px 18px", flex: 1 }}
                        >
                          Editar
                        </button>
                        <button
                          className="button-secondary"
                          onClick={() => abrirEncarregados(obra)}
                          style={{ padding: "10px 18px", flex: 1 }}
                        >
                          Encarregados
                        </button>
                        <button
                          className="button-danger"
                          onClick={() => handleExcluir(obra)}
                          style={{ padding: "10px 18px" }}
                        >
                          Remover
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {!loading && obrasFiltradas.length > 0 && (
          <p style={{
            marginTop: "var(--espacamento-lg)",
            color: "var(--cor-texto-secundario)",
            fontSize: "var(--tamanho-fonte-pequena)",
          }}>
            Exibindo {obrasFiltradas.length} de {obras.length}{" "}
            {obras.length === 1 ? "obra" : "obras"}.
          </p>
        )}
      </div>
    </Layout>
  );
}

export default GerenciarObras;

