import React, { useRef, useEffect, useState } from "react";

export default function DraftsPanel({
  rascunhos = [],
  loading = false,
  open = false,
  onToggle = () => {},
  onLoad = () => {},
  onDelete = () => {},
  activeId = null,
  mapaTipos = {},
  mapaAreas = {},
}) {
  const listRef = useRef(null);
  const [maxH, setMaxH] = useState("0px");

  useEffect(() => {
    if (open) {
      const h = listRef.current ? `${listRef.current.scrollHeight}px` : "300px";
      setMaxH(h);
    } else {
      setMaxH("0px");
    }
  }, [open, rascunhos, loading]);

  return (
    <div className="drafts-panel">
      <div className="drafts-panel__header">
        <div>
          <h3 className="drafts-panel__title">Carregar rascunho</h3>
          <p className="drafts-panel__subtitle">Seus rascunhos ficam visíveis apenas para você.</p>
        </div>

        <button
          type="button"
          className={`drafts-panel__toggle ${open ? "is-open" : ""}`}
          onClick={onToggle}
          aria-expanded={open}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
            <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <div
        className="drafts-list"
        ref={listRef}
        style={{ maxHeight: maxH, opacity: open ? 1 : 0, transition: "max-height 220ms ease, opacity 180ms ease", overflow: "hidden" }}
      >
        {loading ? (
          <p className="carregando">Carregando rascunhos...</p>
        ) : rascunhos.length === 0 ? (
          <p className="drafts-empty">Nenhum rascunho salvo até o momento.</p>
        ) : (
          <ul className="drafts-list__items">
            {rascunhos.map((r) => (
              <li key={r.id} className={`draft-item ${Number(activeId) === Number(r.id) ? "is-active" : ""}`}>
                <div className="draft-item__meta">
                  <div className="draft-item__title">
                    { (mapaTipos && mapaTipos[r.tipoServico]) ? mapaTipos[r.tipoServico] : (r.tipoServico ? r.tipoServico : "Serviço sem tipo") }
                  </div>
                  <div className="draft-item__meta-sub">
                    { (mapaAreas && mapaAreas[r.area]) ? mapaAreas[r.area] : (r.area || "Área não informada") }
                    {r.data ? ` • ${new Date(r.data).toLocaleDateString("pt-BR")}` : ""}
                  </div>
                </div>

                <div className="draft-item__actions">
                  <button type="button" className="draft-action-link" onClick={() => onLoad(r)}>
                    Carregar
                  </button>
                  <button type="button" className="draft-action-link draft-action-link--danger" onClick={() => onDelete(r.id)}>
                    Excluir
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
