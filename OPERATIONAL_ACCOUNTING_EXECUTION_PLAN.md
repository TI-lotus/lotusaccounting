# Plano de execucao operacional da Lotus Accounting

Data: 23/09/2026.

Este plano detalha como transformar a Lotus em um sistema operacional de escritorio contabil, preservando a essencia ja construida: clientes, equipe, tarefas, documentos, mensagens, agenda, financeiro, permissoes e portal do cliente.

## Escopo deste plano

Incluido:

- Ciclo mensal por cliente e competencia.
- Checklists operacionais por regime e servico.
- Solicitacao e controle de documentos.
- Portal do cliente orientado a pendencias e acompanhamento.
- Fila de trabalho do colaborador.
- Revisao, aprovacao e qualidade tecnica.
- Obrigacoes recorrentes internas.
- Indicadores operacionais.
- Notificacoes e alertas internos.
- Testes, QA e criterios de aceite.

Fora deste plano, por decisao atual:

- SERPRO, Banco Inter, Asaas, WhatsApp, Gmail, NFSe, DAS/Simples oficial, OCR avancado e outras integracoes externas.
- Transmissao fiscal oficial.
- Emissao bancaria, Pix, boleto e automacoes externas.

As integracoes existentes ou ja iniciadas permanecem no codigo, mas nao sao dependencia para cumprir este ciclo operacional.

## Estado atual resumido

A Lotus ja possui uma boa base operacional:

- Cadastro de clientes.
- Cadastro de colaboradores.
- Permissoes por perfil.
- Responsavel por cliente.
- Tarefas com status, prioridade, prazo, tipo e responsavel.
- Agenda com tarefas, documentos, pagamentos/faturas e obrigacoes.
- Upload e classificacao inicial de documentos.
- Mensagens internas.
- Financeiro interno.
- Portal do cliente.
- Modais de detalhe para clientes, colaboradores, tarefas e eventos.

O principal problema atual e que esses blocos ainda funcionam como modulos relacionados, mas nao como um ciclo contabil guiado por competencia.

Objetivo deste plano: fazer cada cliente ter um ciclo mensal claro, com pendencias, tarefas, documentos, revisao, entrega e fechamento.

## Execucao em andamento

Atualizado em 23/09/2026.

### Fase 1 parcialmente executada

Ja entregue:

- Migration `client_periods` com status, progresso, timestamps, unicidade por cliente/competencia e RLS.
- Testes de seguranca para `client_periods`, cobrindo escopo por tenant, visao do cliente e permissoes de colaborador.
- Tipos compartilhados para competencia mensal.
- Estado global do app carregando, criando, gerando em lote e atualizando competencias mensais.
- Nova tela `/periods` chamada `Ciclo mensal`, com filtros por mes, ano, status e responsavel.
- Badges e progresso da competencia atual nos cards/lista de clientes.
- Menu lateral atualizado com acesso ao ciclo mensal para escritorio e cliente.
- Migration `client_period_steps` com etapas padrao da competencia, recalculo automatico de progresso e RLS.
- Tela `Ciclo mensal` exibindo etapas operacionais por cliente e permitindo atualizar status de cada etapa.
- Aba `Ciclo do mes` no detalhe do cliente, com competencia atual, etapas e historico recente.
- Painel de gargalos da competencia atual no dashboard principal, com progresso medio, bloqueios, revisoes, clientes aguardando documentos e clientes sem competencia criada.

Ainda falta na Fase 1:

- Fazer QA navegando como admin, colaborador e cliente em ambiente Supabase real.
- Atualizar tipos gerados do Supabase quando a migration estiver aplicada no projeto remoto.

### Fase 2 parcialmente executada

Ja entregue:

- Migration `operational_checklist_templates`, `operational_checklist_items` e `client_period_checklist_items`.
- Templates globais iniciais para MEI, Simples Nacional, Lucro Presumido e Lucro Real, separados por area fiscal e contabil.
- Geracao automatica de checklist e tarefas mensais ao criar competencia.
- Idempotencia da geracao: acionar novamente a criacao do checklist nao duplica itens nem tarefas.
- Vinculo entre item de checklist e tarefa gerada.
- Cadastro de cliente com servicos contratados por area: Fiscal, Contabil, Folha, Financeiro/BPO e Societario.
- Geracao de checklist respeitando os servicos contratados do cliente.
- Responsavel e prazo ajustaveis por item de checklist na tela `Ciclo mensal`, com sincronizacao para a tarefa vinculada.
- Sincronizacao de conclusao da tarefa para o item do checklist.
- Progresso da competencia refletindo checklist operacional.
- Tela `Ciclo mensal` mostrando checklist por cliente, status, prazo, area, flags de revisao/documento e tarefa vinculada.
- Tela `Ciclo mensal` permite vincular e remover evidencia documental diretamente em itens de checklist que exigem documento.
- Banco valida que a evidencia do checklist pertence ao mesmo workspace e empresa do item.
- Aba `Ciclo do mes` no detalhe do cliente mostrando resumo do checklist gerado.
- Tela administrativa `/settings/templates` para consultar templates globais, duplicar para o escritorio e editar copias do workspace.
- Templates globais de checklist ficam protegidos; o escritorio edita apenas sua propria copia.
- Escritorio pode criar novos templates e itens de checklist do zero pela interface, com regime tributario e area de servico configuraveis.
- Geracao de checklist passa a preferir override do escritorio em novas competencias, inclusive quando o override for desativado para substituir o template global.
- Testes cobrindo diferenca entre MEI e Simples Nacional, servicos contratados, geracao de tarefas, sincronizacao tarefa/checklist, responsavel/prazo do item e vinculo seguro de evidencia documental.
- Testes cobrindo clone administrativo de template de checklist e uso do override na geracao da competencia.

