/**
 * Constantes de medição usadas por EnviarMedicao, measurements e MeusRelatorios.
 * Mantidas em um único lugar para evitar dessincronização entre telas.
 */

// Áreas/ambientes disponíveis para medição
export const AREAS_MEDICAO = [
  { value: "quarto",       label: "Quarto" },
  { value: "sala",         label: "Sala" },
  { value: "banheiro",     label: "Banheiro" },
  { value: "cozinha",      label: "Cozinha" },
  { value: "varanda",      label: "Varanda / Sacada" },
  { value: "corredor",     label: "Corredor" },
  { value: "garagem",      label: "Garagem" },
  { value: "area_servico", label: "Área de Serviço" },
  { value: "escritorio",   label: "Escritório" },
  { value: "fachada",      label: "Fachada" },
  { value: "telhado",      label: "Telhado" },
  { value: "area_externa", label: "Área Externa" },
  { value: "outros",       label: "Outros" },
];

export const AREAS_MEDICAO_GRUPOS = [
  {
    label: "Áreas internas",
    options: [
      "quarto",
      "sala",
      "banheiro",
      "cozinha",
      "corredor",
      "area_servico",
      "escritorio",
      "garagem",
    ],
  },
  {
    label: "Áreas externas",
    options: ["varanda", "fachada", "telhado", "area_externa"],
  },
  {
    label: "Outros",
    options: ["outros"],
  },
];

// Tipos de serviço — sincronizados com TIPOS_SERVICO do back-end (constants/index.js)
export const TIPOS_SERVICO = [
  { value: "alvenaria",             label: "Alvenaria" },
  { value: "pintura",               label: "Pintura" },
  { value: "revestimento",          label: "Revestimento" },
  { value: "instalacao_eletrica",   label: "Instalação Elétrica" },
  { value: "instalacao_hidraulica", label: "Instalação Hidráulica" },
  { value: "impermeabilizacao",     label: "Impermeabilização" },
  { value: "estrutura",             label: "Estrutura" },
  { value: "cobertura",             label: "Cobertura" },
  { value: "acabamento",            label: "Acabamento" },
  { value: "demolicao",             label: "Demolição" },
  { value: "escavacao",             label: "Escavação" },
  { value: "outros",                label: "Outros" },
];

export const TIPOS_SERVICO_GRUPOS = [
  {
    label: "Estrutura e alvenaria",
    options: ["alvenaria", "estrutura", "escavacao", "demolicao"],
  },
  {
    label: "Acabamentos",
    options: ["pintura", "revestimento", "impermeabilizacao", "acabamento", "cobertura"],
  },
  {
    label: "Instalações",
    options: ["instalacao_eletrica", "instalacao_hidraulica"],
  },
  {
    label: "Outros",
    options: ["outros"],
  },
];

export const MEDICAO_CAMPO_MODO = {
  AREA_CL: "area_cl",        // comprimento x largura
  AREA_CA: "area_ca",        // comprimento x altura
  VOLUME: "volume",          // comprimento x largura x altura
  QUANTIDADE: "quantidade",  // quantidade direta
};

export const TIPO_SERVICO_CONFIG = {
  alvenaria: {
    modo: MEDICAO_CAMPO_MODO.AREA_CA,
    unidade: "m²",
    resumo: "Informe comprimento e altura para calcular área de parede.",
  },
  pintura: {
    modo: MEDICAO_CAMPO_MODO.AREA_CA,
    unidade: "m²",
    resumo: "Informe comprimento e altura da superfície pintada.",
  },
  revestimento: {
    modo: MEDICAO_CAMPO_MODO.AREA_CL,
    unidade: "m²",
    resumo: "Informe comprimento e largura da área revestida.",
  },
  impermeabilizacao: {
    modo: MEDICAO_CAMPO_MODO.AREA_CL,
    unidade: "m²",
    resumo: "Informe comprimento e largura da área impermeabilizada.",
  },
  cobertura: {
    modo: MEDICAO_CAMPO_MODO.AREA_CL,
    unidade: "m²",
    resumo: "Informe comprimento e largura da cobertura.",
  },
  estrutura: {
    modo: MEDICAO_CAMPO_MODO.VOLUME,
    unidade: "m³",
    resumo: "Informe comprimento, largura e altura para calcular volume.",
  },
  escavacao: {
    modo: MEDICAO_CAMPO_MODO.VOLUME,
    unidade: "m³",
    resumo: "Informe comprimento, largura e altura para calcular volume escavado.",
  },
  instalacao_eletrica: {
    modo: MEDICAO_CAMPO_MODO.QUANTIDADE,
    unidade: "un",
    resumo: "Informe a quantidade de pontos, luminárias ou itens instalados.",
  },
  instalacao_hidraulica: {
    modo: MEDICAO_CAMPO_MODO.QUANTIDADE,
    unidade: "un",
    resumo: "Informe a quantidade de peças ou pontos hidráulicos.",
  },
  acabamento: {
    modo: MEDICAO_CAMPO_MODO.QUANTIDADE,
    unidade: "un",
    resumo: "Informe a quantidade total executada.",
  },
  demolicao: {
    modo: MEDICAO_CAMPO_MODO.AREA_CL,
    unidade: "m²",
    resumo: "Informe comprimento e largura da área demolida.",
  },
  outros: {
    modo: MEDICAO_CAMPO_MODO.QUANTIDADE,
    unidade: "un",
    resumo: "Informe a quantidade executada para este serviço.",
  },
};

/** Retorna o label legível de um tipo de serviço */
export const getTipoServicoLabel = (value) =>
  TIPOS_SERVICO.find((t) => t.value === value)?.label || value || "—";

// Status de medição — mapa de classe CSS e label
export const STATUS_CLASS = {
  aprovada:  "aprovada",
  rejeitada: "rejeitada",
  enviada:   "pendente",
  rascunho:  "rascunho",
};

export const STATUS_LABEL = {
  aprovada:  "Aprovada",
  rejeitada: "Rejeitada",
  enviada:   "Aguardando revisão",
  rascunho:  "Rascunho",
};
