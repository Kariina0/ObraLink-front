export const PERFIS = {
  ADMIN: "admin",
  SUPERVISOR: "supervisor",
  ENCARREGADO: "encarregado",
};

/**
 * Controle de acesso por rota.
 *
 * Encarregado  → operações do dia a dia (medições próprias, solicitações, upload)
 * Supervisor   → tudo do encarregado + visualização ampliada e relatórios
 * Admin        → acesso completo + administração do sistema
 */
export const ROUTE_PERMISSIONS = {
  // Todos os perfis autenticados
  "/":                     [PERFIS.ADMIN, PERFIS.SUPERVISOR, PERFIS.ENCARREGADO],
  "/profile":              [PERFIS.ADMIN, PERFIS.SUPERVISOR, PERFIS.ENCARREGADO],
  "/medicoes":             [PERFIS.ADMIN, PERFIS.SUPERVISOR, PERFIS.ENCARREGADO],
  "/solicitacoes":         [PERFIS.ADMIN, PERFIS.SUPERVISOR, PERFIS.ENCARREGADO],
  "/status-solicitacoes":  [PERFIS.ADMIN, PERFIS.SUPERVISOR, PERFIS.ENCARREGADO],
  "/upload":               [PERFIS.ADMIN, PERFIS.SUPERVISOR, PERFIS.ENCARREGADO],
  "/diario":               [PERFIS.ADMIN, PERFIS.SUPERVISOR, PERFIS.ENCARREGADO],
  "/sincronizacao":        [PERFIS.ADMIN, PERFIS.SUPERVISOR, PERFIS.ENCARREGADO],

  // Lista de medições (encarregado vê as próprias; supervisor/admin veem todas)
  "/medicoes-lista":       [PERFIS.ADMIN, PERFIS.SUPERVISOR, PERFIS.ENCARREGADO],
  "/relatorios":           [PERFIS.ADMIN, PERFIS.SUPERVISOR],
  "/obras":                [PERFIS.ADMIN, PERFIS.SUPERVISOR],

  // Somente Admin
  "/admin":                [PERFIS.ADMIN],
  "/register":             [PERFIS.ADMIN],
};

export function canAccessRoute(perfil, route) {
  if (!perfil) return false;
  const allowed = ROUTE_PERMISSIONS[route] || [];
  return allowed.includes(perfil);
}

/** Retorna true se o perfil é supervisor ou admin */
export function isReviewer(perfil) {
  return [PERFIS.ADMIN, PERFIS.SUPERVISOR].includes(perfil);
}

/** Retorna true se o perfil é admin */
export function isAdmin(perfil) {
  return perfil === PERFIS.ADMIN;
}

/** Labels legíveis para cada perfil — compartilhado entre Dashboard, Layout e Register */
export const PERFIL_LABELS = {
  admin: "Administrador",
  supervisor: "Supervisor",
  encarregado: "Encarregado",
};
