// ==========================================
// SUPABASE CONFIGURATION
// ==========================================
const SUPABASE_URL = 'https://lpgcnhycveliaxnkwgig.supabase.co';
const SUPABASE_KEY = 'sb_publishable_J42fuJ5ITrrRfgJ00JOS5g_U-GNXJmF';

// Initialisation du client Supabase (sauvegardé globalement pour éviter les conflits)
window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
