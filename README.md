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
   - `AI_PROVIDER` (none|openai|... — default `none`)
   - `OPENAI_API_KEY` (apenas no backend, não é injetado no bundle)
3. Execute:
   `npm run dev`

## IA agnóstica
- O frontend usa `services/aiClient.ts` para chamar `/api/ai/suggest-category`, `/api/ai/parse-receipt` e `/api/ai/insight`.
- O backend seleciona provider via `AI_PROVIDER` (default `none`). Nenhuma API key é embutida no bundle.
