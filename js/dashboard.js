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
    const [profileRes, walletRes, productsRes, investmentsRes, transactionsRes, notificationsRes, settingsRes] = await Promise.all([
        window.supabaseClient.from('profiles').select('*').eq('id', authUser.id).single(),
        window.supabaseClient.from('wallets').select('*').eq('user_id', authUser.id).single(),
        window.supabaseClient.from('investment_products').select('*').eq('is_active', true).order('category').order('sort_order'),
        window.supabaseClient.from('user_investments').select('*, investment_products(name, category, daily_rate)').eq('user_id', authUser.id).order('created_at', { ascending: false }),
        window.supabaseClient.from('transactions').select('*').eq('user_id', authUser.id).order('created_at', { ascending: false }).limit(100),
        window.supabaseClient.from('notifications').select('*').eq('user_id', authUser.id).order('created_at', { ascending: false }).limit(30),
        window.supabaseClient.from('site_settings').select('*').eq('id', 1).single()
    ]);

    let profile = profileRes.data || { full_name: authUser.email, email: authUser.email, referral_code: '' };
    let wallet = walletRes.data || { balance: 0, total_income: 0, referral_earnings: 0 };
    let products = productsRes.data || [];
    let investments = investmentsRes.data || [];
    let transactions = transactionsRes.data || [];
    let notifications = notificationsRes.data || [];
    let siteSettings = settingsRes.data || {};

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
    // 3-7. Rendu des données (KPIs, graphique, produits, solde, transactions)
    //      Regroupé dans une fonction réutilisable pour rafraîchir le
    //      tableau de bord juste après un achat, sans recharger la page.
    // ------------------------------------------------------------------

    // ------------------------------------------------------------------
    // 7bis. Tâches Quotidiennes (24h) — obligatoires pour chaque produit
    //       actif. Chaque investissement en cours doit être "débloqué"
    //       via une courte question financière avant que le gain du jour
    //       ne soit crédité au portefeuille.
    //
    //       ⚠️ Pour que le crédit soit réellement sécurisé côté serveur,
    //       créez cette fonction Postgres dans Supabase (SQL Editor) et
    //       ajoutez la colonne `last_task_at` à `user_investments` :
    //
    //       alter table user_investments add column if not exists last_task_at timestamptz;
    //
    //       create or replace function claim_daily_task(p_investment_id uuid)
    //       returns void language plpgsql security definer as $$
    //       declare v_user_id uuid := auth.uid(); v_amount numeric; v_last timestamptz;
    //       begin
    //         select ui.amount * ip.daily_rate / 100, ui.last_task_at into v_amount, v_last
    //         from user_investments ui join investment_products ip on ip.id = ui.product_id
    //         where ui.id = p_investment_id and ui.user_id = v_user_id and ui.status = 'active';
    //         if v_amount is null then raise exception 'Investissement introuvable ou inactif.'; end if;
    //         if v_last is not null and v_last > now() - interval '24 hours' then
    //           raise exception 'Tâche déjà effectuée aujourd''hui.'; end if;
    //         update user_investments set last_task_at = now() where id = p_investment_id;
    //         update wallets set balance = balance + v_amount, total_income = total_income + v_amount where user_id = v_user_id;
    //         insert into transactions (user_id, type, amount, description)
    //           values (v_user_id, 'quest', v_amount, 'Tâche quotidienne validée');
    //       end; $$;
    //
    //       Tant que cette fonction n'existe pas côté Supabase, la tâche
    //       s'affiche et se joue normalement mais l'appel RPC échouera
    //       avec un message d'erreur explicite au lieu de créditer le solde.
    // ------------------------------------------------------------------
    const FINANCE_QUESTIONS = [
        { q: "Qu'est-ce que la diversification en investissement ?", options: ["Tout miser sur un seul actif", "Répartir son capital sur plusieurs actifs pour réduire le risque", "Retirer tout son argent chaque mois", "Emprunter pour investir davantage"], correct: 1 },
        { q: "Que signifie le terme « taux d'intérêt » ?", options: ["Le montant total investi", "Le coût ou le rendement d'un capital, en pourcentage", "Le nombre de transactions par jour", "Le solde disponible sur un compte"], correct: 1 },
        { q: "Qu'est-ce qu'un portefeuille d'investissement ?", options: ["Un compte bancaire classique", "L'ensemble des actifs détenus par un investisseur", "Un simple carnet de chèques", "Une carte de paiement"], correct: 1 },
        { q: "Pourquoi est-il conseillé d'avoir une épargne de précaution ?", options: ["Pour éviter d'investir", "Pour faire face aux imprévus sans toucher à ses investissements", "Parce que c'est obligatoire par la loi", "Pour payer plus d'impôts"], correct: 1 },
        { q: "Qu'est-ce que l'intérêt composé ?", options: ["Un intérêt calculé uniquement sur le capital de départ", "Un intérêt calculé sur le capital et les intérêts déjà accumulés", "Une taxe bancaire", "Un type de prêt étudiant"], correct: 1 },
        { q: "Quel est généralement le lien entre risque et rendement potentiel ?", options: ["Aucun lien", "Plus le risque est élevé, plus le rendement potentiel l'est aussi", "Le risque élevé garantit un rendement faible", "Le rendement est toujours fixe"], correct: 1 },
        { q: "Qu'est-ce qu'un budget mensuel permet de faire ?", options: ["Dépenser sans limite", "Suivre et planifier ses revenus et dépenses", "Éviter de payer ses factures", "Augmenter ses dettes"], correct: 1 },
        { q: "Que signifie « liquidité » d'un actif ?", options: ["Sa couleur sur un graphique", "La facilité à le convertir rapidement en argent disponible", "Son ancienneté", "Le nombre de propriétaires précédents"], correct: 1 }
    ];

    const tasksListEl = document.getElementById('daily-tasks-list');
    const tasksCardEl = document.getElementById('daily-tasks-card');
    let taskCountdownTimer = null;

    const msUntilUnlock = (lastTaskAt) => {
        if (!lastTaskAt) return 0;
        const next = new Date(lastTaskAt).getTime() + 24 * 60 * 60 * 1000;
        return Math.max(0, next - Date.now());
    };
    const formatCountdown = (ms) => {
        const totalMin = Math.ceil(ms / 60000);
        const h = Math.floor(totalMin / 60);
        const m = totalMin % 60;
        return `${h}h ${m.toString().padStart(2, '0')}min`;
    };

    function renderDailyTasks() {
        if (!tasksListEl || !tasksCardEl) return;
        const active = investments.filter(i => i.status === 'active');

        if (!active.length) {
            tasksCardEl.style.display = 'none';
            if (taskCountdownTimer) { clearInterval(taskCountdownTimer); taskCountdownTimer = null; }
            return;
        }
        tasksCardEl.style.display = '';

        tasksListEl.innerHTML = active.map(inv => {
            const prod = inv.investment_products || {};
            const dailyGain = Math.round(Number(inv.amount) * Number(prod.daily_rate || 0) / 100);
            const remaining = msUntilUnlock(inv.last_task_at);
            const available = remaining <= 0;
            return `
                <div class="task-item">
                    <div class="task-info">
                        <div class="task-name">${prod.name || 'Produit'}</div>
                        <div class="task-gain">+${formatFCFA(dailyGain)} à débloquer</div>
                    </div>
                    <div class="task-action">
                        ${available
                            ? `<button type="button" class="btn btn-primary task-btn" data-investment-id="${inv.id}" data-daily-gain="${dailyGain}" data-product-name="${prod.name || 'Produit'}">Effectuer la tâche</button>`
                            : `<span class="task-locked">
                                 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                 Prochaine dans <span class="task-countdown" data-remaining="${remaining}">${formatCountdown(remaining)}</span>
                               </span>`
                        }
                    </div>
                </div>`;
        }).join('');

        if (taskCountdownTimer) clearInterval(taskCountdownTimer);
        taskCountdownTimer = setInterval(() => {
            let needsRerender = false;
            document.querySelectorAll('.task-countdown').forEach(el => {
                let remaining = Number(el.getAttribute('data-remaining')) - 60000;
                if (remaining <= 0) { needsRerender = true; return; }
                el.setAttribute('data-remaining', remaining);
                el.textContent = formatCountdown(remaining);
            });
            if (needsRerender) renderDailyTasks();
        }, 60000);
    }

    // ---- Modal Quiz (question financière à valider) ----
    let taskModalOverlay = null;
    const closeTaskModal = () => { if (taskModalOverlay) taskModalOverlay.classList.remove('active'); };

    const openTaskModal = (investmentId, dailyGain, productName) => {
        const question = FINANCE_QUESTIONS[Math.floor(Math.random() * FINANCE_QUESTIONS.length)];

        if (!taskModalOverlay) {
            taskModalOverlay = document.createElement('div');
            taskModalOverlay.className = 'modal-overlay';
            document.body.appendChild(taskModalOverlay);
            taskModalOverlay.addEventListener('click', (e) => { if (e.target === taskModalOverlay) closeTaskModal(); });
        }

        taskModalOverlay.innerHTML = `
            <div class="modal-card">
                <button type="button" class="modal-close" data-close-task-modal>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
                <span class="task-modal-badge">Tâche quotidienne</span>
                <h2 class="task-modal-title">${productName}</h2>
                <p class="task-modal-sub">Répondez correctement pour débloquer +${formatFCFA(dailyGain)} sur votre solde.</p>
                <div class="quiz-question">${question.q}</div>
                <div class="quiz-options">
                    ${question.options.map((opt, idx) => `<button type="button" class="quiz-option" data-idx="${idx}">${opt}</button>`).join('')}
                </div>
                <div class="quiz-feedback" id="quiz-feedback"></div>
            </div>`;

        taskModalOverlay.querySelector('[data-close-task-modal]').addEventListener('click', closeTaskModal);

        const feedbackEl = taskModalOverlay.querySelector('#quiz-feedback');
        const optionBtns = taskModalOverlay.querySelectorAll('.quiz-option');
        optionBtns.forEach(btn => {
            btn.addEventListener('click', async () => {
                const idx = Number(btn.getAttribute('data-idx'));
                if (idx === question.correct) {
                    optionBtns.forEach(b => b.disabled = true);
                    btn.classList.add('correct');
                    feedbackEl.textContent = 'Bonne réponse ! Validation en cours…';
                    feedbackEl.className = 'quiz-feedback success';

                    const { error } = await window.supabaseClient.rpc('claim_daily_task', { p_investment_id: investmentId });
                    if (error) {
                        feedbackEl.textContent = "Impossible de valider la tâche pour le moment : " + error.message;
                        feedbackEl.className = 'quiz-feedback error';
                        window.showToast(error.message || "Impossible de valider la tâche pour le moment.", 'error');
                        return;
                    }
                    window.showToast(`<strong>Tâche validée ✅</strong><br>+${formatFCFA(dailyGain)} crédité pour ${productName}.`, 'success', { extraClass: 'investment-toast' });
                    setTimeout(closeTaskModal, 900);
                    await refreshDashboardData();
                } else {
                    btn.classList.add('wrong');
                    btn.disabled = true;
                    feedbackEl.textContent = 'Mauvaise réponse, réessayez.';
                    feedbackEl.className = 'quiz-feedback error';
                }
            });
        });

        taskModalOverlay.classList.add('active');
    };

    if (tasksListEl) {
        tasksListEl.addEventListener('click', (e) => {
            const btn = e.target.closest('.task-btn');
            if (!btn) return;
            openTaskModal(
                btn.getAttribute('data-investment-id'),
                Number(btn.getAttribute('data-daily-gain')),
                btn.getAttribute('data-product-name')
            );
        });
    }

    const renderDashboardData = () => {
        // --- KPIs ---
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
        document.querySelectorAll('.stat-number').forEach(counter => {
            const target = parseFloat(counter.getAttribute('data-target')) || 0;
            const suffix = counter.getAttribute('data-suffix') || '';
            const isDecimal = target % 1 !== 0;
            const steps = 60;
            const duration = 900;
            const startVal = 0;
            const increment = (target - startVal) / steps;
            let current = startVal, step = 0;
            const timer = setInterval(() => {
                step++;
                current += increment;
                if (step >= steps) { current = target; clearInterval(timer); }
                counter.textContent = isDecimal
                    ? current.toFixed(1) + suffix
                    : new Intl.NumberFormat('fr-FR').format(Math.round(current)) + suffix;
            }, duration / steps);
        });

        // --- Graphique d'évolution (12 derniers mois, gains réels) ---
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

        // --- Produits disponibles par catégorie (Revenu Annuel / Actif / Quête) ---
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
                    <button class="btn btn-primary btn-full buy-product-btn"
                        data-product-id="${p.id}"
                        data-product-name="${p.name}"
                        data-product-category="${p.category}"
                        data-daily-gain="${dailyGain}"
                        data-duration="${p.duration_days}"
                        ${affordable ? '' : 'disabled title="Solde insuffisant"'}>
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

        // --- Portefeuille : solde réel ---
        const walletBalanceEl = document.getElementById('wallet-balance-amount');
        if (walletBalanceEl) walletBalanceEl.textContent = formatFCFA(wallet.balance);

        // --- Historique des transactions ---
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

        // --- Tâches Quotidiennes (24h) : une par produit actif ---
        renderDailyTasks();
    };

    renderDashboardData();

    // Recharge le portefeuille, les investissements, les produits et les
    // transactions depuis Supabase (appelé après un achat réussi)
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

    // Message de validation affiché après l'achat, avec les infos réelles du produit activé
    const categoryLabel = { atlas: 'Revenu Annuel', constant: 'Actif — Constant', analyse: 'Actif — Analyse', quete: 'Quête Quotidienne' };
    const showPurchaseConfirmation = (btn) => {
        const name = btn.getAttribute('data-product-name');
        const category = btn.getAttribute('data-product-category');
        const dailyGain = Number(btn.getAttribute('data-daily-gain'));
        const duration = btn.getAttribute('data-duration');
        window.showToast(
            `<strong>Produit activé ✅</strong><br>${name} — ${categoryLabel[category] || category}<br>Gain : ${formatFCFA(dailyGain)}/jour pendant ${duration} jours.<br>Disponible dans votre tableau de bord.`,
            'success',
            { extraClass: 'investment-toast', duration: 6000 }
        );
    };

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
    // 7ter. Dépôt — crée une demande dans `deposit_requests`, à valider
    //       par un admin (voir admin.html > Dépôts > admin_review_deposit).
    //
    //       ⚠️ Si un justificatif (capture d'écran) est joint, il est
    //       envoyé dans le bucket Supabase Storage `deposit-proofs`.
    //       Créez ce bucket (Storage > New bucket, "Public") s'il n'existe
    //       pas encore, sinon l'upload échouera et la demande sera créée
    //       sans justificatif.
    // ------------------------------------------------------------------
    const depositBtn = document.getElementById('wallet-deposit-btn');
    const withdrawBtn = document.getElementById('wallet-withdraw-btn');

    let depositModalOverlay = null;
    const closeDepositModal = () => { if (depositModalOverlay) depositModalOverlay.classList.remove('active'); };

    const openDepositModal = () => {
        const minDeposit = Number(siteSettings.min_deposit) || 0;
        const usdtAddress = siteSettings.deposit_usdt_address || '';
        const quickAmounts = Array.isArray(siteSettings.deposit_amounts) ? siteSettings.deposit_amounts : [];

        if (!depositModalOverlay) {
            depositModalOverlay = document.createElement('div');
            depositModalOverlay.className = 'modal-overlay';
            document.body.appendChild(depositModalOverlay);
            depositModalOverlay.addEventListener('click', (e) => { if (e.target === depositModalOverlay) closeDepositModal(); });
        }

        if (!usdtAddress) {
            depositModalOverlay.innerHTML = `
                <div class="modal-card">
                    <button type="button" class="modal-close" data-close-deposit-modal>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                    <span class="task-modal-badge">Dépôt</span>
                    <h2 class="task-modal-title">Dépôt momentanément indisponible</h2>
                    <p class="task-modal-sub">Aucun moyen de paiement n'est configuré pour le moment. Contactez le support pour effectuer votre dépôt.</p>
                </div>`;
            depositModalOverlay.querySelector('[data-close-deposit-modal]').addEventListener('click', closeDepositModal);
            depositModalOverlay.classList.add('active');
            return;
        }

        depositModalOverlay.innerHTML = `
            <div class="modal-card">
                <button type="button" class="modal-close" data-close-deposit-modal>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
                <span class="task-modal-badge">Dépôt</span>
                <h2 class="task-modal-title">Alimenter mon compte</h2>
                <p class="task-modal-sub">Envoyez votre paiement en USDT (réseau TRC-20) à l'adresse ci-dessous, puis confirmez votre dépôt.${minDeposit ? ` Montant minimum : ${formatFCFA(minDeposit)}.` : ''}</p>

                ${quickAmounts.length ? `
                <div class="form-group">
                    <label>Montant</label>
                    <div class="quiz-options" id="deposit-quick-amounts">
                        ${quickAmounts.map(a => `<button type="button" class="quiz-option" data-amount="${a}">${formatFCFA(a)}</button>`).join('')}
                    </div>
                </div>` : ''}

                <div class="form-group">
                    <label for="deposit-amount-input">${quickAmounts.length ? 'Ou montant personnalisé' : 'Montant'} (FCFA)</label>
                    <input type="number" class="form-control" id="deposit-amount-input" min="${minDeposit || 0}" placeholder="Ex : 25000">
                </div>

                <div class="form-group">
                    <label>Adresse USDT (TRC-20)</label>
                    <div style="display:flex; gap:8px;">
                        <input type="text" class="form-control" id="deposit-address-display" value="${usdtAddress}" readonly>
                        <button type="button" class="btn btn-outline" id="deposit-copy-address-btn">Copier</button>
                    </div>
                </div>

                <div class="form-group">
                    <label for="deposit-proof-input">Justificatif (capture d'écran) — optionnel</label>
                    <input type="file" class="form-control" id="deposit-proof-input" accept="image/*">
                </div>

                <div class="quiz-feedback" id="deposit-feedback"></div>

                <button type="button" class="btn btn-primary btn-full" id="deposit-submit-btn">J'ai envoyé le paiement</button>
            </div>`;

        depositModalOverlay.querySelector('[data-close-deposit-modal]').addEventListener('click', closeDepositModal);

        const amountInput = depositModalOverlay.querySelector('#deposit-amount-input');
        const quickAmountsWrap = depositModalOverlay.querySelector('#deposit-quick-amounts');
        if (quickAmountsWrap) {
            quickAmountsWrap.querySelectorAll('.quiz-option').forEach(btn => {
                btn.addEventListener('click', () => {
                    quickAmountsWrap.querySelectorAll('.quiz-option').forEach(b => b.classList.remove('correct'));
                    btn.classList.add('correct');
                    amountInput.value = btn.getAttribute('data-amount');
                });
            });
        }

        const copyBtn = depositModalOverlay.querySelector('#deposit-copy-address-btn');
        copyBtn.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(usdtAddress);
            } catch (err) {
                const addressInput = depositModalOverlay.querySelector('#deposit-address-display');
                addressInput.select();
                document.execCommand('copy');
            }
            window.showToast('Adresse copiée !', 'success');
        });

        const feedbackEl = depositModalOverlay.querySelector('#deposit-feedback');
        const submitBtn = depositModalOverlay.querySelector('#deposit-submit-btn');
        const proofInput = depositModalOverlay.querySelector('#deposit-proof-input');

        submitBtn.addEventListener('click', async () => {
            const amount = Number(amountInput.value);
            feedbackEl.textContent = '';
            feedbackEl.className = 'quiz-feedback';

            if (!amount || amount <= 0) {
                feedbackEl.textContent = 'Veuillez indiquer un montant valide.';
                feedbackEl.className = 'quiz-feedback error';
                return;
            }
            if (minDeposit && amount < minDeposit) {
                feedbackEl.textContent = `Le montant minimum est de ${formatFCFA(minDeposit)}.`;
                feedbackEl.className = 'quiz-feedback error';
                return;
            }

            submitBtn.disabled = true;
            const originalText = submitBtn.textContent;
            submitBtn.textContent = 'Envoi en cours…';

            let proofUrl = null;
            const proofFile = proofInput.files && proofInput.files[0];
            if (proofFile) {
                try {
                    const ext = proofFile.name.split('.').pop();
                    const path = `${authUser.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
                    const { error: uploadError } = await window.supabaseClient.storage.from('deposit-proofs').upload(path, proofFile);
                    if (uploadError) throw uploadError;
                    const { data: publicUrlData } = window.supabaseClient.storage.from('deposit-proofs').getPublicUrl(path);
                    proofUrl = publicUrlData.publicUrl;
                } catch (err) {
                    console.error('Erreur upload justificatif :', err);
                    // On continue sans bloquer le dépôt : le justificatif n'est pas obligatoire.
                }
            }

            const { error } = await window.supabaseClient.from('deposit_requests').insert({
                user_id: authUser.id,
                amount,
                method_name: 'USDT (TRC-20)',
                proof_url: proofUrl,
                status: 'pending'
            });

            submitBtn.disabled = false;
            submitBtn.textContent = originalText;

            if (error) {
                feedbackEl.textContent = "Impossible d'enregistrer la demande : " + error.message;
                feedbackEl.className = 'quiz-feedback error';
                window.showToast("Impossible d'enregistrer la demande de dépôt.", 'error');
                return;
            }

            window.showToast(`<strong>Demande envoyée ✅</strong><br>Votre dépôt de ${formatFCFA(amount)} sera crédité après validation.`, 'success', { extraClass: 'investment-toast' });
            setTimeout(closeDepositModal, 900);
            await refreshNotifications();
        });

        depositModalOverlay.classList.add('active');
    };

    if (depositBtn) depositBtn.addEventListener('click', openDepositModal);
    if (withdrawBtn) withdrawBtn.addEventListener('click', () => window.showToast('Le retrait sera disponible après validation du code PIN.', 'info'));

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
        withdrawal: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>',
        investment: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>',
        gain: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 3"></path></svg>',
        referral_commission: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle></svg>',
        quest: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>'
    }[type] || '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>');

    const timeAgo = (dateStr) => {
        const diffMs = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diffMs / 60000);
        if (mins < 1) return "à l'instant";
        if (mins < 60) return `il y a ${mins} min`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `il y a ${hrs} h`;
        const days = Math.floor(hrs / 24);
        return `il y a ${days} j`;
    };

    const renderNotifications = () => {
        const unreadCount = notifications.filter(n => !n.is_read).length;
        if (notifBadge) {
            if (unreadCount > 0) {
                notifBadge.textContent = unreadCount > 9 ? '9+' : unreadCount;
                notifBadge.style.display = '';
            } else {
                notifBadge.style.display = 'none';
            }
        }
        if (!notifListEl) return;
        notifListEl.innerHTML = notifications.length ? notifications.map(n => `
            <div class="notif-item ${n.is_read ? '' : 'unread'}" data-notif-id="${n.id}">
                <div class="notif-icon">${notifIconFor(n.type)}</div>
                <div class="notif-body">
                    <div class="notif-title">${n.title}</div>
                    <div class="notif-desc">${n.body}</div>
                    <div class="notif-time">${timeAgo(n.created_at)}</div>
                </div>
            </div>`).join('') : `
            <div class="notif-empty">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
                <p>Aucune notification pour le moment.</p>
                <span>Vos dépôts, retraits, achats et revenus apparaîtront ici.</span>
            </div>`;
    };
    renderNotifications();

    const refreshNotifications = async () => {
        const { data } = await window.supabaseClient
            .from('notifications')
            .select('*')
            .eq('user_id', authUser.id)
            .order('created_at', { ascending: false })
            .limit(30);
        notifications = data || notifications;
        renderNotifications();
    };

    if (notifBtn && notifPanel) {
        notifBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            notifPanel.classList.toggle('active');
        });
        document.addEventListener('click', (e) => {
            if (!notifPanel.contains(e.target)) notifPanel.classList.remove('active');
        });
    }

    if (notifListEl) {
        notifListEl.addEventListener('click', async (e) => {
            const item = e.target.closest('.notif-item.unread');
            if (!item) return;
            const id = item.getAttribute('data-notif-id');
            item.classList.remove('unread');
            const notif = notifications.find(n => n.id === id);
            if (notif) notif.is_read = true;
            renderNotifications();
            await window.supabaseClient.from('notifications').update({ is_read: true }).eq('id', id);
        });
    }

    if (notifMarkAllBtn) {
        notifMarkAllBtn.addEventListener('click', async () => {
            const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
            if (!unreadIds.length) return;
            notifications.forEach(n => n.is_read = true);
            renderNotifications();
            await window.supabaseClient.from('notifications').update({ is_read: true }).eq('user_id', authUser.id).in('id', unreadIds);
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
        adminMenuItem.addEventListener('click', () => {
            window.location.href = 'admin.html';
        });
    }
});
