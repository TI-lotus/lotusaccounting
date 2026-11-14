# Lotus — Runbook operacional do MVP

Este documento orienta o primeiro uso real da plataforma e o smoke test do
ambiente de staging. Integrações externas ficam fora deste roteiro.

## Pré-requisitos

- Ambiente acessível e com variáveis do Supabase corretas.
- Uma conta de administrador do escritório.
- Um e-mail de teste para colaborador e outro para cliente.
- Um CNPJ válido de teste e uma competência mensal escolhida.
- Pelo menos um template de checklist ativo para o regime e os serviços do cliente.

## Roteiro do administrador

1. Acessar o workspace e conferir nome, CNPJ e preferências em
   `Configurações`.
2. Cadastrar um cliente ativo com CNPJ normalizado, regime tributário, serviços
   contratados e responsável.
3. Convidar um colaborador e um cliente. Confirmar que cada convite aparece na
   lista operacional com status pendente.
4. Abrir `Colaboradores`, conferir a matriz de permissões e deixar o
   colaborador sem permissão financeira para o teste negativo.
5. Abrir `Ciclo mensal`, gerar a competência para o cliente e conferir as
   etapas, checklist, tarefas e obrigações criadas sem duplicidade.
6. Criar uma solicitação de documento com prazo, enviar o link ao cliente e
   acompanhar os estados `Solicitado`, `Enviado`, `Aprovado`, `Recusado` e
   `Dispensado`.
7. Abrir `Tarefas`, atribuir tarefas pendentes, mover uma tarefa no kanban,
   registrar comentário e enviar uma tarefa crítica para revisão.
8. Tentar atribuir uma tarefa concluída. O sistema deve bloquear a alteração e
   pedir que a tarefa seja reaberta primeiro.
9. Aprovar ou reprovar a revisão com comentário. A aprovação conclui o item;
   a reprovação devolve a execução para andamento.
10. Registrar uma receita, uma despesa, uma fatura e uma baixa. Conferir os
    totais em `Financeiro`, o extrato em `Pagamentos` e exportar o resultado
    filtrado em CSV.
11. Fechar a competência somente depois que pendências, evidências e revisões
    estiverem resolvidas. Confirmar o status `Fechada` e o histórico do cliente.
12. Verificar `Notificações`, `Agenda`, `Relatórios` e os registros de atividade.

## Roteiro do colaborador

1. Entrar pelo convite e confirmar que o workspace correto é carregado.
2. Abrir `Minha fila` e conferir somente tarefas e pendências atribuídas ou
   permitidas pela matriz.
3. Iniciar, bloquear com motivo, comentar, concluir e enviar uma tarefa para
   revisão.
4. Abrir documentos e solicitações, anexar ou revisar apenas o que a permissão
   permite.
5. Abrir mensagens, iniciar conversa autorizada, marcar como lida, fixar e
   arquivar uma conversa.
6. Abrir uma área financeira sem permissão de escrita. A interface deve ocultar
   a ação e o banco deve rejeitar uma tentativa direta.
7. Confirmar que não consegue convidar usuários, alterar configurações do
   workspace, editar templates globais ou reativar o próprio acesso.

## Roteiro do cliente

1. Criar o acesso pelo convite ou pelo fluxo de cliente usando o e-mail já
   vinculado à empresa, sem criar um novo workspace.
2. Confirmar que `Minha empresa` mostra apenas a própria empresa, competência,
   pendências, documentos, faturas, pagamentos e mensagens autorizadas.
3. Enviar um documento solicitado e acompanhar o estado até aprovação ou
   recusa.
4. Abrir uma tarefa atribuída e visualizar o prazo, responsável e status, sem
   editar o planejamento interno.
5. Conversar apenas com o responsável autorizado do escritório.
6. Confirmar que não consegue acessar clientes, equipe, integrações,
   configurações, templates, tarefas internas ou dados de outra empresa.

## Checklist mensal de operação

- [ ] Clientes ativos conferidos e responsáveis definidos.
- [ ] Competências do mês geradas uma única vez.
- [ ] Checklists e obrigações compatíveis com regime e serviços contratados.
- [ ] Solicitações de documentos enviadas com prazo.
- [ ] Documentos recebidos, classificados e vinculados como evidência.
- [ ] Tarefas distribuídas com prazos e responsáveis ativos.
- [ ] Pendências bloqueadas possuem motivo e responsável.
- [ ] Itens críticos passaram por revisão.
- [ ] Receitas, despesas, faturas e baixas conferidas.
- [ ] Relatório e CSV exportados quando necessário.
- [ ] Competência entregue e fechada com evidências.
- [ ] Cliente informado e notificações críticas tratadas.

## Testes negativos obrigatórios

- [ ] Cliente tenta acessar outra empresa.
- [ ] Cliente tenta alterar status de competência, tarefa, pagamento ou fatura.
- [ ] Colaborador sem permissão tenta excluir tarefa ou escrever no financeiro.
- [ ] Usuário tenta atribuir tarefa concluída.
- [ ] Documento aponta para arquivo de outra empresa.
- [ ] Solicitação é aprovada sem documento ou dispensada sem justificativa.
- [ ] Fatura paga é removida.
- [ ] Pagamento conciliado tem status ou data alterados manualmente.
- [ ] Convite revogado é reutilizado.

## Critério de aprovação

O MVP está pronto para uso operacional quando os três roteiros, os testes
negativos e o checklist mensal forem executados em staging sem intervenção
técnica, os dados permanecerem isolados por workspace e o smoke test pós-
deploy passar. A promoção para `main` deve ocorrer somente depois desse
registro.
