import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { createDiario, listMeusDiarios } from "../services/diariosService";
import { extractApiMessage } from "../services/response";
import useObras from "../hooks/useObras";
import "../styles/pages.css";

// Separa valor da API do rótulo exibido na interface.
// "instavel" não tem acento no banco, mas a UI deve mostrar "Instável".
const CLIMAS = [
  { value: "ensolarado", label: "Ensolarado" },
  { value: "nublado",    label: "Nublado" },
  { value: "chuvoso",    label: "Chuvoso" },
  { value: "ventania",   label: "Ventania" },
  { value: "instavel",   label: "Instável" },
];

// Mapa rápido: valor da API → rótulo legível
const CLIMA_LABEL = Object.fromEntries(
  CLIMAS.map(({ value, label }) => [value, label])
);

export default function DiarioObra() {
  const [form, setForm] = useState({
    obra: "",
    data: new Date().toISOString().slice(0, 10),
    clima: "",
    atividades: "",
    ocorrencias: "",
    observacoesGerais: "",
  });

  const { obras, loadingObras } = useObras(100);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Estado separado para a seção de recentes — não contamina mensagens do formulário
  const [recentes, setRecentes] = useState([]);
  const [loadingRecentes, setLoadingRecentes] = useState(true);
  const [errorRecentes, setErrorRecentes] = useState("");

  // Pré-seleciona automaticamente quando houver apenas uma obra vinculada
  useEffect(() => {
    if (obras.length === 1) {
      setForm((prev) => ({ ...prev, obra: String(obras[0].id) }));
    }
  }, [obras]);

  // Carrega diários recentes ao montar
  useEffect(() => {
    carregarRecentes();
  }, []);

  async function carregarRecentes() {
    setLoadingRecentes(true);
    try {
      const data = await listMeusDiarios({ page: 1, limit: 5 });
      setRecentes(Array.isArray(data?.data) ? data.data : []);
      setErrorRecentes("");
    } catch {
      setErrorRecentes("Não foi possível carregar os diários recentes.");
    } finally {
      setLoadingRecentes(false);
    }
  }

  function handleChange(event) {
    setForm((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  }

  function mapLinesToArray(text) {
    return text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((descricao) => ({ descricao }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!form.obra) {
      setError("Selecione a obra do diário.");
      return;
    }

    if (!form.atividades.trim()) {
      setError("Informe pelo menos uma atividade do dia.");
      return;
    }

    const payload = {
      obra: Number(form.obra),
      data: new Date(`${form.data}T12:00:00`).toISOString(),
      clima: form.clima || null,
      atividades: mapLinesToArray(form.atividades),
      ocorrencias: mapLinesToArray(form.ocorrencias),
      observacoesGerais: form.observacoesGerais || null,
    };

    try {
      setLoading(true);
      await createDiario(payload);
      setSuccess("Diário registrado com sucesso.");
      setForm((prev) => ({
        ...prev,
        atividades: "",
        ocorrencias: "",
        observacoesGerais: "",
      }));
      // Atualiza lista de recentes silenciosamente (sem spinner)
      listMeusDiarios({ page: 1, limit: 5 })
        .then((data) => setRecentes(Array.isArray(data?.data) ? data.data : []))
        .catch(() => {});
    } catch (err) {
      setError(extractApiMessage(err, "Erro ao registrar diário."));
    } finally {
      setLoading(false);
    }
  }

  // Usa o fuso horário do Brasil para evitar off-by-one de UTC na exibição de datas
  function formatarData(isoString) {
    if (!isoString) return "—";
    return new Date(isoString).toLocaleDateString("pt-BR", {
      timeZone: "America/Sao_Paulo",
    });
  }

  const semObras = !loadingObras && obras.length === 0;

  return (
    <Layout>
      <div className="page-container">
        <h1 className="page-title">Diário de Obra</h1>
        <p className="page-description">
          Registre as atividades diárias da obra para manter o escritório
          atualizado.
        </p>

        <form onSubmit={handleSubmit} className="form-container">
          {/* Obra */}
          <div className="form-group">
            <label htmlFor="obra">Obra *</label>
            {loadingObras ? (
              <select disabled>
                <option>Carregando obras...</option>
              </select>
            ) : semObras ? (
              <p className="erro-msg" style={{ margin: "4px 0 0" }}>
                Nenhuma obra vinculada à sua conta. Contate o administrador.
              </p>
            ) : (
              <select
                id="obra"
                name="obra"
                value={form.obra}
                onChange={handleChange}
              >
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

          {/* Data */}
          <div className="form-group">
            <label htmlFor="data">Data *</label>
            <input
              id="data"
              name="data"
              type="date"
              value={form.data}
              onChange={handleChange}
              required
            />
          </div>

          {/* Clima */}
          <div className="form-group">
            <label htmlFor="clima">Clima</label>
            <select
              id="clima"
              name="clima"
              value={form.clima}
              onChange={handleChange}
            >
              <option value="">Selecione</option>
              {CLIMAS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Atividades */}
          <div className="form-group">
            <label htmlFor="atividades">Atividades do dia *</label>
            <textarea
              id="atividades"
              name="atividades"
              rows={4}
              placeholder="Uma atividade por linha. Ex: Concretagem da laje"
              value={form.atividades}
              onChange={handleChange}
              required
            />
          </div>

          {/* Ocorrências */}
          <div className="form-group">
            <label htmlFor="ocorrencias">Ocorrências</label>
            <textarea
              id="ocorrencias"
              name="ocorrencias"
              rows={3}
              placeholder="Uma ocorrência por linha. Ex: Chuva às 15h"
              value={form.ocorrencias}
              onChange={handleChange}
            />
          </div>

          {/* Observações */}
          <div className="form-group">
            <label htmlFor="observacoesGerais">Observações gerais</label>
            <textarea
              id="observacoesGerais"
              name="observacoesGerais"
              rows={3}
              value={form.observacoesGerais}
              onChange={handleChange}
            />
          </div>

          {error && <p className="erro-msg">{error}</p>}
          {success && <p className="success-msg">{success}</p>}

          <button
            className="button-primary"
            type="submit"
            disabled={loading || loadingObras || semObras}
          >
            {loading ? "Salvando..." : "Salvar Diário"}
          </button>
        </form>

        {/* Seção de diários recentes */}
        <h3 style={{ marginTop: "var(--espacamento-xl)" }}>
          Últimos diários enviados
        </h3>

        {loadingRecentes ? (
          <div className="card" style={{ marginTop: "var(--espacamento-md)" }}>
            Carregando...
          </div>
        ) : errorRecentes ? (
          <div className="card" style={{ marginTop: "var(--espacamento-md)" }}>
            <p className="erro-msg" style={{ margin: 0 }}>
              {errorRecentes}
            </p>
          </div>
        ) : recentes.length === 0 ? (
          <div className="card" style={{ marginTop: "var(--espacamento-md)" }}>
            Nenhum diário registrado ainda.
          </div>
        ) : (
          recentes.map((d) => (
            <div
              key={d.id}
              className="card"
              style={{ marginTop: "var(--espacamento-sm)" }}
            >
              <strong>{formatarData(d.data)}</strong>
              {d.obraNome && (
                <p style={{ marginTop: "4px", color: "var(--cor-texto-secundario, #666)" }}>
                  {d.obraNome}
                </p>
              )}
              <p style={{ marginTop: "6px" }}>
                <strong>Clima:</strong>{" "}
                {CLIMA_LABEL[d.clima] ?? "Não informado"}
              </p>
              <p style={{ marginTop: "6px" }}>
                <strong>Atividades:</strong>{" "}
                {Array.isArray(d.atividades) ? d.atividades.length : 0} registro(s)
              </p>
            </div>
          ))
        )}
      </div>
    </Layout>
  );
}
