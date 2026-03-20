# Documentacao do frontend

Esta pasta concentra a documentacao pratica do projeto frontend do ObraLink.

## Leitura recomendada

1. [ARQUITETURA_FRONTEND.md](ARQUITETURA_FRONTEND.md)
Resumo da estrutura da aplicacao, responsabilidades por pasta, rotas e fluxos principais.

2. [FRONTEND_CHECKLIST.md](FRONTEND_CHECKLIST.md)
Lista de ajustes pendentes para alinhamento entre frontend, backend, UX e organizacao tecnica.

## Quando usar cada documento

- Se voce acabou de entrar no projeto: comece por [ARQUITETURA_FRONTEND.md](ARQUITETURA_FRONTEND.md).
- Se vai corrigir bugs ou integrar backend: consulte [FRONTEND_CHECKLIST.md](FRONTEND_CHECKLIST.md).
- Se precisa subir o ambiente local: veja o [README.md](../README.md) da raiz.

## Visao rapida do projeto

- Stack principal: React 19, react-router-dom 6, Axios, IndexedDB via idb.
- Entrada da aplicacao: `src/index.js` e `src/App.jsx`.
- Autenticacao: `src/context/AuthContext.js` com tokens em localStorage e refresh automatico.
- API: `src/services/api.js` centraliza `baseURL`, JWT e retry apos refresh.
- Offline: fila local e sincronizacao apoiadas por `src/utils/db.js`, `src/utils/syncQueue.js` e `src/components/SyncManager.jsx`.

## Objetivo desta pasta

Evitar que o conhecimento do projeto fique espalhado apenas no codigo. A ideia aqui e reduzir tempo de onboarding, facilitar manutencao e deixar claros os pontos de integracao.