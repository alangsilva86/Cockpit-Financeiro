<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1LIxzL7o0UetRiHgSRL7seU57sYkebGEY

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Opcional: configure variáveis de ambiente:
   - `VITE_SYNC_ENDPOINT` (URL que receberá os lançamentos para sincronização; fallback httpbin)
   - `VITE_SYNC_WORKSPACE` (namespace compartilhado entre dispositivos)
   - `VITE_SYNC_KEY` (opcional, chave simples enviada ao backend)
   - `SYNC_SHARED_KEY` (opcional, validado no backend do sync)
   - `SUPABASE_URL` (server-side)
   - `SUPABASE_SERVICE_ROLE_KEY` (server-side, **não** vai para o bundle)
   - `SUPABASE_SYNC_SCHEMA` (opcional, default `public`)
   - `SUPABASE_SYNC_TABLE` (opcional, default `app_states`)
   - `AI_PROVIDER` (none|openai|... — default `none`)
   - `OPENAI_API_KEY` (apenas no backend, não é injetado no bundle)
3. Execute:
   `npm run dev`

## IA agnóstica
- O frontend usa `services/aiClient.ts` para chamar `/api/ai/suggest-category`, `/api/ai/parse-receipt` e `/api/ai/insight`.
- O backend seleciona provider via `AI_PROVIDER` (default `none`). Nenhuma API key é embutida no bundle.

## Sync multi-dispositivo
- O frontend chama `/api/sync` e compartilha o estado por `VITE_SYNC_WORKSPACE`.
- Para produção, configure Supabase (server-side) e `SYNC_SHARED_KEY` opcional para proteger gravações.
- Tabela esperada (SQL):
```sql
create table if not exists public.app_states (
  workspace_id text primary key,
  state jsonb not null,
  updated_at timestamptz not null default now()
);
```

## Fluxos de teste (QA)
1. Setup (usuário novo):
   - Abrir app → ver Setup Progress.
   - Definir renda/teto → cadastrar 1 cartão → criar 1 lançamento.
   - Setup some automaticamente.
2. Compra parcelada 10x:
   - Novo Lançamento → Compra → Crédito → Parcelado 10x.
   - Em Cartões: aparece parcela do mês e plano.
   - Cancelar futuras → futuras somem, histórico mantém auditável.
3. Pagamento do cartão:
   - Meu Mês → Próximos 7 dias → “Pagar agora”.
   - Novo Lançamento abre prefill em `debt_payment`.
   - Confirmar → Cartões mostra pagamento no bloco “Pagamentos (caixa)”.
4. Relatórios em 10s:
   - Abrir Relatórios → resumo executivo aparece.
   - Filtros e mês alteram conteúdo.
