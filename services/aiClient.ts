export interface SuggestCategoryResponse {
  category?: string;
}

export interface ParseReceiptResponse {
  amount?: number;
  description?: string;
  category?: string;
}

const postJSON = async <T>(path: string, body: Record<string, unknown>): Promise<T | null> => {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return null;
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch (err) {
    console.warn('AI endpoint unavailable', err);
    return null;
  }
};

export const suggestCategory = async (description: string, availableCategories: string[]) => {
  const result = await postJSON<SuggestCategoryResponse>('/api/ai/suggest-category', { description, availableCategories });
  if (result?.category && availableCategories.includes(result.category)) return result.category;
  return null;
};

export const parseReceiptImage = async (base64Image: string, availableCategories: string[]) => {
  const result = await postJSON<ParseReceiptResponse>('/api/ai/parse-receipt', { base64Image, availableCategories });
  return result;
};

export const generateFinancialInsight = async (payload: unknown): Promise<string> => {
  const result = await postJSON<{ insight?: string }>('/api/ai/insight', payload as Record<string, unknown>);
  return result?.insight || 'IA indisponível.';
};
