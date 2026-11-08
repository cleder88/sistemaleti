# Sistema LETI — Controle de Pedidos

Aplicação web para controle de pedidos de uma rede de lojas, com leitura de PDFs, dashboard executivo e relatórios.

## Stack

- Next.js 15 (App Router) + React 18 + TypeScript
- Tailwind CSS + Recharts + Lucide
- Supabase (Auth, Postgres com RLS e Storage)
- Zod para validação
- PWA via `@ducanh2912/next-pwa`
- Vitest para testes unitários

## Como rodar

```bash
npm install
cp .env.example .env.local   # preencha as variáveis
npm run dev
```

Acesse `http://localhost:3000` (redireciona para `/login`).

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Sim | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sim | Chave anônima do Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Recomendada | Upload de PDFs e criação do bucket no servidor |
| `DEEPSEEK_API_KEY` | Não | Fallback de extração de itens via IA |
| `UPSTASH_REDIS_REST_URL` | Não | Rate limit distribuído (recomendado em produção) |
| `UPSTASH_REDIS_REST_TOKEN` | Não | Token do Upstash Redis |

Sem as variáveis do Upstash, o rate limit funciona em memória (válido apenas para uma instância).

## Banco de dados

Execute os scripts em `supabase/migrations/` na ordem, no SQL Editor do Supabase:

1. `001_create_stores.sql`
2. `002_create_orders_and_items.sql`
3. `003_create_store_monthly_analytics_view.sql`
4. `004_rls_security_policies.sql`
5. `005_store_budgets_and_indexes.sql`
6. `006_audit_logs.sql`
7. `007_security_hardening.sql` (papéis `admin`/`operator` e políticas por papel)
8. `008_orders_unique_store_month.sql` (impede pedidos duplicados por loja/mês)
9. `009_system_backups.sql` (tabela de backups completos do sistema)

Para uma instalação nova, também é possível usar `supabase/setup_completo.sql`.

> A migration `008` faz backup dos pedidos duplicados em
> `orders_duplicate_backup`/`order_items_duplicate_backup` e mantém o pedido mais
> recente de cada loja/mês antes de criar o índice único.

## Funcionalidades

- Login com Supabase Auth e verificação em duas etapas (TOTP/2FA)
- Papéis de acesso (`admin` e `operator`) aplicados no banco e na interface
- Gestão de utilizadores e visualização da trilha de auditoria (somente admin)
- Backup completo do sistema em JSONB no banco, com download e remoção (somente admin)
- Dashboard executivo: KPIs, evolução mensal, ranking por loja, comparativo de quantidades, Curva ABC e auditoria de preços
- Cadastro e gestão de lojas, com orçamento e limite mensal de itens
- Envio de PDF de pedido, extração automática (regex e fallback opcional por IA), conferência e gravação
- Central de relatórios em PDF
- Busca global de lojas e produtos e contador de alertas
- PWA instalável

## Scripts

```bash
npm run dev        # desenvolvimento
npm run build      # build de produção
npm run start      # servidor de produção
npm run lint       # ESLint
npm run lint:fix   # ESLint com correções
npm test           # testes unitários (Vitest)
npm run test:watch # testes em modo watch
```

## Segurança

- RLS habilitado em todas as tabelas operacionais
- Bucket de PDFs privado, com URLs assinadas geradas sob demanda
- Validação de PDF (extensão, MIME, tamanho e assinatura binária)
- Sanitização de textos contra XSS
- Verificação de origem (CSRF) nas rotas de mutação
- Rate limit em login e upload de PDF

## Integração contínua

O workflow `.github/workflows/ci.yml` executa `lint`, `test` e `build` em cada push na `main` e em pull requests.

## Deploy

O deploy é feito na Vercel a partir da branch `main`. Configure as variáveis de ambiente no painel da Vercel e aplique as migrations no Supabase antes de publicar.
