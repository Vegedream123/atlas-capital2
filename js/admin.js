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
    const titleMap = { apercu: 'Aperçu', produits: 'Produits', depots: 'Dépôts', retraits: 'Retraits', utilisateurs: 'Utilisateurs', parametres: 'Paramètres' };

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
            if (target === 'depots') loadRequests('deposits', currentDepositStatus);
            if (target === 'retraits') loadRequests('withdrawals', currentWithdrawalStatus);
            if (target === 'utilisateurs') loadUsers();
            if (target === 'parametres') { loadSettings(); loadPaymentLinks(); }
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
        tbody.innerHTML = `<tr><td colspan="7">Chargement…</td></tr>`;

        const [{ data, error }, usersMap] = await Promise.all([
            window.supabaseClient.from(table).select('*').eq('status', status).order('created_at', { ascending: false }),
            getUsersMap()
        ]);
        if (error) { tbody.innerHTML = `<tr><td colspan="7">Erreur de chargement.</td></tr>`; return; }
        if (!data.length) { tbody.innerHTML = `<tr><td colspan="7">Aucune demande.</td></tr>`; return; }

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
            <tr><td>${formatDate(w.created_at)}</td><td>${formatFCFA(w.amount)}</td><td>${w.method_name || '—'}</td><td><span class="admin-badge ${w.status}">${w.status}</span></td></tr>
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
    // 7bis. Liens de paiement par pays
    // ----------------------------------------------------------------
    const paymentLinksList = document.getElementById('payment-links-list');
    const countryBlockTemplate = document.getElementById('country-block-template');
    const numberBlockTemplate = document.getElementById('number-block-template');
    const addCountryBtn = document.getElementById('add-country-btn');
    const paymentLinksSaveBtn = document.getElementById('payment-links-save-btn');

    function updateAddNumberBtnState(numbersContainer) {
        const addBtn = numbersContainer.parentElement.querySelector('[data-add-number]');
        if (!addBtn) return;
        const count = numbersContainer.querySelectorAll('[data-number-block]').length;
        addBtn.disabled = count >= 2;
        addBtn.textContent = count >= 2 ? 'Maximum 2 numéros atteint' : '+ Ajouter un numéro';
    }

    function addNumberBlock(numbersContainer, data = {}) {
        if (numbersContainer.querySelectorAll('[data-number-block]').length >= 2) return;
        const node = numberBlockTemplate.content.firstElementChild.cloneNode(true);
        node.querySelector('[data-field="number"]').value = data.number || '';
        node.querySelector('[data-field="holder"]').value = data.holder || '';
        node.querySelector('[data-field="network"]').value = data.network || '';
        node.querySelector('[data-remove-number]').addEventListener('click', () => {
            node.remove();
            updateAddNumberBtnState(numbersContainer);
        });
        numbersContainer.appendChild(node);
        updateAddNumberBtnState(numbersContainer);
    }

    function addCountryBlock(data = {}) {
        const node = countryBlockTemplate.content.firstElementChild.cloneNode(true);
        node.querySelector('[data-field="country"]').value = data.country || '';
        node.querySelector('[data-field="link"]').value = data.link || '';
        const numbersContainer = node.querySelector('[data-numbers-list]');
        (data.numbers || []).slice(0, 2).forEach(n => addNumberBlock(numbersContainer, n));
        node.querySelector('[data-add-number]').addEventListener('click', () => addNumberBlock(numbersContainer));
        node.querySelector('[data-remove-country]').addEventListener('click', () => {
            if (confirm('Supprimer ce pays et ses liens de paiement ?')) node.remove();
        });
        updateAddNumberBtnState(numbersContainer);
        paymentLinksList.appendChild(node);
    }

    addCountryBtn.addEventListener('click', () => addCountryBlock());

    function collectPaymentLinksData() {
        return Array.from(paymentLinksList.querySelectorAll('[data-country-block]')).map(block => ({
            country: block.querySelector('[data-field="country"]').value.trim(),
            link: block.querySelector('[data-field="link"]').value.trim(),
            numbers: Array.from(block.querySelectorAll('[data-number-block]')).map(nb => ({
                number: nb.querySelector('[data-field="number"]').value.trim(),
                holder: nb.querySelector('[data-field="holder"]').value.trim(),
                network: nb.querySelector('[data-field="network"]').value.trim()
            })).filter(n => n.number || n.holder || n.network)
        })).filter(c => c.country || c.link);
    }

    async function loadPaymentLinks() {
        paymentLinksList.innerHTML = '';
        const { data, error } = await window.supabaseClient
            .from('site_settings').select('payment_links').eq('id', 1).single();
        if (error) { window.showToast("Impossible de charger les liens de paiement.", 'error'); return; }
        const links = (data && data.payment_links) || [];
        links.forEach(c => addCountryBlock(c));
    }

    paymentLinksSaveBtn.addEventListener('click', async () => {
        paymentLinksSaveBtn.disabled = true;
        const originalText = paymentLinksSaveBtn.textContent;
        paymentLinksSaveBtn.textContent = 'Enregistrement…';
        const payload = { id: 1, payment_links: collectPaymentLinksData() };
        const { error } = await window.supabaseClient.from('site_settings').upsert(payload);
        paymentLinksSaveBtn.disabled = false;
        paymentLinksSaveBtn.textContent = originalText;
        if (error) { window.showToast("Erreur : " + error.message, 'error'); return; }
        window.showToast('Liens de paiement enregistrés.', 'success');
    });

    // ----------------------------------------------------------------
    // 8. Chargement initial
    // ----------------------------------------------------------------
    loadStats();
});
