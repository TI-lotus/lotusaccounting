# Meta de preparação operacional da Lotus

Objetivo: deixar a plataforma Lotus pronta para uso real de um escritório de
contabilidade, sem depender de integrações externas nesta etapa.

## Estado atual

- Branch de trabalho: `staging`.
- Última versão de código enviada: `a26d50a`.
- Última validação automatizada: 14/11/2026; typecheck, testes, lint e build
  aprovados no branch `staging` (execução atual: 99 testes aprovados).
- Staging no Vercel: deployment `lotusaccounting-74imgxbcg-lotus-5cd8.vercel.app`
  observado como `READY`, com o alias de staging apontando para a versão atual.
- Smoke test público: aprovado antes da proteção; o SSO foi reativado depois da
  primeira rodada de QA para proteger os previews.
- Typecheck: aprovado.
- Testes automatizados: 99 aprovados em 6 arquivos.
- Lint: aprovado sem erros bloqueantes; permanecem apenas avisos históricos de
  Fast Refresh.
- Build: aprovado; permanece o aviso de chunks grandes do bundle.
- QA autenticado: primeira rodada dos três perfis aprovada por relato do
  usuário; regressão detalhada recomendada.
- Proteção Vercel: SSO reativado para `prod_deployment_urls_and_all_previews`.
- Última checagem de proteção e deployment: 14/11/2026; run GitHub Actions
  #105 concluído com sucesso e não há falha de build no staging.
- Gate repetível disponível com `npm run verify`: typecheck, testes, lint e
  build em sequência; execução atual aprovada.
- CI e deploy do Supabase agora reutilizam esse mesmo gate, evitando divergência
  entre a validação local e a promoção de ambiente.
- Deploy de staging do Supabase: run GitHub Actions #100 concluído com sucesso
  no commit `9dc5aaa`; secrets, migrations, configuração e Edge Functions foram
  aplicados sem erro.
- Deploy de staging do Supabase: run GitHub Actions #102 concluído com sucesso
  no commit `b55a680`; a recuperação de perfil sem logout está publicada.
- `main`: não promovido.

## Acompanhamento dos 10 pontos

| Ponto | Escopo | Estado | Evidência principal |
| --- | --- | --- | --- |
| 1 | QA por administrador, colaborador e cliente | Primeira rodada aprovada; regressão recomendada | `MANUAL_QA_EVIDENCE.md` |
| 2 | Regras de negócio e permissões | Automatizado; falta confirmação manual | `supabase/tests/workspace-security.test.ts` |
| 3 | Ciclo do cliente até fechamento da competência | Implementado; falta smoke test real | `OPERATIONAL_ACCOUNTING_EXECUTION_PLAN.md` e migrations de `client_periods` |
| 4 | Tarefas, kanban, recorrência, responsáveis e revisão | Implementado; falta QA dos perfis | `src/pages/Tasks.tsx`, `src/pages/WorkQueue.tsx`; submissões protegidas contra duplicidade |
| 5 | Documentos, solicitações, evidências e histórico | Implementado; falta QA dos perfis | migrations `document_requests`, `checklist_evidence` e `operational_audit` |
| 6 | Mensagens, leitura, busca, fixação e arquivamento | Implementado; falta teste autenticado | `src/pages/Messages.tsx` e migrations de mensagens |
| 7 | Financeiro interno, faturas, baixas, cancelamentos e CSV | Implementado; falta QA financeiro | `src/pages/Payments.tsx`, `src/pages/Invoices.tsx`, `src/pages/Reports.tsx`, migrations `linked_payment_integrity` e `payment_history_integrity` |
| 8 | UX, responsividade, acessibilidade e estados de erro | Implementado em código; falta inspeção visual | `AppErrorBoundary`, `DashboardLayout`, `MANUAL_QA_EVIDENCE.md`; sparklines de KPI sem dependência pesada no componente compartilhado |
| 9 | Auditoria, alertas, duplicidade e recuperação | Automatizado; falta validar cron no Supabase real | migrations `operational_alert_engine`, `operational_audit`, `linked_payment_integrity`, `payment_history_integrity` e testes |
| 10 | Onboarding, demonstração, treinamento e smoke test final | Parcialmente implementado | `OPERATIONAL_MVP_RUNBOOK.md` e `OnboardingChecklist` |

## Gate de encerramento

A meta só pode ser encerrada quando:

1. o preview de staging estiver acessível ao testador;
2. os roteiros dos três perfis forem executados e registrados;
3. os testes negativos não mostrarem vazamento de tenant ou bypass de
   permissão;
4. o ciclo mensal completo for concluído em uma conta controlada;
5. o smoke test pós-deploy passar;
6. somente então a versão for promovida para `main`.

O roteiro executável está em `OPERATIONAL_MVP_RUNBOOK.md` e o formulário de
evidências está em `MANUAL_QA_EVIDENCE.md`.
