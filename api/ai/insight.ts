import { provider } from './provider';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const result = await provider.generateInsight(req.body);
    return res.status(200).json(result);
  } catch (error) {
    console.error('AI insight error', error);
    return res.status(500).json({ error: 'insight failed' });
  }
}
