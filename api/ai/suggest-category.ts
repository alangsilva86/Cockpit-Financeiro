import { provider } from './provider';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { description, availableCategories } = req.body as { description: string; availableCategories: string[] };
    const result = await provider.suggestCategory({ description, availableCategories: availableCategories || [] });
    return res.status(200).json(result);
  } catch (error) {
    console.error('AI suggest error', error);
    return res.status(500).json({ error: 'suggest failed' });
  }
}
