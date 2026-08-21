// ==========================================================================
// ATLAS CAPITAL — PANEL ADMIN
// ==========================================================================
document.addEventListener('DOMContentLoaded', async () => {

    const formatFCFA = (amount) => new Intl.NumberFormat('fr-FR').format(Math.round(amount || 0)) + ' FCFA';
    const formatDate = (d) => d ? new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

    window.showToast = (message, type = 'info') => {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<div>${message}</div>`;
        container.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 4000);
    };

    const openModal = (id) => document.getElementById(id).classList.add('open');
    const closeModal = (id) => document.getElementById(id).classList.remove('open');
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
        btn.addEventListener('click', () => closeModal(btn.getAttribute('data-close-modal')));
    });
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('open'); });
    });

    // ----------------------------------------------------------------
    // 1. Vérification d'accès admin
    // ----------------------------------------------------------------
    if (!window.supabaseClient) { window.location.href = 'index.html'; return; }

    const { data: sessionData } = await window.supabaseClient.auth.getSession();
    const session = sessionData && sessionData.session;
    if (!session) { window.location.href = 'index.html'; return; }

    const authUser = session.user;
    const { data: profile, error: profileError } = await window.supabaseClient
        .from('profiles').select('*').eq('id', authUser.id).single();

    if (profileError || !profile || !profile.is_admin) {
        document.getElementById('admin-gate').innerHTML = "<p>Accès réservé aux administrateurs. Redirection…</p>";
        setTimeout(() => window.location.href = 'dashboard.html', 1500);
        return;
    }

    document.getElementById('admin-gate').style.display = 'none';
    document.getElementById('admin-app').style.display = 'flex';
    document.querySelectorAll('.user-name').forEach(el => el.textContent = profile.full_name || authUser.email);

    document.getElementById('admin-logout-btn').addEventListener('click', async () => {
        await window.supabaseClient.auth.signOut();
        window.location.href = 'index.html';
    });

    // ----------------------------------------------------------------
    // 2. Navigation latérale
    // ----------------------------------------------------------------
    const navItems = document.querySelectorAll('.admin-nav-item');
    const views = document.querySelectorAll('.admin-view');
    const titleMap = { apercu: 'Aperçu', produits: 'Produits', codespromo: 'Codes promo', depots: 'Dépôts', retraits: 'Retraits', utilisateurs: 'Utilisateurs', parametres: 'Paramètres' };

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const target = item.getAttribute('data-target');
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            views.forEach(v => v.classList.remove('active'));
            document.getElementById('view-' + target).classList.add('active');
            document.getElementById('admin-view-title').textContent = titleMap[target] || '';
            if (target === 'apercu') loadStats();
            if (target === 'produits') loadProducts();
            if (target === 'codespromo') loadPromoCodes();
            if (target === 'depots') loadRequests('deposits', currentDepositStatus);
            if (target === 'retraits') loadRequests('withdrawals', currentWithdrawalStatus);
            if (target === 'utilisateurs') loadUsers();
            if (target === 'parametres') { loadSettings(); loadPaymentSettings(); }
        });
    });

    // ----------------------------------------------------------------
    // 3. Aperçu / statistiques
    // ----------------------------------------------------------------
    async function loadStats() {
        const { data, error } = await window.supabaseClient.rpc('admin_get_stats');
        if (error) { window.showToast("Impossible de charger les statistiques.", 'error'); return; }
        document.getElementById('stat-total-users').textContent = data.total_users;
        document.getElementById('stat-total-deposits').textContent = formatFCFA(data.total_deposits_validated);
        document.getElementById('stat-total-withdrawals').textContent = formatFCFA(data.total_withdrawals_validated);
        document.getElementById('stat-pending-deposits').textContent = `${data.deposits_pending_count} (${formatFCFA(data.deposits_pending_amount)})`;
        document.getElementById('stat-pending-withdrawals').textContent = `${data.withdrawals_pending_count} (${formatFCFA(data.withdrawals_pending_amount)})`;
    }

    // ----------------------------------------------------------------
    // 4. Produits
    // ----------------------------------------------------------------
    const productForm = document.getElementById('product-form');
    const productIdInput = document.getElementById('product-id');
    const productNameInput = document.getElementById('product-name');
    const productCategoryInput = document.getElementById('product-category');
    const productPriceInput = document.getElementById('product-price');
    const productRateInput = document.getElementById('product-rate');
    const productDurationInput = document.getElementById('product-duration');
    const productImageInput = document.getElementById('product-image');
    const productImagePreview = document.getElementById('product-image-preview');
    const productDailyGainPreview = document.getElementById('product-daily-gain-preview');
    const productSubmitBtn = document.getElementById('product-submit-btn');
    const productCancelEditBtn = document.getElementById('product-cancel-edit');
    const productFormTitle = document.getElementById('product-form-title');

    let selectedImageFile = null;
    let editingImageUrl = null;

    productImageInput.addEventListener('change', () => {
        selectedImageFile = productImageInput.files[0] || null;
        if (selectedImageFile) {
            productImagePreview.src = URL.createObjectURL(selectedImageFile);
            productImagePreview.style.display = 'block';
        }
    });

    const updateDailyGainPreview = () => {
        const price = Number(productPriceInput.value) || 0;
        const rate = Number(productRateInput.value) || 0;
        productDailyGainPreview.textContent = formatFCFA(price * rate / 100) + ' / jour';
    };
    productPriceInput.addEventListener('input', updateDailyGainPreview);
    productRateInput.addEventListener('input', updateDailyGainPreview);

    const resetProductForm = () => {
        productForm.reset();
        productIdInput.value = '';
        selectedImageFile = null;
        editingImageUrl = null;
        productImagePreview.style.display = 'none';
        productDailyGainPreview.textContent = '—';
        productSubmitBtn.textContent = 'Ajouter le produit';
        productFormTitle.textContent = 'Ajouter un produit';
        productCancelEditBtn.style.display = 'none';
    };
    productCancelEditBtn.addEventListener('click', resetProductForm);

    async function uploadProductImage(file) {
        const ext = file.name.split('.').pop();
        const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error } = await window.supabaseClient.storage.from('product-images').upload(path, file);
        if (error) throw error;
        const { data } = window.supabaseClient.storage.from('product-images').getPublicUrl(path);
        return data.publicUrl;
    }

    productForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        productSubmitBtn.disabled = true;
        const originalText = productSubmitBtn.textContent;
        productSubmitBtn.textContent = 'Enregistrement…';
        try {
            let imageUrl = editingImageUrl;
            if (selectedImageFile) {
                imageUrl = await uploadProductImage(selectedImageFile);
            }
            const { error } = await window.supabaseClient.rpc('admin_upsert_product', {
                p_id: productIdInput.value || null,
                p_name: productNameInput.value.trim(),
                p_category: productCategoryInput.value,
                p_price: Number(productPriceInput.value),
                p_daily_rate: Number(productRateInput.value),
                p_duration_days: Number(productDurationInput.value),
                p_image_url: imageUrl,
                p_sort_order: 0,
                p_is_active: true
            });
            if (error) throw error;
            window.showToast(productIdInput.value ? 'Produit modifié !' : 'Produit ajouté !', 'success');
            resetProductForm();
            loadProducts();
        } catch (err) {
            window.showToast("Erreur : " + err.message, 'error');
        } finally {
            productSubmitBtn.disabled = false;
            productSubmitBtn.textContent = originalText;
        }
    });

    async function loadProducts() {
        const tbody = document.getElementById('products-tbody');
        const { data, error } = await window.supabaseClient.from('investment_products').select('*').order('category').order('sort_order');
        if (error) { tbody.innerHTML = `<tr><td colspan="8">Erreur de chargement.</td></tr>`; return; }
        if (!data.length) { tbody.innerHTML = `<tr><td colspan="8">Aucun produit pour le moment.</td></tr>`; return; }
        tbody.innerHTML = data.map(p => `
            <tr>
                <td>${p.image_url ? `<img src="${p.image_url}" class="admin-table-thumb">` : '—'}</td>
                <td>${p.name}</td>
                <td>${p.category}</td>
                <td>${formatFCFA(p.price)}</td>
                <td>${p.daily_rate}%</td>
                <td>${p.duration_days} j</td>
                <td><span class="admin-badge ${p.is_active ? 'active' : 'blocked'}">${p.is_active ? 'Actif' : 'Désactivé'}</span></td>
                <td>
                    <button class="admin-btn-sm admin-btn-edit" data-edit="${p.id}">Modifier</button>
                    ${p.is_active ? `<button class="admin-btn-sm admin-btn-reject" data-deactivate="${p.id}">Désactiver</button>` : ''}
                </td>
            </tr>`).join('');

        tbody.querySelectorAll('[data-edit]').forEach(btn => {
            btn.addEventListener('click', () => {
                const p = data.find(x => x.id === btn.getAttribute('data-edit'));
                if (!p) return;
                productIdInput.value = p.id;
                productNameInput.value = p.name;
                productCategoryInput.value = p.category;
                productPriceInput.value = p.price;
                productRateInput.value = p.daily_rate;
                productDurationInput.value = p.duration_days;
                editingImageUrl = p.image_url;
                if (p.image_url) { productImagePreview.src = p.image_url; productImagePreview.style.display = 'block'; }
                updateDailyGainPreview();
                productFormTitle.textContent = 'Modifier le produit';
                productSubmitBtn.textContent = 'Enregistrer les modifications';
                productCancelEditBtn.style.display = 'inline-block';
                window.scrollTo(0, 0);
            });
        });
        tbody.querySelectorAll('[data-deactivate]').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!confirm('Désactiver ce produit ? Il ne sera plus visible pour les utilisateurs.')) return;
                const { error } = await window.supabaseClient.rpc('admin_delete_product', { p_id: btn.getAttribute('data-deactivate') });
                if (error) { window.showToast("Erreur : " + error.message, 'error'); return; }
                window.showToast('Produit désactivé.', 'success');
                loadProducts();
            });
        });
    }

    // ----------------------------------------------------------------
    // 4bis. Codes promo
    // ----------------------------------------------------------------
    const promoForm = document.getElementById('promo-generate-form');
    const promoMaxAmountInput = document.getElementById('promo-max-amount');
    const promoCountInput = document.getElementById('promo-count');
    const promoGenerateBtn = document.getElementById('promo-generate-btn');
    const promoTbody = document.getElementById('promo-tbody');
    const promoSummary = document.getElementById('promo-summary');

    async function loadPromoCodes() {
        promoTbody.innerHTML = `<tr><td colspan="7">Chargement…</td></tr>`;
        const { data, error } = await window.supabaseClient
            .from('promo_codes')
            .select('*, used_by_profile:profiles!promo_codes_used_by_fkey(full_name, email)')
            .order('created_at', { ascending: false });

        if (error) {
            promoTbody.innerHTML = `<tr><td colspan="7">Erreur de chargement.</td></tr>`;
            return;
        }

        const total = data.length;
        const activeCount = data.filter(c => !c.is_used).length;
        promoSummary.textContent = `${activeCount} code(s) actif(s) non utilisé(s) • ${total} au total`;

        if (!total) {
            promoTbody.innerHTML = `<tr><td colspan="7">Aucun code généré pour le moment.</td></tr>`;
            return;
        }

        promoTbody.innerHTML = data.map(c => `
            <tr>
                <td><code>${c.code}</code></td>
                <td>${formatFCFA(c.amount)}</td>
                <td>${formatFCFA(c.max_amount)}</td>
                <td><span class="admin-badge ${c.is_used ? 'blocked' : 'active'}">${c.is_used ? 'Utilisé' : 'Actif'}</span></td>
                <td>${c.used_by_profile ? (c.used_by_profile.full_name || c.used_by_profile.email) : '—'}</td>
                <td>${formatDate(c.created_at)}</td>
                <td>
                    <button class="admin-btn-sm admin-btn-edit" data-copy-code="${c.code}">Copier</button>
                </td>
            </tr>`).join('');

        promoTbody.querySelectorAll('[data-copy-code]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const code = btn.getAttribute('data-copy-code');
                try {
                    await navigator.clipboard.writeText(code);
                    window.showToast('Code copié : ' + code, 'success');
                } catch (err) {
                    window.showToast('Impossible de copier le code.', 'error');
                }
            });
        });
    }

    if (promoForm) {
        promoForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const maxAmount = Number(promoMaxAmountInput.value);
            const count = Number(promoCountInput.value);
            if (!maxAmount || maxAmount <= 0) {
                window.showToast('Le plafond du gain doit être supérieur à 0.', 'error');
                return;
            }
            if (!count || count < 1) {
                window.showToast('Le nombre de codes doit être au moins 1.', 'error');
                return;
            }
            promoGenerateBtn.disabled = true;
            const originalText = promoGenerateBtn.textContent;
            promoGenerateBtn.textContent = 'Génération…';
            try {
                const { data, error } = await window.supabaseClient.rpc('admin_generate_promo_codes', {
                    p_max_amount: maxAmount,
                    p_count: count
                });
                if (error) throw error;
                window.showToast(`${count} code(s) généré(s) !`, 'success');
                await loadPromoCodes();
            } catch (err) {
                window.showToast('Erreur : ' + err.message, 'error');
            } finally {
                promoGenerateBtn.disabled = false;
                promoGenerateBtn.textContent = originalText;
            }
        });
    }

    // ----------------------------------------------------------------
    // 5. Dépôts & Retraits
    // ----------------------------------------------------------------
    let currentDepositStatus = 'pending';
    let currentWithdrawalStatus = 'pending';
    let usersCache = null;

    async function getUsersMap() {
        if (usersCache) return usersCache;
        const { data } = await window.supabaseClient.from('profiles').select('id, full_name, email');
        usersCache = {};
        (data || []).forEach(u => usersCache[u.id] = u);
        return usersCache;
    }

    document.querySelectorAll('.admin-subnav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const list = btn.getAttribute('data-list');
            const status = btn.getAttribute('data-status');
            const group = btn.closest('.admin-subnav');
            group.querySelectorAll('.admin-subnav-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            if (list === 'deposits') { currentDepositStatus = status; loadRequests('deposits', status); }
            else { currentWithdrawalStatus = status; loadRequests('withdrawals', status); }
        });
    });

    async function loadRequests(kind, status) {
        const table = kind === 'deposits' ? 'deposit_requests' : 'withdrawal_requests';
        const tbodyId = kind === 'deposits' ? 'deposits-tbody' : 'withdrawals-tbody';
        const tbody = document.getElementById(tbodyId);
        const colspan = kind === 'deposits' ? 7 : 8;
        tbody.innerHTML = `<tr><td colspan="${colspan}">Chargement…</td></tr>`;

        const [{ data, error }, usersMap] = await Promise.all([
            window.supabaseClient.from(table).select('*').eq('status', status).order('created_at', { ascending: false }),
            getUsersMap()
        ]);
        if (error) { tbody.innerHTML = `<tr><td colspan="${colspan}">Erreur de chargement.</td></tr>`; return; }
        if (!data.length) { tbody.innerHTML = `<tr><td colspan="${colspan}">Aucune demande.</td></tr>`; return; }

        tbody.innerHTML = data.map(r => {
            const u = usersMap[r.user_id] || {};
            const actions = status === 'pending' ? `
                <button class="admin-btn-sm admin-btn-approve" data-approve="${r.id}">Valider</button>
                <button class="admin-btn-sm admin-btn-reject" data-reject="${r.id}">Rejeter</button>` : '—';
            if (kind === 'deposits') {
                return `<tr>
                    <td>${formatDate(r.created_at)}</td>
                    <td>${u.full_name || u.email || r.user_id}</td>
                    <td>${formatFCFA(r.amount)}</td>
                    <td>${r.method_name || '—'}</td>
                    <td>${r.proof_url ? `<span class="admin-proof-link" data-img="${r.proof_url}">Voir la capture</span>` : '—'}</td>
                    <td><span class="admin-badge ${status}">${status}</span></td>
                    <td>${actions}</td>
                </tr>`;
            }
            return `<tr>
                <td>${formatDate(r.created_at)}</td>
                <td>${u.full_name || u.email || r.user_id}</td>
                <td>${formatFCFA(r.amount)}</td>
                <td>${r.method_name || '—'}</td>
                <td>${r.destination || '—'}</td>
                <td>${r.recipient_name || '—'}</td>
                <td><span class="admin-badge ${status}">${status}</span></td>
                <td>${actions}</td>
            </tr>`;
        }).join('');

        tbody.querySelectorAll('[data-img]').forEach(el => {
            el.addEventListener('click', () => {
                document.getElementById('image-view-full').src = el.getAttribute('data-img');
                openModal('image-view-modal');
            });
        });
        tbody.querySelectorAll('[data-approve]').forEach(btn => {
            btn.addEventListener('click', () => reviewRequest(kind, btn.getAttribute('data-approve'), true));
        });
        tbody.querySelectorAll('[data-reject]').forEach(btn => {
            btn.addEventListener('click', () => reviewRequest(kind, btn.getAttribute('data-reject'), false));
        });
    }

    async function reviewRequest(kind, id, approve) {
        if (!confirm(approve ? 'Valider cette demande ?' : 'Rejeter cette demande ?')) return;
        const rpcName = kind === 'deposits' ? 'admin_review_deposit' : 'admin_review_withdrawal';
        const { error } = await window.supabaseClient.rpc(rpcName, { p_request_id: id, p_approve: approve, p_note: null });
        if (error) { window.showToast("Erreur : " + error.message, 'error'); return; }
        window.showToast(approve ? 'Demande validée.' : 'Demande rejetée.', 'success');
        loadRequests(kind, kind === 'deposits' ? currentDepositStatus : currentWithdrawalStatus);
        loadStats();
    }

    // ----------------------------------------------------------------
    // 6. Utilisateurs
    // ----------------------------------------------------------------
    let allUsersData = [];

    async function loadUsers() {
        const tbody = document.getElementById('users-tbody');
        tbody.innerHTML = `<tr><td colspan="6">Chargement…</td></tr>`;
        const [{ data: profiles, error }, { data: wallets }] = await Promise.all([
            window.supabaseClient.from('profiles').select('*').order('created_at', { ascending: false }),
            window.supabaseClient.from('wallets').select('user_id, balance')
        ]);
        if (error) { tbody.innerHTML = `<tr><td colspan="6">Erreur de chargement.</td></tr>`; return; }
        const walletMap = {};
        (wallets || []).forEach(w => walletMap[w.user_id] = w.balance);
        allUsersData = (profiles || []).map(p => ({ ...p, balance: walletMap[p.id] || 0 }));
        renderUsersTable(allUsersData);
    }

    function renderUsersTable(list) {
        const tbody = document.getElementById('users-tbody');
        if (!list.length) { tbody.innerHTML = `<tr><td colspan="6">Aucun utilisateur.</td></tr>`; return; }
        tbody.innerHTML = list.map(u => `
            <tr>
                <td>${u.full_name || '—'}</td>
                <td>${u.email || '—'}</td>
                <td>${formatFCFA(u.balance)}</td>
                <td><span class="admin-badge ${u.is_blocked ? 'blocked' : 'active'}">${u.is_blocked ? 'Bloqué' : 'Actif'}</span>${u.is_admin ? ' <span class="admin-badge active">Admin</span>' : ''}</td>
                <td>${formatDate(u.created_at)}</td>
                <td>
                    <button class="admin-btn-sm admin-btn-view" data-view="${u.id}">Voir</button>
                    ${u.is_super_admin ? '' : (u.is_blocked
                        ? `<button class="admin-btn-sm admin-btn-unblock" data-unblock="${u.id}">Réactiver</button>`
                        : `<button class="admin-btn-sm admin-btn-block" data-block="${u.id}">Bloquer</button>`)}
                </td>
            </tr>`).join('');

        tbody.querySelectorAll('[data-block]').forEach(btn => btn.addEventListener('click', () => setBlocked(btn.getAttribute('data-block'), true)));
        tbody.querySelectorAll('[data-unblock]').forEach(btn => btn.addEventListener('click', () => setBlocked(btn.getAttribute('data-unblock'), false)));
        tbody.querySelectorAll('[data-view]').forEach(btn => btn.addEventListener('click', () => viewUserDetail(btn.getAttribute('data-view'))));
    }

    async function setBlocked(userId, blocked) {
        if (!confirm(blocked ? 'Bloquer cet utilisateur ?' : 'Réactiver cet utilisateur ?')) return;
        const { error } = await window.supabaseClient.rpc('admin_set_user_blocked', { p_user_id: userId, p_blocked: blocked });
        if (error) { window.showToast("Erreur : " + error.message, 'error'); return; }
        window.showToast(blocked ? 'Utilisateur bloqué.' : 'Utilisateur réactivé.', 'success');
        loadUsers();
    }

    document.getElementById('user-search').addEventListener('input', (e) => {
        const q = e.target.value.trim().toLowerCase();
        renderUsersTable(allUsersData.filter(u =>
            (u.full_name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q)
        ));
    });

    async function viewUserDetail(userId) {
        const user = allUsersData.find(u => u.id === userId);
        if (!user) return;
        document.getElementById('user-detail-name').textContent = user.full_name || user.email;
        document.getElementById('user-detail-summary').innerHTML = `
            <div>Email<strong>${user.email || '—'}</strong></div>
            <div>Solde<strong>${formatFCFA(user.balance)}</strong></div>
            <div>Statut<strong>${user.is_blocked ? 'Bloqué' : 'Actif'}</strong></div>
            <div>Inscrit le<strong>${formatDate(user.created_at)}</strong></div>`;

        const [{ data: deposits }, { data: withdrawals }] = await Promise.all([
            window.supabaseClient.from('deposit_requests').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
            window.supabaseClient.from('withdrawal_requests').select('*').eq('user_id', userId).order('created_at', { ascending: false })
        ]);

        const depositsBody = document.getElementById('user-detail-deposits');
        depositsBody.innerHTML = (deposits && deposits.length) ? deposits.map(d => `
            <tr><td>${formatDate(d.created_at)}</td><td>${formatFCFA(d.amount)}</td><td>${d.method_name || '—'}</td><td><span class="admin-badge ${d.status}">${d.status}</span></td></tr>
        `).join('') : `<tr><td>Aucun dépôt.</td></tr>`;

        const withdrawalsBody = document.getElementById('user-detail-withdrawals');
        withdrawalsBody.innerHTML = (withdrawals && withdrawals.length) ? withdrawals.map(w => `
            <tr><td>${formatDate(w.created_at)}</td><td>${formatFCFA(w.amount)}</td><td>${w.method_name || '—'}</td><td>${w.recipient_name || '—'}</td><td><span class="admin-badge ${w.status}">${w.status}</span></td></tr>
        `).join('') : `<tr><td>Aucun retrait.</td></tr>`;

        openModal('user-detail-modal');
    }

    // ----------------------------------------------------------------
    // 7. Paramètres généraux
    // ----------------------------------------------------------------
    const settingsForm = document.getElementById('settings-form');
    const settingsSubmitBtn = document.getElementById('settings-submit-btn');

    async function loadSettings() {
        settingsSubmitBtn.disabled = true;
        const { data, error } = await window.supabaseClient
            .from('site_settings').select('*').eq('id', 1).single();

        if (error) {
            window.showToast("Impossible de charger les paramètres.", 'error');
            settingsSubmitBtn.disabled = false;
            return;
        }

        document.getElementById('setting-site-name').value = data.site_name || '';
        document.getElementById('setting-support-email').value = data.support_email || '';
        document.getElementById('setting-support-whatsapp').value = data.support_whatsapp || '';
        document.getElementById('setting-referral-rate').value = data.referral_rate ?? '';
        document.getElementById('setting-min-deposit').value = data.min_deposit ?? '';
        document.getElementById('setting-min-withdrawal').value = data.min_withdrawal ?? '';
        document.getElementById('setting-maintenance-mode').checked = !!data.maintenance_mode;
        settingsSubmitBtn.disabled = false;
    }

    settingsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        settingsSubmitBtn.disabled = true;
        settingsSubmitBtn.textContent = 'Enregistrement…';

        const payload = {
            id: 1,
            site_name: document.getElementById('setting-site-name').value.trim(),
            support_email: document.getElementById('setting-support-email').value.trim(),
            support_whatsapp: document.getElementById('setting-support-whatsapp').value.trim(),
            referral_rate: Number(document.getElementById('setting-referral-rate').value) || 0,
            min_deposit: Number(document.getElementById('setting-min-deposit').value) || 0,
            min_withdrawal: Number(document.getElementById('setting-min-withdrawal').value) || 0,
            maintenance_mode: document.getElementById('setting-maintenance-mode').checked
        };

        const { error } = await window.supabaseClient.from('site_settings').upsert(payload);

        settingsSubmitBtn.disabled = false;
        settingsSubmitBtn.textContent = 'Enregistrer les paramètres';

        if (error) { window.showToast("Erreur : " + error.message, 'error'); return; }
        window.showToast('Paramètres enregistrés.', 'success');
    });

    // ----------------------------------------------------------------
    // 7bis. Moyens de paiement (retraits + dépôts)
    // ----------------------------------------------------------------
    const paymentSettingsForm = document.getElementById('payment-settings-form');
    const paymentSettingsSubmitBtn = document.getElementById('payment-settings-submit-btn');

    // Convertit une valeur texte multi-lignes (venant de la BDD, tableau ou chaîne
    // séparée par des virgules/retours à la ligne) en texte "une valeur par ligne".
    function linesFromValue(value) {
        if (Array.isArray(value)) return value.join('\n');
        if (typeof value === 'string') {
            try {
                const parsed = JSON.parse(value);
                if (Array.isArray(parsed)) return parsed.join('\n');
            } catch (e) { /* pas du JSON, on garde la chaîne telle quelle */ }
            return value;
        }
        return '';
    }

    // Convertit un textarea "une valeur par ligne" en tableau de chaînes nettoyées.
    function linesToArray(text) {
        return text.split('\n').map(l => l.trim()).filter(Boolean);
    }

    async function loadPaymentSettings() {
        paymentSettingsSubmitBtn.disabled = true;
        const { data, error } = await window.supabaseClient
            .from('site_settings').select('*').eq('id', 1).single();

        if (error) {
            window.showToast("Impossible de charger les moyens de paiement.", 'error');
            paymentSettingsSubmitBtn.disabled = false;
            return;
        }

        document.getElementById('setting-withdrawal-methods').value = linesFromValue(data.withdrawal_methods);
        document.getElementById('setting-deposit-usdt-address').value = data.deposit_usdt_address || '';
        document.getElementById('setting-deposit-amounts').value = linesFromValue(data.deposit_amounts);
        paymentSettingsSubmitBtn.disabled = false;
    }

    paymentSettingsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        paymentSettingsSubmitBtn.disabled = true;
        paymentSettingsSubmitBtn.textContent = 'Enregistrement…';

        const payload = {
            id: 1,
            withdrawal_methods: linesToArray(document.getElementById('setting-withdrawal-methods').value),
            deposit_usdt_address: document.getElementById('setting-deposit-usdt-address').value.trim(),
            deposit_amounts: linesToArray(document.getElementById('setting-deposit-amounts').value).map(Number).filter(n => !isNaN(n))
        };

        const { error } = await window.supabaseClient.from('site_settings').upsert(payload);

        paymentSettingsSubmitBtn.disabled = false;
        paymentSettingsSubmitBtn.textContent = 'Enregistrer les moyens de paiement';

        if (error) { window.showToast("Erreur : " + error.message, 'error'); return; }
        window.showToast('Moyens de paiement enregistrés.', 'success');
    });

    // ----------------------------------------------------------------
    // 8. Chargement initial
    // ----------------------------------------------------------------
    loadStats();
});