Ainda falta na Fase 2:

- QA real em Supabase validando criacao/edicao de templates com admin e bloqueio para colaborador.

### Fase 3 executada

Ja entregue:

- Migration `document_requests` com status `requested`, `uploaded`, `approved`, `rejected` e `waived`.
- RLS para escritorio, colaborador e cliente, com protecao para cliente apenas anexar documento na propria solicitacao.
- Validacao de que documento anexado pertence ao mesmo workspace e empresa da solicitacao.
- Solicitatacoes vinculadas a competencia e cliente.
- Recalculo da etapa macro `Documentos recebidos` conforme documentos solicitados sao enviados, aprovados, recusados ou dispensados.
- Estado global do app carregando, criando e atualizando solicitacoes de documentos.
- Upload direcionado para uma solicitacao de documento.
- Tela `Ciclo mensal` com bloco de documentos solicitados, botao `Solicitar documento` e acoes de aprovar, recusar e dispensar.
- Tela `Documentos` mostrando pendencias e permitindo upload diretamente na solicitacao.
- Tela `Documentos` com visao dedicada de solicitacoes por status: pendentes, aguardando aprovacao, recusadas, resolvidas e todas.
- Tela `Documentos` destacando solicitacoes vencidas e deixando o reenvio explicito apos recusa.
- Campo de motivo customizado ao recusar ou dispensar uma solicitacao pela interface.
- Checklist da competencia exibindo evidencia aprovada, ou ausencia dela, em itens que exigem documento.
- Alertas internos persistentes para solicitacoes vencidas, direcionados ao responsavel interno e encerrados quando o documento e reenviado/resolvido.
- Aba `Ciclo do mes` no detalhe do cliente mostrando documentos solicitados da competencia.
- Testes cobrindo escopo por cliente, upload do cliente na propria solicitacao, bloqueio de adulteracao, atualizacao da etapa de documentos e alertas internos de vencimento.

### Fase 4 parcialmente executada

Ja entregue:

- Dashboard do cliente renomeado para `Minha empresa`.
- Card de competencia atual com status, progresso, etapas e atalho `Acompanhar mes`.
- Card `Acoes necessarias` agregando documentos pendentes/recusados e pendencias financeiras.
- Estado vazio `Nenhuma acao necessaria`.
- Bloco de pendencias de documentos com acao `Enviar documento`/`Reenviar documento`.
- Bloco de proximos vencimentos consolidando documentos, faturas e obrigacoes.
- Bloco de mensagens recentes com atalho para a conversa.
- Mensagens recentes exibindo remetente e contexto da conversa.
- Historico de competencias com status e progresso.
- Upload direto no card da pendencia de documento, sem precisar navegar para `Documentos`.
- Teste/RLS existente confirmando que cliente ve apenas sua empresa e tarefas atribuidas, sem acesso a tarefas internas de outros contextos.

Ainda falta na Fase 4:

- QA como usuario cliente em ambiente Supabase real.

### Fase 5 parcialmente executada

Ja entregue:

- Nova tela `/work-queue` chamada `Minha fila`, disponivel para escritorio e bloqueada para usuarios cliente.
- Menu operacional atualizado com acesso direto para `Minha fila`.
- Fila diaria separando:
  - tarefas atrasadas;
  - tarefas para hoje;
  - proximas tarefas dos proximos sete dias;
  - solicitacoes de documentos aguardando cliente;
  - itens de checklist em revisao;
  - itens de checklist bloqueados.
- Colaborador ve a fila filtrada pela propria responsabilidade.
- Admin pode alternar entre todos os colaboradores ou um colaborador especifico.
- Indicadores individuais da fila:
  - tarefas concluidas hoje;
  - tarefas atrasadas;
  - itens em revisao;
  - clientes sob responsabilidade.
