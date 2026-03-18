// src/pages/PurchaseRequest.jsx
import { useContext, useEffect, useState } from "react";
import Layout from "../components/Layout";
import { AuthContext } from "../context/AuthContext";
import { createPurchase } from "../services/purchasesService";
import { extractApiMessage } from "../services/response";
import useObras from "../hooks/useObras";
import { enqueueSyncOperation } from "../utils/syncQueue";
import "../styles/pages.css";

function getTodayInputDate() {
  return new Date().toISOString().slice(0, 10);
}

const CATEGORIAS = [
  {
    nome: "EPI — Equipamentos de Proteção Individual",
    itens: [
      "Capacete de segurança (classe A)",
      "Capacete de segurança (classe B)",
      "Luvas de raspa de couro",
      "Luvas de borracha isolante",
      "Luvas de malha de aço",
      "Bota de segurança com biqueira",
      "Bota de PVC cano longo",
      "Óculos de proteção incolor",
      "Óculos de proteção fumê",
      "Protetor auricular tipo plug",
      "Protetor auricular tipo concha",
      "Colete refletivo classe II",
      "Cinto de segurança tipo paraquedista",
      "Talabarte de segurança duplo",
      "Máscara respiratória PFF2",
      "Máscara respiratória PFF3",
      "Máscara semifacial com filtro",
      "Avental de raspa de couro",
      "Manga de raspa de couro",
      "Joelheira ergonômica",
    ],
  },
  {
    nome: "Ferramentas Manuais",
    itens: [
      "Martelo de borracha",
      "Martelo de carpinteiro",
      "Marreta 1,5 kg",
      "Marreta 3 kg",
      "Chave de fenda 1/4 x 6\"",
      "Chave Phillips 1/4 x 6\"",
      "Alicate universal 8\"",
      "Alicate de corte diagonal",
      "Alicate de pressão",
      "Serra manual 26\"",
      "Serrote para gesso",
      "Arco de serra com lâmina",
      "Nível de alumínio 60 cm",
      "Nível de alumínio 120 cm",
      "Trena de aço 5 m",
      "Trena de aço 50 m",
      "Colher de pedreiro 10\"",
      "Desempenadeira de aço",
      "Desempenadeira de borracha",
      "Régua de alumínio 1,5 m",
      "Régua de alumínio 3 m",
      "Enxada",
      "Pazinha de jardinagem",
      "Pá de bico",
      "Picareta",
      "Ponteiro e talhadeira",
    ],
  },
  {
    nome: "Ferramentas Elétricas e Equipamentos",
    itens: [
      "Furadeira de impacto",
      "Parafusadeira a bateria",
      "Serra circular",
      "Serra tico-tico",
      "Esmerilhadeira 4,5\"",
      "Esmerilhadeira 7\"",
      "Lixadeira orbital",
      "Compactador de solo (placa)",
      "Betoneira 400L",
      "Vibrador de imersão para concreto",
      "Gerador de energia",
      "Compressor de ar",
      "Pistola de pintura",
      "Soprador térmico",
      "Detector de tensão",
      "Multímetro digital",
      "Extensão elétrica 20 m",
      "Extensão elétrica 50 m",
    ],
  },
  {
    nome: "Materiais de Construção Civil",
    itens: [
      "Cimento CP II — saco 50 kg",
      "Cimento CP V — saco 50 kg",
      "Cimento branco — saco 20 kg",
      "Areia fina (m³)",
      "Areia média (m³)",
      "Areia grossa (m³)",
      "Brita nº 0 (m³)",
      "Brita nº 1 (m³)",
      "Brita nº 2 (m³)",
      "Tijolo cerâmico 9x14x19 cm (milheiro)",
      "Tijolo maciço (milheiro)",
      "Bloco de concreto 14x19x39 cm (und)",
      "Bloco de concreto celular (m³)",
      "Argamassa AC-I — saco 20 kg",
      "Argamassa AC-II — saco 20 kg",
      "Argamassa AC-III — saco 20 kg",
      "Argamassa de reboco (saco 20 kg)",
      "Cal hidratada CH-I (saco 20 kg)",
      "Cal virgem (saco 20 kg)",
      "Ferro CA-50 — Ø 6,3 mm (barra 12 m)",
      "Ferro CA-50 — Ø 8 mm (barra 12 m)",
      "Ferro CA-50 — Ø 10 mm (barra 12 m)",
      "Ferro CA-50 — Ø 12,5 mm (barra 12 m)",
      "Ferro CA-60 — Ø 4,2 mm (barra 12 m)",
      "Tela soldada Q-138",
      "Tela soldada Q-196",
      "Lona plástica 100 micras (m²)",
      "Madeira pinus para forma 3x30 cm (m)",
      "Compensado para forma 12 mm (chapa)",
      "Concreto usinado fck 20 MPa (m³)",
      "Concreto usinado fck 25 MPa (m³)",
    ],
  },
  {
    nome: "Acabamentos e Revestimentos",
    itens: [
      "Piso cerâmico 60x60 cm (m²)",
      "Piso porcelanato 60x60 cm (m²)",
      "Piso porcelanato 80x80 cm (m²)",
      "Azulejo 20x20 cm (m²)",
      "Revestimento externo 30x60 cm (m²)",
      "Rejunte acrílico (kg)",
      "Rejunte cimentício (kg)",
      "Gesso em pó — saco 20 kg",
      "Placa de gesso acartonado 1,20x1,80 m",
      "Perfil guia U 70 mm (3 m)",
      "Perfil montante 70 mm (3 m)",
      "Rodapé de porcelanato (m)",
      "Rodapé de madeira MDF (m)",
      "Soleira de granito (m)",
      "Peitoril de granito (m)",
      "Massa corrida PVA (lata 25 kg)",
      "Massa acrílica (lata 25 kg)",
    ],
  },
  {
    nome: "Pintura e Impermeabilização",
    itens: [
      "Tinta látex PVA branca (18L)",
      "Tinta acrílica premium branca (18L)",
      "Tinta acrílica colorida (18L)",
      "Tinta esmalte brilhante (3,6L)",
      "Tinta esmalte fosco (3,6L)",
      "Primer acrílico (18L)",
      "Selador acrílico (18L)",
      "Textura acrílica (25 kg)",
      "Verniz marítimo (3,6L)",
      "Lixa para parede nº 80 (folha)",
      "Lixa para madeira nº 120 (folha)",
      "Rolo de lã 23 cm",
      "Rolo de espuma 23 cm",
      "Pincel 3\" cerdas naturais",
      "Fita crepe (und)",
      "Impermeabilizante acrílico (18L)",
      "Manta asfáltica 3 mm (m²)",
      "Manta asfáltica 4 mm (m²)",
      "Argamassa de impermeabilização (20 kg)",
    ],
  },
  {
    nome: "Materiais Elétricos",
    itens: [
      "Fio flexível 1,5 mm² (rolo 100 m)",
      "Fio flexível 2,5 mm² (rolo 100 m)",
      "Fio flexível 4 mm² (rolo 100 m)",
      "Cabo PP 2x2,5 mm² (m)",
      "Disjuntor monopolar 10A",
      "Disjuntor monopolar 16A",
      "Disjuntor monopolar 20A",
      "Disjuntor bipolar 25A",
      "Disjuntor bipolar 40A",
      "Disjuntor tripolar 50A",
      "Tomada 2P+T 10A",
      "Tomada 2P+T 20A",
      "Interruptor simples",
      "Interruptor paralelo",
      "Interruptor três teclas",
      "Eletroduto PVC rígido 3/4\" (barra 3 m)",
      "Eletroduto PVC rígido 1\" (barra 3 m)",
      "Eletroduto corrugado 3/4\" (rolo 50 m)",
      "Caixa de passagem 10x10 cm",
      "Caixa de passagem 15x15 cm",
      "Quadro de distribuição 12 disjuntores",
      "Luminária LED 20W",
      "Luminária de emergência",
      "Lâmpada LED bulbo 9W",
    ],
  },
  {
    nome: "Materiais Hidráulicos e Sanitários",
    itens: [
      "Tubo PVC esgoto 50 mm (barra 6 m)",
      "Tubo PVC esgoto 75 mm (barra 6 m)",
      "Tubo PVC esgoto 100 mm (barra 6 m)",
      "Tubo PVC água fria 25 mm (barra 6 m)",
      "Tubo PVC água fria 32 mm (barra 6 m)",
      "Tubo CPVC água quente 22 mm (barra 3 m)",
      "Joelho 90° PVC 100 mm",
      "Joelho 45° PVC 100 mm",
      "Tê PVC 100 mm",
      "Luva PVC 100 mm",
      "Joelho soldável 25 mm",
      "Tê soldável 25 mm",
      "Registro de gaveta 25 mm",
      "Registro de esfera 1/2\"",
      "Válvula de retenção 25 mm",
      "Caixa d'água PVC 500L",
      "Caixa d'água PVC 1000L",
      "Fita veda-rosca (und)",
      "Cola para PVC (bisnaga)",
      "Cimento para esgoto (lata)",
      "Sifão para pia",
      "Caixilho de inspeção",
    ],
  },
  {
    nome: "Andaimes, Escoramentos e Segurança de Obra",
    itens: [
      "Andaime tubular — trecho 1 m (und)",
      "Andaime tubular — trecho 2 m (und)",
      "Prancha metálica 1,5 m (und)",
      "Braçadeira simples (und)",
      "Braçadeira cruzeta (und)",
      "Escada de alumínio 6 m",
      "Escada de alumínio 8 m",
      "Escada de madeira 7 degraus",
      "Cavalete metálico (par)",
      "Tela de proteção para andaime (m²)",
      "Placas de sinalização de obra (und)",
      "Cone de sinalização (und)",
      "Fita de isolamento de área (rolo)",
      "Grade de proteção metálica (m)",
    ],
  },
  {
    nome: "Limpeza e Descarte",
    itens: [
      "Vassoura de pelo",
      "Vassoura de junco",
      "Rodo de borracha 60 cm",
      "Pá de lixo inox",
      "Saco de entulho 50 kg (und)",
      "Bombona plástica 50L",
      "Detergente concentrado (5L)",
      "Água sanitária (5L)",
      "Álcool 70° (1L)",
      "Papel toalha (pacote)",
      "Luva descartável nitrílica (caixa 100 und)",
      "Aviso de piso molhado (und)",
    ],
  },
];

