// ==========================================
// SUPABASE CONFIGURATION
// ==========================================

// Filet de sécurité réseau : certains opérateurs/réseaux bloquent ou
// ralentissent fortement un CDN précis (ici jsdelivr) sans bloquer le
// reste du site (hébergé sur Vercel). Résultat côté utilisateur : "mon
// réseau fonctionne pourtant" alors que SEULE la librairie Supabase n'a
// pas pu se charger, bloquant connexion/inscription avec un message
// générique. Si la librairie n'est pas là, on bascule automatiquement
// sur un second CDN (unpkg, infrastructure différente de jsdelivr) via
// document.write PENDANT le chargement de la page, ce qui garde
// l'exécution des scripts suivants (dashboard.js / admin.js) bien
// synchrone et dans l'ordre, sans rien changer au comportement normal.
if (typeof window.supabase === 'undefined') {
    document.write('<script src="https://unpkg.com/@supabase/supabase-js@2"><\/script>');
}

const SUPABASE_URL = 'https://lpgcnhycveliaxnkwgig.supabase.co';
const SUPABASE_KEY = 'sb_publishable_J42fuJ5ITrrRfgJ00JOS5g_U-GNXJmF';

// Initialisation du client Supabase (sauvegardé globalement pour éviter les conflits)
if (typeof window.supabase !== 'undefined') {
    window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
} else {
    // Les deux CDN ont échoué (cas très rare) : on log clairement pour le
    // diagnostic, le reste du code gère déjà l'absence de supabaseClient
    // avec un message utilisateur ("Connexion au serveur impossible...").
    console.error('Atlas Capital : impossible de charger la librairie Supabase depuis les deux CDN (jsdelivr et unpkg).');
}
