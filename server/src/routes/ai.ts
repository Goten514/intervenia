import { Router, Request, Response } from 'express';
import { logAudit } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const ADEMI_AI_KEY = process.env.ADEMI_AI_KEY || '';
const AI_BASE_URL = 'https://ademi.ai/api/ai/v1';

function anonymize(params: { age: string; problematique: string; contexte?: string; objectif?: string; type?: string }) {
  const result: Record<string, string> = { ...params };
  const age = parseInt(params.age);
  if (age <= 5) result.age = 'préscolaire (0-5 ans)';
  else if (age <= 11) result.age = 'primaire (6-11 ans)';
  else if (age <= 14) result.age = 'secondaire 1er cycle (12-14 ans)';
  else if (age <= 17) result.age = 'secondaire 2e cycle (15-17 ans)';
  else result.age = 'adulte (18+)';
  return result;
}

const SYSTEM_PROMPT = `Tu es un assistant clinique spécialisé en psychoéducation au Québec. Tu génères des outils d'intervention personnalisés et conformes au Programme de formation de l'école québécoise.

Réponds UNIQUEMENT avec un objet JSON valide (sans markdown, sans texte avant/après) au format :
{
  "titre": "...",
  "duree": "...",
  "materiel": ["..."],
  "objectifs": ["..."],
  "etapes": [{ "numero": 1, "titre": "...", "description": "..." }],
  "conseils_intervenant": ["..."],
  "adaptations": ["..."],
  "indicateurs_succes": ["..."]
}

Assure-toi que chaque outil soit adapté au niveau de développement, basé sur des approches evidence-based, structuré en étapes claires et directement utilisable par un intervenant.`;

router.post('/generate', async (req: Request, res: Response) => {
  try {
    const { age, problematique, contexte, objectif, type } = req.body;
    if (!age || !problematique) {
      res.status(400).json({ error: 'Âge et problématique requis' });
      return;
    }

    const anonymized = anonymize({ age, problematique, contexte, objectif, type });
    const userPrompt = [
      `Niveau : ${anonymized.age}`,
      `Problématique : ${anonymized.problematique}`,
      anonymized.objectif ? `Objectif clinique : ${anonymized.objectif}` : '',
      anonymized.type ? `Type d'outil : ${anonymized.type}` : '',
      anonymized.contexte ? `Contexte : ${anonymized.contexte}` : '',
    ].filter(Boolean).join('\n');

    const aiRes = await fetch(`${AI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ADEMI_AI_KEY}`,
      },
      body: JSON.stringify({
        model: 'qwen/qwen3-8b',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 4096,
      }),
    });

    if (!aiRes.ok) {
      const body = await aiRes.text().catch(() => '');
      res.status(502).json({ error: `Erreur API IA (${aiRes.status})` });
      return;
    }

    const data: any = await aiRes.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      res.status(502).json({ error: 'Réponse vide de l\'IA' });
      return;
    }

    const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    let intervention: any;
    try { intervention = JSON.parse(cleaned); } catch {
      res.status(502).json({ error: 'Format de réponse invalide' });
      return;
    }

    if (!intervention.titre || !intervention.etapes) {
      res.status(502).json({ error: 'Réponse incomplète' });
      return;
    }

    logAudit(req.user!.userId, 'generate', 'intervention', undefined, req.ip);
    res.json({ intervention });
  } catch (err: any) {
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

export default router;