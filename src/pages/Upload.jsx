// src/pages/Upload.jsx
// Envio de Arquivos — todos os perfis.
// Campos obrigatórios para o back-end: obra, tipoArquivo, descricao.
// Quando tipoArquivo === "problema", detalheProblema também é exigido.
// Suporte offline: arquivos são salvos localmente (IndexedDB) e enviados
// automaticamente quando a conexão é restaurada.
import React, { useState, useEffect, useRef, useContext, useMemo } from "react";
import Layout from "../components/Layout";
import { saveFileOffline, getPendingFiles, markAsUploaded, removeOfflineFile, incrementRetryCount, MAX_RETRY_COUNT } from "../utils/db";
import { uploadFile } from "../services/filesService";
import { extractApiMessage } from "../services/response";
import { API_ORIGIN } from "../services/apiConfig";
import { PERFIS } from "../constants/permissions";
import useObras from "../hooks/useObras";
import { AuthContext } from "../context/AuthContext";
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

function getTodayInputDate() {
  return new Date().toISOString().slice(0, 10);
}

function isImageLike(mimeType = "", fileName = "") {
  return mimeType.startsWith("image/") || /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(fileName);
}

function resolveUploadedUrl(rawUrl) {
  if (!rawUrl) return null;
  if (/^https?:\/\//i.test(rawUrl)) return rawUrl;
  return `${API_ORIGIN}${rawUrl.startsWith("/") ? "" : "/"}${rawUrl}`;
}

function Upload() {
  const { user } = useContext(AuthContext);
  const [file, setFile] = useState(null);
  const [form, setForm] = useState({
    obra: "",           // ID da obra relacionada (obrigatório)
    tipoArquivo: "",    // tipo do arquivo (obrigatório)
    descricao: "",      // descrição do arquivo (obrigatório)
    detalheProblema: "", // obrigatório apenas quando tipoArquivo === "problema"
    dataEnvio: getTodayInputDate(),
    observacoes: "",
  });
  const { obras, loadingObras } = useObras(100);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [isDragActive, setIsDragActive] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [gallerySearch, setGallerySearch] = useState("");
  const [galleryTypeFilter, setGalleryTypeFilter] = useState("");
  const [galleryDateFilter, setGalleryDateFilter] = useState("todos");
  const [galleryVisibleCount, setGalleryVisibleCount] = useState(10);
  const fileInputRef = useRef(null);
  const nomeResponsavel = user?.nome || "Usuário autenticado";
  const perfilUsuario = user?.perfil;
  const usuarioId = user?.id;

  const visibleUploadedFiles = useMemo(() => {
    if (perfilUsuario !== PERFIS.ENCARREGADO) return uploadedFiles;
    return uploadedFiles.filter((item) => {
      const ownerId = item?.uploader?.id;
      if (ownerId === undefined || ownerId === null || usuarioId === undefined || usuarioId === null) {
        return false;
      }
      return String(ownerId) === String(usuarioId);
    });
  }, [uploadedFiles, perfilUsuario, usuarioId]);

  const canRemoveFromGallery = (item) => {
    const ownerId = item?.uploader?.id;
    if (perfilUsuario === PERFIS.ADMIN) return true;
    if (ownerId === undefined || ownerId === null || usuarioId === undefined || usuarioId === null) {
      return false;
    }
    return String(ownerId) === String(usuarioId);
  };

  const galleryTypeOptions = useMemo(() => {
    const setTipos = new Set(
      uploadedFiles
        .map((item) => item?.tipoArquivo)
        .filter(Boolean),
    );
    return Array.from(setTipos);
  }, [uploadedFiles]);

  const filteredUploadedFiles = useMemo(() => {
    const termo = gallerySearch.trim().toLowerCase();
    const agora = new Date();
    const limiteRecente = new Date();
    limiteRecente.setDate(agora.getDate() - 7);

    return visibleUploadedFiles.filter((item) => {
      if (galleryTypeFilter && item?.tipoArquivo !== galleryTypeFilter) {
        return false;
      }

      if (termo && !(item?.nome || "").toLowerCase().includes(termo)) {
        return false;
      }

      if (galleryDateFilter === "hoje") {
        if (!item?.uploadedAt) return false;
        const dataItem = new Date(item.uploadedAt);
        if (dataItem.toDateString() !== agora.toDateString()) return false;
      }

      if (galleryDateFilter === "recentes") {
        if (!item?.uploadedAt) return false;
        const dataItem = new Date(item.uploadedAt);
        if (dataItem < limiteRecente) return false;
      }

      return true;
    });
  }, [visibleUploadedFiles, galleryTypeFilter, gallerySearch, galleryDateFilter]);

  const visibleGalleryItems = useMemo(() => {
    return filteredUploadedFiles.slice(0, galleryVisibleCount);
  }, [filteredUploadedFiles, galleryVisibleCount]);

  const hasMoreGalleryItems = visibleGalleryItems.length < filteredUploadedFiles.length;

  useEffect(() => {
    setGalleryVisibleCount(10);
  }, [gallerySearch, galleryTypeFilter, galleryDateFilter, visibleUploadedFiles.length]);

  const obrasOrdenadas = useMemo(() => {
    return [...obras].sort((a, b) => {
      const nomeA = (a?.nome || "").toLowerCase();
      const nomeB = (b?.nome || "").toLowerCase();
      return nomeA.localeCompare(nomeB);
    });
  }, [obras]);

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

  // Pré-seleciona automaticamente quando houver apenas uma obra vinculada
  useEffect(() => {
    if (obras.length === 1) {
      setForm((prev) => ({ ...prev, obra: String(obras[0].id) }));
    }
  }, [obras]);

  // Carrega arquivos pendentes ao montar
  useEffect(() => {
    loadPendingFiles();
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

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

  function processSelectedFile(nextFile) {
    if (!nextFile) return;

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }

    setFile(nextFile);
    if (isImageLike(nextFile.type, nextFile.name)) {
      setPreviewUrl(URL.createObjectURL(nextFile));
    }
  }

  function handleFileInputChange(e) {
    processSelectedFile(e.target.files?.[0] || null);
  }

  function handleDragOver(event) {
    event.preventDefault();
    setIsDragActive(true);
  }

  function handleDragLeave(event) {
    event.preventDefault();
    setIsDragActive(false);
  }

  function handleDrop(event) {
    event.preventDefault();
    setIsDragActive(false);
    processSelectedFile(event.dataTransfer?.files?.[0] || null);
  }

  async function loadPendingFiles() {
    // getPendingFiles já filtra somente os não enviados e reconstrói o File
    const files = await getPendingFiles();
    setPendingFiles(files);
  }

  // ─── Validações locais antes de enviar ──────────────────────────────────
  function validar() {
    if (!file) return "Selecione um arquivo para enviar.";
    if (!form.dataEnvio) return "Informe a data do envio.";
    if (form.dataEnvio > getTodayInputDate()) return "Não é permitido enviar arquivo com data futura.";
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
      dataEnvio: form.dataEnvio,
      observacoes: form.observacoes?.trim() || "",
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
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      setForm((prev) => ({
        ...prev,
        tipoArquivo: "",
        descricao: "",
        detalheProblema: "",
        observacoes: "",
        dataEnvio: getTodayInputDate(),
      }));
      return;
    }

    // Modo online: envia direto ao servidor
    try {
      setLoading(true);
      const response = await uploadFile(file, metadata);
      const resolvedUrl = resolveUploadedUrl(response?.url || response?.storage_url || "");

      const newUploadedFile = {
        id: response?.id || null,
        nome: response?.nomeOriginal || response?.nome || file.name,
        mimeType: response?.mimeType || file.type || "",
        url: resolvedUrl,
        tipoArquivo: response?.tipoArquivo || metadata.tipoArquivo || "",
        descricao: response?.descricao || metadata.descricao || "",
        uploadedAt: new Date().toISOString(),
        uploader: {
          id: response?.usuarioId || response?.uploadedBy || usuarioId || null,
          nome: user?.nome || "",
        },
      };

      setUploadedFiles((prev) => [...prev, newUploadedFile]);

      setSuccess(
        "Arquivo enviado com sucesso: " +
          (response?.nomeOriginal || response?.nome || file.name),
      );
      setFile(null);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      setForm((prev) => ({
        ...prev,
        tipoArquivo: "",
        descricao: "",
        detalheProblema: "",
        observacoes: "",
        dataEnvio: getTodayInputDate(),
      }));
    } catch (err) {
      setError("Erro ao enviar arquivo: " + extractApiMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveUploadedFile = (itemToRemove) => {
    if (!canRemoveFromGallery(itemToRemove)) return;
    setUploadedFiles((prev) => prev.filter((item) => item !== itemToRemove));
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
        <h1 className="page-title">Enviar Arquivos</h1>
        <p style={{ fontSize: "var(--tamanho-fonte-base)", color: "var(--cor-texto-secundario)", marginBottom: "var(--espacamento-lg)", lineHeight: "1.6" }}>
          Envie documentos, fotos e relatórios da obra de forma organizada e rápida.
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

        <div className="form-container medicao-form-container">
          <div className="medicao-topo-grid" aria-label="Informações do envio">
            <div className="form-group medicao-topo-grid__responsavel">
              <label htmlFor="responsavelEnvio">Responsável pelo envio</label>
              <input
                id="responsavelEnvio"
                type="text"
                value={nomeResponsavel}
                readOnly
                className="medicao-readonly-input"
                aria-readonly="true"
              />
            </div>

            <div className="form-group medicao-topo-grid__data">
              <label htmlFor="dataEnvio">Data do envio</label>
              <input
                id="dataEnvio"
                type="date"
                name="dataEnvio"
                value={form.dataEnvio}
                max={getTodayInputDate()}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="upload-section">
            <h3 className="upload-section__title">Informações do Arquivo</h3>

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
                {obrasOrdenadas.map((o) => (
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
              placeholder="Ex: Foto da fachada"
              value={form.descricao}
              onChange={handleChange}
              required
              maxLength={500}
            />
          </div>

          {/* ─── Detalhe do Problema (condicional) ────────────────────────────
              Exibido e obrigatório apenas quando o tipo selecionado é "problema". */}
          {form.tipoArquivo === "problema" && (
            <div className="form-group">
              <label htmlFor="detalheProblema">Detalhe do Problema *</label>
              <textarea
                id="detalheProblema"
                name="detalheProblema"
                placeholder="Ex: infiltração na parede do banheiro"
                value={form.detalheProblema}
                onChange={handleChange}
                rows="4"
                required
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="observacoes">Observações (opcional)</label>
            <textarea
              id="observacoes"
              name="observacoes"
              placeholder="Ex: arquivo referente ao turno da manhã"
              value={form.observacoes}
              onChange={handleChange}
              rows="4"
            />
          </div>
          </div>

          <div className="upload-section">
            <h3 className="upload-section__title">Envio do Arquivo</h3>

          {/* ─── Seleção do Arquivo ─────────────────────────────────────────── */}
          <div className="form-group">
            <label htmlFor="arquivo">Arquivo *</label>
            <div
              className={`medicao-upload-dropzone ${isDragActive ? "is-drag-active" : ""}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              role="button"
              tabIndex={0}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
            >
              <p className="medicao-upload-dropzone__title">Arraste o arquivo aqui ou selecione</p>
              <button
                type="button"
                className="button-secondary medicao-upload-dropzone__button"
                onClick={(event) => {
                  event.stopPropagation();
                  fileInputRef.current?.click();
                }}
              >
                Selecionar arquivo
              </button>
              <p className="medicao-upload-dropzone__hint">PDF, imagem ou documento de obra.</p>
              {file && (
                <p className="medicao-upload-dropzone__filename">
                  {file.name} ({(file.size / 1024).toFixed(1)} KB)
                </p>
              )}
            </div>

            <input
              ref={fileInputRef}
              id="arquivo"
              type="file"
              className="medicao-upload-hidden-input"
              onChange={handleFileInputChange}
            />

            {previewUrl && (
              <div className="medicao-upload-preview" role="region" aria-label="Pré-visualização da imagem selecionada">
                <img src={previewUrl} alt="Pré-visualização do arquivo selecionado" />
              </div>
            )}
          </div>

          </div>

          {error && <p className="erro-msg">{error}</p>}
          {success && <p className="success-msg">{success}</p>}

          <div className="medicao-actions">
            <button
              className="button-primary medicao-actions__primary"
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
        </div>

        <h3 className="upload-pendentes-title">Fotos e Arquivos Enviados</h3>

        <div className="upload-galeria-filtros" aria-label="Filtros da galeria">
          <div className="form-group upload-galeria-filtros__item">
            <label htmlFor="gallerySearch">Buscar por nome</label>
            <input
              id="gallerySearch"
              type="text"
              value={gallerySearch}
              placeholder="Ex: fachada"
              onChange={(event) => setGallerySearch(event.target.value)}
            />
          </div>

          <div className="form-group upload-galeria-filtros__item">
            <label htmlFor="galleryTypeFilter">Tipo</label>
            <select
              id="galleryTypeFilter"
              value={galleryTypeFilter}
              onChange={(event) => setGalleryTypeFilter(event.target.value)}
            >
              <option value="">Todos os tipos</option>
              {galleryTypeOptions.map((tipo) => (
                <option key={tipo} value={tipo}>{tipo}</option>
              ))}
            </select>
          </div>

          <div className="form-group upload-galeria-filtros__item">
            <label htmlFor="galleryDateFilter">Data</label>
            <select
              id="galleryDateFilter"
              value={galleryDateFilter}
              onChange={(event) => setGalleryDateFilter(event.target.value)}
            >
              <option value="todos">Todos</option>
              <option value="hoje">Hoje</option>
              <option value="recentes">Últimos 7 dias</option>
            </select>
          </div>
        </div>

        {filteredUploadedFiles.length === 0 ? (
          <div className="card upload-pendente-card upload-pendente-card--empty">
            <p>Nenhum arquivo encontrado com os filtros aplicados.</p>
          </div>
        ) : (
          <ul className="upload-galeria-list">
            {visibleGalleryItems.map((item, index) => {
              const cardKey = item.id || `${item.nome}-${index}`;
              const isImage = isImageLike(item.mimeType, item.nome);

              return (
                <li key={cardKey} className="card upload-galeria-card">
                  <div className="upload-galeria-card__thumb-wrap" aria-hidden="true">
                    {item.url && isImage ? (
                      <img src={item.url} alt="" className="upload-galeria-card__thumb" />
                    ) : (
                      <div className="upload-galeria-card__thumb upload-galeria-card__thumb--file">
                        Arquivo
                      </div>
                    )}
                  </div>

                  <div className="upload-galeria-card__content">
                    <p className="upload-galeria-card__title">
                      <strong>{item.nome}</strong>
                    </p>
                    {item.tipoArquivo && (
                      <p className="upload-galeria-card__meta">Tipo: {item.tipoArquivo}</p>
                    )}
                    {item.uploadedAt && (
                      <p className="upload-galeria-card__meta">
                        Enviado em: {new Date(item.uploadedAt).toLocaleString("pt-BR")}
                      </p>
                    )}
                    {item.descricao && (
                      <p className="upload-galeria-card__meta">{item.descricao}</p>
                    )}
                  </div>

                  <div className="upload-galeria-card__actions">
                    {item.url && (
                      <a href={item.url} target="_blank" rel="noreferrer" className="button-secondary upload-galeria-card__button" style={{ textDecoration: "none", display: "inline-block" }}>
                        Abrir arquivo
                      </a>
                    )}
                    {canRemoveFromGallery(item) && (
                      <button
                        type="button"
                        className="button-secondary upload-galeria-card__button"
                        onClick={() => handleRemoveUploadedFile(item)}
                      >
                        Remover da lista
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {hasMoreGalleryItems && (
          <div className="upload-galeria-more-wrap">
            <button
              type="button"
              className="button-secondary upload-galeria-more-button"
              onClick={() => setGalleryVisibleCount((prev) => prev + 10)}
            >
              Ver mais
            </button>
          </div>
        )}

        {/* ─── Arquivos Pendentes (Offline) ────────────────────────────────── */}
        <h3 className="upload-pendentes-title">
          Arquivos Aguardando Envio
        </h3>

        {pendingFiles.length === 0 ? (
          <div className="card upload-pendente-card upload-pendente-card--empty">
            <p>Sem arquivos pendentes no momento.</p>
          </div>
        ) : (
          <ul className="upload-pendente-list">
            {pendingFiles.map((f) => (
              <li
                key={f.id}
                className="card upload-pendente-card"
              >
                <div className="upload-pendente-card__content">
                  <strong className="upload-pendente-card__name">
                    {f.file?.name || "Arquivo sem nome"}
                  </strong>
                  {f.metadata && (
                    <p className="upload-pendente-card__meta">
                      {f.metadata.tipoArquivo && <span>Tipo: {f.metadata.tipoArquivo} • </span>}
                      {f.metadata.descricao && <span>{f.metadata.descricao}</span>}
                    </p>
                  )}
                  <p className="upload-pendente-card__meta">
                    Salvo em: {f.savedAt ? new Date(f.savedAt).toLocaleString("pt-BR") : "—"}
                  </p>
                </div>
                <div className="upload-pendente-card__actions">
                  {online && (
                    <button
                      className="button-primary upload-pendente-card__button"
                      onClick={() => handleReenviaPendente(f)}
                    >
                      Enviar agora
                    </button>
                  )}
                  <button
                    className="button-secondary upload-pendente-card__button"
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
