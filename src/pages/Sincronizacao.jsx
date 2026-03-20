import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { syncPendingOperations, getServerSideConflicts } from "../services/syncService";
import {
  getPendingSyncOperations,
  getConflictSyncOperations,
  removeSyncOperation,
  markSyncOperationPending,
} from "../utils/syncQueue";
import "../styles/pages.css";

const TYPE_LABELS = {
  medicao: "Medição",
  solicitacao: "Solicitação de Material",
  diario: "Diário de Obra",
  upload: "Arquivo para Upload",
};

function labelTipo(type) {
  return TYPE_LABELS[type] || type;
}

export default function Sincronizacao() {
  const [pending, setPending] = useState([]);
  const [conflicts, setConflicts] = useState([]);
  const [serverConflicts, setServerConflicts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const loadQueue = async () => {
    const [p, c] = await Promise.all([
      getPendingSyncOperations(),
      getConflictSyncOperations(),
    ]);
    setPending(p);
    setConflicts(c);
  };

  const loadServerConflicts = async () => {
    try {
      const list = await getServerSideConflicts();
      setServerConflicts(Array.isArray(list) ? list : []);
    } catch {
      setServerConflicts([]);
    }
  };

  useEffect(() => {
    loadQueue();
    loadServerConflicts();
  }, []);

  const runSync = async () => {
    setLoading(true);
    setMessage("");
    try {
      const result = await syncPendingOperations();
      setMessage(
        `Sincronização concluída: ${result.synced} sucesso(s), ${result.conflicts} conflito(s), ${result.errors} erro(s).`,
      );
      await loadQueue();
      await loadServerConflicts();
    } finally {
      setLoading(false);
    }
  };

  const retryConflict = async (id) => {
    await markSyncOperationPending(id);
    await loadQueue();
    setMessage("Conflito movido para pendente. Clique em 'Sincronizar agora'.");
  };

  const discardConflict = async (id) => {
    await removeSyncOperation(id);
    await loadQueue();
    await loadServerConflicts();
    setMessage("Item de conflito removido da fila local.");
  };

  return (
    <Layout>
      <div className="page-container">
        <h1 className="page-title">Sincronização Offline</h1>
        <p className="page-description">
          Gerencie itens pendentes e conflitos detectados durante o envio automático.
        </p>

        <div className="card" style={{ marginBottom: "var(--espacamento-md)" }}>
          <p><strong>Pendentes:</strong> {pending.length}</p>
          <p><strong>Conflitos locais:</strong> {conflicts.length}</p>
          <p><strong>Conflitos detectados no servidor:</strong> {serverConflicts.length}</p>
          <button className="button-primary" onClick={runSync} disabled={loading}>
            {loading ? "Sincronizando..." : "Sincronizar agora"}
          </button>
          {message && <p className="success-msg" style={{ marginTop: "var(--espacamento-sm)" }}>{message}</p>}
        </div>

        <h3>Itens pendentes</h3>
        {pending.length === 0 ? (
          <div className="card">Nenhum item pendente.</div>
        ) : (
          pending.map((item) => (
            <div key={item.id} className="card" style={{ marginTop: "var(--espacamento-sm)" }}>
              <strong>{labelTipo(item.type)}</strong>
              {item?.payload?.obra && (
                <p style={{ margin: "4px 0 0", color: "var(--cor-texto-secundario)", fontSize: "0.9rem" }}>
                  Obra #{item.payload.obra}
                </p>
              )}
              <p style={{ margin: "4px 0 0", color: "var(--cor-texto-secundario)", fontSize: "0.85rem" }}>
                Salvo em: {new Date(item.createdAt).toLocaleString("pt-BR")}
              </p>
            </div>
          ))
        )}

        <h3 style={{ marginTop: "var(--espacamento-lg)" }}>Conflitos locais</h3>
        {conflicts.length === 0 ? (
          <div className="card">Nenhum conflito local.</div>
        ) : (
          conflicts.map((item) => (
            <div key={item.id} className="card" style={{ marginTop: "var(--espacamento-sm)" }}>
              <strong>{labelTipo(item.type)}</strong>
              {item?.payload?.obra && (
                <p style={{ margin: "4px 0 0", color: "var(--cor-texto-secundario)", fontSize: "0.9rem" }}>
                  Obra #{item.payload.obra}
                </p>
              )}
              <p style={{ margin: "4px 0 0", color: "var(--cor-texto-secundario)", fontSize: "0.85rem" }}>
                Salvo em: {new Date(item.createdAt).toLocaleString("pt-BR")}
              </p>
              <div style={{ display: "flex", gap: "var(--espacamento-sm)", flexWrap: "wrap", marginTop: "var(--espacamento-sm)" }}>
                <button className="button-secondary" onClick={() => retryConflict(item.id)}>
                  Tentar novamente
                </button>
                <button className="button-danger" onClick={() => discardConflict(item.id)}>
                  Descartar local
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </Layout>
  );
}
