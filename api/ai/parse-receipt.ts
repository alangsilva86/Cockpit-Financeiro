import { provider } from '../../server/ai/provider.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { base64Image, availableCategories } = req.body as { base64Image: string; availableCategories: string[] };
    const result = await provider.parseReceipt({ base64Image, availableCategories: availableCategories || [] });
    return res.status(200).json(result);
  } catch (error) {
    console.error('AI parse error', error);
    return res.status(500).json({ error: 'parse failed' });
  }
}
