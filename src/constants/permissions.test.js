import { canAccessRoute, PERFIS, ROUTE_PERMISSIONS } from "./permissions";

describe("permissions route matrix", () => {
  const allProtectedRoutes = [
    "/",
    "/profile",
    "/medicoes",
    "/solicitacoes",
    "/status-solicitacoes",
    "/upload",
    "/diario",
    "/sincronizacao",
    "/medicoes-lista",
    "/relatorios",
    "/obras",
    "/admin",
    "/register",
  ];

  test("todas as rotas protegidas conhecidas existem no mapa de permissões", () => {
    allProtectedRoutes.forEach((route) => {
      expect(ROUTE_PERMISSIONS[route]).toBeDefined();
      expect(Array.isArray(ROUTE_PERMISSIONS[route])).toBe(true);
    });
  });

  test("admin acessa todas as rotas protegidas", () => {
    allProtectedRoutes.forEach((route) => {
      expect(canAccessRoute(PERFIS.ADMIN, route)).toBe(true);
    });
  });

  test("supervisor respeita bloqueios de administração", () => {
    expect(canAccessRoute(PERFIS.SUPERVISOR, "/")).toBe(true);
    expect(canAccessRoute(PERFIS.SUPERVISOR, "/medicoes-lista")).toBe(true);
    expect(canAccessRoute(PERFIS.SUPERVISOR, "/relatorios")).toBe(true);
    expect(canAccessRoute(PERFIS.SUPERVISOR, "/obras")).toBe(true);

    expect(canAccessRoute(PERFIS.SUPERVISOR, "/admin")).toBe(false);
    expect(canAccessRoute(PERFIS.SUPERVISOR, "/register")).toBe(false);
  });

  test("encarregado acessa operação diária e não acessa gestão restrita", () => {
    expect(canAccessRoute(PERFIS.ENCARREGADO, "/")).toBe(true);
    expect(canAccessRoute(PERFIS.ENCARREGADO, "/medicoes")).toBe(true);
    expect(canAccessRoute(PERFIS.ENCARREGADO, "/medicoes-lista")).toBe(true);
    expect(canAccessRoute(PERFIS.ENCARREGADO, "/upload")).toBe(true);

    expect(canAccessRoute(PERFIS.ENCARREGADO, "/relatorios")).toBe(false);
    expect(canAccessRoute(PERFIS.ENCARREGADO, "/obras")).toBe(false);
    expect(canAccessRoute(PERFIS.ENCARREGADO, "/admin")).toBe(false);
    expect(canAccessRoute(PERFIS.ENCARREGADO, "/register")).toBe(false);
  });

  test("rota inexistente não é permitida", () => {
    expect(canAccessRoute(PERFIS.ADMIN, "/rota-inexistente")).toBe(false);
  });
});
