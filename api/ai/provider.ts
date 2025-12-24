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

const getProvider = (): AIProvider => {
  const provider = process.env.AI_PROVIDER || 'none';
  switch (provider) {
    case 'none':
    default:
      return noneProvider;
  }
};

export const provider = getProvider();
