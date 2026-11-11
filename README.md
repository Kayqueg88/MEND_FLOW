# Sistema de Eventos

## Programar usando o modo de produção

Use o Node.js 24. Na raiz do projeto, instale as dependências e crie o arquivo de ambiente:

```powershell
npm ci
Copy-Item .env.example .env
```

Preencha o `.env` com a URL e a chave pública do seu projeto Supabase. A aplicação depende de um backend já configurado com o esquema, as políticas de acesso, o Storage e as funções RPC usadas pelo frontend.

```powershell
npm run dev:prod
```

Acesse http://127.0.0.1:5173. As alterações no código aparecem automaticamente. Esse comando usa o servidor de desenvolvimento com o modo `production` do Vite para carregar as variáveis correspondentes.

As variáveis de acesso são `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`. O arquivo `.env` existente continua sendo carregado; caso precise de valores específicos, use `.env.production.local`. As variáveis `VITE_` são públicas no navegador; use a chave pública do Supabase.

Para conferir a aplicação compilada e otimizada para produção:

```powershell
npm run preview:prod
```

Acesse http://127.0.0.1:4173. Execute novamente esse comando após alterar o código para gerar uma nova compilação. O preview serve para verificação local; a publicação deve hospedar a pasta `dist` com suporte às rotas da aplicação.

Use `Ctrl+C` no terminal para encerrar qualquer um dos comandos. Ambos usam o Supabase configurado nos arquivos de ambiente, inclusive para gravação de dados.

Projetos de uma aplicação web para gestão de eventos, desenvolvido com **React, TypeScript e Supabase**.

Este repositório faz parte do meu portfólio e registra a evolução do projeto, as funcionalidades construídas e a prática com desenvolvimento frontend e integração com serviços de autenticação.

> 🚧 Em desenvolvimento. Algumas páginas ainda possuem apenas a estrutura inicial.

## Sobre o projeto

A proposta é organizar o acesso às funcionalidades de um sistema de eventos de acordo com três perfis:

- **Coordenador:** acesso aos eventos e à página de criação de evento.
- **Técnico:** acesso aos eventos e ao histórico.
- **Estoque:** acesso aos eventos e aos recebimentos.

Todos os perfis possuem acesso à página inicial e aos próprios dados de perfil. As funcionalidades de gestão estão sendo desenvolvidas aos poucos.

## Tecnologias utilizadas

- **React 19** — construção da interface com componentes.
- **TypeScript** — tipagem do código.
- **Vite** — ambiente de desenvolvimento e build.
- **React Router** — navegação entre páginas.
- **Supabase** — autenticação e consulta dos dados de perfil.
- **Oxlint** — análise do código para identificar problemas e avisos.

## Progresso

- [x] Organização das pastas por funcionalidades.
- [x] Tela de login com e-mail e senha.
- [x] Integração com Supabase Auth.
- [x] Contexto de autenticação e recuperação de sessão.
- [x] Proteção de rotas por autenticação e perfil.
- [x] Página inicial com navegação conforme o perfil.
- [x] Página com os dados do usuário.
- [x] Encerramento da sessão.
- [x] Estrutura inicial das páginas de eventos, criação, histórico e recebimentos.

Também estão implementados a criação e listagem de eventos, anexos, início e finalização pelo técnico, entrega e devolução de equipamentos e histórico com filtros por status. Os processos do estoque estão fora do escopo da etapa atual.

## Próximos passos

- [x] Implementar a listagem e criação de eventos.
- [x] Implementar entrega, devolução e histórico com filtros.
- [x] Separar formulários, histórico, consultas e tipos do detalhe de evento.
- [ ] Validar permissões e funções com contas de teste no Supabase real.
- [x] Enviar chave de operação nas entregas e devoluções e usar criação transacional.
- [ ] Persistir a recuperação de operações após fechar ou atualizar a página.
- [ ] Implementar a página de avisos, já referenciada no menu do coordenador.
- [ ] Melhorar o visual e a experiência de navegação.

Recebimentos e demais processos do estoque ficam adiados por decisão de escopo.

## Manutenção dos eventos

`DetalheEvento.tsx` coordena o carregamento e as ações. Os formulários estão em `FormularioEntrega.tsx` e `FormularioDevolucao.tsx`; o painel de movimentações está em `HistoricoMovimentacoes.tsx`. Os arquivos `tipos-evento.ts`, `consultas-evento.ts` e `formatacao-evento.ts` concentram tipos, consultas e apresentação de valores.

Após uma entrega ou devolução confirmada, apenas as movimentações são atualizadas. Se essa consulta falhar, a tela informa que o registro já foi salvo e bloqueia a finalização até recarregar o histórico.

Entregas e devoluções enviam `p_operacao_id` para as RPCs com cinco parâmetros. Na mesma tela, repetir os mesmos dados após falha de resposta reutiliza a chave; alterar os dados enviados gera outra chave. Cancelar, concluir ou trocar de evento encerra essa operação local. Os formulários, histórico e filtros existentes foram preservados.

A criação usa `criar_evento_com_tecnicos`, com o UUID estável do evento, para gravar evento e vínculos na mesma transação. Anexos continuam em etapas próprias; uma falha de upload pode ser retomada sem recriar o evento confirmado.

Os testes locais simulam o backend. Também foi executado um teste nas funções reais com perfis autenticados de coordenador e técnico: criação e repetição, entrega e repetição, devolução e repetição e finalização. Todas as gravações desse teste foram desfeitas com `ROLLBACK`. Isso não substitui a validação completa pelo navegador. A chave das movimentações fica em memória e não é preservada ao fechar ou atualizar a página. O acesso às RPCs antigas de quatro parâmetros ainda precisa ser encerrado após a confirmação da atualização em uso.

## Organização do código

```text
src/
├── app/
│   ├── ProtectedRoute.tsx
│   └── providers.tsx
├── features/
│   ├── auth/
│   │   ├── login.tsx
│   │   └── Perfil.tsx
│   └── eventos/
│       ├── Eventos.tsx
│       ├── Historico.tsx
│       ├── Home.tsx
│       ├── NovoEvento.tsx
│       └── Recebimentos.tsx
├── lib/
│   └── supabase.ts
├── App.tsx
└── main.tsx
```

A pasta `app` concentra o contexto de autenticação e a proteção das rotas. As páginas ficam em `features`, separadas por funcionalidade, e a configuração do cliente Supabase fica em `lib`.

## Conceitos praticados

O desenvolvimento envolve componentes React, hooks, Context API, formulários, chamadas assíncronas, tipagem com TypeScript e navegação com rotas protegidas.

A integração com Supabase também permite trabalhar com sessão de usuário e com a separação entre o controle de navegação no frontend e as permissões de acesso aos dados no backend.
