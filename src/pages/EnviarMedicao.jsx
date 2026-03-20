// src/pages/EnviarMedicao.jsx
// Registrar / Editar Medição — disponível para encarregado, supervisor e admin.
// Quando acessada via /medicoes?editar=:id, carrega a medição existente para edição.
// O select de obra carrega apenas as obras vinculadas ao usuário logado.
import { useState, useEffect, useRef, useMemo, useContext } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Layout from "../components/Layout";
import DraftsPanel from "../components/DraftsPanel";
import {
  createMedicao,
  deleteMedicao,
  getMedicaoById,
  listDrafts,
  updateMedicao,
} from "../services/medicoesService";
import { uploadFile } from "../services/filesService";
import { extractApiMessage } from "../services/response";
import useObras from "../hooks/useObras";
import {
  AREAS_MEDICAO,
  AREAS_MEDICAO_GRUPOS,
  MEDICAO_CAMPO_MODO,
  TIPOS_SERVICO,
  TIPOS_SERVICO_GRUPOS,
  TIPO_SERVICO_CONFIG,
} from "../constants/medicao";
import { enqueueSyncOperation } from "../utils/syncQueue";
import { AuthContext } from "../context/AuthContext";
import "../styles/pages.css";
import "../styles/drafts.css";

const TOAST_TIMEOUT_MS = 4500;

