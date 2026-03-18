import React, { useEffect, useState } from "react";
import api from "../services/api";
import { getObra } from "../services/obrasService";
import Layout from "../components/Layout";
import { extractApiMessage } from "../services/response";
import { validarSenha } from "../utils/validarSenha";
import { PERFIL_LABELS } from "../constants/permissions";
import "../styles/pages.css";

function Profile() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [obra, setObra] = useState(null);

  // Estado do formulário de troca de senha
  const [pwForm, setPwForm] = useState({ senhaAtual: "", novaSenha: "", confirmar: "" });
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState("");
  const [pwLoading, setPwLoading] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        setError("");
        const response = await api.get("/auth/me");
        const userData = response.data?.data || null;
        setUser(userData);

        // Buscar dados da obra se o usuário tiver uma obra atribuída
        if (userData?.obraAtual) {
          try {
            const obraId = Number(userData.obraAtual);
            if (Number.isInteger(obraId) && obraId > 0) {
              const obraData = await getObra(obraId);
              setObra(obraData);
            }
          } catch (err) {
            // Não bloqueia a exibição do perfil se falhar ao buscar a obra
          }
        }
      } catch (err) {
        setError("Não foi possível carregar o perfil.");
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handlePwChange = (e) => {
    setPwForm({ ...pwForm, [e.target.name]: e.target.value });
  };

  const handlePwSubmit = async (e) => {
    e.preventDefault();
    setPwError("");
    setPwSuccess("");

    const erroSenha = validarSenha(pwForm.novaSenha);
    if (erroSenha) {
      setPwError(erroSenha);
      return;
    }
    if (pwForm.novaSenha !== pwForm.confirmar) {
      setPwError("A nova senha e a confirmação não coincidem.");
      return;
    }

    try {
      setPwLoading(true);
      await api.post("/auth/change-password", {
        senhaAtual: pwForm.senhaAtual,
        novaSenha: pwForm.novaSenha,
      });
      setPwSuccess("Senha alterada com sucesso!");
      setPwForm({ senhaAtual: "", novaSenha: "", confirmar: "" });
    } catch (err) {
      setPwError(extractApiMessage(err, "Não foi possível alterar a senha."));
    } finally {
      setPwLoading(false);
    }
  };

  // PERFIL_LABELS importado de constants/permissions

  if (loading) {
    return (
      <Layout>
        <div className="page-container" style={{ textAlign: "center", padding: "var(--espacamento-xl)" }}>
          <p>Carregando informações...</p>
        </div>
      </Layout>
    );
  }

  if (error || !user) {
    return (
      <Layout>
        <div className="page-container">
          <p className="erro-msg">{error || "Usuário não encontrado."}</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="page-container">
        <h1 className="page-title">Meu Perfil</h1>

        {/* Dados da conta */}
        <div className="summary">
          <h3>Dados da Conta</h3>
          <div style={{ display: "grid", gap: "var(--espacamento-md)" }}>
            <div>
              <strong>Nome:</strong>
              <p style={{ marginTop: "var(--espacamento-xs)", fontSize: "var(--tamanho-fonte-grande)" }}>
                {user.nome || "—"}
              </p>
            </div>
            <div>
              <strong>E-mail:</strong>
              <p style={{ marginTop: "var(--espacamento-xs)" }}>{user.email}</p>
            </div>
            <div>
              <strong>Tipo de usuário:</strong>
              <p style={{ marginTop: "var(--espacamento-xs)", textTransform: "capitalize" }}>
                {PERFIL_LABELS[user.perfil] || user.perfil || "—"}
              </p>
            </div>
            {user.obraAtual && (
              <div>
                <strong>Obra atual:</strong>
                <p style={{ marginTop: "var(--espacamento-xs)" }}>
                  {obra ? (
                    <>
                      <span style={{ fontWeight: 600 }}>#{user.obraAtual}</span>
                      {" — "}
                      <span>{obra.nome}</span>
                      {obra.codigo && (
                        <span style={{ 
                          color: "var(--cor-texto-secundario)", 
                          fontSize: "var(--tamanho-fonte-pequena)",
                          marginLeft: "8px"
                        }}>
                          ({obra.codigo})
                        </span>
                      )}
                    </>
                  ) : (
                    user.obraAtual
                  )}
                </p>
              </div>
            )}
            {user.createdAt && (
              <div>
                <strong>Conta criada em:</strong>
                <p style={{ marginTop: "var(--espacamento-xs)", color: "var(--cor-texto-secundario)", fontSize: "var(--tamanho-fonte-pequena)" }}>
                  {new Date(user.createdAt).toLocaleString("pt-BR")}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Divider */}
        <hr className="section-divider" />

        {/* Alterar senha */}
        <h2 className="section-title">Alterar Senha</h2>

        {pwError && <p className="erro-msg">{pwError}</p>}
        {pwSuccess && <p className="success-msg">{pwSuccess}</p>}

        <form onSubmit={handlePwSubmit} className="form-container">
          <div className="form-group">
            <label htmlFor="senhaAtual">Senha atual</label>
            <input
              id="senhaAtual"
              type="password"
              name="senhaAtual"
              value={pwForm.senhaAtual}
              onChange={handlePwChange}
              placeholder="Digite a sua senha atual"
              required
              autoComplete="current-password"
            />
          </div>
          <div className="form-group">
            <label htmlFor="novaSenha">Nova senha</label>
            <input
              id="novaSenha"
              type="password"
              name="novaSenha"
              value={pwForm.novaSenha}
              onChange={handlePwChange}
              placeholder="Mínimo 8 caracteres, 1 maiúscula e 1 número"
              minLength={8}
              required
              autoComplete="new-password"
            />
            <small style={{ display: "block", marginTop: "4px", color: "var(--cor-texto-secundario)", fontSize: "14px" }}>
              Mínimo 8 caracteres, ao menos uma letra maiúscula e um número.
            </small>
          </div>
          <div className="form-group">
            <label htmlFor="confirmar">Confirmar nova senha</label>
            <input
              id="confirmar"
              type="password"
              name="confirmar"
              value={pwForm.confirmar}
              onChange={handlePwChange}
              placeholder="Repita a nova senha"
              minLength={8}
              required
              autoComplete="new-password"
            />
          </div>
          <button type="submit" className="button-primary" disabled={pwLoading}>
            {pwLoading ? "Salvando..." : "Alterar Senha"}
          </button>
        </form>
      </div>
    </Layout>
  );
}

export default Profile;
