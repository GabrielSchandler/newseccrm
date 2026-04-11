# CRM SaaS Multiempresa

Projeto base em Next.js com App Router, TypeScript, Tailwind CSS e Supabase Auth.

## O que ja esta pronto

- Estrutura base organizada em `src/app`, `src/components` e `src/lib`.
- Tailwind CSS configurado.
- Cliente Supabase para browser, servidor e middleware.
- Layout publico para login.
- Layout autenticado com sidebar.
- Login com React Hook Form, Zod e Supabase Auth.
- Middleware protegendo rotas autenticadas.
- Redirecionamento da pagina inicial para `/login` ou `/dashboard`.
- Paginas placeholder para `/dashboard`, `/pre-vendas`, `/contratos` e `/usuarios`.
- CRUD inicial de clientes usando a tabela `public.clients`.

## Pacotes usados

Dependencias principais:

```bash
npm install next react react-dom @supabase/ssr @supabase/supabase-js react-hook-form zod @hookform/resolvers lucide-react
```

Dependencias de desenvolvimento:

```bash
npm install -D typescript @types/node @types/react @types/react-dom tailwindcss @tailwindcss/postcss eslint eslint-config-next @eslint/eslintrc
```

Como o `package.json` ja esta pronto, em uma maquina com Node.js instalado basta rodar:

```bash
npm install
```

## Variaveis de ambiente

Copie o arquivo de exemplo:

```bash
cp .env.example .env.local
```

No Windows PowerShell, se preferir:

```powershell
Copy-Item .env.example .env.local
```

Depois preencha:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

Esses valores ficam no painel do Supabase em Project Settings > API.

## Rodando localmente

Instale as dependencias:

```bash
npm install
```

Suba o servidor de desenvolvimento:

```bash
npm run dev
```

Acesse:

```text
http://localhost:3000
```

## Testando o CRUD de clientes

1. Garanta que `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` estejam preenchidas em `.env.local`.
2. No Supabase Auth, o usuario autenticado precisa ter `company_id` em `user_metadata` ou `app_metadata`.
3. Entre em `http://localhost:3000/login`.
4. Acesse `/clientes`.
5. Clique em `Novo cliente` e preencha os campos obrigatorios: nome completo, CPF e celular.
6. Salve o cliente e confira a tela de visualizacao.
7. Use `Editar` para atualizar os dados.
8. Tente cadastrar outro cliente com o mesmo CPF na mesma empresa para validar a mensagem de duplicidade.

## Observacoes

Esta etapa nao cria tabelas novas nem muda a modelagem do banco. O modulo de clientes usa a tabela existente `public.clients`, aplica `company_id` e `created_by` no servidor e depende das politicas RLS ja configuradas no Supabase.
# GRSCRM
