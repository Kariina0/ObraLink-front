# Frontend checklist (ajustes)

## Integracao Front x Back
- [ ] Trocar solicitacoes para usar POST /api/purchases com payload { items } e auth (remover uso de /api/solicitacoes)
- [ ] Ajustar listagem de solicitacoes para GET /api/purchases (exibir itens e status reais)
- [ ] Padronizar medicoes: escolher um unico endpoint (recomendado: /api/medicoes) e alinhar formato de resposta
- [ ] Ajustar Profile para campos corretos do backend (id, perfil, metadata.createdAt)
- [ ] Garantir que uploads usem token valido e tratar 401/refresh no fluxo offline/online
- [ ] Padronizar uso de um unico client de API (remover duplicidade em src/services/api.js e src/api/api.js)
- [ ] Parametrizar baseURL por variavel de ambiente (ex: REACT_APP_API_URL)

## Estrutura e organizacao
- [ ] Criar services dedicados (auth, medicoes, solicitacoes, arquivos) e manter pages enxutas
- [ ] Centralizar constantes no front (status, perfis, unidades)
- [ ] Remover componentes nao usados (ex: Navbar se nao for usado) ou unificar com Layout

## Validacao e erros
- [ ] Validar campos de medicao no front (>= 0, obrigatorios, tipos)
- [ ] Validar envio de solicitacao (itens obrigatorios, payload correto)
- [ ] Exibir mensagens de erro consistentes (sem alert), com feedback visual na tela
- [ ] Adicionar estados de loading/empty/error em todas as paginas com API

## UX/UI
- [ ] Melhorar fluxo de solicitacao (confirmacao, historico, status real)
- [ ] Melhorar feedback no upload (progresso, sucesso, falha)
- [ ] Padronizar estilos e navegacao (menu ativo, hierarquia visual)

## Performance
- [ ] Usar paginacao e filtros nas listagens (medicoes, solicitacoes, arquivos)
- [ ] Evitar carregar listas completas sem limite

## Itens faltantes
- [ ] Tela de obras e selecao de obraAtual integrada ao perfil
- [ ] Fluxo de aprovacao de medicoes e solicitacoes no front
- [ ] Integrar sincronizacao offline (usar /api/sync/* para medicoes/solicitacoes)
