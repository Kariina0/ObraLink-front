// src/services/filesService.js
// Serviços de upload de arquivo.
// O back-end exige os campos: obra (id numérico), tipoArquivo, descricao.
// Quando tipoArquivo === "problema", detalheProblema também é obrigatório.
import api from "./api";
import { extractApiData } from "./response";

/**
 * Envia um arquivo para o servidor junto com seus metadados.
 *
 * @param {File} file             - arquivo a ser enviado
 * @param {object} extra          - campos adicionais do formulário
 * @param {number} extra.obra     - ID da obra relacionada (obrigatório)
 * @param {string} extra.tipoArquivo  - tipo: solicitacao|problema|relatorio|medicao|foto_obra|documento|outros (obrigatório)
 * @param {string} extra.descricao    - descrição do arquivo (obrigatório)
 * @param {string} [extra.detalheProblema] - detalhe do problema (obrigatório quando tipoArquivo === "problema")
 * @param {number} [extra.solicitadoPor]   - ID do usuário que solicitou (opcional)
 */
export async function uploadFile(file, extra = {}) {
  const formData = new FormData();
  formData.append("file", file);

  // Adiciona cada campo de metadados ao FormData, ignorando valores nulos/indefinidos
  Object.entries(extra).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      formData.append(key, value);
    }
  });

  const response = await api.post("/files/upload", formData);

  return extractApiData(response.data);
}