- Acoes rapidas na fila:
  - iniciar tarefa;
  - concluir tarefa;
  - enviar tarefa vinculada a checklist para revisao;
  - concluir revisao de item de checklist;
  - abrir competencia;
  - solicitar documento;
  - ir para mensagens/comentarios.
- Botao `Competencia` da fila abre o Ciclo mensal filtrado por mes, ano e cliente quando houver competencia vinculada.
- Tela `Ciclo mensal` aceita filtros por URL e filtro direto de cliente.
- Comentarios contextuais internos em tarefas, itens de checklist e competencias via tabela `operational_comments`.
- Tela `Minha fila` permite comentar sem sair da tela e mostra o ultimo comentario do contexto.
- Tarefas soltas podem ser bloqueadas formalmente com motivo obrigatório em `blocked_reason`.
- Tarefas bloqueadas aparecem na secao `Bloqueadas` da fila com o motivo operacional.
- Itens bloqueados exibem o motivo operacional quando disponivel.
- Pendencias documentais recusadas exibem o motivo de recusa.
- Tela `Tarefas` ganhou estado/filtro/coluna/contador de bloqueadas e acao de bloqueio com motivo.

Ainda falta na Fase 5:

- QA navegando como admin e colaborador em ambiente Supabase real.

### Fase 6 parcialmente executada

Ja entregue:

- Migration `task_reviews` com status `pending_review`, `approved` e `rejected`.
- Historico de revisao por tarefa, com revisor, comentario, data solicitada e data revisada.
- RLS para manter revisoes restritas ao workspace e a usuarios internos autorizados.
- Gatilho que cria revisao pendente quando um item de checklist obrigatorio entra em `in_review`.
- Tarefa critica concluida sem revisao aprovada passa para fluxo de revisao em vez de fechar o checklist diretamente.
- Aprovacao de revisao conclui o item de checklist e a tarefa vinculada.
- Reprovacao de revisao devolve item e tarefa para `in_progress`, preservando o comentario de ajuste.
- Competencia nao pode ser fechada se houver revisao pendente vinculada.
- `DataContext` carrega revisoes e expoe acoes para solicitar, aprovar e reprovar revisao.
- Tela `Minha fila` mostra itens em revisao com acoes `Aprovar` e `Reprovar`.
- Reprovacao pela interface exige motivo em modal.
- Tela `Minha fila` exibe o ultimo comentario de reprovacao diretamente no card da tarefa/checklist.
- Tela `Ciclo mensal` exibe o ultimo comentario de reprovacao nos itens de checklist.
- Tela `Ciclo mensal` mostra historico recente de revisoes vinculadas as tarefas da competencia.
- Tela `Ciclo mensal` permite comentar diretamente nos itens de checklist e mostra o ultimo comentario operacional.
- Testes cobrindo:
  - criacao de revisao para tarefa critica;
  - bloqueio de fechamento da competencia com revisao pendente;
  - aprovacao concluindo checklist/tarefa;
  - reprovacao devolvendo tarefa para execucao com comentario.
- Testes cobrindo escopo interno de comentarios operacionais, vinculo ao alvo e bloqueio para usuario cliente.

Ainda falta na Fase 6:

- Tela/historico dedicado de revisoes no detalhe da tarefa, caso seja criada uma visao individual mais completa de tarefa.
- Definir matriz fina de quem pode revisar, separando executor e revisor quando o escritorio exigir dupla conferencia.
- QA como admin, colaborador executor e colaborador revisor em ambiente Supabase real.

### Fase 7 parcialmente executada

Ja entregue:

- Migration `fiscal_obligation_templates` com templates por regime tributario, area de servico, vencimento padrao, prioridade, recorrencia, geracao de tarefa e exigencia de evidencia.
- `fiscal_obligations` ampliada com:
  - vinculo com `client_period_id`;
  - vinculo com template de origem;
  - area de servico;
  - flag de tarefa gerada;
  - flag de evidencia obrigatoria.
