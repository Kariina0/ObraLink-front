# Arquitetura do frontend

## Objetivo

Este documento descreve como o frontend do ObraLink esta organizado hoje, quais sao os modulos centrais e por onde passam os principais fluxos da aplicacao.

## Stack e decisoes principais

- React com `react-scripts` (Create React App).
- Roteamento com `react-router-dom`.
- Comunicacao HTTP com Axios.
- Estado de autenticacao via Context API.
- Persistencia local para recursos offline com IndexedDB.
- Estilos via CSS separado por area (`styles/` + arquivos de pagina/componente).

## Estrutura de alto nivel

### `src/App.jsx`

Define as rotas, monta o `AuthProvider` e injeta o `SyncManager` global.

Responsabilidades:

- inicializar o contexto de autenticacao
- proteger rotas com `PrivateRoute`
- registrar paginas publicas e privadas
- manter o componente global de sincronizacao ativo

### `src/context/`

Contem o estado global de autenticacao.

Arquivo principal:

- `AuthContext.js`: carrega usuario salvo, valida sessao com `/auth/me`, expoe `login`, `logout`, `patchUser` e `refreshUser`.

### `src/components/`

Guarda blocos reutilizaveis de interface e controle de navegacao.

Pecas importantes:

- `PrivateRoute.jsx`: bloqueia acesso sem autenticacao e por permissao de perfil.
- `Layout.jsx`, `Sidebar.jsx`, `NavBar.jsx`: estrutura visual compartilhada.
- `Modal.jsx`: modal generico.
- `SyncManager.jsx`: monitora e aciona o fluxo de sincronizacao.

### `src/pages/`

Concentra as telas de negocio. Cada arquivo representa uma pagina acessada por rota.

Grupos principais:

- autenticacao: `Login`, `Register`
- area operacional: `Dashboard`, `EnviarMedicao`, `DiarioObra`, `Upload`, `PurchaseRequest`
- acompanhamento: `StatusSolicitacao`, `MeusRelatorios`, `measurements`
- administracao: `GerenciarObras`, `AdminPanel`
- suporte operacional: `Sincronizacao`, `Profile`

### `src/services/`

Implementa o acesso ao backend por dominio.

Pecas importantes:

- `api.js`: cliente Axios base com `REACT_APP_API_URL`, envio de JWT e refresh token.
- arquivos de dominio como `obrasService.js`, `medicoesService.js`, `purchasesService.js`, `filesService.js` encapsulam chamadas especificas.

### `src/utils/`

Contem regras de apoio e infraestrutura local.

Exemplos:

- `db.js`: acesso ao banco local
- `syncQueue.js`: fila para sincronizacao
- `normalizeMedicao.js`: normalizacao de payload/resposta
- `validarSenha.js`: regra de validacao

### `src/constants/`

Centraliza constantes reutilizadas.

Exemplos:

- permissoes de rota
- configuracoes de medicao
- constantes de paginacao e status

## Rotas da aplicacao

Rotas definidas atualmente em `src/App.jsx`:

| Rota | Pagina | Observacao |
| --- | --- | --- |
| `/login` | Login | publica |
| `/` | Dashboard | autenticada |
| `/profile` | Profile | autenticada |
| `/medicoes` | EnviarMedicao | autenticada |
| `/solicitacoes` | PurchaseRequest | autenticada |
| `/status-solicitacoes` | StatusSolicitacao | autenticada |
| `/upload` | Upload | autenticada |
| `/diario` | DiarioObra | autenticada |
| `/sincronizacao` | Sincronizacao | autenticada |
| `/medicoes-lista` | measurements | supervisor/admin |
| `/relatorios` | MeusRelatorios | supervisor/admin |
| `/obras` | GerenciarObras | supervisor/admin no codigo atual |
| `/admin` | AdminPanel | admin |
| `/register` | Register | admin |

Observacao: o comentario do README descreve `GerenciarObras` como admin, mas a protecao final depende do mapeamento em `constants/permissions.js` consumido por `PrivateRoute`.

## Fluxo de autenticacao

1. O usuario faz login.
2. O contexto salva `user`, `token` e `refreshToken` no `localStorage`.
3. A cada carregamento da aplicacao, `AuthContext` tenta restaurar a sessao.
4. Se existir token, o frontend valida com `GET /auth/me`.
5. Se o access token expirar, `api.js` tenta `POST /auth/refresh`.
6. Se o refresh falhar, a sessao local e limpa e o app dispara `auth:logout`.

## Fluxo de autorizacao

- `PrivateRoute` espera `authChecked` para evitar redirecionamento prematuro.
- Sem usuario autenticado, a rota redireciona para `/login`.
- Com usuario autenticado, a permissao final depende de `canAccessRoute(perfil, routePath)`.

## Fluxo de dados com a API

Padrao predominante:

1. Pagina ou componente chama um service de dominio.
2. O service usa `api.js` para executar a requisicao.
3. O interceptor adiciona `Authorization: Bearer <token>`.
4. A resposta volta para a pagina, que atualiza estado local e interface.

Beneficios desse desenho:

- concentracao da configuracao HTTP em um ponto unico
- comportamento consistente para erros 401 e refresh token
- menor acoplamento entre componentes visuais e detalhes de transporte

## Fluxo offline e sincronizacao

O projeto ja tem base para operacao offline.

Elementos envolvidos:

- persistencia local com IndexedDB
- fila de sincronizacao em utilitarios
- componente global `SyncManager` para orquestrar tentativas de envio
- pagina `Sincronizacao` para visibilidade operacional

Esse fluxo e relevante principalmente para cenarios de obra com conectividade instavel.

## Convencoes praticas do codigo

- paginas representam casos de uso completos
- services concentram integracoes externas
- constants evitam strings magicas de perfil, status e configuracao
- componentes ficam mais focados em interface e navegacao
- autenticacao nao deve ser duplicada fora de `AuthContext` e `api.js`

## Pontos de atencao para manutencao

- Existem pendencias de alinhamento frontend/backend registradas em [FRONTEND_CHECKLIST.md](FRONTEND_CHECKLIST.md).
- O projeto depende da variavel `REACT_APP_API_URL`; sem ela, usa `http://localhost:5000/api`.
- Como a build em CI trata warnings de ESLint como erro, vale evitar imports mortos e arquivos com BOM.

## Sugestao de leitura para desenvolvimento

1. Leia `src/App.jsx` para entender as rotas.
2. Leia `src/context/AuthContext.js` e `src/services/api.js` para entender autenticacao.
3. Entre na pagina que voce vai alterar e depois no service correspondente.
4. Consulte o checklist tecnico antes de mexer em integracoes com backend.