const PRIORIDADES = [
  { value: "baixa",   label: "Baixa — pode aguardar" },
  { value: "media",   label: "Média — necessidade normal" },
  { value: "alta",    label: "Alta — necessário em breve" },
  { value: "urgente", label: "Urgente — necessidade imediata" },
];

export default function PurchaseRequest() {
  const { user } = useContext(AuthContext);
  const { obras, loadingObras } = useObras(100);
  const [obraId, setObraId] = useState("");
  const [categoriaAberta, setCategoriaAberta] = useState(null);
  const [itensSelecionados, setItensSelecionados] = useState([]);
  const [prioridade, setPrioridade] = useState("media");
  const [descricao, setDescricao] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState(false);
  const nomeResponsavel = user?.nome || "Usuário autenticado";
  const dataSolicitacao = getTodayInputDate();

  useEffect(() => {
    const onSyncCompleted = (event) => {
      const total = event?.detail?.synced || 0;
      if (total > 0) {
        setSucesso(true);
        setErro("");
      }
    };

    window.addEventListener("sync:completed", onSyncCompleted);
    return () => window.removeEventListener("sync:completed", onSyncCompleted);
  }, []);

  // Pré-seleciona automaticamente quando houver apenas uma obra vinculada
  useEffect(() => {
    if (obras.length === 1) setObraId(String(obras[0].id));
  }, [obras]);

  function toggleItem(item) {
    setItensSelecionados((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
    );
  }

  function toggleCategoria(idx) {
    setCategoriaAberta((prev) => (prev === idx ? null : idx));
  }

  function limparSelecao() {
    setItensSelecionados([]);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErro("");
    setSucesso(false);

    if (!obraId) {
      setErro("Selecione uma obra.");
      return;
    }
    if (itensSelecionados.length === 0) {
      setErro("Selecione pelo menos um item da lista de materiais.");
      return;
    }

    setLoading(true);
    const itens = itensSelecionados.map((item) => ({
      descricao: item,
      quantidade: 1,
      unidade: "un",
    }));

    const payload = {
      obra: Number(obraId),
      itens,
      prioridade,
      justificativa: descricao || null,
      status: "pendente",
    };

    try {
      if (!navigator.onLine) {
        await enqueueSyncOperation("solicitacao", payload);
      } else {
        await createPurchase({
        obra_id: Number(obraId),
        itens: itensSelecionados,
        prioridade,
        descricao,
        });
      }

      setSucesso(true);
      setItensSelecionados([]);
      setDescricao("");
      setPrioridade("media");
      if (obras.length !== 1) setObraId("");
      setCategoriaAberta(null);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      const status = err?.response?.status;
      if (!navigator.onLine || !status) {
        await enqueueSyncOperation("solicitacao", payload);
        setSucesso(true);
        setItensSelecionados([]);
        setDescricao("");
        setPrioridade("media");
        if (obras.length !== 1) setObraId("");
        setCategoriaAberta(null);
      } else {
        setErro(extractApiMessage(err, "Erro ao enviar solicitação. Tente novamente."));
      }
    } finally {
      setLoading(false);
    }
  }

  const totalSelecionados = itensSelecionados.length;

  return (
    <Layout>
      <div className="page-container">
        <h1 className="page-title">Solicitar Materiais</h1>
        <p className="page-description">
          Selecione os materiais necessários para a obra. Clique em uma categoria para expandir e marcar os itens desejados.
        </p>

        {sucesso && (
          <p className="success-msg" style={{ marginBottom: "var(--espacamento-lg)" }}>
            Solicitação enviada com sucesso! Aguarde a aprovação do supervisor.
          </p>
        )}

        <form onSubmit={handleSubmit} className="form-container medicao-form-container purchase-request-form">
            <div className="medicao-topo-grid" aria-label="Informações da solicitação">
              <div className="form-group medicao-topo-grid__responsavel">
                <label htmlFor="responsavelSolicitacao">Responsável pela Solicitação</label>
                <input
                  id="responsavelSolicitacao"
                  type="text"
                  value={nomeResponsavel}
                  readOnly
                  tabIndex={-1}
                  className="medicao-readonly-input purchase-request-readonly-input"
                  aria-readonly="true"
                />
              </div>

              <div className="form-group medicao-topo-grid__data">
                <label htmlFor="dataSolicitacao">Data da Solicitação</label>
                <input
                  id="dataSolicitacao"
                  type="date"
                  value={dataSolicitacao}
                  readOnly
                  tabIndex={-1}
                  className="medicao-readonly-input purchase-request-readonly-input"
                  aria-readonly="true"
                />
              </div>
            </div>

            <section className="purchase-request-section" aria-labelledby="purchase-request-info-title">
              <h2 id="purchase-request-info-title" className="section-title purchase-request-section-title">
                Informações da Solicitação
              </h2>

              <div className="purchase-request-info-grid">
                <div className="form-group">
                  <label htmlFor="obra-select">Obra *</label>
                  {loadingObras ? (
                    <select id="obra-select" disabled>
                      <option>Carregando obras...</option>
                    </select>
                  ) : obras.length === 0 ? (
                    <p className="erro-msg" style={{ marginTop: "4px" }}>
                      Nenhuma obra disponível. Entre em contato com o administrador.
                    </p>
                  ) : (
                    <select
                      id="obra-select"
                      value={obraId}
                      onChange={(e) => setObraId(e.target.value)}
                      required
                    >
                      {obras.length > 1 && <option value="">Selecione a obra</option>}
                      {obras.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.nome || `Obra #${o.id}`}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="prioridade">Prioridade *</label>
                  <select
                    id="prioridade"
                    value={prioridade}
                    onChange={(e) => setPrioridade(e.target.value)}
                  >
                    {PRIORIDADES.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </section>

            <section className="purchase-request-section" aria-labelledby="purchase-request-materials-title">
              <div className="purchase-request-section-header">
                <h2 id="purchase-request-materials-title" className="section-title purchase-request-section-title">
                  Materiais Necessários
                </h2>
                {totalSelecionados > 0 && (
                  <button
                    type="button"
                    onClick={limparSelecao}
                    className="purchase-request-clear-button"
                  >
                    Limpar seleção ({totalSelecionados})
                  </button>
                )}
              </div>

              <div className="materiais-lista">
                {CATEGORIAS.map((cat, idx) => {
                  const selecionados = cat.itens.filter((i) => itensSelecionados.includes(i)).length;
                  const todosMarcados = cat.itens.every((i) => itensSelecionados.includes(i));
                  const aberta = categoriaAberta === idx;

                  return (
                    <div key={cat.nome} className="materiais-categoria">
                      <button
                        type="button"
                        className="materiais-categoria-header"
                        aria-expanded={aberta}
                        onClick={() => toggleCategoria(idx)}
                      >
                        <span className="materiais-categoria-nome">{cat.nome}</span>
                        <div className="purchase-request-category-meta">
                          {selecionados > 0 && (
                            <span className="badge">{selecionados}/{cat.itens.length}</span>
                          )}
                          <span className="topico-chevron">{aberta ? "▲" : "▼"}</span>
                        </div>
                      </button>

                      {aberta && (
                        <div className="materiais-corpo">
                          <div className="materiais-acoes">
                            <button
                              type="button"
                              className="materiais-marcar-btn"
                              onClick={() => {
                                if (todosMarcados) {
                                  setItensSelecionados((prev) => prev.filter((i) => !cat.itens.includes(i)));
                                } else {
                                  setItensSelecionados((prev) => [
                                    ...prev,
                                    ...cat.itens.filter((i) => !prev.includes(i)),
                                  ]);
                                }
                              }}
                            >
                              {todosMarcados ? "Desmarcar todos" : "Marcar todos"}
                            </button>
                            <span className="purchase-request-category-count">
                              {selecionados} de {cat.itens.length} selecionados
                            </span>
                          </div>
                          <ul className="materiais-itens">
                            {cat.itens.map((item) => {
                              const marcado = itensSelecionados.includes(item);

                              return (
                                <li key={item} className="materiais-item">
                                  <label className={"materiais-item-label" + (marcado ? " marcado" : "") }>
                                    <input
                                      type="checkbox"
                                      checked={marcado}
                                      onChange={() => toggleItem(item)}
                                    />
                                    {item}
                                  </label>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="purchase-request-section" aria-labelledby="purchase-request-selected-title">
              <h2 id="purchase-request-selected-title" className="section-title purchase-request-section-title">
                Itens Selecionados
              </h2>

              <div className="summary purchase-request-selected-card">
                <h3 className="purchase-request-selected-count">
                  {totalSelecionados > 0
                    ? `${totalSelecionados} ${totalSelecionados === 1 ? "item selecionado" : "itens selecionados"}`
                    : "Nenhum item selecionado até o momento"}
                </h3>

                {totalSelecionados > 0 ? (
                  <div className="purchase-request-chip-list">
                    {itensSelecionados.map((item) => (
                      <span key={item} className="purchase-request-chip">
                        {item}
                        <button
                          type="button"
                          onClick={() => toggleItem(item)}
                          aria-label={`Remover ${item}`}
                          className="purchase-request-chip-remove"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="purchase-request-empty-state">
                    Os materiais marcados nas categorias aparecerão aqui.
                  </p>
                )}
              </div>
            </section>

            <section className="purchase-request-section" aria-labelledby="purchase-request-notes-title">
              <h2 id="purchase-request-notes-title" className="section-title purchase-request-section-title">
                Justificativa / observações (opcional)
              </h2>

              <div className="form-group purchase-request-notes-group">
                <textarea
                  id="descricao"
                  rows={4}
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Ex: uso na concretagem da fundação."
                  aria-labelledby="purchase-request-notes-title"
                />
              </div>
            </section>

            {erro && <p className="erro-msg">{erro}</p>}

            <div className="medicao-actions purchase-request-actions">
              <button
                type="submit"
                className="button-primary medicao-actions__primary"
                disabled={loading || loadingObras || obras.length === 0}
              >
                {loading ? "Enviando solicitação..." : "Enviar Solicitação"}
              </button>
            </div>
        </form>
      </div>
    </Layout>
  );
}