- Ao criar competencia mensal, o banco gera automaticamente obrigacoes aplicaveis ao regime do cliente.
- Ao criar competencia mensal, o banco gera obrigacoes apenas para os servicos contratados do cliente.
- Geracao idempotente: chamar novamente a funcao de obrigacoes da competencia nao duplica registros.
- Obrigacao configurada para gerar tarefa cria tarefa mensal vinculada ao cliente, competencia e responsavel.
- Atualizacao da tarefa vinculada sincroniza o status da obrigacao.
- Obrigacao com evidencia obrigatoria nao pode ser concluida sem documento vinculado.
- Alertas internos persistentes para obrigacoes proximas/vencidas, direcionados ao responsavel interno e encerrados quando a obrigacao e concluida.
- Botao `Gerar mês atual` em Relatorios passa a sincronizar obrigacoes por competencia usando a funcao do banco.
- Tela `Ciclo mensal` mostra as obrigacoes geradas da competencia com status, vencimento, area, tarefa vinculada e exigencia/evidencia.
- Tela `Ciclo mensal` permite vincular e remover evidencia documental diretamente em obrigacoes que exigem evidencia.
- Agenda ja inclui obrigacoes e passa a refletir as obrigacoes geradas pela competencia.
- Tela administrativa `/settings/templates` para consultar obrigacoes globais, duplicar para o escritorio e editar copias do workspace.
- Templates globais de obrigacoes ficam protegidos; o escritorio edita apenas sua propria copia.
- Escritorio pode criar novos templates de obrigacoes do zero pela interface, com regime tributario e area de servico configuraveis.
- Geracao de obrigacoes passa a preferir override do escritorio em novas competencias, inclusive quando o override for desativado para substituir o template global.
- Testes cobrindo:
  - obrigacoes geradas ao iniciar competencia;
  - tarefas vinculadas;
  - idempotencia;
  - bloqueio de conclusao sem evidencia obrigatoria;
  - sincronizacao por tarefa;
  - alerta interno de vencimento.
  - clone administrativo de template de obrigacao e uso do override na geracao da competencia.

Ainda falta na Fase 7:

- QA real em Supabase validando criacao/edicao de obrigacoes com admin e bloqueio para colaborador.
- Mostrar historico/atividade da obrigacao no detalhe da competencia e do cliente.
- Parametrizar recorrencias anuais/trimestrais de forma completa; a base atual cobre o fluxo mensal do MVP.
- QA real em Supabase com regimes diferentes e usuarios admin/colaborador/cliente.

### Fase 8 parcialmente executada

Ja entregue:

- Utilitario `computeOperationalMetrics` para consolidar indicadores operacionais a partir de clientes, competencias, etapas, tarefas, documentos, revisoes e obrigacoes.
- Testes unitarios dos indicadores operacionais cobrindo:
  - clientes em risco;
  - pendencias do cliente;
  - tarefas atrasadas por responsavel;
  - revisoes pendentes;
  - distribuicao de competencias por status;
  - tempo medio de fechamento;
  - gargalos por etapa.
- Novo painel `Indicadores operacionais` no dashboard do escritorio.
- Indicadores exibidos:
  - clientes em dia;
  - clientes com pendencia do cliente;
  - competencias em risco;
  - tarefas/itens em revisao;
  - competencias por status;
  - gargalos por etapa;
  - clientes em risco com motivos;
  - tarefas atrasadas por colaborador;
  - tempo medio de fechamento.
- Atalhos do painel para `Ciclo mensal`, `Minha fila` e detalhe do cliente em risco.
- O dashboard do cliente ja possui status do mes, pendencias, documentos, vencimentos, faturas e historico de competencias, cobrindo a primeira camada de indicadores do cliente.

Ainda falta na Fase 8:

- Expandir relatorios com historico comparativo de produtividade por periodo.
- Criar indicadores detalhados por colaborador dentro de uma tela propria, nao apenas no painel do dashboard.
- Exibir tendencia temporal de tempo medio de fechamento e gargalos.
- QA visual dos indicadores em bases com muitos clientes e muitos colaboradores.

### Fase 9 parcialmente executada

Ja entregue:

- Migration `operational_alert_engine` com motor persistente de alertas internos.
- Funcao de resolucao de destinatario interno por:
  - responsavel preferencial;
  - responsavel do cliente;
  - administrador ativo do workspace.
- Alertas persistentes para:
  - documento enviado pelo cliente;
  - documento recusado;
  - documento solicitado vencido;
  - tarefa atrasada;
  - revisao reprovada;
  - competencia bloqueada;
  - competencia parada ha pelo menos 7 dias;
  - fatura vencida.
- Funcao de varredura `sync_operational_alerts()` para sincronizar estados que mudam apenas pela passagem do tempo.
- Funcao `run_operational_notification_maintenance()` consolidando varredura de alertas e arquivamento de notificacoes antigas.
- Politica de retencao com arquivamento de notificacoes lidas apos 180 dias, preservando notificacoes nao lidas.
- Migration de agendamento Supabase cron `lotus-operational-alert-maintenance` a cada 15 minutos.
- Alertas novos limpam/marcam como lidos quando o fato operacional e resolvido.
- Central `/notifications` com pesquisa, filtro por categoria, filtro por lida/nao lida, historico recente, marcar uma ou todas como lidas e abertura por deep link.
- TopBar categorizando notificacoes persistentes por tipo:
  - Mensagens;
  - Documentos;
  - Vencimentos;
  - Tarefas;
  - Revisoes;
  - Ciclo mensal;
  - Faturas.
