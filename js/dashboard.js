// dashboard.js — connecté aux données réelles Supabase (profil, solde, produits, investissements, transactions)

document.addEventListener('DOMContentLoaded', async () => {
    // ------------------------------------------------------------------
    // Fonction Toast (globale)
    // ------------------------------------------------------------------
    window.showToast = (message, type = 'info', options = {}) => {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}${options.extraClass ? ' ' + options.extraClass : ''}`;

        const icons = {
            success: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
            error: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
            info: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C9A227" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
        };

        toast.innerHTML = `${icons[type] || icons.info}<div>${message}</div>`;
        container.appendChild(toast);

        setTimeout(() => toast.classList.add('show'), 10);
        const duration = options.duration || 4000;
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    };

    const formatFCFA = (amount) => new Intl.NumberFormat('fr-FR').format(Math.round(amount || 0)) + ' FCFA';

    // ------------------------------------------------------------------
    // 1. Authentification réelle (session Supabase)
    // ------------------------------------------------------------------
    if (!window.supabaseClient) {
        window.location.href = 'index.html';
        return;
    }

    const { data: sessionData } = await window.supabaseClient.auth.getSession();
    const session = sessionData && sessionData.session;
    if (!session) {
        window.location.href = 'index.html';
        return;
    }
    const authUser = session.user;

    // ------------------------------------------------------------------
    // 2. Chargement des données réelles : profil, portefeuille, produits,
    //    investissements en cours, transactions
    // ------------------------------------------------------------------
    const [profileRes, walletRes, productsRes, investmentsRes, transactionsRes, notificationsRes] = await Promise.all([
        window.supabaseClient.from('profiles').select('*').eq('id', authUser.id).single(),
        window.supabaseClient.from('wallets').select('*').eq('user_id', authUser.id).single(),
        window.supabaseClient.from('investment_products').select('*').eq('is_active', true).order('category').order('sort_order'),
        window.supabaseClient.from('user_investments').select('*, investment_products(name, category, daily_rate)').eq('user_id', authUser.id).order('created_at', { ascending: false }),
        window.supabaseClient.from('transactions').select('*').eq('user_id', authUser.id).order('created_at', { ascending: false }).limit(100),
        window.supabaseClient.from('notifications').select('*').eq('user_id', authUser.id).order('created_at', { ascending: false }).limit(30)
    ]);

    let profile = profileRes.data || { full_name: authUser.email, email: authUser.email, referral_code: '' };
    let wallet = walletRes.data || { balance: 0, total_income: 0, referral_earnings: 0 };
    let products = productsRes.data || [];
    let investments = investmentsRes.data || [];
    let transactions = transactionsRes.data || [];
    let notifications = notificationsRes.data || [];

    if (profileRes.error) console.error('Erreur profil :', profileRes.error);
    if (walletRes.error) console.error('Erreur portefeuille :', walletRes.error);
    if (productsRes.error) console.error('Erreur produits :', productsRes.error);

    const userName = profile.full_name || authUser.email;
    const userEmail = profile.email || authUser.email;

    document.querySelectorAll('.user-name').forEach(el => el.textContent = userName);
    document.querySelectorAll('.user-email').forEach(el => el.textContent = userEmail);

    const initials = userName.split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'U';
    document.querySelectorAll('.avatar').forEach(el => el.textContent = initials);

    // ------------------------------------------------------------------
    // 3. Badge compte vérifié
    // ------------------------------------------------------------------
    const verifiedBadge = document.getElementById('account-verified-badge');

    if (verifiedBadge) {
        const isVerified = !!authUser.email_confirmed_at;
        verifiedBadge.style.display = 'inline-flex';

        if (isVerified) {
            verifiedBadge.classList.remove('pending');
            verifiedBadge.innerHTML = `
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                Compte vérifié
            `;
        } else {
            verifiedBadge.classList.add('pending');
            verifiedBadge.innerHTML = `
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="9"></circle>
                    <line x1="12" y1="8" x2="12" y2="13"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                Vérification en attente
            `;

            verifiedBadge.title = "Cliquez pour renvoyer l'e-mail de confirmation";

            verifiedBadge.addEventListener('click', async () => {
                const { error } = await window.supabaseClient.auth.resend({
                    type: 'signup',
                    email: userEmail
                });

                window.showToast(
                    error ? "Impossible d'envoyer l'e-mail pour le moment." : "E-mail de confirmation renvoyé !",
                    error ? 'error' : 'success'
                );
            });
        }
    }

    // ------------------------------------------------------------------
    // 4. Données du dashboard
    // ------------------------------------------------------------------
    const renderDashboardData = () => {
        const walletBalanceEl = document.getElementById('wallet-balance-amount');
        if (walletBalanceEl) walletBalanceEl.textContent = formatFCFA(wallet.balance);

        document.querySelectorAll('[data-wallet-income]').forEach(el => {
            el.textContent = formatFCFA(wallet.total_income);
        });

        document.querySelectorAll('[data-referral-earnings]').forEach(el => {
            el.textContent = formatFCFA(wallet.referral_earnings);
        });

        const gridIds = {
            atlas: 'atlas-products-grid',
            constant: 'constant-products-grid',
            analyse: 'analyse-products-grid',
            quete: 'quete-products-grid'
        };

        const renderProductCard = (p) => {
            const amount = Number(p.min_amount || p.amount || 0);
            const dailyRate = Number(p.daily_rate || 0);
            const duration = Number(p.duration_days || 0);
            const dailyGain = amount * dailyRate / 100;
            const affordable = Number(wallet.balance || 0) >= amount;

            return `
                <div class="vip-card">
                    <div class="vip-card-header">
                        <h3>${p.name || 'Produit'}</h3>
                    </div>

                    <div class="vip-card-body">
                        <div class="vip-card-row">
                            <span>Montant</span>
                            <strong>${formatFCFA(amount)}</strong>
                        </div>

                        <div class="vip-card-row">
                            <span>Taux journalier</span>
                            <strong>${dailyRate}%</strong>
                        </div>

                        <div class="vip-card-row">
                            <span>Durée</span>
                            <strong>${duration} jours</strong>
                        </div>

                        <div class="vip-card-row">
                            <span>Gain / jour</span>
                            <strong>${formatFCFA(dailyGain)}</strong>
                        </div>

                        <button
                            class="btn btn-primary buy-product-btn"
                            data-product-id="${p.id}"
                            data-product-name="${p.name || ''}"
                            data-product-category="${p.category || ''}"
                            data-daily-gain="${dailyGain}"
                            data-duration="${duration}"
                            ${affordable ? '' : 'disabled title="Solde insuffisant"'}>
                            ${affordable ? 'Acheter' : 'Solde insuffisant'}
                        </button>
                    </div>
                </div>
            `;
        };

        Object.entries(gridIds).forEach(([category, gridId]) => {
            const grid = document.getElementById(gridId);
            if (!grid) return;

            const items = products.filter(p => p.category === category);

            grid.innerHTML = items.length
                ? items.map(renderProductCard).join('')
                : '<p class="text-secondary" style="padding:12px 2px;">Aucun produit disponible pour le moment.</p>';
        });

        const transactionsList = document.getElementById('transactions-list');

        if (transactionsList) {
            const iconFor = (type, positive) => {
                const arrowUp = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>';
                const arrowDown = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 5"></polyline></svg>';
                const invest = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>';
                const quest = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>';

                if (type === 'investment') return { svg: invest, cls: 'bg-primary-light text-primary' };
                if (type === 'quest') return { svg: quest, cls: 'bg-warning-light text-warning' };
                if (type === 'withdrawal') return { svg: arrowDown, cls: 'bg-danger-light text-danger' };

                return {
                    svg: arrowUp,
                    cls: positive ? 'bg-success-light text-success' : 'bg-danger-light text-danger'
                };
            };

            const labelFor = (type) => ({
                deposit: 'Dépôt',
                withdrawal: 'Retrait',
                investment: 'Investissement',
                gain: 'Gain généré',
                referral_commission: 'Commission de parrainage',
                quest: 'Quête journalière'
            }[type] || type);

            transactionsList.innerHTML = transactions.length ? transactions.map(t => {
                const amount = Number(t.amount);
                const positive = amount >= 0;
                const { svg, cls } = iconFor(t.type, positive);

                const date = t.created_at
                    ? new Date(t.created_at).toLocaleString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    })
                    : '';

                return `
                    <div class="transaction-item">
                        <div class="transaction-icon ${cls}">
                            ${svg}
                        </div>

                        <div class="transaction-info">
                            <div class="transaction-title">${labelFor(t.type)}</div>
                            <div class="transaction-desc">${t.description || ''}</div>
                        </div>

                        <div class="transaction-meta">
                            <div class="transaction-date">${date}</div>
                            <div class="transaction-amount ${positive ? 'positive' : 'negative'}">
                                ${positive ? '+' : ''}${formatFCFA(amount)}
                            </div>
                        </div>
                    </div>
                `;
            }).join('') : '<p class="text-secondary" style="padding:12px 2px;">Aucune transaction pour le moment.</p>';
        }
    };

    renderDashboardData();

    // ------------------------------------------------------------------
    // 5. Rafraîchissement des données
    // ------------------------------------------------------------------
    const refreshDashboardData = async () => {
        const [w, p, inv, tr] = await Promise.all([
            window.supabaseClient.from('wallets').select('*').eq('user_id', authUser.id).single(),
            window.supabaseClient.from('investment_products').select('*').eq('is_active', true).order('category').order('sort_order'),
            window.supabaseClient.from('user_investments').select('*, investment_products(name, category, daily_rate)').eq('user_id', authUser.id).order('created_at', { ascending: false }),
            window.supabaseClient.from('transactions').select('*').eq('user_id', authUser.id).order('created_at', { ascending: false }).limit(100)
        ]);

        wallet = w.data || wallet;
        products = p.data || products;
        investments = inv.data || investments;
        transactions = tr.data || transactions;

        renderDashboardData();
    };

    // ------------------------------------------------------------------
    // 6. Achat produit
    // ------------------------------------------------------------------
    const categoryLabel = {
        atlas: 'Revenu Annuel',
        constant: 'Actif — Constant',
        analyse: 'Actif — Analyse',
        quete: 'Quête Quotidienne'
    };

    const showPurchaseConfirmation = (btn) => {
        const name = btn.getAttribute('data-product-name');
        const category = btn.getAttribute('data-product-category');
        const dailyGain = Number(btn.getAttribute('data-daily-gain'));
        const duration = btn.getAttribute('data-duration');

        window.showToast(
            `<strong>Produit activé ✅</strong><br>
            ${name} — ${categoryLabel[category] || category}<br>
            Gain : ${formatFCFA(dailyGain)}/jour pendant ${duration} jours.<br>
            Disponible dans votre tableau de bord.`,
            'success',
            {
                extraClass: 'investment-toast',
                duration: 6000
            }
        );
    };

    document.querySelectorAll('.vip-grid').forEach(grid => {
        grid.addEventListener('click', async e => {
            const btn = e.target.closest('.buy-product-btn');
            if (!btn || btn.disabled) return;

            const productId = btn.getAttribute('data-product-id');

            btn.disabled = true;

            const originalText = btn.textContent;
            btn.textContent = 'Traitement...';

            try {
                const { error } = await window.supabaseClient.rpc(
                    'purchase_investment',
                    { p_product_id: productId }
                );

                if (error) {
                    window.showToast(
                        error.message || "Impossible d'effectuer cet investissement.",
                        'error'
                    );

                    btn.disabled = false;
                    btn.textContent = originalText;
                } else {
                    showPurchaseConfirmation(btn);
                    await refreshDashboardData();
                    await refreshNotifications();
                }
            } catch (err) {
                window.showToast('Erreur : ' + err.message, 'error');
                btn.disabled = false;
                btn.textContent = originalText;
            }
        });
    });

    // ------------------------------------------------------------------
    // 7. DÉPÔT RÉEL
    // ------------------------------------------------------------------
    const depositBtn = document.getElementById('wallet-deposit-btn');
    const withdrawBtn = document.getElementById('wallet-withdraw-btn');

    const closeFinanceModal = () => {
        const modal = document.getElementById('wallet-action-modal');
        if (modal) modal.remove();
    };

    const openDepositModal = () => {
        closeFinanceModal();

        const modal = document.createElement('div');
        modal.id = 'wallet-action-modal';
        modal.className = 'modal-overlay active';

        modal.innerHTML = `
            <div class="modal-card" style="max-width:500px;max-height:90vh;overflow:auto;">
                <button type="button" class="modal-close" id="wallet-modal-close">✕</button>

                <div class="task-modal-badge">DÉPÔT</div>

                <h3 class="task-modal-title">Faire un dépôt</h3>

                <p class="task-modal-sub">
                    Effectuez votre paiement puis envoyez votre demande.
                    Le solde sera crédité après validation.
                </p>

                <label style="display:block;font-weight:600;margin-bottom:6px;">
                    Montant (FCFA)
                </label>

                <input
                    id="deposit-amount"
                    type="number"
                    min="1000"
                    step="1"
                    placeholder="Ex. 10000"
                    style="width:100%;padding:14px;border:1px solid #dbe3ef;border-radius:10px;margin-bottom:15px;box-sizing:border-box;"
                >

                <label style="display:block;font-weight:600;margin-bottom:6px;">
                    Moyen de paiement
                </label>

                <select
                    id="deposit-method"
                    style="width:100%;padding:14px;border:1px solid #dbe3ef;border-radius:10px;margin-bottom:15px;background:#fff;box-sizing:border-box;"
                >
                    <option value="Orange Money">🟠 Orange Money</option>
                    <option value="MTN Mobile Money">🟡 MTN Mobile Money</option>
                    <option value="Carte bancaire">💳 Carte bancaire</option>
                </select>

                <div style="background:#f6f8fb;border-radius:12px;padding:15px;margin-bottom:15px;">
                    <strong>Instructions de paiement</strong>

                    <div style="margin-top:8px;color:#64748b;line-height:1.5;">
                        Effectuez le paiement sur le moyen de paiement officiel
                        indiqué par Atlas Capital, puis saisissez la référence
                        exacte de la transaction ci-dessous.
                    </div>
                </div>

                <label style="display:block;font-weight:600;margin-bottom:6px;">
                    Référence de transaction
                </label>

                <input
                    id="deposit-reference"
                    type="text"
                    maxlength="120"
                    placeholder="Ex. ID de transaction"
                    style="width:100%;padding:14px;border:1px solid #dbe3ef;border-radius:10px;margin-bottom:16px;box-sizing:border-box;"
                >

                <button
                    type="button"
                    id="deposit-submit"
                    class="btn btn-primary"
                    style="width:100%;"
                >
                    J'ai effectué le paiement — Envoyer
                </button>
            </div>
        `;

        document.body.appendChild(modal);

        const amountInput = modal.querySelector('#deposit-amount');
        const methodInput = modal.querySelector('#deposit-method');
        const referenceInput = modal.querySelector('#deposit-reference');
        const submitBtn = modal.querySelector('#deposit-submit');

        modal
            .querySelector('#wallet-modal-close')
            .addEventListener('click', closeFinanceModal);

        modal.addEventListener('click', e => {
            if (e.target === modal) closeFinanceModal();
        });

        submitBtn.addEventListener('click', async () => {
            const amount = Number(amountInput.value);
            const method = methodInput.value;
            const reference = referenceInput.value.trim();

            if (!Number.isFinite(amount) || amount < 1000) {
                window.showToast(
                    'Le montant minimum est de 1 000 FCFA.',
                    'error'
                );
                return;
            }

            if (!reference) {
                window.showToast(
                    'Entrez la référence de votre transaction.',
                    'error'
                );
                return;
            }

            submitBtn.disabled = true;
            submitBtn.textContent = 'Envoi en cours...';

            try {
                const { error } = await window.supabaseClient
                    .from('deposit_requests')
                    .insert({
                        user_id: authUser.id,
                        amount: amount,
                        method: method,
                        payment_method: method,
                        transaction_reference: reference,
                        status: 'pending'
                    });

                if (error) {
                    console.error(
                        'Erreur dépôt Supabase :',
                        error
                    );

                    window.showToast(
                        'Erreur lors de l’envoi : ' + error.message,
                        'error',
                        { duration: 7000 }
                    );

                    submitBtn.disabled = false;
                    submitBtn.textContent =
                        "J'ai effectué le paiement — Envoyer";

                    return;
                }

                closeFinanceModal();

                window.showToast(
                    'Votre demande de dépôt a été envoyée. Elle sera vérifiée avant le crédit de votre solde.',
                    'success',
                    { duration: 7000 }
                );

            } catch (err) {
                console.error('Erreur dépôt :', err);

                window.showToast(
                    'Une erreur est survenue. Réessayez.',
                    'error'
                );

                submitBtn.disabled = false;
                submitBtn.textContent =
                    "J'ai effectué le paiement — Envoyer";
            }
        });
    };

    if (depositBtn) {
        depositBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openDepositModal();
        });
    }

    if (withdrawBtn) {
        withdrawBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            window.showToast(
                'Le retrait sera disponible après validation du code PIN.',
                'info'
            );
        });
    }

    // ------------------------------------------------------------------
    // 8. Navigation Top & Bottom (Multi-View SPA)
    // ------------------------------------------------------------------
    const navLinks = document.querySelectorAll('.nav-link, .bottom-nav-item');
    const views = document.querySelectorAll('.view-section');

    navLinks.forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();

            const target = link.getAttribute('data-target');
            if (!target) return;

            navLinks.forEach(l => l.classList.remove('active'));

            document.querySelectorAll(`[data-target="${target}"]`).forEach(l => {
                l.classList.add('active');
            });

            views.forEach(v => v.classList.remove('active'));

            const targetView = document.getElementById('view-' + target);
            if (targetView) targetView.classList.add('active');

            window.scrollTo(0, 0);
        });
    });

    // ------------------------------------------------------------------
    // 9. Sous-navigation
    // ------------------------------------------------------------------
    const subNavLinks = document.querySelectorAll('.sub-nav-link');
    const subViews = document.querySelectorAll('.sub-view');

    subNavLinks.forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();

            const target = link.getAttribute('data-sub-target');
            if (!target) return;

            subNavLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            subViews.forEach(v => v.classList.remove('active'));

            const targetView = document.getElementById('sub-' + target);
            if (targetView) targetView.classList.add('active');
        });
    });

    // ------------------------------------------------------------------
    // 10. Centre de notifications — données réelles, générées automatiquement
    //     côté serveur à chaque transaction (dépôt, retrait, achat, revenu,
    //     commission de parrainage, quête...). Un nouveau compte démarre à zéro.
    // ------------------------------------------------------------------
    const notifBtn = document.getElementById('notif-btn');
    const notifPanel = document.getElementById('notif-panel');
    const notifBadge = document.getElementById('notif-badge');
    const notifListEl = document.getElementById('notif-list');
    const notifMarkAllBtn = document.getElementById('notif-mark-all');

    const notifIconFor = (type) => ({
        deposit: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>',
        withdrawal: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 5"></polyline></svg>',
        investment: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>',
        gain: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 3"></path></svg>',
        referral_commission: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle></svg>',
        quest: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>'
    }[type] || '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>');

    const timeAgo = (dateStr) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = Math.floor((now - date) / 1000);

        if (diff < 60) return 'À l’instant';
        if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`;
        if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)} h`;
        if (diff < 604800) return `Il y a ${Math.floor(diff / 86400)} j`;

        return date.toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    const renderNotifications = () => {
        if (!notifListEl) return;

        const unreadCount =
            notifications.filter(n => !n.is_read).length;

        if (notifBadge) {
            notifBadge.textContent = unreadCount;
            notifBadge.style.display =
                unreadCount > 0 ? 'inline-flex' : 'none';
        }

        notifListEl.innerHTML = notifications.length
            ? notifications.map(n => `
                <div class="notif-item ${n.is_read ? '' : 'unread'}"
                     data-notif-id="${n.id}">
                    <div class="notif-icon">
                        ${notifIconFor(n.type)}
                    </div>
                    <div class="notif-content">
                        <div class="notif-title">${n.title}</div>
                        <div class="notif-desc">${n.body}</div>
                        <div class="notif-time">${timeAgo(n.created_at)}</div>
                    </div>
                </div>
            `).join('')
            : `
                <div class="notif-empty">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                        <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                    </svg>
                    <p>Aucune notification pour le moment.</p>
                    <span>Vos dépôts, retraits, achats et revenus apparaîtront ici.</span>
                </div>
            `;
    };

    renderNotifications();

    const refreshNotifications = async () => {
        const { data } = await window.supabaseClient
            .from('notifications')
            .select('*')
            .eq('user_id', authUser.id)
            .order('created_at', { ascending: false })
            .limit(30);

        notifications = data || [];
        renderNotifications();
    };

    if (notifBtn && notifPanel) {
        notifBtn.addEventListener('click', e => {
            e.stopPropagation();
            notifPanel.classList.toggle('active');
        });

        document.addEventListener('click', e => {
            if (!notifPanel.contains(e.target) && !notifBtn.contains(e.target)) {
                notifPanel.classList.remove('active');
            }
        });
    }

    if (notifMarkAllBtn) {
        notifMarkAllBtn.addEventListener('click', async () => {
            const { error } = await window.supabaseClient
                .from('notifications')
                .update({ is_read: true })
                .eq('user_id', authUser.id)
                .eq('is_read', false);

            if (error) {
                window.showToast(
                    'Impossible de marquer les notifications comme lues.',
                    'error'
                );
                return;
            }

            await refreshNotifications();
        });
    }

    if (notifListEl) {
        notifListEl.addEventListener('click', async e => {
            const item = e.target.closest('.notif-item');
            if (!item) return;

            const id = item.getAttribute('data-notif-id');
            if (!id) return;

            await window.supabaseClient
                .from('notifications')
                .update({ is_read: true })
                .eq('id', id)
                .eq('user_id', authUser.id);

            await refreshNotifications();
        });
    }

    // ------------------------------------------------------------------
    // 11. Quêtes quotidiennes
    // ------------------------------------------------------------------
    const questButtons =
        document.querySelectorAll('.quest-claim-btn');

    questButtons.forEach(btn => {
        btn.addEventListener('click', async () => {
            const questId = btn.getAttribute('data-quest-id');

            if (!questId) return;

            btn.disabled = true;
            const originalText = btn.textContent;
            btn.textContent = 'Traitement...';

            try {
                const { error } =
                    await window.supabaseClient.rpc(
                        'claim_daily_quest',
                        {
                            p_quest_id: questId
                        }
                    );

                if (error) {
                    window.showToast(
                        error.message || 'Impossible de valider cette quête.',
                        'error'
                    );

                    btn.disabled = false;
                    btn.textContent = originalText;
                    return;
                }

                window.showToast(
                    'Quête validée et récompense créditée.',
                    'success'
                );

                await refreshDashboardData();
                await refreshNotifications();

            } catch (err) {
                window.showToast(
                    'Erreur : ' + err.message,
                    'error'
                );

                btn.disabled = false;
                btn.textContent = originalText;
            }
        });
    });

    // ------------------------------------------------------------------
    // 12. Profil / Paramètres
    // ------------------------------------------------------------------
    const profileForm =
        document.getElementById('profile-form');

    if (profileForm) {
        const fullNameInput =
            profileForm.querySelector('[name="full_name"]');

        const phoneInput =
            profileForm.querySelector('[name="phone"]');

        if (fullNameInput)
            fullNameInput.value = profile.full_name || '';

        if (phoneInput)
            phoneInput.value = profile.phone || '';

        profileForm.addEventListener('submit', async e => {
            e.preventDefault();

            const fullName =
                fullNameInput
                    ? fullNameInput.value.trim()
                    : '';

            const phone =
                phoneInput
                    ? phoneInput.value.trim()
                    : '';

            const { error } =
                await window.supabaseClient
                    .from('profiles')
                    .update({
                        full_name: fullName,
                        phone: phone
                    })
                    .eq('id', authUser.id);

            if (error) {
                window.showToast(
                    error.message ||
                    'Impossible de mettre à jour le profil.',
                    'error'
                );
                return;
            }

            profile.full_name = fullName;
            profile.phone = phone;

            document.querySelectorAll('.user-name')
                .forEach(el => {
                    el.textContent =
                        fullName || authUser.email;
                });

            window.showToast(
                'Profil mis à jour.',
                'success'
            );
        });
    }

    // ------------------------------------------------------------------
    // 13. Parrainage
    // ------------------------------------------------------------------
    const referralInput =
        document.getElementById('referral-link');

    const referralCopyBtn =
        document.getElementById('referral-copy-btn');

    if (referralInput) {
        const code =
            profile.referral_code || '';

        const referralLink =
            `${window.location.origin}${window.location.pathname.replace(
                'dashboard.html',
                'index.html'
            )}?ref=${encodeURIComponent(code)}`;

        referralInput.value =
            referralLink;

        if (referralCopyBtn) {
            referralCopyBtn.addEventListener(
                'click',
                async () => {
                    try {
                        await navigator.clipboard.writeText(
                            referralLink
                        );

                        window.showToast(
                            'Lien de parrainage copié !',
                            'success'
                        );
                    } catch (err) {
                        referralInput.select();
                        document.execCommand('copy');

                        window.showToast(
                            'Lien de parrainage copié !',
                            'success'
                        );
                    }
                }
            );
        }
    }

    // ------------------------------------------------------------------
    // 14. Déconnexion
    // ------------------------------------------------------------------
    const logoutButtons =
        document.querySelectorAll(
            '[data-action="logout"], #logout-btn'
        );

    logoutButtons.forEach(btn => {
        btn.addEventListener('click', async e => {
            e.preventDefault();

            await window.supabaseClient.auth.signOut();

            window.location.href =
                'index.html';
        });
    });

    // ------------------------------------------------------------------
    // 15. Menu mobile
    // ------------------------------------------------------------------
    const menuBtn =
        document.getElementById('mobile-menu-btn');

    const sidebar =
        document.getElementById('sidebar');

    if (menuBtn && sidebar) {
        menuBtn.addEventListener('click', () => {
            sidebar.classList.toggle('open');
        });
    }

    // ------------------------------------------------------------------
    // 16. Chargement final
    // ------------------------------------------------------------------
    await refreshNotifications();

});                return;
            }
            if (profile.referred_by) {
                window.showToast('Un code de parrainage est déjà associé à votre compte.', 'error');
                return;
            }
            const { data: sponsor } = await window.supabaseClient.from('profiles').select('id').eq('referral_code', code).maybeSingle();
            if (!sponsor) {
                window.showToast('Code de parrainage invalide.', 'error');
                return;
            }
            const { error } = await window.supabaseClient.from('profiles').update({ referred_by: code }).eq('id', authUser.id);
            if (error) {
                window.showToast("Impossible d'enregistrer ce code pour le moment.", 'error');
                return;
            }
            redeemInput.value = '';
            redeemInputRow.classList.remove('open');
            if (redeemToggleBtn) redeemToggleBtn.classList.remove('open');
            window.showToast('Code de parrainage validé !', 'success');
        });
    }

    // ------------------------------------------------------------------
    // 14. Accès admin (n'affiche l'entrée que si le profil est marqué admin)
    // ------------------------------------------------------------------
    const adminMenuItem = document.getElementById('admin-menu-item');
    if (adminMenuItem && profile.is_admin) {
        adminMenuItem.style.display = '';
        adminMenuItem.addEventListener('click', () => {
            window.location.href = 'admin.html';
        });
    }
});
