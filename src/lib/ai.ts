const ADEMI_AI_KEY = 'adm_live_NL9FxfwZsatldZ6feQwM1eIRFcYWXI4_';
const AI_BASE_URL = 'https://ademi.ai/api/ai/v1';

interface Intervention {
  titre: string;
  duree?: string;
  materiel?: string[];
  objectifs?: string[];
  etapes?: { numero: number; titre: string; description: string }[];
  conseils_intervenant?: string[];
  adaptations?: string[];
  indicateurs_succes?: string[];
  raw?: string;
}

interface GenerateResult {
  success: boolean;
  intervention?: Intervention;
  error?: string;
}

const SYSTEM_PROMPT = `Tu es un assistant clinique spécialisé en psychoéducation et intervention auprès des jeunes. Tu génères des outils d'intervention personnalisés, structurés et prêts à l'usage.

Réponds UNIQUEMENT avec un objet JSON valide (sans markdown, sans texte avant/après) au format suivant :
{
  "titre": "Titre de l'outil",
  "duree": "Durée estimée (ex: 30-45 minutes)",
  "materiel": ["Matériel nécessaire 1", "Matériel nécessaire 2"],
  "objectifs": ["Objectif 1", "Objectif 2", "Objectif 3"],
  "etapes": [
    { "numero": 1, "titre": "Titre de l'étape", "description": "Description détaillée de l'étape" }
  ],
  "conseils_intervenant": ["Conseil 1", "Conseil 2"],
  "adaptations": ["Adaptation possible 1", "Adaptation possible 2"],
  "indicateurs_succes": ["Indicateur 1", "Indicateur 2"]
}

Assure-toi que chaque outil soit :
- Adapté à l'âge et au niveau de développement
- Basé sur des approches evidence-based (TCC, TAC, approche ludique, etc.)
- Structuré en étapes claires et réalisables
- Pratique et directement utilisable par un intervenant`;

export async function generateIntervention(params: {
  age: string;
  problematique: string;
  contexte?: string;
  objectif?: string;
  type?: string;
}): Promise<GenerateResult> {
  const userPrompt = [
    `Âge : ${params.age} ans`,
    `Problématique : ${params.problematique}`,
    params.objectif ? `Objectif clinique : ${params.objectif}` : '',
    params.type ? `Type d'outil souhaité : ${params.type}` : '',
    params.contexte ? `Contexte : ${params.contexte}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const res = await fetch(`${AI_BASE_URL}/chat/completions`, {
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

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { success: false, error: `Erreur API (${res.status}): ${body}` };
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;

    if (!content) {
      return { success: false, error: 'Réponse vide de l\'IA' };
    }

    const cleaned = content
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    const intervention = JSON.parse(cleaned) as Intervention;

    if (!intervention.titre || !intervention.etapes) {
      return { success: false, error: 'Format de réponse invalide' };
    }

    return { success: true, intervention };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erreur réseau' };
  }
}