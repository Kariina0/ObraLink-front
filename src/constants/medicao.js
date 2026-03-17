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
