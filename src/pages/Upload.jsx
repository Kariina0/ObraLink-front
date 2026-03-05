// src/pages/Upload.jsx
// Envio de Arquivos — todos os perfis.
// Campos obrigatórios para o back-end: obra, tipoArquivo, descricao.
// Quando tipoArquivo === "problema", detalheProblema também é exigido.
// Suporte offline: arquivos são salvos localmente (IndexedDB) e enviados
// automaticamente quando a conexão é restaurada.
import React, { useState, useEffect } from "react";
import Layout from "../components/Layout";
import { saveFileOffline, getPendingFiles, markAsUploaded, removeOfflineFile, incrementRetryCount, MAX_RETRY_COUNT } from "../utils/db";
import { uploadFile } from "../services/filesService";
import { listObras } from "../services/obrasService";
import { extractApiMessage } from "../services/response";
import "../styles/pages.css";

// Tipos de arquivo aceitos pelo back-end
const TIPOS_ARQUIVO = [
  { value: "foto_obra", label: "Foto da Obra" },
  { value: "medicao", label: "Medição" },
  { value: "relatorio", label: "Relatório" },
  { value: "solicitacao", label: "Solicitação" },
  { value: "problema", label: "Registro de Problema" },
  { value: "documento", label: "Documento" },
  { value: "outros", label: "Outros" },
];

