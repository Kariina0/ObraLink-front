// src/pages/EnviarMedicao.jsx
// Nova Medição — disponível para encarregado, supervisor e admin.
// O select de obra carrega apenas as obras vinculadas ao usuário logado
// (o back-end já filtra por perfil: encarregado vê só suas obras).
import { useState, useEffect } from "react";
import Layout from "../components/Layout";
import { createMedicao } from "../services/medicoesService";
import { uploadFile } from "../services/filesService";
import { extractApiMessage } from "../services/response";
import useObras from "../hooks/useObras";
import { AREAS_MEDICAO, TIPOS_SERVICO } from "../constants/medicao";
import { enqueueSyncOperation } from "../utils/syncQueue";
import "../styles/pages.css";

function EnviarMedicao() {

  const [form, setForm] = useState({
    obra: "",
    area: "",          // nome do ambiente (quarto, sala, etc.)
    tipoServico: "",   // tipo de serviço realizado
    comprimento: "",
    largura: "",
    altura: "",
    observacoes: "",
  });

  const [foto, setFoto] = useState(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loadingMode, setLoadingMode] = useState(null);
  const { obras, loadingObras } = useObras(100);

  useEffect(() => {
    const onSyncCompleted = (event) => {
      const total = event?.detail?.synced || 0;
      if (total > 0) {
        setSuccess(`Sincronização concluída: ${total} registro(s) offline enviado(s).`);
      }
    };

    window.addEventListener("sync:completed", onSyncCompleted);
    return () => window.removeEventListener("sync:completed", onSyncCompleted);
  }, []);

  // Pré-seleciona automaticamente quando houver apenas uma obra vinculada
  useEffect(() => {
    if (obras.length === 1) {
      setForm((prev) => ({ ...prev, obra: String(obras[0].id) }));
    }
  }, [obras]);

  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  // ─── Cálculos automáticos de área e volume ──────────────────────────────────
  const comprimento = Number(form.comprimento) || 0;
  const largura = Number(form.largura) || 0;
  const altura = Number(form.altura) || 0;
  const areaCalculada = comprimento * largura;
  const volume = comprimento * largura * altura;

  function handleChange(event) {
    setForm({
      ...form,
      [event.target.name]: event.target.value,
    });
  }

  function handleFotoChange(event) {
    const file = event.target.files[0];
    if (file) {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
      setFoto(file);
      setPreview(URL.createObjectURL(file));
    }
  }

  // ─── Envio do formulário ─────────────────────────────────────────────────────
  async function handleSubmit(mode = "enviada") {
    if (loadingMode) return;

    setError("");
    setSuccess("");

    // Validações no cliente antes de chamar a API
    if (!form.obra) {
      setError("Selecione uma obra para registrar a medição.");
      return;
    }
    if (!form.area) {
      setError("Selecione a área (ambiente) da medição.");
      return;
    }
    if (!form.tipoServico) {
      setError("Selecione o tipo de serviço realizado.");
      return;
    }
    if (comprimento <= 0 || largura <= 0 || altura <= 0) {
      setError("Comprimento, largura e altura devem ser maiores que zero.");
      return;
    }

    const body = {
      obra: Number(form.obra),
      data: new Date().toISOString(),
      area: form.area,
      tipoServico: form.tipoServico,
      observacoes: form.observacoes,
      status: mode,
      comprimento: Number(form.comprimento),
      largura: Number(form.largura),
      altura: Number(form.altura),
      areaCalculada,
      volume,
      itens: [
        {
          descricao: `Medição geométrica — ${form.area}`,
          quantidade: areaCalculada,
          unidade: "m²",
          valorUnitario: null,
          valorTotal: volume > 0 ? volume : areaCalculada,
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

      // Upload da foto antes de criar a medição, se houver
      // O back-end exige: obra (id), tipoArquivo e descricao (mín 3 chars)
      if (foto) {
        const areaLabel = form.area || "medição";
        const uploadRes = await uploadFile(foto, {
          obra: Number(form.obra),
          tipoArquivo: "foto_obra",
          descricao: `Foto da medição — ${areaLabel}`,
        });
        anexoId = uploadRes?.id ? Number(uploadRes.id) : null;
      }

      // Criar medição no back-end, incluindo dimensões brutas e campos de área/serviço
      fullBody = { ...body, ...(anexoId ? { anexos: [anexoId] } : {}) };

      if (!navigator.onLine) {
        await enqueueSyncOperation("medicao", fullBody);
      } else {
        await createMedicao(fullBody);
      }

      const acaoLabel = mode === "rascunho" ? "Rascunho salvo" : "Medição enviada";
      setSuccess(
        navigator.onLine
          ? `${acaoLabel} com sucesso!`
          : `Sem internet: ${acaoLabel.toLowerCase()} para sincronização automática.`,
      );
      // Limpa o formulário, mas mantém a obra se só havia uma opção
      setForm({
        obra: obras.length === 1 ? String(obras[0].id) : "",
        area: "",
        tipoServico: "",
        comprimento: "",
        largura: "",
        altura: "",
        observacoes: "",
      });
      setFoto(null);
      setPreview(null);
    } catch (err) {
      const status = err?.response?.status;
      if (!navigator.onLine || !status) {
        await enqueueSyncOperation("medicao", fullBody);
        const acaoLabel = mode === "rascunho" ? "Rascunho" : "Medição";
        setSuccess(`Sem conexão: ${acaoLabel.toLowerCase()} salvo offline e será sincronizado ao reconectar.`);
      } else {
        setError("Erro ao enviar medição: " + extractApiMessage(err));
      }
    } finally {
      setLoadingMode(null);
    }
  }

  return (
    <Layout>
      <div className="page-container">
        <h1 className="page-title">Nova Medição</h1>
        <p style={{ fontSize: "var(--tamanho-fonte-grande)", color: "var(--cor-texto-secundario)", marginBottom: "var(--espacamento-xl)", lineHeight: "1.6" }}>
          Registre as dimensões e informações da medição realizada na obra.
          Os campos marcados com <strong>*</strong> são obrigatórios.
        </p>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            handleSubmit("enviada");
          }}
          className="form-container"
        >

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
                {obras.map((obra) => (
                  <option key={obra.id} value={obra.id}>
                    {obra.nome || `Obra #${obra.id}`}
                  </option>
                ))}
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
              {AREAS_MEDICAO.map((a) => (
                <option key={a.value} value={a.value}>{a.label}</option>
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
              <option value="">Selecione o tipo de serviço</option>
              {TIPOS_SERVICO.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* ─── Dimensões ──────────────────────────────────────────────────── */}
          <div className="form-group">
            <label htmlFor="comprimento">Comprimento (metros) *</label>
            <input
              id="comprimento"
              type="number"
              step="0.01"
              min="0.01"
              name="comprimento"
              placeholder="Ex: 10,50"
              value={form.comprimento}
              onChange={handleChange}
              required
            />
            <small style={{ color: "var(--cor-texto-secundario)", fontSize: "var(--tamanho-fonte-pequena)" }}>
              Exemplo: para parede de alvenaria, use o lado horizontal (ex: 5.20m).
            </small>
          </div>

          <div className="form-group">
            <label htmlFor="largura">Largura (metros) *</label>
            <input
              id="largura"
              type="number"
              step="0.01"
              min="0.01"
              name="largura"
              placeholder="Ex: 8,00"
              value={form.largura}
              onChange={handleChange}
              required
            />
            <small style={{ color: "var(--cor-texto-secundario)", fontSize: "var(--tamanho-fonte-pequena)" }}>
              Exemplo: para piso, use a segunda dimensão do ambiente (ex: 3.80m).
            </small>
          </div>

          <div className="form-group">
            <label htmlFor="altura">Altura (metros) *</label>
            <input
              id="altura"
              type="number"
              step="0.01"
              min="0.01"
              name="altura"
              placeholder="Ex: 3,00"
              value={form.altura}
              onChange={handleChange}
              required
            />
            <small style={{ color: "var(--cor-texto-secundario)", fontSize: "var(--tamanho-fonte-pequena)" }}>
              Exemplo: para alvenaria, use o pé-direito (ex: 2.80m). Para piso, informe 0.01.
            </small>
          </div>

          {/* ─── Cálculos Automáticos ──────────────────────────────────────── */}
          {(comprimento > 0 || largura > 0 || altura > 0) && (
            <div className="summary" style={{ marginBottom: "var(--espacamento-lg)" }}>
              <h3>Cálculos Automáticos</h3>
              <p><strong>Área calculada:</strong> {areaCalculada.toFixed(2)} m²</p>
              <p><strong>Volume calculado:</strong> {volume.toFixed(2)} m³</p>
            </div>
          )}

          {/* ─── Observações ────────────────────────────────────────────────── */}
          <div className="form-group">
            <label htmlFor="observacoes">Observações (opcional)</label>
            <textarea
              id="observacoes"
              name="observacoes"
              placeholder="Adicione informações extras sobre a medição, condições encontradas, etc."
              value={form.observacoes}
              onChange={handleChange}
              rows="4"
            />
          </div>

          {/* ─── Foto da Medição ─────────────────────────────────────────────── */}
          <div className="form-group">
            <label htmlFor="foto">Foto da Medição (opcional)</label>
            <input
              id="foto"
              type="file"
              accept="image/*"
              onChange={handleFotoChange}
              className="file-input"
            />
            {preview && (
              <div style={{ marginTop: "var(--espacamento-sm)" }}>
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
          {success && <p className="success-msg">{success}</p>}

          <div style={{ display: "flex", gap: "var(--espacamento-sm)", flexWrap: "wrap" }}>
            <button
              type="submit"
              className="button-secondary"
              disabled={loadingMode !== null || loadingObras || obras.length === 0}
              onClick={(event) => {
                event.preventDefault();
                handleSubmit("rascunho");
              }}
            >
              {loadingMode === "rascunho" ? "Salvando..." : "Salvar Rascunho"}
            </button>
            <button
              type="submit"
              className="button-primary"
              disabled={loadingMode !== null || loadingObras || obras.length === 0}
              onClick={(event) => {
                event.preventDefault();
                handleSubmit("enviada");
              }}
            >
              {loadingMode === "enviada" ? "Enviando medição..." : "Enviar Medição"}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
}

export default EnviarMedicao;
