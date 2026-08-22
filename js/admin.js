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

    const openModal = (id) => document.getElementById(id).classList.add('active');
    const closeModal = (id) => document.getElementById(id).classList.remove('active');
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
        btn.addEventListener('click', () => closeModal(btn.getAttribute('data-close-modal')));
    });
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('active'); });
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
            if (target === 'produits') { loadProducts(); }
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
    // 3bis. Placements Revenu Annuel arrivés à échéance — crédit manuel
    // ----------------------------------------------------------------
    const processMaturedBtn = document.getElementById('process-matured-btn');
    const processMaturedResult = document.getElementById('process-matured-result');
    if (processMaturedBtn) {
        processMaturedBtn.addEventListener('click', async () => {
            processMaturedBtn.disabled = true;
            const originalText = processMaturedBtn.textContent;
            processMaturedBtn.textContent = 'Vérification…';
            try {
                const { data, error } = await window.supabaseClient.rpc('admin_process_matured_investments');
                if (error) throw error;
                const count = Number(data) || 0;
                processMaturedResult.style.display = 'block';
                processMaturedResult.textContent = count > 0
                    ? `${count} placement(s) crédité(s) à l'instant.`
                    : 'Aucun placement en attente de crédit pour le moment.';
                window.showToast(count > 0 ? `${count} placement(s) crédité(s).` : 'Rien à créditer pour le moment.', 'success');
                loadStats();
            } catch (err) {
                window.showToast('Erreur : ' + err.message, 'error');
            } finally {
                processMaturedBtn.disabled = false;
                processMaturedBtn.textContent = originalText;
            }
        });
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

    // ----------------------------------------------------------------
    // 4a. Revenu mensuel (12 mois) — uniquement catégorie "atlas"
    // ----------------------------------------------------------------
    const MONTHLY_REVENUE_COUNT = 12;
    const monthlyRevenuesGroup = document.getElementById('product-monthly-revenues-group');
    const monthlyRevenuesGrid = document.getElementById('product-monthly-revenues-grid');

    if (monthlyRevenuesGrid) {
        monthlyRevenuesGrid.innerHTML = Array.from({ length: MONTHLY_REVENUE_COUNT }, (_, i) => `
            <div class="admin-monthly-revenue-field">
                <label>Mois ${i + 1}</label>
                <input type="number" min="0" step="1" class="product-monthly-revenue-input" data-month="${i + 1}">
            </div>`).join('');
    }

    function toggleMonthlyRevenuesVisibility() {
        const isAtlas = productCategoryInput.value === 'atlas';
        if (monthlyRevenuesGroup) monthlyRevenuesGroup.style.display = isAtlas ? 'block' : 'none';

        // Pour "Revenu Annuel", le %/jour et l'échéance en jours ne servent à
        // rien (le montant et la durée viennent du revenu mensuel ci-dessus) :
        // on les cache et on les rend optionnels pour éviter toute confusion.
        const rateGroup = document.getElementById('product-rate-group');
        const durationGroup = document.getElementById('product-duration-group');
        const dailyGainGroup = document.getElementById('product-daily-gain-preview-group');
        if (rateGroup) rateGroup.style.display = isAtlas ? 'none' : 'block';
        if (durationGroup) durationGroup.style.display = isAtlas ? 'none' : 'block';
        if (dailyGainGroup) dailyGainGroup.style.display = isAtlas ? 'none' : 'block';
        productRateInput.required = !isAtlas;
        productDurationInput.required = !isAtlas;
    }
    productCategoryInput.addEventListener('change', toggleMonthlyRevenuesVisibility);

    function getMonthlyRevenuesFromForm() {
        return Array.from(document.querySelectorAll('.product-monthly-revenue-input'))
            .map(input => Number(input.value) || 0);
    }

    function setMonthlyRevenuesInForm(values) {
        const arr = Array.isArray(values) ? values : [];
        document.querySelectorAll('.product-monthly-revenue-input').forEach(input => {
            const month = Number(input.getAttribute('data-month'));
            input.value = arr[month - 1] != null ? arr[month - 1] : '';
        });
    }

    function resetMonthlyRevenuesInForm() {
        document.querySelectorAll('.product-monthly-revenue-input').forEach(input => { input.value = ''; });
    }

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
        resetMonthlyRevenuesInForm();
        toggleMonthlyRevenuesVisibility();
    };
    productCancelEditBtn.addEventListener('click', resetProductForm);
    toggleMonthlyRevenuesVisibility();

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
                p_daily_rate: productCategoryInput.value === 'atlas' ? 0 : Number(productRateInput.value),
                p_duration_days: productCategoryInput.value === 'atlas' ? 1 : Number(productDurationInput.value),
                p_image_url: imageUrl,
                p_sort_order: 0,
                p_is_active: true,
                p_monthly_revenues: productCategoryInput.value === 'atlas' ? getMonthlyRevenuesFromForm() : null
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

    function renderMonthlyRevenuesPreview(category, monthlyRevenues) {
        if (category !== 'atlas') return '—';
        const arr = Array.isArray(monthlyRevenues) ? monthlyRevenues : [];
        if (!arr.length || arr.every(v => !v)) return '—';
        return `<div class="admin-monthly-revenues-view">${arr.map((v, i) => `<span>M${i + 1}: ${formatFCFA(v)}</span>`).join('')}</div>`;
    }

    async function loadProducts() {
        const tbody = document.getElementById('products-tbody');
        const { data, error } = await window.supabaseClient.from('investment_products').select('*').order('category').order('sort_order');
        if (error) { tbody.innerHTML = `<tr><td colspan="8">Erreur de chargement.</td></tr>`; return; }
        if (!data.length) { tbody.innerHTML = `<tr><td colspan="9">Aucun produit pour le moment.</td></tr>`; return; }
        tbody.innerHTML = data.map(p => `
            <tr>
                <td>${p.image_url ? `<img src="${p.image_url}" class="admin-table-thumb">` : '—'}</td>
                <td>${p.name}</td>
                <td>${p.category}</td>
                <td>${formatFCFA(p.price)}</td>
                <td>${p.daily_rate}%</td>
                <td>${p.duration_days} j</td>
                <td>${renderMonthlyRevenuesPreview(p.category, p.monthly_revenues)}</td>
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
                setMonthlyRevenuesInForm(p.monthly_revenues);
                toggleMonthlyRevenuesVisibility();
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

    let currentDetailUserId = null;

    async function refreshUserDetailBlockUI(user) {
        document.getElementById('user-detail-status').textContent = user.is_blocked ? 'Bloqué' : 'Actif';
        const toggleBtn = document.getElementById('user-detail-toggle-block');
        toggleBtn.textContent = user.is_blocked ? 'Réactiver' : 'Bloquer';
        toggleBtn.style.display = user.is_super_admin ? 'none' : '';
    }

    async function viewUserDetail(userId) {
        const user = allUsersData.find(u => u.id === userId);
        if (!user) return;
        currentDetailUserId = userId;

        document.getElementById('user-detail-name').textContent = user.full_name || user.email || 'Utilisateur';
        document.getElementById('user-detail-phone').textContent = user.phone || user.email || '—';
        document.getElementById('user-detail-registered').textContent = 'Inscrit le ' + formatDate(user.created_at);
        document.getElementById('user-detail-balance').textContent = formatFCFA(user.balance);
        await refreshUserDetailBlockUI(user);

        const [{ data: deposits }, { data: withdrawals }, { count: referralCount }] = await Promise.all([
            window.supabaseClient.from('deposit_requests').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
            window.supabaseClient.from('withdrawal_requests').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
            user.referral_code
                ? window.supabaseClient.from('profiles').select('id', { count: 'exact', head: true }).eq('referred_by', user.referral_code)
                : Promise.resolve({ count: 0 })
        ]);

        const depositsBody = document.getElementById('user-detail-deposits');
        depositsBody.innerHTML = (deposits && deposits.length) ? deposits.map(d => `
            <tr><td>${formatDate(d.created_at)}</td><td>${formatFCFA(d.amount)}</td><td>${d.method_name || '—'}</td><td><span class="admin-badge ${d.status}">${d.status}</span></td></tr>
        `).join('') : `<tr><td>Aucun dépôt.</td></tr>`;

        const withdrawalsBody = document.getElementById('user-detail-withdrawals');
        withdrawalsBody.innerHTML = (withdrawals && withdrawals.length) ? withdrawals.map(w => `
            <tr><td>${formatDate(w.created_at)}</td><td>${formatFCFA(w.amount)}</td><td>${w.method_name || '—'}</td><td>${w.recipient_name || '—'}</td><td><span class="admin-badge ${w.status}">${w.status}</span></td></tr>
        `).join('') : `<tr><td>Aucun retrait.</td></tr>`;

        document.getElementById('user-detail-deposits-count').textContent =
            (deposits || []).filter(d => d.status === 'approved').length;
        document.getElementById('user-detail-withdrawals-count').textContent =
            (withdrawals || []).filter(w => w.status === 'approved').length;

        document.getElementById('user-detail-referral-count').textContent = referralCount || 0;
        document.getElementById('user-detail-sponsor').textContent = user.referred_by || 'Aucun';

        let referralEarnings = 0;
        const { data: wallet } = await window.supabaseClient.from('wallets').select('referral_earnings').eq('user_id', userId).maybeSingle();
        if (wallet) referralEarnings = wallet.referral_earnings || 0;
        document.getElementById('user-detail-referral-earnings').textContent = formatFCFA(referralEarnings);

        openModal('user-detail-modal');
    }

    document.getElementById('user-detail-toggle-block').addEventListener('click', async () => {
        if (!currentDetailUserId) return;
        const user = allUsersData.find(u => u.id === currentDetailUserId);
        if (!user) return;
        await setBlocked(currentDetailUserId, !user.is_blocked);
        const refreshed = allUsersData.find(u => u.id === currentDetailUserId);
        if (refreshed) refreshUserDetailBlockUI(refreshed);
    });

    document.getElementById('user-detail-add-funds').addEventListener('click', () => adjustUserFunds(1));
    document.getElementById('user-detail-remove-funds').addEventListener('click', () => adjustUserFunds(-1));

    async function adjustUserFunds(sign) {
        if (!currentDetailUserId) return;
        const label = sign > 0 ? 'ajouter' : 'retirer';
        const raw = prompt(`Montant à ${label} (FCFA) :`);
        if (raw === null) return;
        const amount = Number(raw);
        if (!amount || amount <= 0) { window.showToast('Montant invalide.', 'error'); return; }

        const { error } = await window.supabaseClient.rpc('admin_adjust_balance', {
            p_user_id: currentDetailUserId,
            p_amount: sign * amount,
            p_reason: sign > 0 ? 'Ajout manuel par admin' : 'Retrait manuel par admin'
        });
        if (error) { window.showToast("Erreur : " + error.message, 'error'); return; }
        window.showToast('Solde mis à jour.', 'success');
        await loadUsers();
        viewUserDetail(currentDetailUserId);
    }

    document.getElementById('user-detail-change-password').addEventListener('click', async () => {
        if (!currentDetailUserId) return;
        const newPassword = prompt('Nouveau mot de passe pour ce compte :');
        if (!newPassword) return;
        if (newPassword.length < 6) { window.showToast('6 caractères minimum.', 'error'); return; }

        const { error } = await window.supabaseClient.rpc('admin_reset_user_password', {
            p_user_id: currentDetailUserId,
            p_new_password: newPassword
        });
        if (error) { window.showToast("Erreur : " + error.message, 'error'); return; }
        window.showToast('Mot de passe mis à jour.', 'success');
    });

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
        document.getElementById('setting-whatsapp-group').value = data.whatsapp_group || '';
        document.getElementById('setting-referral-rate-l1').value = data.referral_rate_l1 ?? data.referral_rate ?? '';
        document.getElementById('setting-referral-rate-l2').value = data.referral_rate_l2 ?? '';
        document.getElementById('setting-referral-rate-l3').value = data.referral_rate_l3 ?? '';
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
            whatsapp_group: document.getElementById('setting-whatsapp-group').value.trim(),
            referral_rate_l1: Number(document.getElementById('setting-referral-rate-l1').value) || 0,
            referral_rate_l2: Number(document.getElementById('setting-referral-rate-l2').value) || 0,
            referral_rate_l3: Number(document.getElementById('setting-referral-rate-l3').value) || 0,
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

        countryPaymentData = parseCountryPaymentMethods(data.country_payment_methods);
        renderCountryPaymentLinks();

        paymentSettingsSubmitBtn.disabled = false;
    }

    // ----------------------------------------------------------------
    // 7ter. Paiement par pays (numéros Mobile Money éditables par pays)
    // ----------------------------------------------------------------
    const countryPaymentListEl = document.getElementById('country-payment-links-list');
    const addCountryBtn = document.getElementById('add-country-payment-link-btn');
    // Structure : [{ country: 'CM', methods: [{ number: '', holder: '' }, ...] }]
    let countryPaymentData = [];

    function parseCountryPaymentMethods(value) {
        if (Array.isArray(value)) return value;
        if (typeof value === 'string' && value) {
            try {
                const parsed = JSON.parse(value);
                return Array.isArray(parsed) ? parsed : [];
            } catch (e) { return []; }
        }
        return [];
    }

    function usedCountryCodes(excludeIndex) {
        return countryPaymentData
            .map((c, i) => (i === excludeIndex ? null : c.country))
            .filter(Boolean);
    }

    function countryOptionsHtml(selected, excludeIndex) {
        const used = usedCountryCodes(excludeIndex);
        const list = window.AtlasCountries || [];
        return list.map(c =>
            `<option value="${c.code}" ${c.code === selected ? 'selected' : ''} ${used.includes(c.code) && c.code !== selected ? 'disabled' : ''}>${c.name}</option>`
        ).join('');
    }

    function renderCountryPaymentLinks() {
        if (!countryPaymentListEl) return;
        if (!countryPaymentData.length) {
            countryPaymentListEl.innerHTML = `<p class="country-payment-empty">Aucun pays configuré pour le moment. Cliquez sur "Ajouter un pays" ci-dessous.</p>`;
            return;
        }
        countryPaymentListEl.innerHTML = countryPaymentData.map((entry, ci) => `
            <div class="country-payment-item">
                <div class="country-payment-header">
                    <select class="country-select" data-country-index="${ci}">
                        <option value="">Sélectionner un pays</option>
                        ${countryOptionsHtml(entry.country, ci)}
                    </select>
                    <button type="button" class="remove-country-btn" data-remove-country="${ci}">Supprimer le pays</button>
                </div>
                <div class="country-payment-methods">
                    ${(entry.methods || []).map((m, mi) => `
                        <div class="payment-method-row">
                            <span class="payment-method-index">N°${mi + 1}</span>
                            <input type="text" placeholder="Numéro de téléphone" value="${(m.number || '').replace(/"/g, '&quot;')}" data-country-index="${ci}" data-method-index="${mi}" data-field="number">
                            <input type="text" placeholder="Réseau (ex: Orange Money)" value="${(m.network || '').replace(/"/g, '&quot;')}" data-country-index="${ci}" data-method-index="${mi}" data-field="network">
                            <input type="text" placeholder="Nom du titulaire" value="${(m.holder || '').replace(/"/g, '&quot;')}" data-country-index="${ci}" data-method-index="${mi}" data-field="holder">
                            <button type="button" class="payment-method-remove-btn" data-remove-method="${ci}:${mi}" title="Supprimer ce numéro">✕</button>
                        </div>
                    `).join('')}
                </div>
                ${(entry.methods || []).length < 2 ? `<button type="button" class="add-method-btn" data-add-method="${ci}" style="margin-top:10px;">+ Ajouter un numéro</button>` : ''}
            </div>
        `).join('');

        countryPaymentListEl.querySelectorAll('.country-select').forEach(sel => {
            sel.addEventListener('change', () => {
                countryPaymentData[Number(sel.getAttribute('data-country-index'))].country = sel.value;
            });
        });
        countryPaymentListEl.querySelectorAll('[data-remove-country]').forEach(btn => {
            btn.addEventListener('click', () => {
                countryPaymentData.splice(Number(btn.getAttribute('data-remove-country')), 1);
                renderCountryPaymentLinks();
            });
        });
        countryPaymentListEl.querySelectorAll('[data-add-method]').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = Number(btn.getAttribute('data-add-method'));
                if (!countryPaymentData[idx].methods) countryPaymentData[idx].methods = [];
                if (countryPaymentData[idx].methods.length < 2) {
                    countryPaymentData[idx].methods.push({ number: '', network: '', holder: '' });
                    renderCountryPaymentLinks();
                }
            });
        });
        countryPaymentListEl.querySelectorAll('[data-remove-method]').forEach(btn => {
            btn.addEventListener('click', () => {
                const [ci, mi] = btn.getAttribute('data-remove-method').split(':').map(Number);
                countryPaymentData[ci].methods.splice(mi, 1);
                renderCountryPaymentLinks();
            });
        });
        countryPaymentListEl.querySelectorAll('input[data-field]').forEach(input => {
            input.addEventListener('input', () => {
                const ci = Number(input.getAttribute('data-country-index'));
                const mi = Number(input.getAttribute('data-method-index'));
                countryPaymentData[ci].methods[mi][input.getAttribute('data-field')] = input.value;
            });
        });
    }

    if (addCountryBtn) {
        addCountryBtn.addEventListener('click', () => {
            countryPaymentData.push({ country: '', methods: [{ number: '', network: '', holder: '' }] });
            renderCountryPaymentLinks();
        });
    }

    paymentSettingsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        paymentSettingsSubmitBtn.disabled = true;
        paymentSettingsSubmitBtn.textContent = 'Enregistrement…';

        const cleanCountryPayments = countryPaymentData
            .filter(c => c.country)
            .map(c => ({
                country: c.country,
                methods: (c.methods || []).filter(m => (m.number || '').trim() || (m.network || '').trim() || (m.holder || '').trim())
            }));

        const payload = {
            id: 1,
            withdrawal_methods: linesToArray(document.getElementById('setting-withdrawal-methods').value),
            deposit_usdt_address: document.getElementById('setting-deposit-usdt-address').value.trim(),
            deposit_amounts: linesToArray(document.getElementById('setting-deposit-amounts').value).map(Number).filter(n => !isNaN(n)),
            country_payment_methods: cleanCountryPayments
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
