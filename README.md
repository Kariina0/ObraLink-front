# ObraLink — Frontend React

Frontend em **React 19** do sistema de Gestão de Obras da Construtora RPG, integrado ao backend em **Node.js + Express + SQLite/Knex**.

Permite que encarregados registrem medições, solicitem materiais e enviem arquivos diretamente do canteiro de obras. Supervisores e administradores acompanham, aprovam e gerenciam obras em tempo real.

---

## 🚀 Funcionalidades

| Tela | Perfis com acesso | Descrição |
|---|---|---|
| **Login** | Todos | Autenticação via JWT com refresh automático |
| **Registro** | Admin | Cadastro de novos funcionários |
| **Dashboard** | Todos | Visão geral com indicadores e atalhos |
| **Enviar Medição** | Encarregado | Formulário estruturado com cálculo automático de área/volume |
| **Minhas Medições** | Encarregado | Histórico de medições com status de aprovação |
| **Medições** | Supervisor, Admin | Listagem completa com filtros, aprovação e rejeição |
| **Upload de Arquivo** | Todos | Envio de fotos, PDFs e documentos vinculados a obras |
| **Solicitação de Compra** | Encarregado | Catálogo de 200+ materiais com prioridade |
| **Status de Solicitação** | Todos | Acompanhamento de solicitações com aprovação/rejeição |
| **Gerenciar Obras** | Admin | CRUD de obras e vinculação de encarregados |
| **Painel Administrativo** | Admin | Estatísticas gerais do sistema |
| **Diário de Obra** | Encarregado, Supervisor | Registro diário de atividades (RDO) |
| **Sincronização** | Todos | Gerenciamento do modo offline e fila de envio |
| **Perfil** | Todos | Dados da conta e troca de senha |

---

## 📂 Estrutura do projeto

```
frontend/
├── public/
│   ├── index.html
│   └── manifest.json
└── src/
    ├── pages/          → 14 telas da aplicação
    ├── components/     → Layout, PrivateRoute, Modal, Icons, SyncManager
    ├── services/       → Clientes de API (axios) por domínio
    ├── context/        → AuthContext (estado global de autenticação)
    ├── utils/          → IndexedDB offline, normalização, validação de senha
    ├── constants/      → Permissões por rota, constantes de medição e status
    ├── styles/         → CSS com variáveis e media queries responsivos
    ├── App.jsx
    └── index.js
```

---

## 🛠️ Pré-requisitos

- Node.js >= 18
- npm >= 9
- Backend (`../backend/`) rodando na mesma porta configurada em `backend/.env`

---

## ⚙️ Como rodar o projeto

### 1. Instalar dependências

```bash
cd frontend
npm install
```

### 2. Configurar variáveis de ambiente

Crie o arquivo `.env` na raiz do projeto frontend:

```bash
REACT_APP_API_URL=http://localhost:5001/api
```

> Ajuste a porta para a mesma usada pelo backend local. Neste workspace atual, a API respondeu em `http://localhost:5001/api`.

### 3. Iniciar o frontend

```bash
npm start
```

O app abrirá em `http://localhost:3000`.

### 4. Iniciar o backend (em outro terminal)

```bash
cd ../backend
npm install
npm start
```

---

## 📚 Documentação complementar

- [docs/README.md](docs/README.md) -> índice da documentação do frontend
- [docs/ARQUITETURA_FRONTEND.md](docs/ARQUITETURA_FRONTEND.md) -> mapa de módulos, rotas e fluxos principais
- [docs/FRONTEND_CHECKLIST.md](docs/FRONTEND_CHECKLIST.md) -> pendências e alinhamentos técnicos

---

## 🔗 Integração com o backend

Todas as chamadas de API passam pelo cliente Axios configurado em `src/services/api.js`, que injeta o token JWT automaticamente e realiza refresh em caso de expiração.

| Grupo | Endpoints principais |
|---|---|
| Autenticação | `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `POST /api/auth/refresh` |
| Obras | `GET /api/obras`, `POST /api/obras`, `PUT /api/obras/:id` |
| Medições | `POST /api/measurements`, `GET /api/measurements/minhas`, `POST /api/measurements/:id/aprovar` |
| Arquivos | `POST /api/files/upload`, `GET /api/files/obra/:id` |
| Solicitações | `POST /api/solicitacoes`, `GET /api/solicitacoes`, `PUT /api/solicitacoes/:id` |
| Sincronização | `GET /api/sync/pull`, `POST /api/sync/push` |