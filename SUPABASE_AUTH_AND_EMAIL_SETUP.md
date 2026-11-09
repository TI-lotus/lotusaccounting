# Autenticacao e e-mail de producao

## Supabase Auth

No painel Supabase, configure a URL de producao em **Authentication > URL Configuration**:

- Site URL: `https://SEU-DOMINIO`;
- Redirect URLs: `https://SEU-DOMINIO/auth`, `https://SEU-DOMINIO/**` e a URL local de desenvolvimento;
- habilite confirmacao de e-mail quando o dominio SMTP estiver pronto.

Em **Authentication > SMTP Settings**, informe um provedor transacional com dominio verificado. Os templates de confirmacao e recuperacao devem usar `{{ .ConfirmationURL }}` e linguagem em portugues. Essa configuracao depende de dominio, remetente e credenciais fornecidos pelo escritorio; ela nao deve ser versionada nem inserida no frontend.

## Convites por e-mail

A Edge Function `create-workspace-invite` cria o convite e usa Resend quando estas secrets estiverem configuradas:

```text
APP_ORIGIN=https://SEU-DOMINIO
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=Lotus Accounting <acesso@SEU-DOMINIO>
```

Configure-as com `supabase secrets set`. Sem elas, o convite e criado com entrega `not_configured` e a interface copia o link manual como contingencia. O projeto ja possui `RESEND_API_KEY` e um remetente de teste configurados como secrets; o valor da chave nao fica no repositorio.

`onboarding@resend.dev` serve apenas para a validacao inicial e normalmente aceita envio ao endereco autorizado na conta Resend. Antes de convidar usuarios reais, verifique um dominio da Lotus no Resend e substitua `RESEND_FROM_EMAIL` por um remetente desse dominio. A funcao usa `APP_ORIGIN` quando ele estiver definido; em desenvolvimento, ela usa com seguranca a origem HTTP da chamada para montar o link de convite.

## OAuth

Google e Facebook permanecem disponiveis apenas para entradas sem convite. Convites usam e-mail e senha ate existir callback OAuth com state assinado que preserve o token do convite.

## Acesso de cliente sem convite

A tela `/auth` possui a opcao "Sou cliente" para casos em que o convite por e-mail nao chegou. Nesse fluxo, o cliente cria uma conta usando o mesmo e-mail cadastrado na empresa do escritorio. A Edge Function publica `client-self-signup` valida e-mail, senha, nome e opcionalmente CNPJ, encontra exatamente uma empresa ativa com aquele e-mail e cria o usuario como `client` sem depender do e-mail de confirmacao nativo do Supabase Auth.

A Edge Function autenticada `claim-client-access` continua disponivel como recuperacao para usuarios autenticados que ja existem no Auth, mas ainda nao possuem perfil vinculado.

Se o e-mail nao estiver cadastrado em nenhuma empresa ativa, ou aparecer em mais de uma empresa sem CNPJ para desempatar, o cliente deve pedir um convite ao escritorio. Esse fluxo nao cria workspace e nao concede acesso administrativo.

## Recuperacao de senha

A tela `/auth` possui o fluxo de recuperacao e redireciona de volta para `/auth?reset=1`. Inclua essa URL nas Redirect URLs do Supabase, alem da URL de producao e da URL local usada no desenvolvimento.
