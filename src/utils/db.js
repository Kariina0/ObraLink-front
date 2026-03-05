// src/utils/db.js
// Armazenamento local (IndexedDB) para arquivos pendentes de envio offline.
// Quando o dispositivo fica sem internet, os arquivos e seus metadados são
// salvos aqui. Ao reconectar, a sincronização automática os envia ao servidor.
import { openDB } from "idb";

// Máximo de tentativas antes de marcar o arquivo como falho definitivamente (I-9/M-10)
export const MAX_RETRY_COUNT = 5;
// Validade máxima de um arquivo pendente (7 dias)
const OFFLINE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Versão 4: adiciona retryCount e expiresAt para controle de retry/TTL (I-9/M-10)
export async function getDB() {
  return openDB("offline-files", 4, {
    upgrade(db, oldVersion) {
      if (!db.objectStoreNames.contains("files")) {
        db.createObjectStore("files", { keyPath: "id", autoIncrement: true });
      }
      // v2 → v3: buffer em vez de File.
      // v3 → v4: adicionados retryCount e expiresAt (schema compatível — campos opcionais).
    },
  });
}

/**
 * Salva um arquivo localmente para envio posterior.
 * Converte o File em ArrayBuffer para garantir persistência entre sessões.
 *
 * @param {File} file        - arquivo selecionado pelo usuário
 * @param {object} metadata  - metadados do formulário (obra, tipoArquivo, descricao, etc.)
 */
export async function saveFileOffline(file, metadata = {}) {
  const db = await getDB();
  const buffer = await file.arrayBuffer();
  await db.add("files", {
    buffer,
    fileName: file.name,
    fileType: file.type,
    fileSize: file.size,
    metadata,
    uploaded: false,
    retryCount: 0,
    expiresAt: new Date(Date.now() + OFFLINE_TTL_MS).toISOString(),
    savedAt: new Date().toISOString(),
  });
}

/**
 * Retorna todos os arquivos pendentes (não enviados) reconstruindo
 * o objeto File a partir do ArrayBuffer salvo.
 * Arquivos expirados ou que excederam MAX_RETRY_COUNT são removidos
 * automaticamente (I-9/M-10).
 */
export async function getPendingFiles() {
  const db = await getDB();
  const all = await db.getAll("files");
  const now = Date.now();

  const toRemove = [];
  const valid = [];

  for (const f of all) {
    if (f.uploaded || !f.buffer) continue;

    // Expirado ou esgotou tentativas — remove do IndexedDB
    const expired = f.expiresAt && new Date(f.expiresAt).getTime() < now;
    const maxRetry = (f.retryCount ?? 0) >= MAX_RETRY_COUNT;
    if (expired || maxRetry) {
      toRemove.push(f.id);
      continue;
    }

    valid.push({
      ...f,
      file: new File([f.buffer], f.fileName || "arquivo", { type: f.fileType || "application/octet-stream" }),
    });
  }

  // Remove registros inválidos em background sem bloquear
  if (toRemove.length > 0) {
    Promise.all(toRemove.map((id) => db.delete("files", id))).catch(() => {});
  }

  return valid;
}

/**
 * Incrementa o contador de tentativas de um arquivo pendente.
 * Chamado após cada falha de upload para controle de retry (I-9/M-10).
 */
export async function incrementRetryCount(id) {
  const db = await getDB();
  const record = await db.get("files", id);
  if (record) {
    record.retryCount = (record.retryCount ?? 0) + 1;
    record.lastRetryAt = new Date().toISOString();
    await db.put("files", record);
  }
}

/**
 * Marca um arquivo como enviado com sucesso.
 */
export async function markAsUploaded(id) {
  const db = await getDB();
  const record = await db.get("files", id);
  if (record) {
    record.uploaded = true;
    record.uploadedAt = new Date().toISOString();
    // Libera o buffer da memória após o upload bem-sucedido
    delete record.buffer;
    await db.put("files", record);
  }
}

/**
 * Remove um arquivo pendente do armazenamento local.
 */
export async function removeOfflineFile(id) {
  const db = await getDB();
  await db.delete("files", id);
}
