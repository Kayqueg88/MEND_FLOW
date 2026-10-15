# Sistema de Eventos

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

As quatro páginas de gestão ainda exibem apenas seus títulos; os fluxos de negócio não estão concluídos.

## Próximos passos

- [ ] Implementar a listagem de eventos.
- [ ] Desenvolver o formulário de criação de eventos.
- [ ] Construir as funcionalidades de histórico e recebimentos.
- [ ] Implementar a página de avisos, já referenciada no menu do coordenador.
- [ ] Melhorar o visual e a experiência de navegação.

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
