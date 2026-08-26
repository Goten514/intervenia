// Ce fichier est conservé pour compatibilité : tout le site utilise désormais
// la base de données LOCALE (localStorage) définie dans local-db.ts.
// Aucun appel réseau n'est effectué.

export {
  supabase,
  probeBackendReachable,
  probeRestTable,
  type RestProbeResult,
} from '@/lib/local-db';