- Deep links de notificacao para os modulos corretos:
  - `/work-queue`;
  - `/periods`;
  - `/invoices`;
  - `/documents`;
  - `/reports`;
  - `/messages`.
- Remocao de duplicidade visual para alertas vencidos que agora sao persistidos pelo banco.
- Testes cobrindo criacao e encerramento de alertas para documentos enviados/recusados, competencia parada, tarefa atrasada, revisao reprovada, competencia bloqueada e fatura vencida.
- Testes cobrindo arquivamento apenas de notificacoes lidas fora da janela de retencao.

Ainda falta na Fase 9:

- Aplicar e validar o cron em um projeto Supabase real, confirmando extensao `pg_cron` e execucoes no painel.

## Meta operacional

Ao final, um escritorio deve conseguir:

1. Iniciar ou gerar automaticamente a competencia mensal de cada cliente.
2. Saber em que etapa cada cliente esta.
3. Solicitar documentos ao cliente e acompanhar o que falta.
4. Gerar tarefas operacionais a partir de checklists por regime/servico.
5. Distribuir execucao entre colaboradores.
6. Revisar entregas criticas antes do fechamento.
7. Mostrar ao cliente o que ele precisa fazer e o status do mes.
8. Fechar a competencia com evidencias.
9. Ver gargalos, atrasos, produtividade e risco operacional.

## Modelo operacional alvo

### Fluxo mensal padrao

1. Competencia criada.
2. Documentos solicitados.
3. Cliente envia documentos.
4. Equipe confere e classifica.
5. Tarefas fiscais, contabeis, folha e financeiras sao executadas.
6. Itens criticos entram em revisao.
7. Revisao aprova ou reprova.
8. Entregas e evidencias sao registradas.
9. Competencia e fechada.
10. Cliente visualiza status, pendencias e historico.

### Estados da competencia

- `not_started`: nao iniciada.
- `waiting_documents`: aguardando documentos.
- `in_progress`: em execucao.
- `in_review`: em revisao.
- `delivered`: entregue.
- `closed`: fechada.
- `blocked`: bloqueada por pendencia critica.

### Estados de solicitacao de documento

- `requested`: solicitado.
- `uploaded`: enviado.
- `approved`: aprovado.
- `rejected`: recusado.
- `waived`: dispensado.

### Estados de tarefa operacional

Manter os estados atuais e adicionar, quando a fase permitir:

- `pending`: pendente.
- `in_progress`: em andamento.
- `in_review`: em revisao.
- `completed`: concluida.
- `overdue`: atrasada.
- `blocked`: bloqueada.

## Fase 0 - Preparacao tecnica

Objetivo: preparar a base sem alterar a experiencia atual.

### Entregas

- Confirmar nomes finais de tabelas, status e enums.
- Criar migrations aditivas, sem quebrar dados existentes.
- Mapear tarefas, documentos e obrigacoes atuais para a nova estrutura.
- Criar testes basicos de schema e RLS para as novas entidades.

### Tabelas previstas

- `client_periods`
- `operational_checklist_templates`
- `operational_checklist_items`
- `client_period_steps`
- `document_requests`
- `task_reviews`
- `task_dependencies`
- `operational_events`
- `operational_alerts`

### Criterio de aceite

- Migrations rodam em ambiente limpo.
- Tipos Supabase atualizados.
- Nenhum fluxo atual de clientes, tarefas, documentos, mensagens ou financeiro quebra.

## Fase 1 - Competencia mensal por cliente

Objetivo: criar a espinha dorsal do ciclo operacional.

### Backend e dados

Criar `client_periods`:

- `id`
- `tenant_id`
- `company_id`
- `period_month`
- `period_year`
- `status`
- `progress_percent`
- `started_at`
- `delivered_at`
- `closed_at`
- `blocked_reason`
- `responsible_user_id`
- `created_by`
- `created_at`
- `updated_at`

Criar unicidade:

- Uma competencia por `tenant_id`, `company_id`, `period_month`, `period_year`.

Criar policies:

- Admin ve tudo do tenant.
- Colaborador ve periodos permitidos pelo modulo clientes/tarefas.
- Cliente ve apenas periodos da propria empresa.

### Frontend

Adicionar nos clientes:

- Badge do status da competencia atual.
- Progresso do mes.
- Link/modal "Ciclo do mes".

Criar tela ou aba:

- `Ciclo mensal`
- Lista por cliente.
- Filtro por status.
- Filtro por responsavel.
- Filtro por competencia.

### Comportamentos

- Botao "Iniciar competencia".
- Geracao em lote para clientes ativos.
- Atualizacao automatica de progresso conforme etapas/tarefas/documentos.

