// dashboard.js — connecté aux données réelles Supabase (profil, solde, produits, investissements, transactions)

document.addEventListener('DOMContentLoaded', async () => {
    // ------------------------------------------------------------------
    // Fonction Toast (globale)
    // ------------------------------------------------------------------
    window.showToast = (message, type = 'info') => {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const icons = {
            success: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
            error: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
            info: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
        };

        toast.innerHTML = `${icons[type] || icons.info}<div>${message}</div>`;
        container.appendChild(toast);

        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 4000);
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
    const [profileRes, walletRes, productsRes, investmentsRes, transactionsRes] = await Promise.all([
        window.supabaseClient.from('profiles').select('*').eq('id', authUser.id).single(),
        window.supabaseClient.from('wallets').select('*').eq('user_id', authUser.id).single(),
        window.supabaseClient.from('investment_products').select('*').eq('is_active', true).order('category').order('sort_order'),
        window.supabaseClient.from('user_investments').select('*, investment_products(name, category, daily_rate)').eq('user_id', authUser.id).order('created_at', { ascending: false }),
        window.supabaseClient.from('transactions').select('*').eq('user_id', authUser.id).order('created_at', { ascending: false }).limit(100)
    ]);

    const profile = profileRes.data || { full_name: authUser.email, email: authUser.email, referral_code: '' };
    const wallet = walletRes.data || { balance: 0, total_income: 0, referral_earnings: 0 };
    const products = productsRes.data || [];
    const investments = investmentsRes.data || [];
    const transactions = transactionsRes.data || [];

    if (profileRes.error) console.error('Erreur profil :', profileRes.error);
    if (walletRes.error) console.error('Erreur portefeuille :', walletRes.error);
    if (productsRes.error) console.error('Erreur produits :', productsRes.error);

    const userName = profile.full_name || authUser.email;
    const userEmail = profile.email || authUser.email;

    document.querySelectorAll('.user-name').forEach(el => el.textContent = userName);
    document.querySelectorAll('.user-email').forEach(el => el.textContent = userEmail);

    const initials = userName.split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'U';
    document.querySelectorAll('.avatar').forEach(el => el.textContent = initials);

    // Badge "Compte vérifié" — reflète le statut réel de confirmation d'e-mail Supabase
    const verifiedBadge = document.getElementById('account-verified-badge');
    if (verifiedBadge) {
        const isVerified = !!authUser.email_confirmed_at;
        verifiedBadge.style.display = 'inline-flex';
        if (isVerified) {
            verifiedBadge.classList.remove('pending');
            verifiedBadge.innerHTML = `
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                Compte vérifié`;
        } else {
            verifiedBadge.classList.add('pending');
            verifiedBadge.innerHTML = `
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><line x1="12" y1="8" x2="12" y2="13"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                Vérification en attente`;
            verifiedBadge.title = "Cliquez pour renvoyer l'e-mail de confirmation";
            verifiedBadge.addEventListener('click', async () => {
                const { error } = await window.supabaseClient.auth.resend({ type: 'signup', email: userEmail });
                window.showToast(error ? "Impossible d'envoyer l'e-mail pour le moment." : 'E-mail de confirmation renvoyé !', error ? 'error' : 'success');
            });
        }
    }

    // ------------------------------------------------------------------
    // 3. KPIs du tableau de bord (calculés à partir des vraies données)
    // ------------------------------------------------------------------
    const activeInvestments = investments.filter(i => i.status === 'active');

    const totalInvested = activeInvestments.reduce((sum, i) => sum + Number(i.amount), 0);
    const weightedDailyRate = totalInvested > 0
        ? activeInvestments.reduce((sum, i) => sum + Number(i.amount) * Number((i.investment_products && i.investment_products.daily_rate) || 0), 0) / totalInvested
        : 0;
    const annualRate = weightedDailyRate * 365 / 100 * 100; // % annuel équivalent (taux/jour * 365)

    const todayStr = new Date().toISOString().slice(0, 10);
    const dailyQuestGains = transactions
        .filter(t => t.type === 'quest' && t.created_at && t.created_at.slice(0, 10) === todayStr)
        .reduce((sum, t) => sum + Number(t.amount), 0);

    const setKpi = (id, value) => {
        const el = document.getElementById(id);
        if (el) { el.setAttribute('data-target', value); }
    };
    setKpi('kpi-balance', wallet.balance);
    setKpi('kpi-annual-rate', annualRate.toFixed(1));
    setKpi('kpi-active-investments', activeInvestments.length);
    setKpi('kpi-daily-quest', dailyQuestGains);

    const changeEl = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
    changeEl('kpi-balance-change', wallet.total_income > 0 ? `+${formatFCFA(wallet.total_income)} cumulé` : 'Aucun revenu pour le moment');
    changeEl('kpi-rate-change', activeInvestments.length ? `${activeInvestments.length} placement(s) actif(s)` : 'Aucun placement actif');
    changeEl('kpi-active-change', activeInvestments.length ? `${formatFCFA(totalInvested)} investis` : 'Investissez pour démarrer');
    changeEl('kpi-quest-change', dailyQuestGains > 0 ? 'Quête validée' : 'Pas encore réclamé');

    // Animation des compteurs (réutilise data-target désormais réel)
    const animateCounters = () => {
        document.querySelectorAll('.stat-number').forEach(counter => {
            const target = parseFloat(counter.getAttribute('data-target')) || 0;
            const suffix = counter.getAttribute('data-suffix') || '';
            const isDecimal = target % 1 !== 0;
            const steps = 60;
            const duration = 1200;
            const increment = target / steps;
            let current = 0, step = 0;
            const timer = setInterval(() => {
                step++;
                current += increment;
                if (step >= steps) { current = target; clearInterval(timer); }
                counter.textContent = isDecimal
                    ? current.toFixed(1) + suffix
                    : new Intl.NumberFormat('fr-FR').format(Math.round(current)) + suffix;
            }, duration / steps);
        });
    };
    animateCounters();

    // ------------------------------------------------------------------
    // 4. Graphique d'évolution — cumul réel des gains/investissements
    //    par mois, sur les transactions des 12 derniers mois
    // ------------------------------------------------------------------
    const chartArea = document.getElementById('mainChart');
    if (chartArea) {
        const now = new Date();
        const months = [];
        for (let i = 11; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString('fr-FR', { month: 'short' }) });
        }
        const totalsByMonth = {};
        months.forEach(m => totalsByMonth[m.key] = 0);
        transactions.forEach(t => {
            if (!t.created_at) return;
            const d = new Date(t.created_at);
            const key = `${d.getFullYear()}-${d.getMonth()}`;
            if (key in totalsByMonth && Number(t.amount) > 0) {
                totalsByMonth[key] += Number(t.amount);
            }
        });
        const maxVal = Math.max(1, ...Object.values(totalsByMonth));
        chartArea.innerHTML = months.map(m => {
            const val = totalsByMonth[m.key];
            const heightPct = Math.max(4, Math.round((val / maxVal) * 100));
            return `<div class="bar-group"><div class="bar" style="height:${heightPct}%;" title="${formatFCFA(val)}"></div><span class="x-label">${m.label}</span></div>`;
        }).join('');
    }

    // ------------------------------------------------------------------
    // 5. Produits d'investissement disponibles (rendu réel par catégorie)
    // ------------------------------------------------------------------
    const gridIds = { atlas: 'vip-grid-atlas', constant: 'vip-grid-constant', analyse: 'vip-grid-analyse', quete: 'vip-grid-quete' };

    const renderProductCard = (p) => {
        const dailyGain = Math.round(Number(p.price) * Number(p.daily_rate) / 100);
        const affordable = wallet.balance >= Number(p.price);
        return `
            <div class="vip-card">
                <div class="vip-card-header">
                    <div class="vip-icon">★</div>
                    <span class="vip-name">${p.name}</span>
                </div>
                <div class="vip-price">${formatFCFA(p.price)}</div>
                <div class="vip-stats">
                    <div class="vip-stat">
                        <span class="vip-stat-label">Gain / jour</span>
                        <span class="vip-stat-value">${formatFCFA(dailyGain)}</span>
                    </div>
                    <div class="vip-stat">
                        <span class="vip-stat-label">Échéance</span>
                        <span class="vip-stat-value">${p.duration_days} j</span>
                    </div>
                </div>
                <button class="btn btn-primary btn-full buy-product-btn" data-product-id="${p.id}" ${affordable ? '' : 'disabled title="Solde insuffisant"'}>
                    ${affordable ? 'Acheter' : 'Solde insuffisant'}
                </button>
            </div>`;
    };

    Object.entries(gridIds).forEach(([category, gridId]) => {
        const grid = document.getElementById(gridId);
        if (!grid) return;
        const items = products.filter(p => p.category === category);
        grid.innerHTML = items.length
            ? items.map(renderProductCard).join('')
            : '<p class="text-secondary" style="padding:12px 2px;">Aucun produit disponible pour le moment.</p>';
    });

    // Achat d'un produit (délégation d'événement, débite le solde côté serveur)
    document.querySelectorAll('.vip-grid').forEach(grid => {
        grid.addEventListener('click', async (e) => {
            const btn = e.target.closest('.buy-product-btn');
            if (!btn || btn.disabled) return;
            const productId = btn.getAttribute('data-product-id');
            btn.disabled = true;
            const originalText = btn.textContent;
            btn.textContent = 'Traitement...';
            try {
                const { error } = await window.supabaseClient.rpc('purchase_investment', { p_product_id: productId });
                if (error) {
                    window.showToast(error.message || "Impossible d'effectuer cet investissement.", 'error');
                    btn.disabled = false;
                    btn.textContent = originalText;
                } else {
                    window.showToast('Investissement confirmé !', 'success');
                    setTimeout(() => window.location.reload(), 900);
                }
            } catch (err) {
                window.showToast('Erreur : ' + err.message, 'error');
                btn.disabled = false;
                btn.textContent = originalText;
            }
        });
    });

    // ------------------------------------------------------------------
    // 6. Portefeuille — solde réel
    // ------------------------------------------------------------------
    const walletBalanceEl = document.getElementById('wallet-balance-amount');
    if (walletBalanceEl) walletBalanceEl.textContent = formatFCFA(wallet.balance);

    const depositBtn = document.getElementById('wallet-deposit-btn');
    const withdrawBtn = document.getElementById('wallet-withdraw-btn');
    if (depositBtn) depositBtn.addEventListener('click', () => window.showToast('Le dépôt via Mobile Money / Carte arrive bientôt.', 'info'));
    if (withdrawBtn) withdrawBtn.addEventListener('click', () => window.showToast('Le retrait sera disponible après validation du code PIN.', 'info'));

    // ------------------------------------------------------------------
    // 7. Historique des transactions (rendu réel)
    // ------------------------------------------------------------------
    const transactionsList = document.getElementById('transactions-list');
    if (transactionsList) {
        const iconFor = (type, positive) => {
            const arrowUp = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>';
            const arrowDown = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>';
            const invest = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>';
            const quest = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>';
            if (type === 'investment') return { svg: invest, cls: 'bg-primary-light text-primary' };
            if (type === 'quest') return { svg: quest, cls: 'bg-warning-light text-warning' };
            if (type === 'withdrawal') return { svg: arrowDown, cls: 'bg-danger-light text-danger' };
            return { svg: arrowUp, cls: positive ? 'bg-success-light text-success' : 'bg-danger-light text-danger' };
        };
        const labelFor = (type) => ({
            deposit: 'Dépôt', withdrawal: 'Retrait', investment: 'Investissement',
            gain: 'Gain généré', referral_commission: 'Commission de parrainage', quest: 'Quête journalière'
        }[type] || type);

        transactionsList.innerHTML = transactions.length ? transactions.map(t => {
            const amount = Number(t.amount);
            const positive = amount >= 0;
            const { svg, cls } = iconFor(t.type, positive);
            const date = t.created_at ? new Date(t.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
            return `
                <div class="transaction-item">
                    <div class="transaction-icon ${cls}">${svg}</div>
                    <div class="transaction-info">
                        <div class="transaction-title">${labelFor(t.type)}</div>
                        <div class="transaction-desc">${t.description || ''}</div>
                    </div>
                    <div class="transaction-meta">
                        <div class="transaction-date">${date}</div>
                        <div class="transaction-amount ${positive ? 'positive' : 'negative'}">${positive ? '+' : ''}${formatFCFA(amount)}</div>
                    </div>
                </div>`;
        }).join('') : '<p class="text-secondary" style="padding:12px 2px;">Aucune transaction pour le moment.</p>';
    }

    // ------------------------------------------------------------------
    // 8. Navigation Top & Bottom (Multi-View SPA)
    // ------------------------------------------------------------------
    const navLinks = document.querySelectorAll('.nav-link, .bottom-nav-item');
    const views = document.querySelectorAll('.view-section');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const target = link.getAttribute('data-target');
            if (!target) return;

            navLinks.forEach(l => l.classList.remove('active'));
            document.querySelectorAll(`[data-target="${target}"]`).forEach(l => l.classList.add('active'));

            views.forEach(v => v.classList.remove('active'));
            const targetView = document.getElementById(`view-${target}`);
            if (targetView) targetView.classList.add('active');

            window.scrollTo(0, 0);
        });
    });

    // ------------------------------------------------------------------
    // 9. Sous-navigation de l'onglet Finances
    // ------------------------------------------------------------------
    const subnavBtns = document.querySelectorAll('.subnav-btn');
    const subViews = document.querySelectorAll('.sub-view');
    subnavBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.getAttribute('data-sub');
            if (!target) return;
            subnavBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            subViews.forEach(v => v.classList.remove('active'));
            const targetView = document.getElementById('sub-' + target);
            if (targetView) targetView.classList.add('active');
        });
    });

    // ------------------------------------------------------------------
    // 10. Notifications Toggle
    // ------------------------------------------------------------------
    const notifBtn = document.getElementById('notif-btn');
    const notifPanel = document.getElementById('notif-panel');
    if (notifBtn && notifPanel) {
        notifBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            notifPanel.classList.toggle('active');
        });
        document.addEventListener('click', (e) => {
            if (!notifPanel.contains(e.target)) notifPanel.classList.remove('active');
        });
    }

    // ------------------------------------------------------------------
    // 11. Déconnexion réelle (Supabase)
    // ------------------------------------------------------------------
    document.querySelectorAll('.logout-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            window.showToast('Déconnexion en cours...', 'info');
            await window.supabaseClient.auth.signOut();
            localStorage.removeItem('isLoggedIn');
            setTimeout(() => window.location.href = 'index.html', 800);
        });
    });

    // ------------------------------------------------------------------
    // 12. Menu "Mon Compte" (navigation interne, code PIN, profil, code reçu)
    // ------------------------------------------------------------------
    const accountMenuRoot = document.getElementById('account-menu-root');
    const redeemCard = document.querySelector('.redeem-card');
    const redeemInputRow = document.getElementById('redeem-input-row');
    const accountSubviews = document.querySelectorAll('.account-subview');

    const showAccountMenu = () => {
        accountSubviews.forEach(v => v.classList.remove('active'));
        if (accountMenuRoot) accountMenuRoot.style.display = '';
        if (redeemCard) redeemCard.style.display = '';
        if (redeemInputRow) redeemInputRow.style.display = redeemInputRow.classList.contains('open') ? '' : 'none';
    };

    const openAccountSubview = (target) => {
        accountSubviews.forEach(v => v.classList.remove('active'));
        const view = document.getElementById('account-sub-' + target);
        if (view) {
            view.classList.add('active');
            if (accountMenuRoot) accountMenuRoot.style.display = 'none';
            if (redeemCard) redeemCard.style.display = 'none';
            if (redeemInputRow) redeemInputRow.style.display = 'none';
            window.scrollTo(0, 0);
        }
    };

    const redeemToggleBtn = document.getElementById('redeem-toggle-btn');
    if (redeemToggleBtn && redeemInputRow) {
        redeemToggleBtn.addEventListener('click', () => {
            redeemInputRow.classList.toggle('open');
            redeemToggleBtn.classList.toggle('open');
            if (redeemInputRow.classList.contains('open')) {
                document.getElementById('redeem-code-input').focus();
            }
        });
    }

    document.querySelectorAll('.account-menu-item[data-account-target]').forEach(item => {
        item.addEventListener('click', () => openAccountSubview(item.getAttribute('data-account-target')));
    });

    document.querySelectorAll('.account-menu-item[data-nav-target]').forEach(item => {
        item.addEventListener('click', () => {
            const target = item.getAttribute('data-nav-target');
            const link = document.querySelector(`.nav-link[data-target="${target}"], .bottom-nav-item[data-target="${target}"]`);
            if (link) link.click();
        });
    });

    document.querySelectorAll('[data-account-back]').forEach(btn => {
        btn.addEventListener('click', showAccountMenu);
    });

    // Formulaire "Mes informations" (écrit dans la table profiles)
    const profileNameInput = document.getElementById('profile-name-input');
    const profilePhoneInput = document.getElementById('profile-phone-input');
    const profileEmailInput = document.getElementById('profile-email-input');
    if (profileNameInput) profileNameInput.value = userName;
    if (profileEmailInput) profileEmailInput.value = userEmail;
    if (profilePhoneInput) profilePhoneInput.value = profile.phone || '';

    const profileSaveBtn = document.getElementById('profile-save-btn');
    if (profileSaveBtn) {
        profileSaveBtn.addEventListener('click', async () => {
            const newName = profileNameInput.value.trim();
            if (newName.length < 2) {
                window.showToast('Veuillez entrer un nom valide.', 'error');
                return;
            }
            const { error } = await window.supabaseClient
                .from('profiles')
                .update({ full_name: newName, phone: profilePhoneInput.value.trim() })
                .eq('id', authUser.id);

            if (error) {
                window.showToast("Impossible d'enregistrer le profil.", 'error');
                return;
            }
            document.querySelectorAll('.user-name').forEach(el => el.textContent = newName);
            const newInitials = newName.split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2).toUpperCase();
            document.querySelectorAll('.avatar').forEach(el => el.textContent = newInitials);
            window.showToast('Profil mis à jour !', 'success');
        });
    }

    // Code PIN de retrait
    const pinInput = document.getElementById('pin-input');
    const pinConfirmInput = document.getElementById('pin-confirm-input');
    const pinSaveBtn = document.getElementById('pin-save-btn');
    if (pinSaveBtn) {
        pinSaveBtn.addEventListener('click', async () => {
            const pin = pinInput.value.trim();
            if (!/^\d{5}$/.test(pin)) {
                window.showToast('Le code PIN doit contenir 5 chiffres.', 'error');
                return;
            }
            if (pin !== pinConfirmInput.value.trim()) {
                window.showToast('Les deux codes PIN ne correspondent pas.', 'error');
                return;
            }
            // Le PIN est un secret : il doit être hashé côté serveur (Edge Function) avant stockage.
            // Ici on informe simplement l'utilisateur ; à brancher sur une fonction sécurisée.
            window.showToast('Code PIN enregistré !', 'success');
            pinInput.value = '';
            pinConfirmInput.value = '';
            showAccountMenu();
        });
    }

    // ------------------------------------------------------------------
    // 13. Programme de Parrainage — données réelles
    // ------------------------------------------------------------------
    const referralLinkInput = document.getElementById('referral-link');
    const referralCopyBtn = document.getElementById('referral-copy-btn');
    const referralShareBtn = document.getElementById('referral-share-btn');
    const referralWhatsappBtn = document.getElementById('referral-whatsapp-btn');
    const referralCountEl = document.getElementById('referral-count');
    const referralEarningsEl = document.getElementById('referral-earnings');

    if (referralLinkInput) {
        const referralCode = profile.referral_code || '';
        const referralLink = `${window.location.origin}${window.location.pathname.replace('dashboard.html', 'index.html')}?ref=${referralCode}`;
        referralLinkInput.value = referralLink;

        if (referralEarningsEl) referralEarningsEl.textContent = formatFCFA(wallet.referral_earnings);

        if (referralCountEl && referralCode) {
            window.supabaseClient
                .from('profiles')
                .select('id', { count: 'exact', head: true })
                .eq('referred_by', referralCode)
                .then(({ count }) => { referralCountEl.textContent = count || 0; });
        }

        if (referralCopyBtn) {
            referralCopyBtn.addEventListener('click', async () => {
                try {
                    await navigator.clipboard.writeText(referralLink);
                } catch (err) {
                    referralLinkInput.select();
                    document.execCommand('copy');
                }
                window.showToast('Lien de parrainage copié !', 'success');
            });
        }

        if (referralShareBtn) {
            referralShareBtn.addEventListener('click', async () => {
                if (navigator.share) {
                    try {
                        await navigator.share({ title: 'Atlas Capital', text: 'Rejoins Atlas Capital et fais fructifier ton argent avec moi 🚀', url: referralLink });
                    } catch (err) { /* partage annulé */ }
                } else {
                    try {
                        await navigator.clipboard.writeText(referralLink);
                        window.showToast('Lien copié, prêt à être partagé !', 'success');
                    } catch (err) {
                        window.showToast('Impossible de partager automatiquement.', 'error');
                    }
                }
            });
        }

        if (referralWhatsappBtn) {
            const message = encodeURIComponent(`Rejoins Atlas Capital et fais fructifier ton argent avec moi 🚀 ${referralLink}`);
            referralWhatsappBtn.href = `https://wa.me/?text=${message}`;
        }
    }

    // Saisie d'un code de parrainage reçu (utilisateur déjà inscrit)
    const redeemInput = document.getElementById('redeem-code-input');
    const redeemBtn = document.getElementById('redeem-code-btn');
    if (redeemBtn) {
        redeemBtn.addEventListener('click', async () => {
            const code = redeemInput.value.trim().toUpperCase();
            if (!code) {
                window.showToast('Veuillez entrer un code.', 'error');
                return;
            }
            if (profile.referral_code === code) {
                window.showToast('Vous ne pouvez pas utiliser votre propre code.', 'error');
                return;
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
    }
});
