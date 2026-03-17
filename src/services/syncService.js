import api from "./api";
import {
  getPendingSyncOperations,
  getConflictSyncOperations,
  removeSyncOperation,
  markSyncOperationConflict,
} from "../utils/syncQueue";

function mapBatch(operations) {
const medicoes = [];
const solicitacoes = [];
const diarios = [];

operations.forEach((op) => {
  if (op.type === "medicao") medicoes.push(op.payload);
  if (op.type === "solicitacao") solicitacoes.push(op.payload);
  if (op.type === "diario") diarios.push(op.payload);
});

return { medicoes, solicitacoes, diarios };
}

export async function syncPendingOperations() {
  const operations = await getPendingSyncOperations();
  if (!operations.length) return { synced: 0, conflicts: 0, errors: 0 };

  const batch = mapBatch(operations);
  if (!batch.medicoes.length && !batch.solicitacoes.length && !batch.diarios.length) {
    return { synced: 0, conflicts: 0, errors: 0 };
  }

  const response = await api.post("/sync/push", batch);
  const result = response?.data?.data || response?.data || {};

  const success = Array.isArray(result.success) ? result.success : [];
  const conflicts = Array.isArray(result.conflicts) ? result.conflicts : [];
  const errors = Array.isArray(result.errors) ? result.errors : [];

  const successSet = new Set(success.map((s) => s.syncId));
  const conflictSet = new Set(conflicts.map((c) => c.syncId));

  for (const op of operations) {
    const syncId = op?.payload?.syncId;
    if (!syncId) continue;

    if (successSet.has(syncId)) {
      await removeSyncOperation(op.id);
      continue;
    }

    if (conflictSet.has(syncId)) {
      await markSyncOperationConflict(op.id);
    }
  }

  return {
    synced: success.length,
    conflicts: conflicts.length,
    errors: errors.length,
  };
}

export async function getServerSideConflicts() {
  const conflicts = await getConflictSyncOperations();
  const medicoes = conflicts
    .filter((c) => c.type === "medicao")
    .map((c) => c.payload)
    .filter((c) => c && c.syncId && c.clientTimestamp);

  if (!medicoes.length) return [];

  const response = await api.post("/sync/conflicts", { medicoes });
  return response?.data?.data || [];
}
