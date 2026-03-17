import { useState, useEffect, useCallback } from "react";
import { listObras } from "../services/obrasService";

export default function useObras(limit = 100) {
  const [obras, setObras]               = useState([]);
  const [loadingObras, setLoadingObras] = useState(true);
  const [errorObras, setErrorObras]     = useState(null);

  const reload = useCallback(async () => {
    try {
      setLoadingObras(true);
      setErrorObras(null);
      const data = await listObras({ page: 1, limit });
      const lista = Array.isArray(data) ? data : [];
      setObras(lista);
      return lista;
    } catch {
      setErrorObras("Não foi possível carregar as obras.");
      setObras([]);
      return [];
    } finally {
      setLoadingObras(false);
    }
  }, [limit]);

  useEffect(() => { reload(); }, [reload]);

  return { obras, loadingObras, errorObras, reload };
}

