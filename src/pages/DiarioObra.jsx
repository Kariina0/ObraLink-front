import { useEffect, useRef, useState } from "react";
import Layout from "../components/Layout";
import {
  checkDuplicataDiario,
  createDiario,
  listMeusDiarios,
} from "../services/diariosService";
import { extractApiMessage } from "../services/response";
import { enqueueSyncOperation } from "../utils/syncQueue";
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

// Data máxima aceita no input (hoje, no fuso local)
function getTodayInputDate() {
  return new Date().toISOString().slice(0, 10);
}

// ── Cartão de detalhes de um diário recente ───────────────────────────────────
function CardDiario({ d, formatarData }) {
  const [expandido, setExpandido] = useState(false);
  if (!d) return null;

  const atividades  = Array.isArray(d.atividades)  ? d.atividades  : [];
  const ocorrencias = Array.isArray(d.ocorrencias) ? d.ocorrencias : [];

  const primeiraAtividade = atividades[0]?.descricao ?? null;
  const restantes         = atividades.length > 1 ? atividades.length - 1 : 0;

  return (
    <div className="card" style={{ marginTop: "var(--espacamento-sm)" }}>
      {/* Cabeçalho do cartão */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "8px" }}>
        <div>
          <strong style={{ fontSize: "1.05rem" }}>{formatarData(d.data)}</strong>
          {d.obraNome && (
            <p style={{ margin: "2px 0 0", color: "var(--cor-texto-secundario, #666)", fontSize: "0.9rem" }}>
              {d.obraNome}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setExpandido((v) => !v)}
          style={{
            background: "none",
            border: "1px solid var(--cor-borda, #ddd)",
            borderRadius: "6px",
            padding: "4px 10px",
            cursor: "pointer",
            fontSize: "0.85rem",
            color: "var(--cor-texto-secundario, #555)",
            whiteSpace: "nowrap",
          }}
        >
          {expandido ? "Ocultar detalhes" : "Ver detalhes"}
        </button>
      </div>

      {/* Resumo sempre visível */}
      <p style={{ marginTop: "8px", fontSize: "0.92rem" }}>
        <strong>Clima:</strong>{" "}
        {CLIMA_LABEL[d.clima] ?? <em style={{ color: "#999" }}>Não informado</em>}
      </p>
      <p style={{ marginTop: "4px", fontSize: "0.92rem" }}>
        <strong>Atividades:</strong>{" "}
        {atividades.length === 0 ? (
          <em style={{ color: "#999" }}>Nenhuma registrada</em>
        ) : (
          <>
            {primeiraAtividade}
            {restantes > 0 && (
              <span style={{ color: "var(--cor-texto-secundario, #666)" }}>
                {" "}(+{restantes} {restantes === 1 ? "outra" : "outras"})
              </span>
            )}
          </>
        )}
      </p>

      {/* Detalhes expandíveis */}
      {expandido && (
        <div style={{ marginTop: "12px", borderTop: "1px solid var(--cor-borda, #eee)", paddingTop: "12px" }}>
          {atividades.length > 1 && (
            <div style={{ marginBottom: "10px" }}>
              <strong style={{ fontSize: "0.9rem" }}>Todas as atividades:</strong>
              <ul style={{ margin: "4px 0 0 16px", padding: 0, fontSize: "0.9rem" }}>
                {atividades.map((a, i) => (
                  <li key={i}>{a.descricao}</li>
                ))}
              </ul>
            </div>
          )}

          {ocorrencias.length > 0 && (
            <div style={{ marginBottom: "10px" }}>
              <strong style={{ fontSize: "0.9rem" }}>Ocorrências:</strong>
              <ul style={{ margin: "4px 0 0 16px", padding: 0, fontSize: "0.9rem" }}>
                {ocorrencias.map((o, i) => (
                  <li key={i}>{o.descricao}</li>
                ))}
              </ul>
            </div>
          )}

          {d.observacoesGerais && (
            <div>
              <strong style={{ fontSize: "0.9rem" }}>Observações gerais:</strong>
              <p style={{ margin: "4px 0 0", fontSize: "0.9rem" }}>{d.observacoesGerais}</p>
            </div>
          )}

          {ocorrencias.length === 0 && !d.observacoesGerais && atividades.length <= 1 && (
            <p style={{ color: "#999", fontSize: "0.9rem", margin: 0 }}>
              Nenhum detalhe adicional registrado.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function DiarioObra() {
  const [form, setForm] = useState({
    obra: "",
    data: getTodayInputDate(),
    clima: "",
    atividades: "",
    ocorrencias: "",
    observacoesGerais: "",
    // Campos adicionais (seção expansível)
    equipamentos: "",
    maoDeObra: "",
    materiais: "",
    visitantes: "",
  });

  const { obras, loadingObras } = useObras(100);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [success, setSuccess]   = useState("");
  const [aviso, setAviso]       = useState(""); // aviso de duplicata (não bloqueia)
  const [mostrarCamposExtra, setMostrarCamposExtra] = useState(false);

  // Estado separado para a seção de recentes — não contamina mensagens do formulário
  const [recentes, setRecentes]               = useState([]);
  const [loadingRecentes, setLoadingRecentes] = useState(true);
  const [errorRecentes, setErrorRecentes]     = useState("");

  // Controla debounce do check de duplicata
  const checkTimeoutRef = useRef(null);

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

  // Verifica duplicata sempre que obra ou data mudam
  useEffect(() => {
    clearTimeout(checkTimeoutRef.current);
    setAviso("");
    if (!form.obra || !form.data) return;

    checkTimeoutRef.current = setTimeout(async () => {
      try {
        const result = await checkDuplicataDiario(Number(form.obra), form.data);
        if (result?.exists) {
          setAviso("Atenção: já existe um diário registrado para esta obra nesta data.");
        }
      } catch {
        // Falha silenciosa — o servidor validará na submissão
      }
    }, 600);

    return () => clearTimeout(checkTimeoutRef.current);
  }, [form.obra, form.data]);

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
      setError("Selecione a obra antes de registrar o diário.");
      return;
    }

    if (!form.atividades.trim()) {
      setError("Informe pelo menos uma atividade do dia.");
      return;
    }

    // Bloqueia data futura mesmo que o browser aceite digitação manual
    if (form.data > getTodayInputDate()) {
      setError("Não é permitido registrar diário com data futura.");
      return;
    }

    const payload = {
      obra: Number(form.obra),
      data: new Date(`${form.data}T12:00:00`).toISOString(),
      clima: form.clima || null,
      atividades:        mapLinesToArray(form.atividades),
      ocorrencias:       mapLinesToArray(form.ocorrencias),
      equipamentos:      mapLinesToArray(form.equipamentos),
      maoDeObra:         mapLinesToArray(form.maoDeObra),
      materiais:         mapLinesToArray(form.materiais),
      visitantes:        mapLinesToArray(form.visitantes),
      observacoesGerais: form.observacoesGerais.trim() || null,
    };

    const limparForm = () => {
      setAviso("");
      setForm((prev) => ({
        ...prev,
        atividades:        "",
        ocorrencias:       "",
        observacoesGerais: "",
        equipamentos:      "",
        maoDeObra:         "",
        materiais:         "",
        visitantes:        "",
      }));
    };

    // Modo offline: enfileira para sincronização automática
    if (!navigator.onLine) {
      try {
        await enqueueSyncOperation("diario", payload);
        setSuccess("Sem internet: diário salvo localmente e será enviado automaticamente ao reconectar.");
        limparForm();
      } catch {
        setError("Não foi possível salvar o diário offline. Tente novamente.");
      }
      return;
    }

    try {
      setLoading(true);
      await createDiario(payload);
      setSuccess("Diário registrado com sucesso!");
      limparForm();
      // Atualiza lista de recentes silenciosamente (sem spinner)
      listMeusDiarios({ page: 1, limit: 5 })
        .then((data) => setRecentes(Array.isArray(data?.data) ? data.data : []))
        .catch(() => {});
    } catch (err) {
      const status = err?.response?.status;
      if (!status) {
        // Falha de rede — salva offline como fallback
        try {
          await enqueueSyncOperation("diario", payload);
          setSuccess("Sem conexão: diário salvo localmente e será enviado automaticamente ao reconectar.");
          limparForm();
        } catch {
          setError("Erro ao registrar o diário. Verifique sua conexão e tente novamente.");
        }
      } else {
        setError(extractApiMessage(err, "Erro ao registrar o diário. Tente novamente."));
      }
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
                Nenhuma obra vinculada à sua conta. Entre em contato com o
                administrador.
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
              max={getTodayInputDate()}
              onChange={handleChange}
              required
            />
          </div>

          {/* Aviso de duplicata */}
          {aviso && (
            <p
              style={{
                margin: "0 0 var(--espacamento-sm)",
                padding: "10px 14px",
                background: "#fff8e1",
                border: "1px solid #f9a825",
                borderRadius: "6px",
                color: "#7a5500",
                fontSize: "0.92rem",
              }}
            >
              ⚠️ {aviso}
            </p>
          )}

          {/* Clima */}
          <div className="form-group">
            <label htmlFor="clima">Clima do dia</label>
            <select
              id="clima"
              name="clima"
              value={form.clima}
              onChange={handleChange}
            >
              <option value="">Selecione o clima do dia</option>
              {CLIMAS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Atividades */}
          <div className="form-group">
            <label htmlFor="atividades">
              Atividades realizadas *
              <span
                style={{ fontWeight: 400, fontSize: "0.85rem", marginLeft: "6px", color: "var(--cor-texto-secundario, #666)" }}
              >
                (uma por linha)
              </span>
            </label>
            <textarea
              id="atividades"
              name="atividades"
              rows={4}
              placeholder={"Concretagem da laje\nMontagem das formas\nInstalação hidráulica — andar 2"}
              value={form.atividades}
              onChange={handleChange}
              required
            />
          </div>

          {/* Ocorrências */}
          <div className="form-group">
            <label htmlFor="ocorrencias">
              Ocorrências
              <span
                style={{ fontWeight: 400, fontSize: "0.85rem", marginLeft: "6px", color: "var(--cor-texto-secundario, #666)" }}
              >
                (uma por linha)
              </span>
            </label>
            <textarea
              id="ocorrencias"
              name="ocorrencias"
              rows={3}
              placeholder={"Chuva às 15h — paralisação de 1h\nAcidente sem feridos — relatório aberto"}
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
              placeholder="Ex: Equipe completa. Visita do engenheiro às 10h. Entrega de material prevista para amanhã."
              value={form.observacoesGerais}
              onChange={handleChange}
            />
          </div>

          {/* Campos adicionais — expansível */}
          <div style={{ margin: "var(--espacamento-sm) 0" }}>
            <button
              type="button"
              onClick={() => setMostrarCamposExtra((v) => !v)}
              style={{
                background: "none",
                border: "1px dashed var(--cor-borda, #ccc)",
                borderRadius: "6px",
                padding: "8px 14px",
                width: "100%",
                textAlign: "left",
                cursor: "pointer",
                color: "var(--cor-texto-secundario, #555)",
                fontSize: "0.92rem",
              }}
            >
              {mostrarCamposExtra ? "▲ Ocultar campos adicionais" : "▼ Adicionar equipamentos, mão de obra, materiais ou visitantes"}
            </button>
          </div>

          {mostrarCamposExtra && (
            <>
              <div className="form-group">
                <label htmlFor="equipamentos">
                  Equipamentos utilizados
                  <span style={{ fontWeight: 400, fontSize: "0.85rem", marginLeft: "6px", color: "var(--cor-texto-secundario, #666)" }}>
                    (um por linha)
                  </span>
                </label>
                <textarea
                  id="equipamentos"
                  name="equipamentos"
                  rows={2}
                  placeholder={"Betoneira\nGuindaste — 6h de uso"}
                  value={form.equipamentos}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label htmlFor="maoDeObra">
                  Mão de obra
                  <span style={{ fontWeight: 400, fontSize: "0.85rem", marginLeft: "6px", color: "var(--cor-texto-secundario, #666)" }}>
                    (uma categoria por linha)
                  </span>
                </label>
                <textarea
                  id="maoDeObra"
                  name="maoDeObra"
                  rows={2}
                  placeholder={"Pedreiros — 4 presentes\nEletricitários — 2 presentes"}
                  value={form.maoDeObra}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label htmlFor="materiais">
                  Materiais utilizados
                  <span style={{ fontWeight: 400, fontSize: "0.85rem", marginLeft: "6px", color: "var(--cor-texto-secundario, #666)" }}>
                    (um por linha)
                  </span>
                </label>
                <textarea
                  id="materiais"
                  name="materiais"
                  rows={2}
                  placeholder={"Cimento — 20 sacos\nFerro 10mm — 50 barras"}
                  value={form.materiais}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label htmlFor="visitantes">
                  Visitantes
                  <span style={{ fontWeight: 400, fontSize: "0.85rem", marginLeft: "6px", color: "var(--cor-texto-secundario, #666)" }}>
                    (um por linha)
                  </span>
                </label>
                <textarea
                  id="visitantes"
                  name="visitantes"
                  rows={2}
                  placeholder={"Eng. Carlos Silva — vistoria\nFiscal da prefeitura"}
                  value={form.visitantes}
                  onChange={handleChange}
                />
              </div>
            </>
          )}

          {error && <p className="erro-msg">{error}</p>}
          {success && <p className="success-msg">{success}</p>}

          <button
            className="button-primary"
            type="submit"
            disabled={loading || loadingObras || semObras}
          >
            {loading ? "Registrando..." : "Registrar diário"}
          </button>
        </form>

        {/* Seção de diários recentes */}
        <h3 style={{ marginTop: "var(--espacamento-xl)", marginBottom: "var(--espacamento-sm)" }}>
          Últimos diários registrados
        </h3>

        {loadingRecentes ? (
          <div className="card" style={{ marginTop: "var(--espacamento-md)" }}>
            Carregando diários recentes...
          </div>
        ) : errorRecentes ? (
          <div className="card" style={{ marginTop: "var(--espacamento-md)" }}>
            <p className="erro-msg" style={{ margin: 0 }}>
              {errorRecentes}
            </p>
          </div>
        ) : recentes.length === 0 ? (
          <div
            className="card"
            style={{
              marginTop: "var(--espacamento-md)",
              color: "var(--cor-texto-secundario, #666)",
              textAlign: "center",
              padding: "var(--espacamento-xl)",
            }}
          >
            <p style={{ margin: 0, fontSize: "1.1rem" }}>📋</p>
            <p style={{ margin: "8px 0 0" }}>Nenhum diário registrado ainda.</p>
            <p style={{ margin: "4px 0 0", fontSize: "0.875rem" }}>
              Preencha o formulário acima para criar o primeiro registro.
            </p>
          </div>
        ) : (
          recentes.map((d) => (
            <CardDiario key={d.id} d={d} formatarData={formatarData} />
          ))
        )}
      </div>
    </Layout>
  );
}