function Upload() {
  const [file, setFile] = useState(null);
  const [form, setForm] = useState({
    obra: "",           // ID da obra relacionada (obrigatório)
    tipoArquivo: "",    // tipo do arquivo (obrigatório)
    descricao: "",      // descrição do arquivo (obrigatório)
    detalheProblema: "", // obrigatório apenas quando tipoArquivo === "problema"
  });
  const [obras, setObras] = useState([]);
  const [loadingObras, setLoadingObras] = useState(true);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);

  // Monitora estado da conexão
  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Carrega obras ao montar
  useEffect(() => {
    const load = async () => {
      try {
        setLoadingObras(true);
        const data = await listObras({ page: 1, limit: 100 });
        const lista = Array.isArray(data) ? data : [];
        setObras(lista);
        if (lista.length === 1) {
          setForm((prev) => ({ ...prev, obra: String(lista[0].id) }));
        }
      } catch {
        setObras([]);
      } finally {
        setLoadingObras(false);
      }
    };
    load();
    loadPendingFiles();
  }, []);

  // Sincroniza automaticamente ao reconectar
  useEffect(() => {
    if (!online) return;
    const syncPending = async () => {
      const pending = await getPendingFiles();
      const pendentes = pending.filter((f) => !f.uploaded);
      if (pendentes.length === 0) return;

      let enviados = 0;
      let falhos = 0;
      for (const item of pendentes) {
        try {
          // Reenvia o arquivo junto com os metadados salvos offline
          await uploadFile(item.file, item.metadata || {});
          await markAsUploaded(item.id);
          await removeOfflineFile(item.id);
          enviados++;
        } catch (err) {
          // Incrementa o contador de tentativas — após MAX_RETRY_COUNT falhas
          // o arquivo será removido automaticamente pelo getPendingFiles (I-9/M-10)
          await incrementRetryCount(item.id);
          const nextCount = (item.retryCount ?? 0) + 1;
          if (nextCount >= MAX_RETRY_COUNT) {
            falhos++;
          }
          console.error("Erro ao reenviar arquivo pendente:", err);
        }
      }
      if (enviados > 0) {
        setSuccess(`${enviados} arquivo(s) pendente(s) enviado(s) com sucesso!`);
      }
      if (falhos > 0) {
        setError(`${falhos} arquivo(s) foram descartados após ${MAX_RETRY_COUNT} tentativas sem sucesso. Tente enviá-los novamente.`);
      }
      await loadPendingFiles();
    };
    syncPending();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function loadPendingFiles() {
    // getPendingFiles já filtra somente os não enviados e reconstrói o File
    const files = await getPendingFiles();
    setPendingFiles(files);
  }

  // ─── Validações locais antes de enviar ──────────────────────────────────
  function validar() {
    if (!file) return "Selecione um arquivo para enviar.";
    if (!form.obra) return "Selecione a obra relacionada ao arquivo.";
    if (!form.tipoArquivo) return "Selecione o tipo do arquivo.";
    if (!form.descricao.trim() || form.descricao.trim().length < 3)
      return "Informe uma descrição com pelo menos 3 caracteres.";
    if (form.tipoArquivo === "problema" && !form.detalheProblema.trim())
      return "Informe o detalhe do problema identificado.";
    if (form.tipoArquivo === "problema" && form.detalheProblema.trim().length < 10)
      return "O detalhe do problema deve ter pelo menos 10 caracteres.";
    return null;
  }

  const handleUpload = async () => {
    setError("");
    setSuccess("");

    const erroValidacao = validar();
    if (erroValidacao) {
      setError(erroValidacao);
      return;
    }

    // Metadados que acompanham o arquivo
    const metadata = {
      obra: Number(form.obra),
      tipoArquivo: form.tipoArquivo,
      descricao: form.descricao.trim(),
      ...(form.tipoArquivo === "problema" && { detalheProblema: form.detalheProblema.trim() }),
    };

    if (!navigator.onLine) {
      // Modo offline: salva arquivo + metadados localmente para envio posterior
      await saveFileOffline(file, metadata);
      setSuccess(
        "Você está sem conexão. O arquivo foi salvo localmente e será enviado automaticamente quando a internet voltar.",
      );
      await loadPendingFiles();
      setFile(null);
      setForm((prev) => ({ ...prev, tipoArquivo: "", descricao: "", detalheProblema: "" }));
      return;
    }

    // Modo online: envia direto ao servidor
    try {
      setLoading(true);
      const response = await uploadFile(file, metadata);
      setSuccess(
        "Arquivo enviado com sucesso: " +
          (response?.nomeOriginal || response?.nome || file.name),
      );
      setFile(null);
      setForm((prev) => ({ ...prev, tipoArquivo: "", descricao: "", detalheProblema: "" }));
    } catch (err) {
      setError("Erro ao enviar arquivo: " + extractApiMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // Solicitar reenvio manual de um arquivo pendente específico
  const handleReenviaPendente = async (item) => {
    try {
      await uploadFile(item.file, item.metadata || {});
      await markAsUploaded(item.id);
      setSuccess(`Arquivo "${item.file?.name}" enviado com sucesso!`);
      await loadPendingFiles();
    } catch (err) {
      setError("Erro ao enviar: " + extractApiMessage(err));
    }
  };

  const handleRemovePendente = async (id) => {
    await removeOfflineFile(id);
    await loadPendingFiles();
  };

  return (
    <Layout>
      <div className="page-container">
        <h2 className="page-title">Enviar Arquivos</h2>
        <p style={{ fontSize: "var(--tamanho-fonte-base)", color: "var(--cor-texto-secundario)", marginBottom: "var(--espacamento-lg)", lineHeight: "1.6" }}>
          Envie documentos, fotos e relatórios relacionados às obras. Preencha todos os campos
          para facilitar a identificação posterior do arquivo.
        </p>

        {/* Indicador de status da conexão */}
        {!online && (
          <div style={{
            background: "var(--cor-aviso-clara)",
            border: "1px solid var(--cor-aviso)",
            borderRadius: "var(--borda-radius)",
            padding: "var(--espacamento-md)",
            marginBottom: "var(--espacamento-lg)",
            color: "var(--cor-aviso)",
            fontWeight: 600,
          }}>
            &#9888; Você está sem conexão com a internet. O arquivo será salvo localmente
            e enviado automaticamente quando a conexão voltar.
          </div>
        )}

        <div className="form-container">

          {/* ─── Obra Relacionada ────────────────────────────────────────── */}
          <div className="form-group">
            <label htmlFor="obra">Obra Relacionada *</label>
            {loadingObras ? (
              <select disabled><option>Carregando obras...</option></select>
            ) : (
              <select
                id="obra"
                name="obra"
                value={form.obra}
                onChange={handleChange}
                required
              >
                <option value="">Selecione a obra</option>
                {obras.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nome || `Obra #${o.id}`}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* ─── Tipo do Arquivo ───────────────────────────────────────────── */}
          <div className="form-group">
            <label htmlFor="tipoArquivo">Tipo do Arquivo *</label>
            <select
              id="tipoArquivo"
              name="tipoArquivo"
              value={form.tipoArquivo}
              onChange={handleChange}
              required
            >
              <option value="">Selecione o tipo</option>
              {TIPOS_ARQUIVO.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* ─── Descrição do Arquivo ─────────────────────────────────────── */}
          <div className="form-group">
            <label htmlFor="descricao">Descrição do Arquivo *</label>
            <input
              id="descricao"
              type="text"
              name="descricao"
              placeholder="Ex: Foto da parede norte após revestimento"
              value={form.descricao}
              onChange={handleChange}
              required
              maxLength={500}
            />
            <small style={{ color: "var(--cor-texto-secundario)", fontSize: "var(--tamanho-fonte-pequena)" }}>
              Descreva brevemente o conteúdo do arquivo para facilitar a busca futura.
            </small>
          </div>

          {/* ─── Detalhe do Problema (condicional) ────────────────────────────
              Exibido e obrigatório apenas quando o tipo selecionado é "problema". */}
          {form.tipoArquivo === "problema" && (
            <div className="form-group">
              <label htmlFor="detalheProblema">Detalhe do Problema *</label>
              <textarea
                id="detalheProblema"
                name="detalheProblema"
                placeholder="Descreva o problema identificado: localização, natureza, gravidade, etc."
                value={form.detalheProblema}
                onChange={handleChange}
                rows="4"
                required
              />
              <small style={{ color: "var(--cor-perigo)", fontSize: "var(--tamanho-fonte-pequena)", fontWeight: 600 }}>
                Obrigatório para arquivos do tipo "Registro de Problema".
              </small>
            </div>
          )}

          {/* ─── Seleção do Arquivo ─────────────────────────────────────────── */}
          <div className="form-group">
            <label htmlFor="arquivo">Selecionar Arquivo *</label>
            <input
              id="arquivo"
              type="file"
              className="file-input"
              onChange={(e) => setFile(e.target.files[0] || null)}
            />
            {file && (
              <p style={{ marginTop: "var(--espacamento-sm)", color: "var(--cor-texto-secundario)" }}>
                Arquivo selecionado: <strong>{file.name}</strong>
                {" "}({(file.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          {error && <p className="erro-msg">{error}</p>}
          {success && <p className="success-msg">{success}</p>}

          <button
            className="button-primary"
            onClick={handleUpload}
            disabled={loading}
          >
            {loading
              ? "Enviando arquivo..."
              : online
              ? "Enviar Arquivo"
              : "Salvar para Envio Posterior"}
          </button>
        </div>

        {/* ─── Arquivos Pendentes (Offline) ────────────────────────────────── */}
        <h3 style={{ marginTop: "var(--espacamento-xl)", marginBottom: "var(--espacamento-md)", fontSize: "var(--tamanho-subtitulo)", fontWeight: 600 }}>
          Arquivos Aguardando Envio
        </h3>

        {pendingFiles.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: "var(--espacamento-lg)" }}>
            <p style={{ color: "var(--cor-texto-secundario)" }}>Nenhum arquivo aguardando envio.</p>
          </div>
        ) : (
          <ul style={{ listStyle: "none", padding: 0 }}>
            {pendingFiles.map((f) => (
              <li
                key={f.id}
                className="card"
                style={{
                  marginBottom: "var(--espacamento-sm)",
                  padding: "var(--espacamento-md)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: "var(--espacamento-md)",
                }}
              >
                <div style={{ flex: 1 }}>
                  <strong style={{ fontSize: "var(--tamanho-fonte-base)" }}>
                    {f.file?.name || "Arquivo sem nome"}
                  </strong>
                  {f.metadata && (
                    <p style={{ margin: "4px 0 0 0", fontSize: "var(--tamanho-fonte-pequena)", color: "var(--cor-texto-secundario)" }}>
                      {f.metadata.tipoArquivo && <span>Tipo: {f.metadata.tipoArquivo} &bull; </span>}
                      {f.metadata.descricao && <span>{f.metadata.descricao}</span>}
                    </p>
                  )}
                  <p style={{ margin: "4px 0 0 0", fontSize: "var(--tamanho-fonte-pequena)", color: "var(--cor-texto-secundario)" }}>
                    Salvo em: {f.savedAt ? new Date(f.savedAt).toLocaleString("pt-BR") : "—"}
                  </p>
                </div>
                <div style={{ display: "flex", gap: "var(--espacamento-sm)", flexShrink: 0 }}>
                  {online && (
                    <button
                      className="button-primary"
                      style={{ padding: "8px 14px", fontSize: "var(--tamanho-fonte-pequena)" }}
                      onClick={() => handleReenviaPendente(f)}
                    >
                      Enviar agora
                    </button>
                  )}
                  <button
                    style={{
                      padding: "8px 14px",
                      fontSize: "var(--tamanho-fonte-pequena)",
                      border: "1px solid var(--cor-perigo)",
                      color: "var(--cor-perigo)",
                      borderRadius: "var(--borda-radius)",
                      background: "transparent",
                      cursor: "pointer",
                    }}
                    onClick={() => handleRemovePendente(f.id)}
                  >
                    Remover
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Layout>
  );
}

export default Upload;
