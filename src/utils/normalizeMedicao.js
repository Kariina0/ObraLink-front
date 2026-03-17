/**
 * Normaliza um objeto de medição retornado pelo back-end
 * para um formato consistente usado nas telas measurements.jsx e MeusRelatorios.jsx.
 *
 * @param {object} m - medição bruta da API
 * @returns {object} medição normalizada
 */
export function normalizeMedicao(m) {
  const itens = Array.isArray(m.itens) ? m.itens : [];
  const firstItem = itens[0] || {};
  
  // Garante valores numéricos válidos ou null
  const parseNumOrNull = (val) => {
    const num = Number(val);
    return !isNaN(num) && isFinite(num) ? num : null;
  };
  
  return {
    id:              m.id,
    obra:            m.obra         || m.obraId  || null,
    obraNome:        m.obraNome     || null,
    responsavel:     m.responsavel  || null,
    responsavelNome: m.responsavelNome || null,
    // area contém o nome do ambiente (string), areaCalculada contém o valor numérico
    areaNome:        m.area         || null,
    area:            parseNumOrNull(m.areaCalculada ?? firstItem.quantidade),
    volume:          parseNumOrNull(m.volume ?? firstItem.valorTotal),
    tipoServico:     m.tipoServico  || null,
    observacoes:     m.observacoes  || firstItem.observacoes,
    status:          m.status       || "enviada",
    motivoRejeicao:  m.motivoRejeicao || null,
    itens,
    anexos:          Array.isArray(m.anexos) ? m.anexos : [],
    foto:            m.foto || null,
    data:            m.data || null,
    createdAt:       m.createdAt || null,
  };
}
