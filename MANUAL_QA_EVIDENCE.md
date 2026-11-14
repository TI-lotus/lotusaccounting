# Lotus — Evidências de QA manual

Este arquivo registra a validação autenticada do MVP. O preenchimento deve ser
feito no staging liberado, antes de qualquer promoção para `main`.

## Pré-condições

- [ ] Staging acessível sem bloqueio de SSO da Vercel ou com uma URL de QA autorizada.
- [ ] Conta de administrador ativa.
- [ ] Conta de colaborador convidada pelo administrador.
- [ ] Conta de cliente convidada ou criada pelo fluxo `Sou cliente`.
- [ ] Empresa ativa com CNPJ, regime tributário, serviços e responsável.
- [ ] Uma competência de teste e um e-mail de teste por perfil.

## Resultado por roteiro

| Roteiro | Perfil | Resultado | Evidência / observação |
| --- | --- | --- | --- |
| Autenticação, recuperação e MFA | Administrador | Pendente |  |
| Autenticação por convite | Colaborador | Pendente |  |
| Autenticação por convite ou vínculo por e-mail | Cliente | Pendente |  |
| Ciclo completo de competência | Administrador | Pendente |  |
| Execução, bloqueio e revisão de tarefa | Colaborador | Pendente |  |
| Documentos e solicitações | Cliente | Pendente |  |
| Mensagens, leitura, fixação e arquivamento | Todos | Pendente |  |
| Faturas, pagamentos, baixa e CSV | Administrador | Pendente |  |
| Responsividade desktop/mobile | Todos | Pendente |  |
| Smoke test pós-deploy | Todos | Pendente |  |

## Casos críticos

### Administrador

- [ ] Criar cliente com CNPJ formatado e confirmar normalização.
- [ ] Convidar colaborador e cliente; conferir status e entrega do convite.
- [ ] Criar competência sem duplicar etapas, checklist, tarefas ou obrigações.
- [ ] Editar uma tarefa pendente, alterar cliente/prazo/prioridade e confirmar a persistência após recarregar.
- [ ] Confirmar que a atribuição para outro colaborador fica disponível ao administrador e não aparece para colaborador comum.
- [ ] Solicitar documento, aprovar, recusar com motivo e dispensar com justificativa.
- [ ] Registrar receita, despesa, fatura, baixa, cancelamento permitido e exportar CSV.
- [ ] Tentar fechar competência com pendência; confirmar bloqueio.
- [ ] Fechar competência somente após resolver evidências e revisões.

### Colaborador

- [ ] Visualizar apenas clientes, tarefas e documentos permitidos pela matriz.
- [ ] Iniciar tarefa, bloquear com motivo, comentar e enviar para revisão.
- [ ] Editar uma tarefa sem responsável ou atribuída ao próprio colaborador; confirmar que não consegue assumir a distribuição de outra pessoa.
- [ ] Confirmar que não consegue escrever no financeiro sem permissão.
- [ ] Confirmar que tarefa concluída não pode receber nova atribuição.
- [ ] Fixar e arquivar conversa autorizada; recuperar a conversa arquivada.

### Cliente

- [ ] Criar acesso sem informar workspace.
- [ ] Confirmar que não é criado um workspace novo.
- [ ] Visualizar apenas sua empresa, competência, documentos, tarefas, mensagens,
  faturas e pagamentos.
- [ ] Enviar documento solicitado e acompanhar aprovação ou recusa.
- [ ] Confirmar bloqueio de acesso a clientes, equipe, configurações e dados de
  outra empresa.

## Registro de falhas

Para cada falha, registrar:

1. perfil e conta usada;
2. rota e ação executada;
3. resultado esperado e resultado observado;
4. horário, navegador e viewport;
5. captura de tela ou mensagem de erro;
6. se o problema foi reproduzido após atualizar a sessão.

## Critério de aprovação

O QA manual só pode ser marcado como aprovado quando todos os casos críticos
dos três perfis passarem, não houver vazamento entre workspaces/empresas e o
smoke test pós-deploy não exigir intervenção técnica.
