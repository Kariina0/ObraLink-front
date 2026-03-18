// src/pages/Login.jsx
// Tela de login — acesso público.
// O cadastro de novos funcionários é feito EXCLUSIVAMENTE pelo administrador
// (rota /register protegida). Não há cadastro livre nesta tela.
import { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import api from "../services/api";
import { extractApiMessage } from "../services/response";
import { requestPasswordReset, resetPasswordWithCode } from "../services/authRecoveryService";
import { validarSenha } from "../utils/validarSenha";
import Modal from "../components/Modal";
import "../styles/pages.css";

const Login = () => {
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [forgotMode, setForgotMode] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [recoveryRequested, setRecoveryRequested] = useState(false);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryError, setRecoveryError] = useState("");
  const [recoveryMessage, setRecoveryMessage] = useState("");
  const [devResetCode, setDevResetCode] = useState("");

  // Estados para controle dos modais
  const [modalAberto, setModalAberto] = useState(null); // "termos", "privacidade", "ajuda" ou null

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);
      setError("");
      const res = await api.post("/auth/login", { email, senha });
      login(res.data); // salva user + token no contexto e localStorage
      navigate("/");   // redireciona para a tela inicial
    } catch (err) {
      setError(extractApiMessage(err, "E-mail ou senha inválidos."));
    } finally {
      setLoading(false);
    }
  };

  const resetRecoveryState = () => {
    setRecoveryCode("");
    setNovaSenha("");
    setConfirmarSenha("");
    setRecoveryRequested(false);
    setRecoveryLoading(false);
    setRecoveryError("");
    setRecoveryMessage("");
    setDevResetCode("");
  };

  const handleOpenForgot = () => {
    setForgotMode(true);
    setError("");
    setRecoveryEmail(email || "");
    resetRecoveryState();
  };

  const handleBackToLogin = () => {
    setForgotMode(false);
    setRecoveryEmail("");
    resetRecoveryState();
  };

  const abrirModal = (tipo) => {
    setModalAberto(tipo);
  };

  const fecharModal = () => {
    setModalAberto(null);
  };

  const handleRequestCode = async (e) => {
    e.preventDefault();

    try {
      setRecoveryLoading(true);
      setRecoveryError("");
      setRecoveryMessage("");
      setDevResetCode("");

      const data = await requestPasswordReset(recoveryEmail);

      setRecoveryRequested(true);
      setRecoveryMessage(
        "Se o e-mail estiver cadastrado, um código de recuperação foi gerado para redefinição de senha."
      );
      if (data?.devResetCode) {
        setDevResetCode(data.devResetCode);
      }
    } catch (err) {
      setRecoveryError(extractApiMessage(err, "Não foi possível iniciar a recuperação de senha."));
    } finally {
      setRecoveryLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    if (e?.preventDefault) e.preventDefault();

    if (!recoveryCode.trim()) {
      setRecoveryError("Informe o código de recuperação recebido por e-mail.");
      return;
    }

    const senhaError = validarSenha(novaSenha);
    if (senhaError) {
      setRecoveryError(senhaError);
      return;
    }

    if (novaSenha !== confirmarSenha) {
      setRecoveryError("A confirmação de senha não confere.");
      return;
    }

    try {
      setRecoveryLoading(true);
      setRecoveryError("");

      await resetPasswordWithCode({
        email: recoveryEmail,
        codigo: recoveryCode,
        novaSenha,
        confirmarSenha,
      });

      setRecoveryMessage("Senha redefinida com sucesso. Faça login com a nova senha.");
      setRecoveryRequested(false);
      setRecoveryCode("");
      setNovaSenha("");
      setConfirmarSenha("");
      setDevResetCode("");
      setSenha("");
      setEmail(recoveryEmail);
      setForgotMode(false);
    } catch (err) {
      setRecoveryError(extractApiMessage(err, "Não foi possível redefinir a senha."));
    } finally {
      setRecoveryLoading(false);
    }
  };

  return (
    <div className="login-page">

      {/* ── Painel esquerdo — identidade visual / canteiro de obras ── */}
      <aside className="login-panel-esquerdo">
        <div className="login-painel-conteudo">

          {/* Marca */}
          <div className="login-marca">
            <div className="login-marca-logo">
              <img
                src={`${process.env.PUBLIC_URL}/logo.png`}
                alt="ObraLink"
                onError={(e) => { e.currentTarget.style.display = "none"; }}
              />
            </div>
            <span className="login-marca-nome">ObraLink</span>
          </div>

          {/* Título e descrição */}
          <h2 className="login-painel-titulo">
            Gestão do canteiro<br />
            <span>na palma da mão</span>
          </h2>
          <p className="login-painel-desc">
            Controle medições, materiais e documentos de obra com agilidade
            e segurança — de qualquer dispositivo, em qualquer lugar.
          </p>

          {/* Recursos do sistema */}
          <ul className="login-painel-features" aria-label="Funcionalidades do sistema">
            <li className="login-feature-item">
              <span className="login-feature-dot" aria-hidden="true"></span>
              Registro e controle de medições
            </li>
            <li className="login-feature-item">
              <span className="login-feature-dot" aria-hidden="true"></span>
              Gestão de materiais e solicitações
            </li>
            <li className="login-feature-item">
              <span className="login-feature-dot" aria-hidden="true"></span>
              Upload e organização de documentos
            </li>
            <li className="login-feature-item">
              <span className="login-feature-dot" aria-hidden="true"></span>
              Relatórios e histórico por obra
            </li>
          </ul>

          {/* Rodapé legal inspirado na referência visual */}
          <div className="login-painel-footer" aria-label="Links legais">
            <button type="button" onClick={() => abrirModal("privacidade")}>
              Política de privacidade
            </button>
            <span aria-hidden="true">•</span>
            <button type="button" onClick={() => abrirModal("termos")}>
              Termos de uso
            </button>
            <span aria-hidden="true">•</span>
            <button type="button" onClick={() => abrirModal("ajuda")}>
              Ajuda
            </button>
          </div>

        </div>

        {/* Elementos decorativos — remetem a planta baixa / estrutura metálica */}
        <div className="login-deco-grid"    aria-hidden="true"></div>
        <div className="login-deco-circulo" aria-hidden="true"></div>
        <div className="login-deco-barra"   aria-hidden="true"></div>
      </aside>

      {/* ── Painel direito — formulário de acesso ── */}
      <main className="login-panel-direito">

        {/* Cabeçalho visível apenas no mobile (painel esquerdo oculto) */}
        <div className="login-mobile-header" aria-hidden="false">
          <div className="login-marca-logo login-marca-logo--mobile">
            <img
              src={`${process.env.PUBLIC_URL}/logo.png`}
              alt="ObraLink"
              onError={(e) => { e.currentTarget.style.display = "none"; }}
            />
          </div>
          <span className="login-marca-nome login-marca-nome--mobile">ObraLink</span>
        </div>

        <form onSubmit={handleSubmit} className="login-form">

          {!forgotMode && (
            <>
              {/* Cabeçalho do formulário */}
              <div className="login-header">
                <span className="login-header-badge" aria-label="Acesso restrito ao sistema">
                  Área restrita
                </span>
                <h1 className="login-title">Entrar no sistema</h1>
                <p className="login-subtitle">
                  Informe suas credenciais para acessar o painel de gestão.
                </p>
              </div>

              {error && (
                <p className="erro-msg" role="alert" aria-live="assertive">
                  {error}
                </p>
              )}

              {recoveryMessage && (
                <p className="success-msg" role="status" aria-live="polite">
                  {recoveryMessage}
                </p>
              )}

              <div className="form-group">
                <label htmlFor="email">E-mail</label>
                <div className="login-input-wrapper">
                  <svg className="login-input-icon" width="18" height="18" viewBox="0 0 24 24"
                    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                    strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                    <polyline points="22,6 12,13 2,6"></polyline>
                  </svg>
                  <input
                    id="email"
                    type="email"
                    placeholder="seuemail@exemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="login-input-com-icone"
                  />
                </div>
              </div>

              <div className="form-group login-password-group">
                <label htmlFor="senha">Senha</label>
                <div className="login-input-wrapper">
                  <svg className="login-input-icon" width="18" height="18" viewBox="0 0 24 24"
                    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                    strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                  <input
                    id="senha"
                    type="password"
                    placeholder="Digite sua senha"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="login-input-com-icone"
                  />
                </div>
              </div>

              <button
                type="button"
                className="login-inline-link"
                onClick={handleOpenForgot}
                aria-label="Abrir recuperação de senha"
              >
                Esqueci minha senha
              </button>

              <button type="submit" className="button-primary login-btn-submit" disabled={loading}>
                {loading ? (
                  <>
                    <span className="login-spinner" aria-hidden="true"></span>
                    Entrando...
                  </>
                ) : (
                  <>
                    Entrar no Sistema
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                      strokeLinejoin="round" aria-hidden="true">
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                      <polyline points="12 5 19 12 12 19"></polyline>
                    </svg>
                  </>
                )}
              </button>
            </>
          )}

          {forgotMode && (
            <>
              {recoveryError && (
                <p className="erro-msg" role="alert" aria-live="assertive">
                  {recoveryError}
                </p>
              )}

              {recoveryMessage && (
                <p className="success-msg" role="status" aria-live="polite">
                  {recoveryMessage}
                </p>
              )}

              {!recoveryRequested && (
                <>
                  <h2 className="login-title" style={{ marginBottom: '18px' }}>Recuperar acesso</h2>
                  <p className="login-subtitle" style={{ marginBottom: '22px' }}>
                    Informe seu e-mail cadastrado para receber o código de recuperação.
                  </p>

                  <div className="form-group">
                    <label htmlFor="recovery-email">E-mail cadastrado</label>
                    <div className="login-input-wrapper">
                      <svg className="login-input-icon" width="18" height="18" viewBox="0 0 24 24"
                        fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                        strokeLinejoin="round" aria-hidden="true">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                        <polyline points="22,6 12,13 2,6"></polyline>
                      </svg>
                      <input
                        id="recovery-email"
                        type="email"
                        placeholder="seuemail@exemplo.com"
                        value={recoveryEmail}
                        onChange={(e) => setRecoveryEmail(e.target.value)}
                        required
                        autoComplete="email"
                        className="login-input-com-icone"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    className="button-primary login-btn-submit"
                    disabled={recoveryLoading || !recoveryEmail}
                    onClick={handleRequestCode}
                  >
                    {recoveryLoading ? (
                      <>
                        <span className="login-spinner" aria-hidden="true"></span>
                        Enviando código...
                      </>
                    ) : (
                      "Enviar código de recuperação"
                    )}
                  </button>
                </>
              )}

              {recoveryRequested && (
                <>
                  <h2 className="login-title" style={{ marginBottom: '18px' }}>Redefinir senha</h2>
                  <p className="login-subtitle" style={{ marginBottom: '22px' }}>
                    Digite o código recebido e sua nova senha.
                  </p>

                  <div className="form-group">
                    <label htmlFor="recovery-code">Código de 6 dígitos</label>
                    <input
                      id="recovery-code"
                      type="text"
                      placeholder="000000"
                      value={recoveryCode}
                      onChange={(e) => setRecoveryCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      required
                      inputMode="numeric"
                      autoComplete="one-time-code"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="recovery-new-password">Nova senha</label>
                    <input
                      id="recovery-new-password"
                      type="password"
                      placeholder="Mínimo 8 caracteres, com maiúscula e número"
                      value={novaSenha}
                      onChange={(e) => setNovaSenha(e.target.value)}
                      required
                      autoComplete="new-password"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="recovery-confirm-password">Confirmar nova senha</label>
                    <input
                      id="recovery-confirm-password"
                      type="password"
                      placeholder="Repita a nova senha"
                      value={confirmarSenha}
                      onChange={(e) => setConfirmarSenha(e.target.value)}
                      required
                      autoComplete="new-password"
                    />
                  </div>

                  <button
                    type="button"
                    className="button-primary login-btn-submit"
                    disabled={
                      recoveryLoading ||
                      !recoveryCode ||
                      !novaSenha ||
                      !confirmarSenha
                    }
                    onClick={handleResetPassword}
                  >
                    {recoveryLoading ? (
                      <>
                        <span className="login-spinner" aria-hidden="true"></span>
                        Redefinindo...
                      </>
                    ) : (
                      "Redefinir senha"
                    )}
                  </button>

                  {devResetCode && (
                    <p className="login-dev-hint" role="status">
                      Ambiente de desenvolvimento: código gerado <strong>{devResetCode}</strong>
                    </p>
                  )}
                </>
              )}

              <button 
                type="button" 
                className="login-inline-link login-back-link" 
                onClick={handleBackToLogin}
              >
                ← Voltar para login
              </button>
            </>
          )}

          {/* Nota informativa: não há cadastro livre — apenas admins criam contas */}
          <p className="login-footer">
            Sem acesso? Solicite o cadastro ao <strong>administrador do sistema</strong>.
          </p>

        </form>
      </main>

      {/* Modais para Termos, Política e Ajuda */}
      <Modal 
        isOpen={modalAberto === "termos"} 
        onClose={fecharModal}
        title="Termos de Uso"
      >
        <p>
          Bem-vindo ao <strong>ObraLink</strong>, sistema de gestão de canteiro de obras.
          Ao utilizar esta plataforma, você concorda com os termos descritos abaixo.
        </p>
        
        <h3>1. Acesso e Uso do Sistema</h3>
        <p>
          O acesso ao sistema é restrito a usuários autorizados, cujo cadastro é realizado 
          exclusivamente pelo administrador. Cada usuário é responsável por manter a 
          confidencialidade de suas credenciais de acesso.
        </p>
        
        <h3>2. Responsabilidades do Usuário</h3>
        <ul>
          <li>Não compartilhar login ou senha com terceiros</li>
          <li>Utilizar o sistema apenas para fins profissionais relacionados à gestão da obra</li>
          <li>Garantir a veracidade das informações inseridas (medições, documentos, materiais)</li>
          <li>Respeitar os níveis de permissão definidos pelo administrador</li>
        </ul>
        
        <h3>3. Propriedade Intelectual</h3>
        <p>
          Todos os dados, relatórios e documentos gerados pelo sistema pertencem à 
          empresa contratante. O ObraLink é uma ferramenta de apoio à gestão e não 
          assume responsabilidade por decisões tomadas com base nas informações do sistema.
        </p>
        
        <h3>4. Modificações nos Termos</h3>
        <p>
          Estes termos podem ser atualizados periodicamente. Usuários serão notificados 
          sobre mudanças significativas através do sistema.
        </p>
      </Modal>

      <Modal 
        isOpen={modalAberto === "privacidade"} 
        onClose={fecharModal}
        title="Política de Privacidade"
      >
        <p>
          Sua privacidade é importante para nós. Esta política explica como coletamos, 
          usamos e protegemos suas informações no <strong>ObraLink</strong>.
        </p>
        
        <h3>1. Dados Coletados</h3>
        <p>Coletamos as seguintes informações:</p>
        <ul>
          <li>Nome completo, CPF e e-mail fornecidos no cadastro</li>
          <li>Registros de medições, solicitações e uploads realizados</li>
          <li>Logs de acesso ao sistema (data, hora e ações executadas)</li>
        </ul>
        
        <h3>2. Uso dos Dados</h3>
        <p>
          As informações coletadas são utilizadas exclusivamente para:
        </p>
        <ul>
          <li>Autenticação e controle de acesso ao sistema</li>
          <li>Rastreabilidade de operações e auditoria interna</li>
          <li>Geração de relatórios e histórico de obra</li>
        </ul>
        
        <h3>3. Compartilhamento de Dados</h3>
        <p>
          Seus dados não são compartilhados com terceiros, exceto quando necessário 
          por obrigação legal ou solicitação judicial.
        </p>
        
        <h3>4. Segurança</h3>
        <p>
          Utilizamos criptografia de senhas (bcrypt), autenticação JWT e controle 
          de sessão para proteger suas informações. Backups regulares garantem a 
          integridade dos dados.
        </p>
        
        <h3>5. Seus Direitos</h3>
        <p>
          Você pode solicitar ao administrador do sistema: acesso aos seus dados, 
          correção de informações incorretas ou exclusão de conta (sujeito a 
          políticas da empresa).
        </p>
      </Modal>

      <Modal 
        isOpen={modalAberto === "ajuda"} 
        onClose={fecharModal}
        title="Central de Ajuda"
      >
        <p>
          Se você está com dificuldades para acessar o sistema ou tem dúvidas sobre 
          funcionalidades, aqui estão algumas orientações:
        </p>
        
        <h3>🔐 Problemas de Login</h3>
        <p>
          Se você esqueceu sua senha, clique em <strong>"Esqueci minha senha"</strong> 
          na tela de login. Um código de 6 dígitos será enviado para seu e-mail cadastrado.
        </p>
        <p>
          <strong>Dica:</strong> Verifique sua caixa de spam se não receber o código em alguns minutos.
        </p>
        
        <h3>📝 Registro de Medições</h3>
        <p>
          Para enviar uma medição, acesse o menu <strong>Enviar Medição</strong> e 
          preencha os campos obrigatórios (CPF, nome, RG, obra e valor). O sistema 
          validará automaticamente os dados antes de salvar.
        </p>
        
        <h3>📄 Upload de Documentos</h3>
        <p>
          Você pode fazer upload de documentos em formato PDF, imagens (JPEG, PNG) 
          ou planilhas (Excel). Arquivos devem ter no máximo 10 MB.
        </p>
        
        <h3>🔧 Sem Acesso ao Sistema?</h3>
        <p>
          O cadastro de novos usuários é feito <strong>exclusivamente pelo administrador</strong>. 
          Se você não possui login, entre em contato com o responsável técnico da sua obra 
          e solicite o cadastro com seus dados: nome completo, CPF e e-mail.
        </p>
        
        <h3>💬 Suporte Técnico</h3>
        <p>
          Em caso de problemas técnicos, erros no sistema ou dúvidas adicionais, 
          entre em contato com o suporte:
        </p>
        <p>
          <strong>E-mail:</strong> suporte@obralink.com.br<br />
          <strong>Horário:</strong> Segunda a sexta, 8h às 18h
        </p>
      </Modal>

    </div>
  );
};

export default Login;