// dashboard.js — connecté aux données réelles Supabase (profil, solde, produits, investissements, transactions)

document.addEventListener('DOMContentLoaded', async () => {
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

    const formatFCFA = (amount) =>
        new Intl.NumberFormat('fr-FR').format(Math.round(amount || 0)) + ' FCFA';

    // ------------------------------------------------------------------
    // 1. AUTHENTIFICATION
    // ------------------------------------------------------------------

    if (!window.supabaseClient) {
        window.location.href = 'index.html';
        return;
    }

    const { data: sessionData } =
        await window.supabaseClient.auth.getSession();

    const session = sessionData && sessionData.session;

    if (!session) {
        window.location.href = 'index.html';
        return;
    }

    const authUser = session.user;

    // ------------------------------------------------------------------
    // 2. CHARGEMENT DES DONNÉES
    // ------------------------------------------------------------------

    const [
        profileRes,
        walletRes,
        productsRes,
        investmentsRes,
        transactionsRes,
        notificationsRes
    ] = await Promise.all([
        window.supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', authUser.id)
            .single(),

        window.supabaseClient
            .from('wallets')
            .select('*')
            .eq('user_id', authUser.id)
            .single(),

        window.supabaseClient
            .from('investment_products')
            .select('*')
            .eq('is_active', true)
            .order('category')
            .order('sort_order'),

        window.supabaseClient
            .from('user_investments')
            .select('*, investment_products(name, category, daily_rate)')
            .eq('user_id', authUser.id)
            .order('created_at', { ascending: false }),

        window.supabaseClient
            .from('transactions')
            .select('*')
            .eq('user_id', authUser.id)
            .order('created_at', { ascending: false })
            .limit(100),

        window.supabaseClient
            .from('notifications')
            .select('*')
            .eq('user_id', authUser.id)
            .order('created_at', { ascending: false })
            .limit(30)
    ]);

    let profile = profileRes.data || {
        full_name: authUser.email,
        email: authUser.email,
        referral_code: ''
    };

    let wallet = walletRes.data || {
        balance: 0,
        total_income: 0,
        referral_earnings: 0
    };

    let products = productsRes.data || [];
    let investments = investmentsRes.data || [];
    let transactions = transactionsRes.data || [];
    let notifications = notificationsRes.data || [];

    if (profileRes.error)
        console.error('Erreur profil :', profileRes.error);

    if (walletRes.error)
        console.error('Erreur portefeuille :', walletRes.error);

    if (productsRes.error)
        console.error('Erreur produits :', productsRes.error);

    const userName = profile.full_name || authUser.email;
    const userEmail = profile.email || authUser.email;

    document.querySelectorAll('.user-name').forEach(el => {
        el.textContent = userName;
    });

    document.querySelectorAll('.user-email').forEach(el => {
        el.textContent = userEmail;
    });

    const initials =
        userName
            .split(' ')
            .filter(Boolean)
            .map(n => n[0])
            .join('')
            .substring(0, 2)
            .toUpperCase() || 'U';

    document.querySelectorAll('.avatar').forEach(el => {
        el.textContent = initials;
    });

    // ------------------------------------------------------------------
    // 3. COMPTE VÉRIFIÉ
    // ------------------------------------------------------------------

    const verifiedBadge =
        document.getElementById('account-verified-badge');

    if (verifiedBadge) {

        const isVerified =
            !!authUser.email_confirmed_at;

        verifiedBadge.style.display = 'inline-flex';

        if (isVerified) {

            verifiedBadge.classList.remove('pending');

            verifiedBadge.innerHTML = `
                <svg width="12" height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="3"
                    stroke-linecap="round"
                    stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                Compte vérifié
            `;

        } else {

            verifiedBadge.classList.add('pending');

            verifiedBadge.innerHTML = `
                <svg width="12" height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="3"
                    stroke-linecap="round"
                    stroke-linejoin="round">
                    <circle cx="12" cy="12" r="9"></circle>
                    <line x1="12" y1="8" x2="12" y2="13"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                Vérification en attente
            `;

            verifiedBadge.title =
                "Cliquez pour renvoyer l'e-mail de confirmation";

            verifiedBadge.addEventListener('click', async () => {

                const { error } =
                    await window.supabaseClient.auth.resend({
                        type: 'signup',
                        email: userEmail
                    });

                window.showToast(
                    error
                        ? "Impossible d'envoyer l'e-mail pour le moment."
                        : "E-mail de confirmation renvoyé !",
                    error ? 'error' : 'success'
                );
            });
        }
    }

    // ------------------------------------------------------------------
    // 4. RENDU DU DASHBOARD
    // ------------------------------------------------------------------

    const renderDashboardData = () => {

        // Solde
        const walletBalanceEl =
            document.getElementById('wallet-balance-amount');

        if (walletBalanceEl) {
            walletBalanceEl.textContent =
                formatFCFA(wallet.balance);
        }

        // Total revenus
        document.querySelectorAll('[data-wallet-income]')
            .forEach(el => {
                el.textContent =
                    formatFCFA(wallet.total_income);
            });

        // Commissions
        document.querySelectorAll('[data-referral-earnings]')
            .forEach(el => {
                el.textContent =
                    formatFCFA(wallet.referral_earnings);
            });

        // --------------------------------------------------------------
        // Produits
        // --------------------------------------------------------------

        const gridIds = {
            atlas: 'atlas-products-grid',
            constant: 'constant-products-grid',
            analyse: 'analyse-products-grid',
            quete: 'quete-products-grid'
        };

        const renderProductCard = p => {

            const amount =
                Number(p.min_amount || p.amount || 0);

            const dailyRate =
                Number(p.daily_rate || 0);

            const duration =
                Number(p.duration_days || 0);

            const dailyGain =
                amount * dailyRate / 100;

            const affordable =
                Number(wallet.balance || 0) >= amount;

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

        Object.entries(gridIds).forEach(
            ([category, gridId]) => {

                const grid =
                    document.getElementById(gridId);

                if (!grid) return;

                const items =
                    products.filter(
                        p => p.category === category
                    );

                grid.innerHTML =
                    items.length
                        ? items.map(renderProductCard).join('')
                        : '<p class="text-secondary" style="padding:12px 2px;">Aucun produit disponible pour le moment.</p>';
            }
        );

        // --------------------------------------------------------------
        // Transactions
        // --------------------------------------------------------------

        const transactionsList =
            document.getElementById('transactions-list');

        if (transactionsList) {

            const iconFor = (type, positive) => {

                const arrowUp = `
                    <svg width="20" height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <polyline points="19 12 12 19 5 12"></polyline>
                    </svg>
                `;

                const arrowDown = `
                    <svg width="20" height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round">
                        <line x1="12" y1="19" x2="12" y2="5"></line>
                        <polyline points="5 12 12 5 19 12"></polyline>
                    </svg>
                `;

                const invest = `
                    <svg width="20" height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round">
                        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
                        <polyline points="17 6 23 6 23 12"></polyline>
                    </svg>
                `;

                const quest = `
                    <svg width="20" height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                    </svg>
                `;

                if (type === 'investment')
                    return {
                        svg: invest,
                        cls: 'bg-primary-light text-primary'
                    };

                if (type === 'quest')
                    return {
                        svg: quest,
                        cls: 'bg-warning-light text-warning'
                    };

                if (type === 'withdrawal')
                    return {
                        svg: arrowDown,
                        cls: 'bg-danger-light text-danger'
                    };

                return {
                    svg: arrowUp,
                    cls: positive
                        ? 'bg-success-light text-success'
                        : 'bg-danger-light text-danger'
                };
            };

            const labelFor = type => ({
                deposit: 'Dépôt',
                withdrawal: 'Retrait',
                investment: 'Investissement',
                gain: 'Gain généré',
                referral_commission:
                    'Commission de parrainage',
                quest: 'Quête journalière'
            }[type] || type);

            transactionsList.innerHTML =
                transactions.length
                    ? transactions.map(t => {

                        const amount =
                            Number(t.amount);

                        const positive =
                            amount >= 0;

                        const { svg, cls } =
                            iconFor(t.type, positive);

                        const date =
                            t.created_at
                                ? new Date(
                                    t.created_at
                                ).toLocaleString(
                                    'fr-FR',
                                    {
                                        day: '2-digit',
                                        month: '2-digit',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    }
                                )
                                : '';

                        return `
                            <div class="transaction-item">

                                <div class="transaction-icon ${cls}">
                                    ${svg}
                                </div>

                                <div class="transaction-info">
                                    <div class="transaction-title">
                                        ${labelFor(t.type)}
                                    </div>

                                    <div class="transaction-desc">
                                        ${t.description || ''}
                                    </div>
                                </div>

                                <div class="transaction-meta">

                                    <div class="transaction-date">
                                        ${date}
                                    </div>

                                    <div class="transaction-amount ${positive ? 'positive' : 'negative'}">
                                        ${positive ? '+' : ''}
                                        ${formatFCFA(amount)}
                                    </div>

                                </div>

                            </div>
                        `;

                    }).join('')
                    : '<p class="text-secondary" style="padding:12px 2px;">Aucune transaction pour le moment.</p>';
        }
    };

    renderDashboardData();

    // ------------------------------------------------------------------
    // 5. RAFRAÎCHISSEMENT
    // ------------------------------------------------------------------

    const refreshDashboardData = async () => {

        const [
            w,
            p,
            inv,
            tr
        ] = await Promise.all([

            window.supabaseClient
                .from('wallets')
                .select('*')
                .eq('user_id', authUser.id)
                .single(),

            window.supabaseClient
                .from('investment_products')
                .select('*')
                .eq('is_active', true)
                .order('category')
                .order('sort_order'),

            window.supabaseClient
                .from('user_investments')
                .select('*, investment_products(name, category, daily_rate)')
                .eq('user_id', authUser.id)
                .order('created_at', {
                    ascending: false
                }),

            window.supabaseClient
                .from('transactions')
                .select('*')
                .eq('user_id', authUser.id)
                .order('created_at', {
                    ascending: false
                })
                .limit(100)
        ]);

        wallet = w.data || wallet;
        products = p.data || products;
        investments = inv.data || investments;
        transactions = tr.data || transactions;

        renderDashboardData();
    };

    // ------------------------------------------------------------------
    // 6. ACHAT PRODUIT
    // ------------------------------------------------------------------

    const categoryLabel = {
        atlas: 'Revenu Annuel',
        constant: 'Actif — Constant',
        analyse: 'Actif — Analyse',
        quete: 'Quête Quotidienne'
    };

    const showPurchaseConfirmation = btn => {

        const name =
            btn.getAttribute('data-product-name');

        const category =
            btn.getAttribute('data-product-category');

        const dailyGain =
            Number(
                btn.getAttribute('data-daily-gain')
            );

        const duration =
            btn.getAttribute('data-duration');

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

            const btn =
                e.target.closest('.buy-product-btn');

            if (!btn || btn.disabled) return;

            const productId =
                btn.getAttribute('data-product-id');

            btn.disabled = true;

            const originalText =
                btn.textContent;

            btn.textContent = 'Traitement...';

            try {

                const { error } =
                    await window.supabaseClient.rpc(
                        'purchase_investment',
                        {
                            p_product_id: productId
                        }
                    );

                if (error) {

                    window.showToast(
                        error.message ||
                        "Impossible d'effectuer cet investissement.",
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
    // 7. DÉPÔT RÉEL
    // ------------------------------------------------------------------

    const depositBtn =
        document.getElementById('wallet-deposit-btn');

    const withdrawBtn =
        document.getElementById('wallet-withdraw-btn');

    const closeFinanceModal = () => {

        const modal =
            document.getElementById(
                'wallet-action-modal'
            );

        if (modal) modal.remove();
    };

    const getPaymentMethodsForUser = () => {

        const country =
            profile.country ||
            profile.country_code ||
            'CM';

        if (
            window.AtlasPaymentMethods &&
            typeof window.AtlasPaymentMethods
                .getPaymentMethods === 'function'
        ) {

            return window.AtlasPaymentMethods
                .getPaymentMethods(country);
        }

        return [
            {
                id: 'orange_money_cm',
                name: 'Orange Money',
                icon: '🟠',
                number: '+237 690 000 000',
                holder: 'ATLAS CAPITAL SARL',
                note: 'Remplacez ce numéro par votre numéro officiel.'
            },
            {
                id: 'mtn_momo_cm',
                name: 'MTN Mobile Money',
                icon: '🟡',
                number: '+237 670 000 000',
                holder: 'ATLAS CAPITAL SARL',
                note: 'Remplacez ce numéro par votre numéro officiel.'
            }
        ];
    };

    const openDepositModal = () => {

        closeFinanceModal();

        const methods =
            getPaymentMethodsForUser();

        const modal =
            document.createElement('div');

        modal.id =
            'wallet-action-modal';

        modal.className =
            'modal-overlay active';

        modal.innerHTML = `
            <div class="modal-card"
                 style="max-width:520px;max-height:90vh;overflow:auto;">

                <button type="button"
                        class="modal-close"
                        id="wallet-modal-close">
                    ✕
                </button>

                <div class="task-modal-badge">
                    DÉPÔT
                </div>

                <h3 class="task-modal-title">
                    Faire un dépôt
                </h3>

                <p class="task-modal-sub">
                    Choisissez un moyen de paiement,
                    effectuez le transfert puis envoyez
                    votre demande. Votre solde sera crédité
                    après validation.
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
                    ${
                        methods.map(m => `
                            <option value="${m.id}">
                                ${m.icon || '💳'} ${m.name}
                            </option>
                        `).join('')
                    }
                </select>

                <div
                    id="deposit-payment-details"
                    style="background:#f6f8fb;border-radius:12px;padding:15px;margin-bottom:15px;">
                </div>

                <label style="display:block;font-weight:600;margin-bottom:6px;">
                    Référence de transaction
                </label>

                <input
                    id="deposit-reference"
                    type="text"
                    placeholder="Ex. ID de transaction"
                    maxlength="120"
                    style="width:100%;padding:14px;border:1px solid #dbe3ef;border-radius:10px;margin-bottom:16px;box-sizing:border-box;"
                >

                <button
                    type="button"
                    id="deposit-submit"
                    class="btn btn-primary"
                    style="width:100%;">
                    J'ai effectué le paiement — Envoyer
                </button>

            </div>
        `;

        document.body.appendChild(modal);

        const methodSelect =
            modal.querySelector('#deposit-method');

        const details =
            modal.querySelector(
                '#deposit-payment-details'
            );

        const amountInput =
            modal.querySelector('#deposit-amount');

        const referenceInput =
            modal.querySelector('#deposit-reference');

        const submitBtn =
            modal.querySelector('#deposit-submit');

        const renderMethod = () => {

            const method =
                methods.find(
                    m => m.id === methodSelect.value
                ) || methods[0];

            if (!method) {

                details.innerHTML =
                    '<strong>Aucun moyen de paiement disponible.</strong>';

                return;
            }

            details.innerHTML = `
                <strong>
                    ${method.icon || '💳'}
                    ${method.name}
                </strong>

                <div style="margin-top:10px;font-size:20px;font-weight:700;word-break:break-word;">
                    ${method.number || 'Coordonnées non configurées'}
                </div>

                <div style="margin-top:5px;color:#64748b;">
                    Titulaire :
                    ${method.holder || 'ATLAS CAPITAL SARL'}
                </div>

                <div style="margin-top:8px;color:#64748b;">
                    ${method.note ||
                    'Effectuez le transfert puis indiquez la référence ci-dessous.'}
                </div>
            `;
        };

        renderMethod();

        methodSelect.addEventListener(
            'change',
            renderMethod
        );

        modal
            .querySelector('#wallet-modal-close')
            .addEventListener(
                'click',
                closeFinanceModal
            );

        modal.addEventListener(
            'click',
            e => {
                if (e.target === modal) {
                    closeFinanceModal();
                }
            }
        );

        submitBtn.addEventListener(
            'click',
            async () => {

                const amount =
                    Number(amountInput.value);

                const method =
                    methods.find(
                        m => m.id === methodSelect.value
                    );

                const reference =
                    referenceInput.value.trim();

                if (
                    !Number.isFinite(amount) ||
                    amount < 1000
                ) {

                    window.showToast(
                        'Le montant minimum est de 1 000 FCFA.',
                        'error'
                    );

                    return;
                }

                if (!method) {

                    window.showToast(
                        'Choisissez un moyen de paiement.',
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

                submitBtn.textContent =
                    'Envoi en cours...';

                try {

                    const { error } =
                        await window.supabaseClient
                            .from('deposit_requests')
                            .insert({

                                user_id:
                                    authUser.id,

                                amount:
                                    amount,

                                method:
                                    method.name,

                                payment_method:
                                    method.name,

                                transaction_reference:
                                    reference,

                                status:
                                    'pending'
                            });

                    if (error) {

                        console.error(
                            'Erreur dépôt Supabase :',
                            error
                        );

                        window.showToast(
                            'Erreur lors de l’envoi : ' +
                            error.message,
                            'error',
                            {
                                duration: 7000
                            }
                        );

                        submitBtn.disabled = false;

                        submitBtn.textContent =
                            "J'ai effectué le paiement — Envoyer";

                        return;
                    }

                    closeFinanceModal();

                    window.showToast(
                        'Demande de dépôt envoyée. Votre solde sera crédité après validation.',
                        'success',
                        {
                            duration: 7000
                        }
                    );

                } catch (err) {

                    console.error(
                        'Erreur dépôt :',
                        err
                    );

                    window.showToast(
                        'Une erreur est survenue. Réessayez.',
                        'error'
                    );

                    submitBtn.disabled = false;

                    submitBtn.textContent =
                        "J'ai effectué le paiement — Envoyer";
                }
            }
        );
    };

    if (depositBtn) {

        depositBtn.addEventListener(
            'click',
            e => {

                e.preventDefault();
                e.stopPropagation();

                openDepositModal();
            }
        );
    }

    if (withdrawBtn) {

        withdrawBtn.addEventListener(
            'click',
            e => {

                e.preventDefault();
                e.stopPropagation();

                window.showToast(
                    'Le retrait sera disponible après validation du code PIN.',
                    'info'
                );
            }
        );
    }

    // ------------------------------------------------------------------
    // 8. NAVIGATION
    // ------------------------------------------------------------------

    const navLinks =
        document.querySelectorAll(
            '.nav-link, .bottom-nav-item'
        );

    const views =
        document.querySelectorAll(
            '.view-section'
        );

    navLinks.forEach(link => {

        link.addEventListener(
            'click',
            e => {

                e.preventDefault();

                const target =
                    link.getAttribute(
                        'data-target'
                    );

                if (!target) return;

                navLinks.forEach(l =>
                    l.classList.remove('active')
                );

                document
                    .querySelectorAll(
                        `[data-target="${target}"]`
                    )
                    .forEach(l =>
                        l.classList.add('active')
                    );

                views.forEach(v =>
                    v.classList.remove('active')
                );

                const targetView =
                    document.getElementById(
                        `view-${target}`
                    );

                if (targetView) {
                    targetView.classList.add('active');
                }

                window.scrollTo(0, 0);
            }
        );
    });

    // ------------------------------------------------------------------
    // 9. NOTIFICATIONS
    // ------------------------------------------------------------------

    const refreshNotifications = async () => {

        const { data, error } =
            await window.supabaseClient
                .from('notifications')
                .select('*')
                .eq('user_id', authUser.id)
                .order('created_at', {
                    ascending: false
                })
                .limit(30);

        if (error) {

            console.error(
                'Erreur notifications :',
                error
            );

            return;
        }

        notifications =
            data || [];

        const count =
            notifications.filter(
                n => !n.is_read
            ).length;

        document
            .querySelectorAll(
                '.notification-count'
            )
            .forEach(el => {
                el.textContent = count;
                el.style.display =
                    count > 0
                        ? 'inline-flex'
                        : 'none';
            });
    };

    refreshNotifications();

    // ------------------------------------------------------------------
    // 10. TÂCHES QUOTIDIENNES
    // ------------------------------------------------------------------

    const renderDailyTasks = () => {

        const container =
            document.getElementById(
                'daily-tasks-container'
            );

        if (!container) return;

        if (!investments.length) {

            container.innerHTML =
                '<p class="text-secondary">Aucune tâche disponible pour le moment.</p>';

            return;
        }

        container.innerHTML =
            investments
                .filter(i => i.status === 'active')
                .map(i => {

                    const product =
                        i.investment_products || {};

                    return `
                        <div class="daily-task-card">

                            <div>
                                <strong>
                                    ${product.name || 'Produit'}
                                </strong>

                                <div class="text-secondary">
                                    Validez votre tâche quotidienne
                                    pour débloquer le gain.
                                </div>
                            </div>

                            <button
                                class="btn btn-primary daily-task-btn"
                                data-investment-id="${i.id}">
                                Valider
                            </button>

                        </div>
                    `;

                }).join('');

        container
            .querySelectorAll('.daily-task-btn')
            .forEach(btn => {

                btn.addEventListener(
                    'click',
                    async () => {

                        const investmentId =
                            btn.getAttribute(
                                'data-investment-id'
                            );

                        btn.disabled = true;
                        btn.textContent =
                            'Traitement...';

                        try {

                            const { error } =
                                await window.supabaseClient
                                    .rpc(
                                        'claim_daily_task',
                                        {
                                            p_investment_id:
                                                investmentId
                                        }
                                    );

                            if (error) {

                                window.showToast(
                                    error.message ||
                                    'Impossible de valider la tâche.',
                                    'error'
                                );

                                btn.disabled = false;
                                btn.textContent =
                                    'Valider';

                                return;
                            }

                            window.showToast(
                                'Tâche validée et gain crédité.',
                                'success'
                            );

                            await refreshDashboardData();

                            await refreshNotifications();

                        } catch (err) {

                            console.error(
                                err
                            );

                            window.showToast(
                                'Erreur : ' +
                                err.message,
                                'error'
                            );

                            btn.disabled = false;
                            btn.textContent =
                                'Valider';
                        }
                    }
                );
            });
    };

    renderDailyTasks();

    // ------------------------------------------------------------------
    // 11. INFORMATIONS COMPTE
    // ------------------------------------------------------------------

    const accountNameInput =
        document.getElementById(
            'account-name-input'
        );

    const accountPhoneInput =
        document.getElementById(
            'account-phone-input'
        );

    const accountPasswordInput =
        document.getElementById(
            'account-password-input'
        );

    const accountSaveBtn =
        document.getElementById(
            'account-save-btn'
        );

    if (accountNameInput)
        accountNameInput.value =
            profile.full_name || '';

    if (accountPhoneInput)
        accountPhoneInput.value =
            profile.phone || '';

    if (accountSaveBtn) {

        accountSaveBtn.addEventListener(
            'click',
            async () => {

                const fullName =
                    accountNameInput
                        ? accountNameInput.value.trim()
                        : '';

                const phone =
                    accountPhoneInput
                        ? accountPhoneInput.value.trim()
                        : '';

                const updates = {
                    full_name: fullName,
                    phone: phone
                };

                if (
                    accountPasswordInput &&
                    accountPasswordInput.value.trim()
                ) {

                    const { error:
                        passwordError
                    } =
                        await window.supabaseClient
                            .auth.updateUser({
                                password:
                                    accountPasswordInput.value
                            });

                    if (passwordError) {

                        window.showToast(
                            passwordError.message,
                            'error'
                        );

                        return;
                    }
                }

                const { error } =
                    await window.supabaseClient
                        .from('profiles')
                        .update(updates)
                        .eq('id', authUser.id);

                if (error) {

                    window.showToast(
                        error.message ||
                        'Impossible de modifier vos informations.',
                        'error'
                    );

                    return;
                }

                profile = {
                    ...profile,
                    ...updates
                };

                document
                    .querySelectorAll('.user-name')
                    .forEach(el =>
                        el.textContent =
                            profile.full_name ||
                            authUser.email
                    );

                window.showToast(
                    'Informations mises à jour.',
                    'success'
                );

                if (accountPasswordInput) {
                    accountPasswordInput.value = '';
                }
            }
        );
    }

    // ------------------------------------------------------------------
    // 12. DÉCONNEXION
    // ------------------------------------------------------------------

    document
        .querySelectorAll(
            '[data-action="logout"], #logout-btn'
        )
        .forEach(btn => {

            btn.addEventListener(
                'click',
                async e => {

                    e.preventDefault();

                    await window.supabaseClient.auth.signOut();

                    window.location.href =
                        'index.html';
                }
            );
        });

    // ------------------------------------------------------------------
    // 13. PARRAINAGE
    // ------------------------------------------------------------------

    const referralLinkInput =
        document.getElementById(
            'referral-link'
        );

    const referralCopyBtn =
        document.getElementById(
            'referral-copy-btn'
        );

    const referralShareBtn =
        document.getElementById(
            'referral-share-btn'
        );

    const referralWhatsappBtn =
        document.getElementById(
            'referral-whatsapp-btn'
        );

    const referralCountEl =
        document.getElementById(
            'referral-count'
        );

    const referralEarningsEl =
        document.getElementById(
            'referral-earnings'
        );

    if (referralLinkInput) {

        const referralCode =
            profile.referral_code || '';

        const referralLink =
            `${window.location.origin}${window.location.pathname.replace(
                'dashboard.html',
                'index.html'
            )}?ref=${referralCode}`;

        referralLinkInput.value =
            referralLink;

        if (referralEarningsEl) {

            referralEarningsEl.textContent =
                formatFCFA(
                    wallet.referral_earnings
                );
        }

        if (
            referralCountEl &&
            referralCode
        ) {

            window.supabaseClient
                .from('profiles')
                .select(
                    'id',
                    {
                        count: 'exact',
                        head: true
                    }
                )
                .eq(
                    'referred_by',
                    referralCode
                )
                .then(({ count }) => {

                    referralCountEl.textContent =
                        count || 0;
                });
        }

        if (referralCopyBtn) {

            referralCopyBtn.addEventListener(
                'click',
                async () => {

                    try {

                        await navigator.clipboard
                            .writeText(
                                referralLink
                            );

                    } catch (err) {

                        referralLinkInput.select();

                        document.execCommand(
                            'copy'
                        );
                    }

                    window.showToast(
                        'Lien de parrainage copié !',
                        'success'
                    );
                }
            );
        }

        if (referralShareBtn) {

            referralShareBtn.addEventListener(
                'click',
                async () => {

                    if (navigator.share) {

                        try {

                            await navigator.share({
                                title:
                                    'Atlas Capital',
                                text:
                                    'Rejoins Atlas Capital et fais fructifier ton argent avec moi 🚀',
                                url:
                                    referralLink
                            });

                        } catch (err) {
                            // partage annulé
                        }

                    } else {

                        try {

                            await navigator.clipboard
                                .writeText(
                                    referralLink
                                );

                            window.showToast(
                                'Lien copié, prêt à être partagé !',
                                'success'
                            );

                        } catch (err) {

                            window.showToast(
                                'Impossible de partager automatiquement.',
                                'error'
                            );
                        }
                    }
                }
            );
        }

        if (referralWhatsappBtn) {

            const message =
                encodeURIComponent(
                    `Rejoins Atlas Capital et fais fructifier ton argent avec moi 🚀 ${referralLink}`
                );

            referralWhatsappBtn.href =
                `https://wa.me/?text=${message}`;
        }
    }

    // ------------------------------------------------------------------
    // 14. CODE DE PARRAINAGE
    // ------------------------------------------------------------------

    const redeemInput =
        document.getElementById(
            'redeem-code-input'
        );

    const redeemBtn =
        document.getElementById(
            'redeem-code-btn'
        );

    if (redeemBtn) {

        redeemBtn.addEventListener(
            'click',
            async () => {

                const code =
                    redeemInput.value
                        .trim()
                        .toUpperCase();

                if (!code) {

                    window.showToast(
                        'Veuillez entrer un code.',
                        'error'
                    );

                    return;
                }

                if (
                    profile.referral_code ===
                    code
                ) {

                    window.showToast(
                        'Vous ne pouvez pas utiliser votre propre code.',
                        'error'
                    );

                    return;
                }

                if (profile.referred_by) {

                    window.showToast(
                        'Un code de parrainage est déjà associé à votre compte.',
                        'error'
                    );

                    return;
                }

                const { data: sponsor } =
                    await window.supabaseClient
                        .from('profiles')
                        .select('id')
                        .eq(
                            'referral_code',
                            code
                        )
                        .maybeSingle();

                if (!sponsor) {

                    window.showToast(
                        'Code de parrainage invalide.',
                        'error'
                    );

                    return;
                }

                const { error } =
                    await window.supabaseClient
                        .from('profiles')
                        .update({
                            referred_by: code
                        })
                        .eq(
                            'id',
                            authUser.id
                        );

                if (error) {

                    window.showToast(
                        "Impossible d'enregistrer ce code pour le moment.",
                        'error'
                    );

                    return;
                }

                profile.referred_by =
                    code;

                redeemInput.value = '';

                const redeemInputRow =
                    document.getElementById(
                        'redeem-code-row'
                    );

                const redeemToggleBtn =
                    document.getElementById(
                        'redeem-code-toggle'
                    );

                if (redeemInputRow)
                    redeemInputRow.classList.remove(
                        'open'
                    );

                if (redeemToggleBtn)
                    redeemToggleBtn.classList.remove(
                        'open'
                    );

                window.showToast(
                    'Code de parrainage validé !',
                    'success'
                );
            }
        );
    }

    // ------------------------------------------------------------------
    // 15. ADMIN
    // ------------------------------------------------------------------

    const adminMenuItem =
        document.getElementById(
            'admin-menu-item'
        );

    if (
        adminMenuItem &&
        profile.is_admin
    ) {

        adminMenuItem.style.display =
            '';

        adminMenuItem.addEventListener(
            'click',
            () => {
                window.location.href =
                    'admin.html';
            }
        );
    }

});
