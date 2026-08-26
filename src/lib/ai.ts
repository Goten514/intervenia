import { ai } from './api';

export async function generateIntervention(params: {
  age: string;
  problematique: string;
  contexte?: string;
  objectif?: string;
  type?: string;
}): Promise<{ success: boolean; intervention?: any; error?: string }> {
  try {
    const res = await ai.generate(params);
    return { success: true, intervention: res.intervention };
  } catch (err: any) {
    return { success: false, error: err.message || 'Erreur réseau' };
  }
}