### Criterio de aceite

- Um admin consegue criar a competencia de setembro/2026 para todos os clientes ativos.
- Cada cliente tem um status e progresso visivel.
- Cliente logado ve somente sua propria competencia.
- Competencia nao duplica se o botao for acionado novamente.

## Fase 2 - Checklists operacionais por regime e servico

Objetivo: transformar tarefas soltas em operacao contabil padronizada.

### Templates iniciais

Criar templates por regime:

- MEI.
- Simples Nacional.
- Lucro Presumido.
- Lucro Real.

Criar dimensao por servico:

- Fiscal.
- Contabil.
- Folha.
- Financeiro/BPO.
- Societario simples.

### Dados

`operational_checklist_templates`:

- `id`
- `tenant_id`
- `name`
- `tax_regime`
- `service_area`
- `active`

`operational_checklist_items`:

- `id`
- `template_id`
- `title`
- `description`
- `default_priority`
- `default_due_day`
- `requires_review`
- `requires_document`
- `sort_order`

`client_period_steps`:

- `id`
- `client_period_id`
- `checklist_item_id`
- `task_id`
- `status`
- `sort_order`

### Frontend

Adicionar tela de configuracao:

- Templates de checklist.
- Itens do checklist.
- Ativar/desativar item.

No ciclo mensal:

- Aba "Checklist".
- Cada item mostra status, responsavel, prazo e evidencias.

### Comportamentos

- Ao iniciar competencia, gerar tarefas a partir do checklist aplicavel ao cliente.
- Usar regime tributario e servicos contratados.
- Nao duplicar tarefas se a competencia ja foi gerada.

### Criterio de aceite

- Cliente Simples Nacional gera checklist diferente de MEI.
- Tarefas aparecem vinculadas a competencia.
- Concluir tarefa atualiza item do checklist.
- Progresso da competencia reflete checklist.

## Fase 3 - Solicitacao e controle de documentos

Objetivo: fechar a maior dor operacional: saber o que falta do cliente.

### Dados

`document_requests`:

- `id`
- `tenant_id`
- `company_id`
- `client_period_id`
- `requested_by`
- `assigned_to`
- `title`
- `description`
- `document_type`
- `due_date`
- `status`
- `document_id`
- `rejection_reason`
- `waived_reason`
- `created_at`
- `updated_at`

### Frontend escritorio

Criar visoes:

- Documentos pendentes por cliente.
- Documentos pendentes por competencia.
- Documentos aguardando aprovacao.
- Documentos recusados.

No ciclo mensal:

- Aba "Documentos solicitados".
- Botao "Solicitar documento".
- Botao "Aprovar".
- Botao "Recusar".
- Botao "Dispensar".

### Frontend cliente

No portal:

- Card "Pendencias de documentos".
- Lista de solicitacoes abertas.
- Upload direto dentro da solicitacao.
- Status do envio.
- Motivo de recusa quando houver.

### Comportamentos

- Upload pode ser associado a uma solicitacao.
- Documento aprovado conta para progresso da competencia.
- Documento recusado volta para pendencia do cliente.
- Solicitacao vencida gera alerta interno.

### Criterio de aceite

- Escritorio solicita documento para uma competencia.
- Cliente envia arquivo dentro da solicitacao.
- Escritorio aprova ou recusa.
- Cliente enxerga o novo status.
- Competencia mostra o documento como evidenciado.

## Fase 4 - Portal do cliente orientado a acompanhamento

Objetivo: fazer o cliente entender o que esta acontecendo sem precisar perguntar.

### Nova area "Minha empresa"

Componentes:

- Status da competencia atual.
- Progresso do mes.
- Pendencias de documentos.
- Pendencias financeiras.
- Proximos vencimentos.
- Mensagens recentes.
- Historico de competencias.
- Estado vazio: "Nenhuma acao necessaria".

### Regras de UX

- Cliente nao deve ver complexidade interna.
- Cliente deve ver verbos simples:
  - Enviar documento.
  - Ver pendencia.
  - Ver mensagem.
  - Ver fatura.
  - Acompanhar mes.

### Criterio de aceite

- Cliente consegue entrar e saber imediatamente se precisa fazer algo.
- Cliente ve status do mes atual.
- Cliente consegue enviar documento solicitado.
- Cliente nao ve tarefas internas de colaborador, exceto pendencias atribuidas a ele.

## Fase 5 - Minha fila do colaborador

Objetivo: dar ao colaborador uma tela diaria de execucao.

### Tela "Minha fila"

Secoes:

- Atrasadas.
- Para hoje.
- Proximas.
- Aguardando cliente.
- Em revisao.
- Bloqueadas.

Campos:

