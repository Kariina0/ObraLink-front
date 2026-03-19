import React from "react";

function PaginationControls({
  currentPage,
  totalPages,
  loading = false,
  onChangePage,
  className = "",
}) {
  if (totalPages <= 1) return null;

  const classes = ["paginacao-controles", className].filter(Boolean).join(" ");

  return (
    <div className={classes}>
      <button
        type="button"
        className="button-secondary"
        onClick={() => onChangePage(Math.max(1, currentPage - 1))}
        disabled={currentPage <= 1 || loading}
      >
        ← Anterior
      </button>
      <span className="paginacao-info">
        Página {currentPage} de {totalPages}
      </span>
      <button
        type="button"
        className="button-secondary"
        onClick={() => onChangePage(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage >= totalPages || loading}
      >
        Próxima →
      </button>
    </div>
  );
}

export default PaginationControls;
