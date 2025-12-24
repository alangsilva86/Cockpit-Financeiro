import { GoogleGenAI, Type } from "@google/genai";
import { Transaction, OperationType } from '../types';

// Explicitly separate for UI filtering
export const INCOME_CATEGORIES = [
  'Salário',
  'Rendimentos',
  'Vendas',
  'Reembolso',
  'Cashback',
  'Outros (Entrada)'
];

export const EXPENSE_CATEGORIES = [
  'Moradia',
  'Alimentação',
  'Transporte',
  'Saúde',
  'Lazer',
  'Educação',
  'Compras',
  'Assinaturas',
  'Dívida',
  'Taxas', // Juros, Multas
  'Investimento',
  'Outros'
];

// Combine for backward compatibility and initial state
export const INITIAL_CATEGORIES = [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES];

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
};

export const suggestCategory = async (description: string, availableCategories: string[]): Promise<string | null> => {
  const ai = getClient();
  if (!ai) return null;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Classify this transaction description: "${description}" into exactly one of these categories: ${availableCategories.join(', ')}. Return only the category name.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            category: { type: Type.STRING }
          }
        }
      }
    });
    
    const json = JSON.parse(response.text || '{}');
    // Validate that the returned category is actually in our list
    const category = json.category;
    if (availableCategories.includes(category)) {
      return category;
    }
    return 'Outros';
  } catch (error) {
    console.error("Gemini suggest error:", error);
    return null;
  }
};

export interface ReceiptData {
  amount: number | null;
  description: string | null;
  category: string | null;
}

export const parseReceiptImage = async (base64Image: string, availableCategories: string[]): Promise<ReceiptData | null> => {
  const ai = getClient();
  if (!ai) return null;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Image
            }
          },
          {
            text: `Analyze this receipt image. Extract the GRAND TOTAL amount (final value paid). Identify the merchant/establishment name for the description. Also classify into one of these categories: ${availableCategories.join(', ')}. Return JSON.`
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            amount: { type: Type.NUMBER, description: "Total value of the receipt" },
            description: { type: Type.STRING, description: "Merchant name" },
            category: { type: Type.STRING, description: "One of the provided categories" }
          }
        }
      }
    });

    const json = JSON.parse(response.text || '{}');
    
    // Validate category
    let category = json.category;
    if (!availableCategories.includes(category)) {
      category = 'Outros';
    }

    return {
      amount: json.amount || null,
      description: json.description || null,
      category: category || null
    };
  } catch (error) {
    console.error("Gemini receipt parsing error:", error);
    return null;
  }
};

export const generateFinancialInsight = async (transactions: Transaction[], income: number): Promise<string> => {
  const ai = getClient();
  if (!ai) return "Conecte sua API Key para insights.";

  const summary = transactions.slice(0, 20).map(t => `${t.type}: ${t.amount}`).join(', ');

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Based on this monthly income ${income} and these recent transaction samples: [${summary}], give me a 1-sentence brutal financial insight in Portuguese. Focus on debt vs life cost balance.`,
    });
    return response.text || "Sem insights no momento.";
  } catch (error) {
    console.error("Gemini insight error:", error);
    return "Erro ao gerar insight.";
  }
};