- Cliente.
- Competencia.
- Tarefa.
- Prazo.
- Prioridade.
- Status.
- Proxima acao.

### Acoes rapidas

- Iniciar.
- Enviar para revisao.
- Concluir.
- Comentar.
- Abrir competencia.
- Solicitar documento.

### Indicadores individuais

- Tarefas concluidas hoje.
- Tarefas atrasadas.
- Tarefas em revisao.
- Clientes sob responsabilidade.

### Criterio de aceite

- Colaborador logado ve uma fila filtrada por suas responsabilidades.
- Admin consegue filtrar por colaborador.
- Acoes rapidas atualizam tarefa e competencia.
- Tarefa bloqueada informa o motivo.

## Fase 6 - Revisao e controle de qualidade

Objetivo: criar uma camada leve de revisao tecnica.

### Dados

`task_reviews`:

- `id`
- `tenant_id`
- `task_id`
- `reviewer_id`
- `status`
- `requested_at`
- `reviewed_at`
- `comment`

Estados:

- `pending_review`
- `approved`
- `rejected`

### Comportamentos

- Item de checklist pode exigir revisao.
- Concluir tarefa critica envia para revisao, em vez de fechar direto.
- Revisor aprova ou reprova.
- Reprovacao devolve tarefa para `in_progress` com comentario.
- Competencia nao fecha com revisao obrigatoria pendente.

### Criterio de aceite

- Tarefa critica entra em revisao.
- Admin/revisor aprova ou reprova.
- Reprovacao registra motivo.
- Competencia bloqueia fechamento se houver revisao pendente.

## Fase 7 - Obrigacoes recorrentes internas

Objetivo: conectar obrigacoes ao regime, competencia e tarefas.

### Dados e regras

Ampliar obrigacoes atuais com:

- Regime aplicavel.
- Area de servico.
- Dia padrao de vencimento.
- Recorrencia mensal/anual.
- Se gera tarefa.
- Se exige evidencia.

### Comportamentos

- Ao iniciar competencia, gerar obrigacoes aplicaveis.
- Obrigacao pode gerar tarefa.
- Obrigacao concluida exige evidencia quando configurada.
- Vencimento proximo cria alerta.

### Criterio de aceite

- Cliente Simples recebe obrigacoes internas compativeis.
- Obrigacao aparece na agenda.
- Obrigacao gera tarefa quando configurada.
- Obrigacao vencida aparece em risco operacional.

## Fase 8 - Indicadores operacionais

Objetivo: permitir que o dono do escritorio veja risco e produtividade.

### Dashboard escritorio

Indicadores:

- Clientes em dia.
- Clientes com pendencia do cliente.
- Clientes com competencia atrasada.
- Competencias por status.
- Tarefas atrasadas por colaborador.
- Tarefas em revisao.
- Documentos pendentes.
- Tempo medio de fechamento.
- Gargalos por etapa.

### Dashboard cliente

Indicadores:

- Status do mes.
- Pendencias abertas.
- Documentos enviados.
- Proximos vencimentos.
- Faturas abertas.

### Criterio de aceite

- Admin consegue identificar clientes em risco.
- Colaborador consegue identificar atraso na propria fila.
- Cliente consegue identificar se ha acao pendente.

## Fase 9 - Notificacoes e alertas internos

Objetivo: transformar notificacoes em motor operacional.

### Eventos que devem gerar alerta

- Documento solicitado ao cliente.
- Documento enviado pelo cliente.
- Documento recusado.
- Tarefa atrasada.
- Tarefa enviada para revisao.
- Revisao reprovada.
- Competencia bloqueada.
- Competencia parada por mais de X dias.
- Obrigacao proxima do vencimento.
- Fatura vencida.
- Mensagem nao lida.

### Canais neste plano

- Topbar.
- Central de notificacoes.
- Badges nas telas.

Fora deste plano:

- WhatsApp.
- E-mail externo.
- Push externo.

### Criterio de aceite

- Notificacao e persistente por destinatario.
- Marcar como lida persiste.
- Notificacao leva ao contexto correto.
- Usuario nao recebe alertas de outro tenant ou outra empresa.

## Sequencia recomendada de implementacao

### Sprint 1 - Espinha dorsal

1. Criar `client_periods`.
2. Criar tela/lista de competencias.
3. Mostrar competencia atual em cliente e dashboard.
4. Testar RLS de admin, colaborador e cliente.

Resultado: o escritorio passa a enxergar o mes de cada cliente.

### Sprint 2 - Checklist e tarefas geradas

1. Criar templates e itens de checklist.
2. Criar etapas da competencia.
3. Gerar tarefas a partir dos itens.
4. Vincular tarefas a competencia.
5. Atualizar progresso.

Resultado: cada competencia vira um plano de execucao.