const STATUS_OBRA_LABELS = {
  em_andamento: "Em andamento",
  planejamento: "Planejamento",
  pausada: "Pausada",
  paralisada: "Paralisada",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

function formatDateToInput(dateValue) {
  if (!dateValue) return "";
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function getTodayInputDate() {
  return formatDateToInput(new Date());
}

function mapMedicaoToForm(medicao) {
  return {
    obra: medicao?.obra != null ? String(medicao.obra) : "",
    area: medicao?.area || medicao?.areaNome || "",
    tipoServico: medicao?.tipoServico || "",
    dataMedicao: formatDateToInput(medicao?.data) || getTodayInputDate(),
    comprimento: medicao?.comprimento != null ? String(medicao.comprimento) : "",
    largura: medicao?.largura != null ? String(medicao.largura) : "",
    altura: medicao?.altura != null ? String(medicao.altura) : "",
    quantidade:
      medicao?.quantidade != null
        ? String(medicao.quantidade)
        : medicao?.itens?.[0]?.quantidade != null
          ? String(medicao.itens[0].quantidade)
          : "",
    observacoes: medicao?.observacoes || "",
  };
}

const FORM_INITIAL = {
  obra: "",
  area: "",
  tipoServico: "",
  dataMedicao: getTodayInputDate(),
  comprimento: "",
  largura: "",
  altura: "",
  quantidade: "",
  observacoes: "",
};

function EnviarMedicao() {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [searchParams] = useSearchParams();
  const editarId = searchParams.get("editar") ? Number(searchParams.get("editar")) : null;
  const modoEdicao = editarId !== null && editarId > 0;

  const [form, setForm] = useState(FORM_INITIAL);
  const [rascunhos, setRascunhos] = useState([]);
  const [loadingRascunhos, setLoadingRascunhos] = useState(false);
  const [mostraRascunhos, setMostraRascunhos] = useState(false);
  const [rascunhoAtivoId, setRascunhoAtivoId] = useState(null);

  const [foto, setFoto] = useState(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);
  const [loadingMode, setLoadingMode] = useState(null);
  const [loadingEdicao, setLoadingEdicao] = useState(modoEdicao);
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef(null);
  const { obras, loadingObras } = useObras(100);
  const nomeResponsavel = user?.nome || "Usuário autenticado";

  const mapaAreas = useMemo(
    () => Object.fromEntries(AREAS_MEDICAO.map((item) => [item.value, item.label])),
    [],
  );
  const mapaTipos = useMemo(
    () => Object.fromEntries(TIPOS_SERVICO.map((item) => [item.value, item.label])),
    [],
  );

  const configTipoServico = TIPO_SERVICO_CONFIG[form.tipoServico] || {
    modo: MEDICAO_CAMPO_MODO.AREA_CL,
    unidade: "m²",
    resumo: "Informe os dados da medição.",
  };

  const usaQuantidadeDireta = configTipoServico.modo === MEDICAO_CAMPO_MODO.QUANTIDADE;
  const usaComprimento = !usaQuantidadeDireta;
  const usaLargura = configTipoServico.modo === MEDICAO_CAMPO_MODO.AREA_CL || configTipoServico.modo === MEDICAO_CAMPO_MODO.VOLUME;
  const usaAltura = configTipoServico.modo === MEDICAO_CAMPO_MODO.AREA_CA || configTipoServico.modo === MEDICAO_CAMPO_MODO.VOLUME;

  const obraPorStatus = useMemo(() => {
    const ativas = [];
    const outras = [];

    obras.forEach((obra) => {
      const status = obra?.status;
      if (status === "em_andamento" || status === "planejamento") {
        ativas.push(obra);
      } else {
        outras.push(obra);
      }
    });

    return { ativas, outras };
  }, [obras]);

  function showToast(message, options = {}) {
    setToast({
      message,
      showViewAction: options.showViewAction === true,
    });
  }

  async function carregarRascunhos() {
    try {
      setLoadingRascunhos(true);
      const data = await listDrafts({ page: 1, limit: 20 });
      setRascunhos(Array.isArray(data) ? data : []);
    } catch (err) {
      setError("Não foi possível carregar os rascunhos. " + extractApiMessage(err));
    } finally {
      setLoadingRascunhos(false);
    }
  }

  function carregarRascunho(rascunho) {
    setForm(mapMedicaoToForm(rascunho));
    setRascunhoAtivoId(rascunho.id || null);
    setFoto(null);
    if (preview) {
      URL.revokeObjectURL(preview);
      setPreview(null);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
    showToast("Rascunho carregado. Continue a edição normalmente.");
  }

  async function excluirRascunho(id) {
    try {
      await deleteMedicao(id);
      if (Number(rascunhoAtivoId) === Number(id)) {
        setRascunhoAtivoId(null);
      }
      await carregarRascunhos();
      showToast("Rascunho excluído com sucesso.");
    } catch (err) {
      setError("Não foi possível excluir o rascunho. " + extractApiMessage(err));
    }
  }

  function processSelectedFile(file) {
    if (!file) return;

    if (preview) {
      URL.revokeObjectURL(preview);
    }

    setFoto(file);
    setPreview(URL.createObjectURL(file));
  }

  useEffect(() => {
    const onSyncCompleted = (event) => {
      const total = event?.detail?.synced || 0;
      if (total > 0) {
        showToast(`Sincronização concluída: ${total} registro(s) offline enviado(s).`);
      }
    };

    window.addEventListener("sync:completed", onSyncCompleted);
    return () => window.removeEventListener("sync:completed", onSyncCompleted);
  }, []);

  useEffect(() => {
    if (modoEdicao) return;
    carregarRascunhos();
  }, [modoEdicao]); // eslint-disable-line react-hooks/exhaustive-deps

  // Carrega a medição existente ao abrir em modo de edição
  useEffect(() => {
    if (!modoEdicao) return;
    let cancelled = false;

    async function carregarMedicao() {
      try {
        setLoadingEdicao(true);
        const m = await getMedicaoById(editarId);
        if (cancelled) return;
        setForm(mapMedicaoToForm(m));
        setRascunhoAtivoId(m.status === "rascunho" ? m.id : null);
      } catch (err) {
        if (!cancelled) {
          setError("Não foi possível carregar a medição para edição. " + extractApiMessage(err));
        }
      } finally {
        if (!cancelled) setLoadingEdicao(false);
      }
    }

    carregarMedicao();
    return () => { cancelled = true; };
  }, [modoEdicao, editarId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pré-seleciona automaticamente quando houver apenas uma obra vinculada
  useEffect(() => {
    if (obras.length === 1 && !modoEdicao) {
      setForm((prev) => ({ ...prev, obra: String(obras[0].id) }));
    }
  }, [obras, modoEdicao]);

  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  useEffect(() => {
    if (!toast) return undefined;

    const timer = window.setTimeout(() => {
      setToast(null);
    }, TOAST_TIMEOUT_MS);

    return () => window.clearTimeout(timer);
  }, [toast]);

  // ─── Cálculos automáticos de área e volume ──────────────────────────────────
  const comprimento = Number(form.comprimento) || 0;
  const largura = Number(form.largura) || 0;
  const altura = Number(form.altura) || 0;
  const quantidadeDireta = Number(form.quantidade) || 0;

  const areaCalculada = configTipoServico.modo === MEDICAO_CAMPO_MODO.AREA_CA
    ? comprimento * altura
    : comprimento * largura;
  const volume = comprimento * largura * altura;

  const quantidadeCalculada = useMemo(() => {
    if (configTipoServico.modo === MEDICAO_CAMPO_MODO.QUANTIDADE) return quantidadeDireta;
    if (configTipoServico.modo === MEDICAO_CAMPO_MODO.VOLUME) return volume;
    return areaCalculada;
  }, [configTipoServico.modo, quantidadeDireta, volume, areaCalculada]);

  const dimensoesResumo = useMemo(() => {
    if (configTipoServico.modo === MEDICAO_CAMPO_MODO.AREA_CA) {
      return "C x A";
    }
    if (configTipoServico.modo === MEDICAO_CAMPO_MODO.VOLUME) {
      return "C x L x A";
    }
    if (configTipoServico.modo === MEDICAO_CAMPO_MODO.QUANTIDADE) {
      return "Quantidade direta";
    }
    return "C x L";
  }, [configTipoServico.modo]);

  function handleChange(event) {
    const { name, value } = event.target;

    if (name === "tipoServico") {
      const nextConfig = TIPO_SERVICO_CONFIG[value] || null;
      const isQuantidade = nextConfig?.modo === MEDICAO_CAMPO_MODO.QUANTIDADE;

      setForm((prev) => ({
        ...prev,
        tipoServico: value,
        ...(isQuantidade
          ? { comprimento: "", largura: "", altura: "" }
          : { quantidade: "" }),
      }));
      return;
    }

    setForm({
      ...form,
      [name]: value,
    });
  }

  function handleFotoChange(event) {
    const file = event.target.files[0];
    processSelectedFile(file);
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

    const file = event.dataTransfer?.files?.[0];
    processSelectedFile(file);
  }

  // ─── Envio do formulário ─────────────────────────────────────────────────────
  async function handleSubmit(mode = "enviada") {
    if (loadingMode) return;

    const isDraftMode = mode === "rascunho";

    setError("");
    setToast(null);

    // Validações no cliente antes de chamar a API
    if (!form.obra) {
      setError("Selecione uma obra para registrar a medição.");
      return;
    }
    if (!isDraftMode && !form.area) {
      setError("Selecione a área (ambiente) da medição.");
      return;
    }
    if (!isDraftMode && !form.tipoServico) {
      setError("Selecione o tipo de serviço realizado.");
      return;
    }
    if (!form.dataMedicao) {
      setError("Informe a data da medição.");
      return;
    }

    const hoje = getTodayInputDate();
    if (form.dataMedicao > hoje) {
      setError("Não é permitido enviar medição com data futura.");
      return;
    }

    if (!isDraftMode && usaQuantidadeDireta) {
      if (quantidadeDireta <= 0) {
        setError("Informe a quantidade executada.");
        return;
      }
    } else if (!isDraftMode) {
      if (usaComprimento && comprimento <= 0) {
        setError("Informe um comprimento maior que zero.");
        return;
      }
      if (usaLargura && largura <= 0) {
        setError("Informe uma largura maior que zero.");
        return;
      }
      if (usaAltura && altura <= 0) {
        setError("Informe uma altura maior que zero.");
        return;
      }
    }

    if (!isDraftMode && quantidadeCalculada <= 0) {
      setError("Não foi possível calcular a medição com os dados informados.");
      return;
    }

    const dataMedicaoISO = new Date(`${form.dataMedicao}T12:00:00`).toISOString();
    const tipoServicoLabel = mapaTipos[form.tipoServico] || "Serviço";
    const areaLabel = mapaAreas[form.area] || "Área";

    const body = {
      obra: Number(form.obra),
      data: dataMedicaoISO,
      area: form.area,
      tipoServico: form.tipoServico,
      observacoes: form.observacoes,
      status: mode,
      unidadeMedicao: configTipoServico.unidade,
      quantidadeDireta: usaQuantidadeDireta ? quantidadeDireta : null,
      comprimento: usaComprimento ? Number(form.comprimento) : null,
      largura: usaLargura ? Number(form.largura) : null,
      altura: usaAltura ? Number(form.altura) : null,
      areaCalculada:
        configTipoServico.modo === MEDICAO_CAMPO_MODO.AREA_CL || configTipoServico.modo === MEDICAO_CAMPO_MODO.AREA_CA
          ? areaCalculada
          : null,
      volume: configTipoServico.modo === MEDICAO_CAMPO_MODO.VOLUME ? volume : null,
      itens: [
        {
          descricao: `${tipoServicoLabel} — ${areaLabel}`,
          quantidade: quantidadeCalculada,
          unidade: configTipoServico.unidade,
          valorUnitario: null,
          valorTotal: quantidadeCalculada,
          observacoes: form.observacoes || "",
          local: form.area || "",
        },
      ],
    };

    if (!navigator.onLine && foto) {
      setError("Não é possível salvar foto em modo offline nesta tela. Remova a foto para salvar offline ou reconecte à internet.");
      return;
    }

    let fullBody = body;

    try {
      setLoadingMode(mode);
      let anexoId = null;

      // Upload da foto antes de criar/atualizar a medição, se houver
      if (foto) {
        const areaLabel = form.area || "medição";
        const uploadRes = await uploadFile(foto, {
          obra: Number(form.obra),
          tipoArquivo: "foto_obra",
          descricao: `Foto da medição — ${areaLabel}`,
        });
        anexoId = uploadRes?.id ? Number(uploadRes.id) : null;
      }

      fullBody = { ...body, ...(anexoId ? { anexos: [anexoId] } : {}) };

      if (!navigator.onLine) {
        await enqueueSyncOperation("medicao", fullBody);
      } else if (rascunhoAtivoId) {
        await updateMedicao(rascunhoAtivoId, fullBody);
      } else if (modoEdicao) {
        await updateMedicao(editarId, fullBody);
      } else {
        await createMedicao(fullBody);
      }

      const emRascunhoCarregado = !modoEdicao && rascunhoAtivoId;
      const acaoLabel = emRascunhoCarregado
        ? (mode === "rascunho" ? "Rascunho atualizado" : "Medição enviada")
        : modoEdicao
        ? (mode === "rascunho" ? "Rascunho atualizado" : "Medição atualizada")
        : (mode === "rascunho" ? "Rascunho salvo"      : "Medição enviada");

      showToast(
        navigator.onLine
          ? `${acaoLabel} com sucesso!`
          : `Sem internet: ${acaoLabel.toLowerCase()} para sincronização automática.`,
        {
          showViewAction: navigator.onLine && mode === "enviada",
        },
      );

      if (!modoEdicao) {
        // Em modo de criação: limpa o formulário, mantendo obra se única
        setForm({
          obra: obras.length === 1 ? String(obras[0].id) : "",
          area: "",
          tipoServico: "",
          dataMedicao: getTodayInputDate(),
          comprimento: "",
          largura: "",
          altura: "",
          quantidade: "",
          observacoes: "",
        });
        setFoto(null);
        setPreview(null);
        setRascunhoAtivoId(null);
        await carregarRascunhos();
      }
    } catch (err) {
      const status = err?.response?.status;
      if (!navigator.onLine || !status) {
        await enqueueSyncOperation("medicao", fullBody);
        const acaoLabel = mode === "rascunho" ? "Rascunho" : "Medição";
        showToast(`Sem conexão: ${acaoLabel.toLowerCase()} salvo offline e será sincronizado ao reconectar.`);
      } else {
        setError(
          modoEdicao
            ? "Erro ao atualizar medição: " + extractApiMessage(err)
            : "Erro ao enviar medição: " + extractApiMessage(err)
        );
      }
    } finally {
      setLoadingMode(null);
    }
  }

  return (
    <Layout>
      <div className="page-container">
        {toast && (
          <div className="medicao-toast" role="status" aria-live="polite">
            <div className="medicao-toast__content">
              <p className="medicao-toast__message">{toast.message}</p>
              <div className="medicao-toast__actions">
                {toast.showViewAction && (
                  <button
                    type="button"
                    className="button-secondary medicao-toast__action-button"
                    onClick={() => {
                      setToast(null);
                      navigate("/medicoes-lista");
                    }}
                  >
                    Ver medições
                  </button>
                )}
                <button
                  type="button"
                  className="medicao-toast__close"
                  onClick={() => setToast(null)}
                  aria-label="Fechar notificação"
                >
                  ×
                </button>
              </div>
            </div>
          </div>
        )}

        <h1 className="page-title">
          {modoEdicao ? "Editar Medição" : "Registrar Nova Medição"}
        </h1>
        <p style={{ fontSize: "var(--tamanho-fonte-grande)", color: "var(--cor-texto-secundario)", marginBottom: "var(--espacamento-xl)", lineHeight: "1.6" }}>
          {modoEdicao
            ? "Corrija os dados abaixo e reenvie a medição para revisão."
            : <>Registre as dimensões e informações da medição realizada na obra. Os campos marcados com <strong>*</strong> são obrigatórios.</>
          }
        </p>

        {loadingEdicao && (
          <p style={{ textAlign: "center", padding: "var(--espacamento-xl)" }}>
            Carregando dados da medição...
          </p>
        )}

        {!loadingEdicao && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            handleSubmit("enviada");
          }}
          className="form-container medicao-form-container"
        >
          {!modoEdicao && (
            <DraftsPanel
              rascunhos={rascunhos}
              loading={loadingRascunhos}
              open={mostraRascunhos}
              onToggle={async () => {
                const next = !mostraRascunhos;
                setMostraRascunhos(next);
                if (next && rascunhos.length === 0 && !loadingRascunhos) {
                  await carregarRascunhos();
                }
              }}
              onLoad={carregarRascunho}
              onDelete={excluirRascunho}
              activeId={rascunhoAtivoId}
              mapaTipos={mapaTipos}
              mapaAreas={mapaAreas}
            />
          )}

          <div className="medicao-topo-grid" aria-label="Informações da medição">
            <div className="form-group medicao-topo-grid__responsavel">
              <label htmlFor="responsavelMedicao">Responsável pela Medição</label>
              <input
                id="responsavelMedicao"
                type="text"
                value={nomeResponsavel}
                readOnly
                className="medicao-readonly-input"
                aria-readonly="true"
              />
            </div>

            <div className="form-group medicao-topo-grid__data">
              <label htmlFor="dataMedicao">Data da Medição *</label>
              <input
                id="dataMedicao"
                type="date"
                name="dataMedicao"
                value={form.dataMedicao}
                max={getTodayInputDate()}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          {/* ─── Seleção de Obra ─────────────────────────────────────────────
              O back-end filtra automaticamente conforme o perfil do usuário:
              encarregados veem apenas as obras às quais estão vinculados. */}
          <div className="form-group">
            <label htmlFor="obra">Obra *</label>
            {loadingObras ? (
              <select id="obra" disabled>
                <option>Carregando obras...</option>
              </select>
            ) : obras.length === 0 ? (
              <p className="erro-msg" style={{ marginTop: "4px" }}>
                Nenhuma obra disponível. Entre em contato com o administrador.
              </p>
            ) : (
              <select
                id="obra"
                name="obra"
                value={form.obra}
                onChange={handleChange}
                required
              >
                {/* Exibe opção vazia somente quando há múltiplas obras */}
                {obras.length > 1 && (
                  <option value="">Selecione a obra</option>
                )}
                {obraPorStatus.ativas.length > 0 && (
                  <optgroup label="Obras ativas">
                    {obraPorStatus.ativas.map((obra) => (
                      <option key={obra.id} value={obra.id}>
                        {obra.nome || `Obra #${obra.id}`}
                      </option>
                    ))}
                  </optgroup>
                )}
                {obraPorStatus.outras.length > 0 && (
                  <optgroup label="Outras obras">
                    {obraPorStatus.outras.map((obra) => (
                      <option key={obra.id} value={obra.id}>
                        {obra.nome || `Obra #${obra.id}`} • {STATUS_OBRA_LABELS[obra.status] || "Sem status"}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            )}
          </div>

          {/* ─── Área da Medição (novo campo) ────────────────────────────────
              Identifica qual ambiente/cômodo da obra está sendo medido. */}
          <div className="form-group">
            <label htmlFor="area">Área da Medição *</label>
            <select
              id="area"
              name="area"
              value={form.area}
              onChange={handleChange}
              required
            >
                <option value="">Selecione a área</option>
              {AREAS_MEDICAO_GRUPOS.map((grupo) => (
                <optgroup key={grupo.label} label={grupo.label}>
                  {grupo.options.map((value) => (
                    <option key={value} value={value}>{mapaAreas[value] || value}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* ─── Tipo de Serviço (novo campo) ────────────────────────────────
              Descreve o tipo de serviço executado que gerou a medição. */}
          <div className="form-group">
            <label htmlFor="tipoServico">Tipo de Serviço *</label>
            <select
              id="tipoServico"
              name="tipoServico"
              value={form.tipoServico}
              onChange={handleChange}
              required
            >
              <option value="">Selecione o serviço</option>
              {TIPOS_SERVICO_GRUPOS.map((grupo) => (
                <optgroup key={grupo.label} label={grupo.label}>
                  {grupo.options.map((value) => (
                    <option key={value} value={value}>{mapaTipos[value] || value}</option>
                  ))}
                </optgroup>
              ))}
            </select>

            {form.tipoServico && (
              <div className="medicao-unidade-info">
                <span className="medicao-unidade-info__badge">Unidade: {configTipoServico.unidade}</span>
                <span className="medicao-unidade-info__text">Medição por: {dimensoesResumo}</span>
              </div>
            )}
          </div>

          {form.tipoServico && (
            <div className="medicao-service-helper">
              <strong>Orientação rápida:</strong> {configTipoServico.resumo}
            </div>
          )}

          {/* ─── Dimensões ──────────────────────────────────────────────────── */}
          {usaQuantidadeDireta ? (
            <div className="form-group">
              <label htmlFor="quantidade">
                Quantidade *
                <span className="medicao-help" title="Use para serviços contados por unidade, como portas e luminárias." aria-hidden="true">ⓘ</span>
              </label>
              <input
                id="quantidade"
                type="number"
                step="1"
                min="1"
                name="quantidade"
                placeholder="Ex: 12"
                value={form.quantidade}
                onChange={handleChange}
                required={usaQuantidadeDireta}
              />
            </div>
          ) : (
            <div className="medicao-dimensoes-grid">
              {usaComprimento && (
                <div className="form-group medicao-dimensoes-grid__item">
                  <label htmlFor="comprimento">
                    Comprimento (m) *
                    <span className="medicao-help" title="Medida principal do trecho." aria-hidden="true">ⓘ</span>
                  </label>
                  <input
                    id="comprimento"
                    type="number"
                    step="0.01"
                    min="0.01"
                    name="comprimento"
                    placeholder="Ex: 5.20"
                    value={form.comprimento}
                    onChange={handleChange}
                    required={usaComprimento}
                  />
                </div>
              )}

              {usaLargura && (
                <div className="form-group medicao-dimensoes-grid__item">
                  <label htmlFor="largura">
                    Largura (m) *
                    <span className="medicao-help" title="Use a segunda medida da área." aria-hidden="true">ⓘ</span>
                  </label>
                  <input
                    id="largura"
                    type="number"
                    step="0.01"
                    min="0.01"
                    name="largura"
                    placeholder="Ex: 3.80"
                    value={form.largura}
                    onChange={handleChange}
                    required={usaLargura}
                  />
                </div>
              )}

              {usaAltura && (
                <div className="form-group medicao-dimensoes-grid__item">
                  <label htmlFor="altura">
                    Altura (m) *
                    <span className="medicao-help" title="Use o pé-direito ou altura da superfície." aria-hidden="true">ⓘ</span>
                  </label>
                  <input
                    id="altura"
                    type="number"
                    step="0.01"
                    min="0.01"
                    name="altura"
                    placeholder="Ex: 2.80"
                    value={form.altura}
                    onChange={handleChange}
                    required={usaAltura}
                  />
                </div>
              )}
            </div>
          )}

          {/* ─── Cálculos Automáticos ──────────────────────────────────────── */}
          {form.tipoServico && quantidadeCalculada > 0 && (
            <div className="summary" style={{ marginBottom: "var(--espacamento-lg)" }}>
              <h3>Resumo da Medição</h3>
              <p>
                <strong>Quantidade calculada:</strong> {quantidadeCalculada.toFixed(2)} {configTipoServico.unidade}
              </p>
              {!usaQuantidadeDireta && (
                <p>
                  <strong>Base de cálculo:</strong> {dimensoesResumo}
                </p>
              )}
            </div>
          )}

          {/* ─── Observações ────────────────────────────────────────────────── */}
          <div className="form-group">
            <label htmlFor="observacoes">Observações (opcional)</label>
            <textarea
              id="observacoes"
              name="observacoes"
              placeholder="Ex: parede com umidade no canto"
              value={form.observacoes}
              onChange={handleChange}
              rows="4"
            />
          </div>

          {/* ─── Foto da Medição ─────────────────────────────────────────────── */}
          <div className="form-group">
            <label htmlFor="foto">Foto da Medição (opcional)</label>

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
              <p className="medicao-upload-dropzone__title">Arraste a imagem aqui</p>
              <p className="medicao-upload-dropzone__subtitle">ou</p>
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
              <p className="medicao-upload-dropzone__hint">JPG, PNG ou WEBP • até 1 imagem por medição.</p>
              {foto && <p className="medicao-upload-dropzone__filename">Arquivo selecionado: {foto.name}</p>}
            </div>

            <input
              ref={fileInputRef}
              id="foto"
              type="file"
              accept="image/*"
              onChange={handleFotoChange}
              className="medicao-upload-hidden-input"
            />

            {preview && (
              <div className="medicao-upload-preview">
                <img
                  src={preview}
                  alt="Pré-visualização da foto selecionada"
                  style={{
                    maxWidth: "100%",
                    maxHeight: "220px",
                    borderRadius: "var(--borda-radius)",
                    border: "2px solid var(--cor-borda)",
                  }}
                />
              </div>
            )}
          </div>

          {error && <p className="erro-msg">{error}</p>}

          <div className="medicao-actions">
            <button
              type="submit"
              className="button-secondary medicao-actions__secondary"
              disabled={loadingMode !== null || loadingObras || obras.length === 0 || loadingEdicao}
              onClick={(event) => {
                event.preventDefault();
                handleSubmit("rascunho");
              }}
            >
              {loadingMode === "rascunho" ? "Salvando..." : "Salvar como rascunho"}
            </button>
            <button
              type="submit"
              className="button-primary medicao-actions__primary"
              disabled={loadingMode !== null || loadingObras || obras.length === 0 || loadingEdicao}
              onClick={(event) => {
                event.preventDefault();
                handleSubmit("enviada");
              }}
            >
              {loadingMode === "enviada"
                ? (modoEdicao ? "Atualizando..." : "Enviando medição...")
                : (modoEdicao ? "Reenviar para revisão" : "Enviar medição")}
            </button>
            {modoEdicao && (
              <button
                type="button"
                className="button-secondary medicao-actions__secondary"
                onClick={() => navigate("/medicoes-lista")}
                disabled={loadingMode !== null}
              >
                Cancelar edição
              </button>
            )}
          </div>
        </form>
        )}
      </div>
    </Layout>
  );
}

export default EnviarMedicao;
