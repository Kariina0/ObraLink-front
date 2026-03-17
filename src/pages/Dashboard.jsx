// src/pages/Dashboard.jsx
// Página inicial do sistema, exibida após o login.
// Os atalhos visíveis dependem do perfil do usuário (encarregado / supervisor / admin).
import React, { useContext } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import Icon from "../components/Icons";
import { AuthContext } from "../context/AuthContext";
import { canAccessRoute, PERFIL_LABELS } from "../constants/permissions";
import "../styles/pages.css";

/**
 * Atalhos de navegação agrupados por categoria.
 * A visibilidade de cada atalho é controlada por ROUTE_PERMISSIONS.
 */
const GRUPOS = [
  {
    titulo: "Atividades diárias",
    atalhos: [
      { path: "/medicoes",            label: "Nova Medição",        descricao: "Registrar dimensões e informações da obra",   iconKey: "ruler"      },
      { path: "/upload",              label: "Enviar Arquivos",      descricao: "Enviar documentos, fotos e relatórios",        iconKey: "upload"     },
      { path: "/diario",              label: "Diário de Obra",       descricao: "Registrar atividades e ocorrências do dia",    iconKey: "clipboard"  },
      { path: "/sincronizacao",       label: "Sincronização",        descricao: "Revisar pendências e conflitos offline",       iconKey: "checklist"  },
      { path: "/solicitacoes",        label: "Solicitar Materiais",  descricao: "Pedir materiais e recursos para a obra",       iconKey: "cart"       },
      { path: "/status-solicitacoes", label: "Minhas Solicitações",  descricao: "Acompanhar o andamento das solicitações",     iconKey: "clipboard"  },
    ],
  },
  {
    titulo: "Gestão e aprovação",
    atalhos: [
      { path: "/medicoes-lista", label: "Lista de Medições", descricao: "Visualizar e aprovar medições enviadas",  iconKey: "checklist" },
      { path: "/relatorios",     label: "Relatórios",         descricao: "Visualizar relatórios de medições e obras", iconKey: "chart"     },
      { path: "/obras",          label: "Obras",               descricao: "Ver e gerenciar as obras cadastradas",     iconKey: "building"  },
    ],
  },
  {
    titulo: "Administração do sistema",
    atalhos: [
      { path: "/admin",    label: "Painel Administrativo", descricao: "Painel de controle do sistema",          iconKey: "settings"   },
      { path: "/register", label: "Cadastrar Funcionário",  descricao: "Adicionar novos usuários ao sistema",    iconKey: "person-add" },
    ],
  },
];

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, patchUser } = useContext(AuthContext);
  const perfil = user?.perfil || null;
  const notificacoesPendentes = Number(user?.notificacoesPendentes || 0);

  const handleReadNotifications = () => {
    patchUser({ notificacoesPendentes: 0 });
  };

  // Filtra apenas os atalhos que o perfil atual pode acessar
  const gruposVisiveis = GRUPOS.map((grupo) => ({
    ...grupo,
    atalhos: grupo.atalhos.filter(({ path }) => canAccessRoute(perfil, path)),
  })).filter((grupo) => grupo.atalhos.length > 0);

  return (
    <Layout>
      <div className="page-container dashboard-container">
        {/* Cabeçalho de boas-vindas */}
        <div className="welcome-card">
          <h1 className="welcome-title">
            Olá, {user?.nome?.split(" ")[0] || "bem-vindo(a)"}!
          </h1>
          <p className="welcome-sub">
            Perfil:&nbsp;<strong>{PERFIL_LABELS[perfil] || perfil}</strong>
            &nbsp;·&nbsp;Selecione uma opção abaixo para continuar.
          </p>
          {notificacoesPendentes > 0 && (
            <div style={{ marginTop: "var(--espacamento-md)", display: "flex", gap: "var(--espacamento-sm)", alignItems: "center", flexWrap: "wrap" }}>
              <span className="status-badge pendente">
                {notificacoesPendentes} {notificacoesPendentes === 1 ? "atualização" : "atualizações"} de medição aguardando leitura
              </span>
              <button className="button-secondary" onClick={handleReadNotifications}>
                Marcar como lidas
              </button>
            </div>
          )}
        </div>

        {/* Grupos de atalhos */}
        {gruposVisiveis.map((grupo) => (
          <div key={grupo.titulo} className="dashboard-grupo">
            <h2 className="dashboard-grupo-titulo">{grupo.titulo}</h2>

            <div className="dashboard-grid">
              {grupo.atalhos.map(({ path, label, descricao, iconKey }) => (
                <button
                  key={path}
                  className="topic-button"
                  onClick={() => navigate(path)}
                >
                  <span className="topic-button-icon">
                    <Icon name={iconKey} size={22} />
                  </span>
                  <span className="topic-button-title">{label}</span>
                  <span className="topic-button-desc">{descricao}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
};

export default Dashboard;