### Sprint 3 - Documentos solicitados

1. Criar `document_requests`.
2. Adicionar solicitacoes no ciclo mensal.
3. Permitir upload do cliente vinculado a solicitacao.
4. Aprovar/recusar/dispensar.
5. Criar alertas basicos.

Resultado: cliente e escritorio sabem exatamente o que falta.

### Sprint 4 - Portal do cliente

1. Criar painel "Minha empresa".
2. Mostrar status do mes.
3. Mostrar pendencias de documentos.
4. Mostrar proximos vencimentos e faturas.
5. Mostrar mensagens recentes.

Resultado: cliente acompanha a contabilidade sem perguntar manualmente.

### Sprint 5 - Minha fila

1. Criar tela "Minha fila".
2. Separar atrasadas, hoje, proximas, revisao e bloqueadas.
3. Adicionar acoes rapidas.
4. Adicionar indicadores individuais.

Resultado: colaborador sabe o que executar agora.

### Sprint 6 - Revisao tecnica

1. Criar `task_reviews`.
2. Permitir checklist com revisao obrigatoria.
3. Enviar tarefa para revisao.
4. Aprovar/reprovar.
5. Bloquear fechamento com revisao pendente.

Resultado: qualidade tecnica entra no fluxo sem burocracia excessiva.

### Sprint 7 - Obrigacoes recorrentes

1. Parametrizar obrigacoes por regime/servico.
2. Gerar obrigacoes da competencia.
3. Gerar tarefas a partir das obrigacoes.
4. Exigir evidencia quando necessario.
5. Alimentar agenda e alertas.

Resultado: agenda passa a refletir rotina fiscal/contabil configurada.

### Sprint 8 - Indicadores e alertas

1. Criar dashboard operacional.
2. Criar indicadores por colaborador.
3. Criar indicadores por cliente.
4. Consolidar alertas persistentes.
5. Ajustar notificacoes contextuais.

Resultado: admin ve risco, colaborador ve execucao e cliente ve acompanhamento.

## Dependencias entre fases

Ordem obrigatoria:

- Competencia vem antes de checklist.
- Checklist vem antes de tarefas geradas por ciclo.
- Documento solicitado depende de competencia.
- Portal do cliente depende de competencia e documento solicitado.
- Minha fila depende de tarefas vinculadas ao ciclo.
- Revisao depende de tarefas/checklist.
- Indicadores dependem de competencia, tarefas, documentos e revisao.
- Alertas podem iniciar cedo, mas so ficam completos apos as entidades principais.

## Ajustes de produto para preservar a essencia

Manter:

- Interface limpa e operacional.
- Modais de detalhe em vez de navegar demais.
- Grade/lista onde ja faz sentido.
- Portal do cliente simples.
- Fluxo de mensagens integrado.
- Agenda como visao consolidada.

Evitar:

- Criar um ERP pesado.
- Misturar integracoes externas nesta etapa.
- Prometer transmissao fiscal oficial.
- Obrigar o usuario a preencher muitos campos antes de operar.
- Criar automacoes opacas que alterem dados sem evidencia.

## QA obrigatorio por fase

Para cada fase:

- `npm run typecheck`.
- `npm test -- --run`.
- `npm run build`.
- Teste manual com admin.
- Teste manual com colaborador.
- Teste manual com cliente.
- Teste RLS com dois tenants quando houver nova tabela.

## Criterio final de aceite

O plano estara cumprido quando:

1. Admin criar ou gerar competencia mensal para clientes ativos.
2. Competencia gerar checklist e tarefas sem duplicidade.
3. Cliente enviar documentos solicitados.
4. Escritorio aprovar/recusar documentos.
5. Colaborador executar tarefas pela fila.
6. Tarefas criticas passarem por revisao.
7. Obrigacoes internas aparecerem no ciclo e agenda.
8. Cliente acompanhar status, pendencias e vencimentos no portal.
9. Admin enxergar clientes em risco e produtividade da equipe.
10. Notificacoes internas levarem cada usuario ao contexto correto.
11. RLS impedir vazamento entre tenants e empresas.
12. Build, testes e typecheck passarem.

## Estimativa de progresso apos implementar este plano

Estado atual antes deste plano:

- Operacao de escritorio: 65% a 70%.
- Portal do cliente: 55%.
- Execucao dos colaboradores: 70%.
- Controle operacional por competencia: 20%.

Meta apos este plano, ainda sem integracoes externas:

- Operacao de escritorio: 85% a 90%.
- Portal do cliente: 80% a 85%.
- Execucao dos colaboradores: 85% a 90%.
- Controle operacional por competencia: 90%.

Essa meta nao torna a Lotus um sistema fiscal oficial completo, mas torna a plataforma forte como sistema operacional de escritorio contabil.
