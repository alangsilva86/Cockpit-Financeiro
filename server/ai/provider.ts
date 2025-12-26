export interface SuggestCategoryInput {
  description: string;
  availableCategories: string[];
}

export interface ParseReceiptInput {
  base64Image: string;
  availableCategories: string[];
}

export interface InsightInput {
  transactions: Array<{ description: string; amount: number; kind?: string }>;
  income?: number;
}

export interface AIProvider {
  suggestCategory(input: SuggestCategoryInput): Promise<{ category?: string }>;
  parseReceipt(input: ParseReceiptInput): Promise<{ amount?: number; description?: string; category?: string }>;
  generateInsight(input: InsightInput): Promise<{ insight?: string }>;
}

const noneProvider: AIProvider = {
  async suggestCategory() {
    return { category: undefined };
  },
  async parseReceipt() {
    return { amount: undefined, description: undefined, category: undefined };
  },
  async generateInsight() {
    return { insight: 'Provider não configurado (AI_PROVIDER=none).' };
  },
};

const withTimeout = async <T>(promise: Promise<T>, ms = 8000): Promise<T> => {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), ms);
  });
  const result = await Promise.race([promise, timeout]);
  clearTimeout(timer!);
  return result as T;
};

const openaiProvider: AIProvider = {
  async suggestCategory({ description, availableCategories }) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return { category: undefined };
    const prompt = `Classifique a descrição "${description}" em UMA categoria desta lista: ${availableCategories.join(', ')}. Responda só com o nome exato da categoria.`;
    const body = {
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
    };
    const res = await withTimeout(
      fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      })
    );
    if (!res.ok) throw new Error(`openai suggest ${res.status}`);
    const json = await res.json();
    const text = json?.choices?.[0]?.message?.content?.trim();
    if (text && availableCategories.includes(text)) return { category: text };
    return { category: undefined };
  },
  async parseReceipt({ base64Image, availableCategories }) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return { amount: undefined, description: undefined, category: undefined };
    const body = {
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: `Extraia total, nome do estabelecimento e categoria (${availableCategories.join(', ')}). Responda JSON {amount, description, category}.` },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
          ],
        },
      ],
      max_tokens: 200,
      temperature: 0.2,
    };
    const res = await withTimeout(
      fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      })
    );
    if (!res.ok) throw new Error(`openai parse ${res.status}`);
    const json = await res.json();
    const text = json?.choices?.[0]?.message?.content;
    try {
      const parsed = JSON.parse(text);
      if (parsed.category && !availableCategories.includes(parsed.category)) {
        parsed.category = undefined;
      }
      return parsed;
    } catch (err) {
      return { amount: undefined, description: undefined, category: undefined };
    }
  },
  async generateInsight(input: InsightInput) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return { insight: 'Provider não configurado (sem OPENAI_API_KEY).' };
    const summary = (input.transactions || []).slice(0, 20).map(t => `${t.description}:${t.amount}`).join(', ');
    const prompt = `Renda mensal: ${input.income || 0}. Transações: ${summary}. Dê um insight em português (1 frase) sobre equilíbrio dívidas x custo de vida.`;
    const body = {
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 60,
    };
    const res = await withTimeout(
      fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      })
    );
    if (!res.ok) throw new Error(`openai insight ${res.status}`);
    const json = await res.json();
    const text = json?.choices?.[0]?.message?.content || 'Insight indisponível.';
    return { insight: text };
  },
};

const getProvider = (): AIProvider => {
  const provider = process.env.AI_PROVIDER || 'none';
  switch (provider) {
    case 'openai':
      return openaiProvider;
    case 'none':
    default:
      return noneProvider;
  }
};

export const provider = getProvider();
