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
    let siteSettings = settingsRes.data || { min_withdrawal: 0 };

    // ------------------------------------------------------------------
    // Règles de déblocage progressif des catégories de produits :
    //  1) "Actif" (constant / analyse) exige d'avoir déjà acheté au moins
    //     un produit "Revenu Annuel" (Atlas), peu importe son statut actuel.
    //  2) "Quête Quotidienne" exige d'avoir acheté un produit "Actif"
    //     (constant ou analyse) LE JOUR MÊME — la fenêtre se referme à minuit.
    // Définies tôt (juste après `investments`) pour être utilisables aussi
    // bien dans le rendu des cartes que dans le gestionnaire de clic d'achat.
    // ------------------------------------------------------------------
    const hasAtlasOwned = () => investments.some(i => i.investment_products && i.investment_products.category === 'atlas');
    const hasActifBoughtToday = () => {
        const todayStr = new Date().toISOString().slice(0, 10);
        return investments.some(i =>
            i.investment_products &&
            ['constant', 'analyse'].includes(i.investment_products.category) &&
            i.created_at && i.created_at.slice(0, 10) === todayStr
        );
    };

    // Revenu mensuel (12 valeurs FCFA, une par mois) défini PAR PRODUIT depuis
    // l'admin — remplace l'ancien tableau global de taux (%). Chaque produit
    // Atlas (Atlas 1, Atlas 2…) a donc ses propres montants pour 1 à 12 mois.
    const getAtlasMonthlyOptions = (product) => {
        const arr = Array.isArray(product && product.monthly_revenues) ? product.monthly_revenues : [];
        return arr
            .map((total, idx) => ({ duration_months: idx + 1, total: Number(total) || 0 }))
            .filter(o => o.total > 0);
    };

    if (profileRes.error) console.error('Erreur profil :', profileRes.error);
    if (walletRes.error) console.error('Erreur portefeuille :', walletRes.error);
    if (productsRes.error) console.error('Erreur produits :', productsRes.error);

    // Injecte les moyens de paiement configurés dans l'admin (adresse USDT +
    // numéros par pays) dans AtlasPaymentMethods, pour que la page de dépôt
    // affiche les vraies infos au lieu des valeurs d'exemple.
    if (window.AtlasPaymentMethods) {
        window.AtlasPaymentMethods.setUsdtAddress(siteSettings.deposit_usdt_address);
        window.AtlasPaymentMethods.setCountryOverrides(siteSettings.country_payment_methods);
    }

    // Bouton "Groupe WhatsApp" — lien géré depuis l'admin (site_settings.whatsapp_group)
    const whatsappGroupBtn = document.getElementById('account-whatsapp-group-btn');
    if (whatsappGroupBtn) {
        if (siteSettings.whatsapp_group) {
            whatsappGroupBtn.href = siteSettings.whatsapp_group;
            whatsappGroupBtn.style.display = 'flex';
        } else {
            whatsappGroupBtn.style.display = 'none';
        }
    }

    // Hash SHA-256 (utilisé pour le code PIN de retrait : jamais stocké en clair)
    const sha256Hex = async (text) => {
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
        return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    };

    const userName = profile.full_name || authUser.email;
    const userEmail = profile.email || authUser.email;

    document.querySelectorAll('.user-name').forEach(el => { el.textContent = userName; el.classList.remove('skeleton-text'); el.classList.add('loaded'); });
    document.querySelectorAll('.user-email').forEach(el => { el.textContent = userEmail; el.classList.remove('skeleton-text'); el.classList.add('loaded'); });


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
    //       Le crédit est sécurisé côté serveur par la fonction Postgres
    //       `claim_daily_task(p_investment_id uuid)`, déjà déployée dans
    //       Supabase. Elle calcule le bon montant par catégorie de produit
    //       (taux figé à l'achat pour Atlas, daily_rate sinon), crédite le
    //       portefeuille, et journalise une transaction avec `category` et
    //       `gain_amount` renseignés — utilisés par la carte "Revenu Annuel"
    //       (voir renderDashboardData) pour totaliser les gains par produit.
    // ------------------------------------------------------------------
    const FINANCE_QUESTIONS = [
        { q: "Qu'est-ce que la diversification en investissement ?", options: ["Tout miser sur un seul actif", "Répartir son capital sur plusieurs actifs pour réduire le risque", "Retirer tout son argent chaque mois", "Emprunter pour investir davantage"], correct: 1 },
        { q: "Que signifie le terme « taux d'intérêt » ?", options: ["Le montant total investi", "Le coût ou le rendement d'un capital, en pourcentage", "Le nombre de transactions par jour", "Le solde disponible sur un compte"], correct: 1 },
        { q: "Qu'est-ce qu'un portefeuille d'investissement ?", options: ["Un compte bancaire classique", "L'ensemble des actifs détenus par un investisseur", "Un simple carnet de chèques", "Une carte de paiement"], correct: 1 },
        { q: "Pourquoi est-il conseillé d'avoir une épargne de précaution ?", options: ["Pour éviter d'investir", "Pour faire face aux imprévus sans toucher à ses investissements", "Parce que c'est obligatoire par la loi", "Pour payer plus d'impôts"], correct: 1 },
        { q: "Qu'est-ce que l'intérêt composé ?", options: ["Un intérêt calculé uniquement sur le capital de départ", "Un intérêt calculé sur le capital et les intérêts déjà accumulés", "Une taxe bancaire", "Un type de prêt étudiant"], correct: 1 },
        { q: "Quel est généralement le lien entre risque et rendement potentiel ?", options: ["Aucun lien", "Plus le risque est élevé, plus le rendement potentiel l'est aussi", "Le risque élevé garantit un rendement faible", "Le rendement est toujours fixe"], correct: 1 },
        { q: "Qu'est-ce qu'un budget mensuel permet de faire ?", options: ["Dépenser sans limite", "Suivre et planifier ses revenus et dépenses", "Éviter de payer ses factures", "Augmenter ses dettes"], correct: 1 },
        { q: "Que signifie « liquidité » d'un actif ?", options: ["Sa couleur sur un graphique", "La facilité à le convertir rapidement en argent disponible", "Son ancienneté", "Le nombre de propriétaires précédents"], correct: 1 },
        { q: "Qu'est-ce qu'un dépôt bancaire ?", options: ["Un retrait d'argent", "De l'argent que l'on verse sur son compte", "Un prêt accordé par la banque", "Une facture impayée"], correct: 1 },
        { q: "À quoi sert un mot de passe ou code PIN sur une application bancaire ?", options: ["À décorer l'application", "À sécuriser l'accès à son compte", "À augmenter le solde", "À payer des frais"], correct: 1 },
        { q: "Qu'est-ce qu'un retrait bancaire ?", options: ["Ajouter de l'argent sur son compte", "Faire sortir de l'argent de son compte", "Créer un nouveau compte", "Changer de mot de passe"], correct: 1 }
    ];

    const tasksListEl = document.getElementById('daily-tasks-list');
    const tasksCardEl = document.getElementById('daily-tasks-card');
    let taskCountdownTimer = null;

    // Gain journalier réel d'un investissement : pour Atlas (Revenu Annuel),
    // le taux dépend de l'échéance choisie à l'achat (locked_rate_percent /
    // locked_payout_amount + duration_months). Pour Constant/Analyse, le
    // cycle est exprimé en JOURS (duration_days), pas en mois : il faut donc
    // aussi couvrir ce cas, sinon locked_payout_amount est ignoré et le
    // calcul retombe à tort sur daily_rate (qui vaut volontairement 0 pour
    // ces catégories), affichant 0 FCFA/jour malgré un cycle bien configuré.
    const dailyGainOf = (inv) => {
        if (inv.locked_payout_amount != null) {
            if (inv.duration_months) {
                return (Number(inv.locked_payout_amount) - Number(inv.amount)) / (Number(inv.duration_months) * 30);
            }
            if (inv.duration_days) {
                return (Number(inv.locked_payout_amount) - Number(inv.amount)) / Number(inv.duration_days);
            }
        }
        if (inv.duration_months && inv.locked_rate_percent != null) {
            return Number(inv.amount) * Number(inv.locked_rate_percent) / 100 / (Number(inv.duration_months) * 30);
        }
        return Number(inv.amount) * Number((inv.investment_products && inv.investment_products.daily_rate) || 0) / 100;
    };

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
            const dailyGain = Math.round(dailyGainOf(inv));
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
        // Tous les placements actifs, toutes catégories confondues — utilisé
        // uniquement pour les vérifications de possession de produit plus bas
        // (ownedActive / active par catégorie), PAS pour les cartes KPI.
        const activeInvestments = investments.filter(i => i.status === 'active');

        // Carte "Revenu Annuel" — UNIQUEMENT les produits de catégorie 'atlas'.
        // Affiche le montant RÉELLEMENT RÉCUPÉRÉ par l'utilisateur sur ce produit
        // (gains débloqués via les tâches quotidiennes + intérêts versés à
        // échéance), et non plus un taux annualisé théorique.
        //
        // Basé sur `transactions.category` et `transactions.gain_amount` (colonnes
        // ajoutées en base). gain_amount isole la part "intérêts" de chaque
        // transaction : pour une tâche quotidienne il vaut le montant entier (pas
        // de capital en jeu) ; pour un versement à échéance (type
        // 'investment_payout', qui inclut le capital rendu) il ne contient QUE les
        // intérêts, pas le capital — sans quoi le total serait gonflé du capital
        // remboursé, qui n'est pas un "gain".
        const atlasActive = activeInvestments.filter(i => i.investment_products && i.investment_products.category === 'atlas');
        const atlasGainsRecovered = transactions
            .filter(t => t.category === 'atlas' && ['gain', 'investment_payout'].includes(t.type))
            .reduce((sum, t) => sum + Number(t.gain_amount != null ? t.gain_amount : t.amount), 0);

        // Carte "Investissements Actifs" — UNIQUEMENT les produits 'constant' /
        // 'analyse' (capital actif), exclut 'atlas' (Revenu Annuel) et 'quete'
        // (Quêtes Journalières) qui ont chacun leur propre carte dédiée.
        const capitalActive = activeInvestments.filter(i => i.investment_products && ['constant', 'analyse'].includes(i.investment_products.category));
        const totalInvested = capitalActive.reduce((sum, i) => sum + Number(i.amount), 0);

        const todayStr = new Date().toISOString().slice(0, 10);
        const dailyQuestGains = transactions
            .filter(t => t.type === 'quest' && t.created_at && t.created_at.slice(0, 10) === todayStr)
            .reduce((sum, t) => sum + Number(t.amount), 0);

        const setKpi = (id, value) => {
            const el = document.getElementById(id);
            if (el) { el.setAttribute('data-target', value); }
        };
        setKpi('kpi-balance', wallet.balance);
        setKpi('kpi-annual-rate', atlasGainsRecovered);
        setKpi('kpi-active-investments', capitalActive.length);
        setKpi('kpi-daily-quest', dailyQuestGains);

        const changeEl = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
        changeEl('kpi-balance-change', wallet.total_income > 0 ? `+${formatFCFA(wallet.total_income)} cumulé` : 'Aucun revenu pour le moment');
        changeEl('kpi-rate-change', atlasActive.length ? `${atlasActive.length} placement(s) actif(s)` : 'Aucun placement actif');
        changeEl('kpi-active-change', capitalActive.length ? `${formatFCFA(totalInvested)} investis` : 'Investissez pour démarrer');
        // Ce montant correspond aux gains de type "quête" réellement crédités
        // aujourd'hui (transactions), ce qui peut inclure un placement arrivé
        // à échéance dans la journée — d'où le libellé explicite ci-dessous,
        // pour ne pas laisser croire à un placement encore actif s'il n'y en a
        // plus (voir "Investissements Actifs" pour l'état actuel réel).
        changeEl('kpi-quest-change', dailyQuestGains > 0 ? 'Crédité aujourd\'hui' : 'Pas encore réclamé');

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

        // --- Graphique d'évolution (12 derniers mois, REVENUS réels de
        //     l'utilisateur connecté uniquement : gains, commissions de
        //     parrainage, récompenses de quêtes. Les dépôts ne sont pas
        //     des revenus et ne sont donc pas comptabilisés ici). ---
        const chartArea = document.getElementById('mainChart');
        if (chartArea) {
            const REVENUE_TYPES = new Set(['gain', 'referral_commission', 'quest']);
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
                if (!REVENUE_TYPES.has(t.type)) return;
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
        // Chaque produit reste affiché en permanence dans sa case (grille) de
        // catégorie, qu'il soit possédé ou non. Une fois acheté, le nombre de
        // placements actifs sur CE produit précis et le gain journalier qui en
        // découle s'affichent directement sous sa carte, tant que
        // l'investissement est actif (statut 'active' dans user_investments).
        const gridIds = { atlas: 'vip-grid-atlas', constant: 'vip-grid-constant', analyse: 'vip-grid-analyse', quete: 'vip-grid-quete' };
        const sectionStatsIds = { atlas: 'section-stats-atlas', constant: 'section-stats-constant', analyse: 'section-stats-analyse', quete: 'section-stats-quete' };

        const dailyGainOf = (inv) => {
            if (inv.locked_payout_amount != null) {
                if (inv.duration_months) {
                    return (Number(inv.locked_payout_amount) - Number(inv.amount)) / (Number(inv.duration_months) * 30);
                }
                if (inv.duration_days) {
                    return (Number(inv.locked_payout_amount) - Number(inv.amount)) / Number(inv.duration_days);
                }
            }
            if (inv.duration_months && inv.locked_rate_percent != null) {
                return Number(inv.amount) * Number(inv.locked_rate_percent) / 100 / (Number(inv.duration_months) * 30);
            }
            return Number(inv.amount) * Number((inv.investment_products && inv.investment_products.daily_rate) || 0) / 100;
        };

        const renderProductCard = (p) => {
            const isAtlas = p.category === 'atlas';
            const isCycle = p.category === 'constant' || p.category === 'analyse';
            // Pour Constant/Analyse, daily_rate vaut volontairement 0 (le gain
            // vient du cycle_payout_amount fixé à la fin de la durée en jours),
            // donc on calcule le gain/jour depuis ce montant plutôt que depuis
            // daily_rate — sinon la carte produit affiche toujours 0 FCFA.
            const dailyGain = isCycle
                ? Math.round((Number(p.cycle_payout_amount || 0) - Number(p.price)) / Math.max(1, Number(p.duration_days) || 1))
                : Math.round(Number(p.price) * Number(p.daily_rate) / 100);
            const affordable = wallet.balance >= Number(p.price);

            // Placements actifs de l'utilisateur sur CE produit précis (pas la catégorie entière)
            const ownedActive = activeInvestments.filter(i => i.product_id === p.id);
            const ownedCount = ownedActive.length;
            const ownedDailyGain = ownedActive.reduce((sum, i) => sum + dailyGainOf(i), 0);

            // Déblocage progressif : Actif nécessite Atlas déjà acheté ; Quête
            // nécessite un Actif acheté aujourd'hui. Le bouton reste visible et
            // cliquable (jamais un "Indisponible" figé) — un clic sans les
            // conditions requises affiche un message explicite au lieu d'agir.
            const lockedReason = (p.category === 'constant' || p.category === 'analyse') && !hasAtlasOwned()
                ? 'Achetez d\'abord un produit Revenu Annuel (Atlas)'
                : (p.category === 'quete' && !hasActifBoughtToday())
                    ? 'Achetez un produit Actif aujourd\'hui pour débloquer'
                    : null;

            // Pour "Revenu Annuel", l'échéance et le gain dépendent du choix de
            // l'utilisateur à l'achat (1 à 12 mois) — pas d'une valeur fixe produit.
            // Le produit reste TOUJOURS disponible à l'achat (jamais "Indisponible") :
            // seul le solde insuffisant peut désactiver le bouton.
            const buyDisabled = !affordable;
            const buyLabel = affordable ? (ownedCount > 0 ? 'Investir à nouveau' : 'Acheter') : 'Solde insuffisant';

            return `
                <div class="vip-card${ownedCount > 0 ? ' is-owned' : ''}">
                    <div class="vip-card-header">
                        <div class="vip-icon">★</div>
                        <span class="vip-name">${p.name}</span>
                    </div>
                    <div class="vip-price">${formatFCFA(p.price)}</div>
                    <div class="vip-stats">
                        <div class="vip-stat">
                            <span class="vip-stat-label">Gain / jour</span>
                            <span class="vip-stat-value">${isAtlas ? 'Selon échéance' : formatFCFA(dailyGain)}</span>
                        </div>
                        <div class="vip-stat">
                            <span class="vip-stat-label">Échéance</span>
                            <span class="vip-stat-value">${isAtlas ? '1 à 12 mois au choix' : p.duration_days + ' j'}</span>
                        </div>
                    </div>
                    ${ownedCount > 0 ? `
                    <div class="vip-owned-box">
                        <div class="vip-owned-row"><span>Placements actifs</span><span class="val">${ownedCount}</span></div>
                        <div class="vip-owned-row"><span>Gain journalier en cours</span><span class="val">+${formatFCFA(ownedDailyGain)}</span></div>
                    </div>` : ''}
                    ${lockedReason ? `<p class="text-secondary" style="font-size:0.8rem;margin:8px 0 0;">🔒 ${lockedReason}</p>` : ''}
                    <button class="btn btn-primary btn-full buy-product-btn"
                        data-product-id="${p.id}"
                        data-product-name="${p.name}"
                        data-product-category="${p.category}"
                        data-product-price="${p.price}"
                        data-daily-gain="${dailyGain}"
                        data-duration="${p.duration_days}"
                        ${buyDisabled ? `disabled title="Solde insuffisant"` : ''}>
                        ${buyLabel}
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

        // --- Résumé par section (catégorie) : X placement(s) actif(s) + gain/jour réel ---
        Object.entries(sectionStatsIds).forEach(([category, elId]) => {
            const el = document.getElementById(elId);
            if (!el) return;
            const active = activeInvestments.filter(i => i.investment_products && i.investment_products.category === category);
            const gain = active.reduce((sum, i) => sum + dailyGainOf(i), 0);
            if (active.length) {
                el.textContent = `${active.length} placement(s) actif(s) · +${formatFCFA(gain)}/jour`;
                el.classList.add('has-active');
            } else {
                el.textContent = 'Aucun placement actif';
                el.classList.remove('has-active');
            }
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

    // Rafraîchissement automatique en continu (toutes les 30s) : le
    // portefeuille, les transactions et donc le graphique "Évolution des
    // Cumuls" restent à jour en temps réel sans recharger la page. On ne
    // rafraîchit que si l'onglet est visible, pour ne pas gaspiller de
    // requêtes en arrière-plan.
    const AUTO_REFRESH_INTERVAL_MS = 30000;
    setInterval(() => {
        if (document.visibilityState === 'visible') {
            refreshDashboardData().catch(() => {});
        }
    }, AUTO_REFRESH_INTERVAL_MS);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            refreshDashboardData().catch(() => {});
        }
    });

    // Message de validation affiché après l'achat, avec les infos réelles du produit activé
    const categoryLabel = { atlas: 'Revenu Annuel', constant: 'Actif — Constant', analyse: 'Actif — Analyse', quete: 'Quête Quotidienne' };
    const showPurchaseConfirmation = (btn, durationMonths) => {
        const name = btn.getAttribute('data-product-name');
        const category = btn.getAttribute('data-product-category');
        const durationText = durationMonths ? `${durationMonths} mois` : `${btn.getAttribute('data-duration')} jours`;
        window.showToast(
            `<strong>Produit activé ✅</strong><br>${name} — ${categoryLabel[category] || category}<br>Échéance : ${durationText}.<br>Disponible dans votre tableau de bord.`,
            'success',
            { extraClass: 'investment-toast', duration: 6000 }
        );
    };

    // Verrou global : empêche tout achat pendant qu'un autre est en cours de
    // traitement (double-tap, clic sur un autre produit pendant l'attente réseau,
    // etc.), en plus du cooldown de 8s déjà appliqué côté serveur.
    let isPurchasing = false;
    const setAllBuyButtonsDisabled = (disabled) => {
        document.querySelectorAll('.buy-product-btn').forEach(b => {
            if (disabled) { b.dataset.wasEnabled = b.disabled ? '0' : '1'; b.disabled = true; }
            else if (b.dataset.wasEnabled === '1') { b.disabled = false; delete b.dataset.wasEnabled; }
        });
    };

    const runPurchase = async (btn, productId, durationMonths) => {
        if (isPurchasing) return;
        isPurchasing = true;
        setAllBuyButtonsDisabled(true);
        const originalText = btn.textContent;
        btn.textContent = 'Traitement...';
        try {
            const { error } = await window.supabaseClient.rpc('purchase_investment', {
                p_product_id: productId,
                p_duration_months: durationMonths || null
            });
            if (error) {
                window.showToast(error.message || "Impossible d'effectuer cet investissement.", 'error');
            } else {
                showPurchaseConfirmation(btn, durationMonths);
                await refreshDashboardData();
                await refreshNotifications();
            }
        } catch (err) {
            window.showToast('Erreur : ' + err.message, 'error');
        } finally {
            isPurchasing = false;
            setAllBuyButtonsDisabled(false);
            btn.textContent = originalText;
        }
    };

    // ------------------------------------------------------------------
    // Modal de choix d'échéance — UNIQUEMENT pour "Revenu Annuel" (atlas).
    // Les autres catégories gardent une échéance fixe définie sur le produit.
    // ------------------------------------------------------------------
    let durationModalOverlay = null;
    const closeDurationModal = () => { if (durationModalOverlay) durationModalOverlay.classList.remove('active'); };

    const openDurationModal = (btn) => {
        const productId = btn.getAttribute('data-product-id');
        const price = Number(btn.getAttribute('data-product-price'));
        const product = products.find(p => p.id === productId);
        const options = getAtlasMonthlyOptions(product);

        if (!options.length) {
            window.showToast("Aucune échéance n'est encore configurée pour ce produit. Contactez le support.", 'error');
            return;
        }

        if (!durationModalOverlay) {
            durationModalOverlay = document.createElement('div');
            durationModalOverlay.className = 'modal-overlay';
            document.body.appendChild(durationModalOverlay);
            durationModalOverlay.addEventListener('click', (e) => { if (e.target === durationModalOverlay) closeDurationModal(); });
        }

        durationModalOverlay.innerHTML = `
            <div class="modal-card">
                <button type="button" class="modal-close" data-close-duration-modal>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
                <h2 class="task-modal-title">Choisissez une échéance</h2>
                <p class="task-modal-sub">Montant : ${formatFCFA(price)}. Le montant reçu est fixé pour toute la durée choisie.</p>
                <div id="duration-options-list" style="display:flex; flex-direction:column; gap:10px; margin:14px 0;">
                    ${options.map(o => {
                        const gain = o.total - price;
                        const daily = Math.round(gain / (o.duration_months * 30));
                        return `<button type="button" class="quiz-option duration-option" data-duration="${o.duration_months}">
                            <strong>${o.duration_months} mois</strong> — ${formatFCFA(o.total)} au total (~${formatFCFA(daily)}/jour)
                        </button>`;
                    }).join('')}
                </div>
                <div class="quiz-feedback" id="duration-feedback"></div>
            </div>`;

        durationModalOverlay.querySelector('[data-close-duration-modal]').addEventListener('click', closeDurationModal);
        durationModalOverlay.querySelectorAll('.duration-option').forEach(optBtn => {
            optBtn.addEventListener('click', async () => {
                const durationMonths = Number(optBtn.getAttribute('data-duration'));
                closeDurationModal();
                await runPurchase(btn, productId, durationMonths);
            });
        });

        durationModalOverlay.classList.add('active');
    };

    // Achat d'un produit (délégation d'événement, débite le solde côté serveur)
    document.querySelectorAll('.vip-grid').forEach(grid => {
        grid.addEventListener('click', (e) => {
            const btn = e.target.closest('.buy-product-btn');
            if (!btn || btn.disabled || isPurchasing) return;
            const category = btn.getAttribute('data-product-category');
            const productId = btn.getAttribute('data-product-id');

            if ((category === 'constant' || category === 'analyse') && !hasAtlasOwned()) {
                window.showToast("Achetez d'abord un produit « Revenu Annuel » (Atlas) pour débloquer les produits Actifs.", 'error');
                return;
            }
            if (category === 'quete' && !hasActifBoughtToday()) {
                window.showToast("Achetez un produit Actif (Constant ou Analyse) aujourd'hui pour débloquer une Quête Quotidienne.", 'error');
                return;
            }

            if (category === 'atlas') {
                openDurationModal(btn);
            } else {
                runPurchase(btn, productId, null);
            }
        });
    });

    const depositBtn = document.getElementById('wallet-deposit-btn');
    const withdrawBtn = document.getElementById('wallet-withdraw-btn');

    // ------------------------------------------------------------------
    // 7bis. Modal de dépôt : pays -> moyen de paiement -> montant -> preuve
    // ------------------------------------------------------------------
    let depositModalOverlay = null;
    let selectedDepositMethod = null;
    const closeDepositModal = () => { if (depositModalOverlay) depositModalOverlay.classList.remove('active'); };

    const renderDepositMethods = (countryCode) => {
        const listEl = depositModalOverlay.querySelector('#deposit-methods-list');
        if (!countryCode || !window.AtlasPaymentMethods) {
            listEl.innerHTML = '';
            return;
        }
        const methods = window.AtlasPaymentMethods.getPaymentMethods(countryCode);
        selectedDepositMethod = null;
        depositModalOverlay.querySelector('#deposit-method-details').innerHTML = '';
        depositModalOverlay.querySelector('#deposit-submit-btn').disabled = true;
        listEl.innerHTML = methods.map(m => `
            <button type="button" class="quiz-option deposit-method-option" data-method-id="${m.id}">
                <span style="margin-right:8px;">${m.icon || ''}</span>${m.name}
            </button>`).join('');

        listEl.querySelectorAll('.deposit-method-option').forEach(btn => {
            btn.addEventListener('click', () => {
                listEl.querySelectorAll('.deposit-method-option').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                const method = methods.find(m => m.id === btn.getAttribute('data-method-id'));
                selectedDepositMethod = method;
                depositModalOverlay.querySelector('#deposit-method-details').innerHTML = method ? `
                    <div class="deposit-method-details-box">
                        <p><strong>${method.name}</strong></p>
                        <p>Numéro / Référence : <strong>${method.number}</strong></p>
                        <p>Bénéficiaire : ${method.holder}</p>
                        <p class="text-secondary" style="font-size:0.82rem;">${method.note}</p>
                    </div>` : '';
                depositModalOverlay.querySelector('#deposit-submit-btn').disabled = false;
            });
        });
    };

    const openDepositModal = () => {
        if (!depositModalOverlay) {
            depositModalOverlay = document.createElement('div');
            depositModalOverlay.className = 'modal-overlay';
            document.body.appendChild(depositModalOverlay);
            depositModalOverlay.addEventListener('click', (e) => { if (e.target === depositModalOverlay) closeDepositModal(); });
        }

        const countries = window.AtlasCountries || [];
        depositModalOverlay.innerHTML = `
            <div class="modal-card">
                <button type="button" class="modal-close" data-close-deposit-modal>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
                <span class="task-modal-badge">Dépôt</span>
                <h2 class="task-modal-title">Faire un dépôt</h2>
                <p class="task-modal-sub">Choisissez votre pays, puis un moyen de paiement. Votre solde sera crédité après validation par notre équipe.</p>

                <div class="form-group">
                    <label class="form-label" for="deposit-country-select">Pays</label>
                    <select id="deposit-country-select" class="form-control">
                        <option value="">Sélectionnez votre pays</option>
                        ${countries.map(c => `<option value="${c.code}">${c.name}</option>`).join('')}
                    </select>
                </div>

                <div id="deposit-methods-list" style="display:flex; flex-direction:column; gap:10px; margin-bottom:10px;"></div>
                <div id="deposit-method-details" style="margin-bottom:14px;"></div>

                <div class="form-group">
                    <label class="form-label" for="deposit-amount-input">Montant (FCFA)</label>
                    <input type="number" id="deposit-amount-input" class="form-control" placeholder="Ex: 10000" min="1">
                </div>

                <div class="form-group">
                    <label class="form-label" for="deposit-proof-input">Capture / preuve de paiement (optionnel)</label>
                    <div class="file-input-group">
                        <label class="file-input-btn" for="deposit-proof-input">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"></path></svg>
                            Choisir le fichier
                        </label>
                        <span class="file-input-filename" id="deposit-proof-filename">Aucun fichier sélectionné</span>
                        <input type="file" id="deposit-proof-input" accept="image/*">
                    </div>
                </div>

                <div class="quiz-feedback" id="deposit-feedback"></div>
                <button type="button" class="btn btn-primary btn-full" id="deposit-submit-btn" disabled>Envoyer ma demande de dépôt</button>
            </div>`;

        depositModalOverlay.querySelector('[data-close-deposit-modal]').addEventListener('click', closeDepositModal);
        depositModalOverlay.querySelector('#deposit-country-select').addEventListener('change', (e) => renderDepositMethods(e.target.value));
        depositModalOverlay.querySelector('#deposit-proof-input').addEventListener('change', (e) => {
            const filenameEl = depositModalOverlay.querySelector('#deposit-proof-filename');
            const file = e.target.files && e.target.files[0];
            filenameEl.textContent = file ? file.name : 'Aucun fichier sélectionné';
        });

        depositModalOverlay.querySelector('#deposit-submit-btn').addEventListener('click', async () => {
            const feedbackEl = depositModalOverlay.querySelector('#deposit-feedback');
            const amountInput = depositModalOverlay.querySelector('#deposit-amount-input');
            const proofInput = depositModalOverlay.querySelector('#deposit-proof-input');
            const submitBtn = depositModalOverlay.querySelector('#deposit-submit-btn');
            const amount = Number(amountInput.value);

            if (!selectedDepositMethod) {
                feedbackEl.textContent = 'Veuillez choisir un moyen de paiement.';
                feedbackEl.className = 'quiz-feedback error';
                return;
            }
            if (!amount || amount <= 0) {
                feedbackEl.textContent = 'Veuillez saisir un montant valide.';
                feedbackEl.className = 'quiz-feedback error';
                return;
            }

            submitBtn.disabled = true;
            submitBtn.textContent = 'Envoi en cours...';
            feedbackEl.textContent = '';

            try {
                let proofUrl = null;
                const file = proofInput.files && proofInput.files[0];
                if (file) {
                    const path = `${authUser.id}/${Date.now()}_${file.name}`;
                    const { error: uploadError } = await window.supabaseClient.storage.from('deposit-proofs').upload(path, file);
                    if (uploadError) throw uploadError;
                    const { data: publicUrlData } = window.supabaseClient.storage.from('deposit-proofs').getPublicUrl(path);
                    proofUrl = publicUrlData ? publicUrlData.publicUrl : null;
                }

                const { error: insertError } = await window.supabaseClient.from('deposit_requests').insert({
                    user_id: authUser.id,
                    amount,
                    method_name: selectedDepositMethod.name,
                    proof_url: proofUrl,
                    status: 'pending'
                });
                if (insertError) throw insertError;

                window.showToast('<strong>Demande envoyée ✅</strong><br>Votre dépôt sera crédité après validation par notre équipe.', 'success', { extraClass: 'investment-toast' });
                closeDepositModal();
                await refreshDashboardData();
                await refreshNotifications();
            } catch (err) {
                feedbackEl.textContent = "Erreur : " + (err.message || 'impossible d\'envoyer la demande.');
                feedbackEl.className = 'quiz-feedback error';
                submitBtn.disabled = false;
                submitBtn.textContent = 'Envoyer ma demande de dépôt';
            }
        });

        depositModalOverlay.classList.add('active');
    };

    if (depositBtn) depositBtn.addEventListener('click', openDepositModal);

    // ------------------------------------------------------------------
    // 7ter. Retrait : pays -> moyen de réception -> montant, puis code
    //       PIN en toute dernière étape pour valider et envoyer la
    //       demande. Sans PIN correct, la demande n'est jamais envoyée.
    // ------------------------------------------------------------------
    let withdrawModalOverlay = null;
    let selectedWithdrawMethod = null;
    const closeWithdrawModal = () => { if (withdrawModalOverlay) withdrawModalOverlay.classList.remove('active'); };

    const ensureWithdrawModal = () => {
        if (!withdrawModalOverlay) {
            withdrawModalOverlay = document.createElement('div');
            withdrawModalOverlay.className = 'modal-overlay';
            withdrawModalOverlay.innerHTML = '<div class="modal-card"></div>';
            document.body.appendChild(withdrawModalOverlay);
            withdrawModalOverlay.addEventListener('click', (e) => { if (e.target === withdrawModalOverlay) closeWithdrawModal(); });
        }
        return withdrawModalOverlay;
    };

    const renderWithdrawMethods = (countryCode) => {
        const listEl = withdrawModalOverlay.querySelector('#withdraw-methods-list');
        if (!listEl) return;
        if (!countryCode || !window.AtlasPaymentMethods) { listEl.innerHTML = ''; return; }
        const methods = window.AtlasPaymentMethods.getPaymentMethods(countryCode);
        selectedWithdrawMethod = null;
        withdrawModalOverlay.querySelector('#withdraw-submit-btn').disabled = true;
        listEl.innerHTML = methods.map(m => `
            <button type="button" class="quiz-option deposit-method-option" data-method-id="${m.id}">
                <span style="margin-right:8px;">${m.icon || ''}</span>${m.name}
            </button>`).join('');
        listEl.querySelectorAll('.deposit-method-option').forEach(btn => {
            btn.addEventListener('click', () => {
                listEl.querySelectorAll('.deposit-method-option').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                selectedWithdrawMethod = methods.find(m => m.id === btn.getAttribute('data-method-id'));
                withdrawModalOverlay.querySelector('#withdraw-submit-btn').disabled = false;
            });
        });
    };

    // Étape 1 : formulaire de retrait (pays -> moyen de réception -> montant)
    const renderWithdrawForm = () => {
        const countries = window.AtlasCountries || [];
        const minWithdrawal = Number(siteSettings.min_withdrawal) || 0;
        withdrawModalOverlay.querySelector('.modal-card').innerHTML = `
            <button type="button" class="modal-close" data-close-withdraw-modal>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
            <span class="task-modal-badge">Retrait</span>
            <h2 class="task-modal-title">Retirer des fonds</h2>
            <p class="task-modal-sub">Solde disponible : <strong>${formatFCFA(wallet.balance)}</strong>. Choisissez comment vous souhaitez être payé.</p>

            <div class="form-group">
                <label class="form-label" for="withdraw-country-select">Pays</label>
                <select id="withdraw-country-select" class="form-control">
                    <option value="">Sélectionnez votre pays</option>
                    ${countries.map(c => `<option value="${c.code}">${c.name}</option>`).join('')}
                </select>
            </div>

            <div id="withdraw-methods-list" style="display:flex; flex-direction:column; gap:10px; margin-bottom:14px;"></div>

            <div class="form-group">
                <label class="form-label" for="withdraw-recipient-name-input">Nom de réception</label>
                <input type="text" id="withdraw-recipient-name-input" class="form-control" placeholder="Nom complet du titulaire du compte">
            </div>

            <div class="form-group">
                <label class="form-label" for="withdraw-destination-input">Numéro / compte de réception</label>
                <input type="text" id="withdraw-destination-input" class="form-control" placeholder="Ex : +237 6XX XXX XXX">
            </div>

            <div class="form-group">
                <label class="form-label" for="withdraw-amount-input">Montant (FCFA)</label>
                <input type="number" id="withdraw-amount-input" class="form-control" placeholder="Min. ${formatFCFA(minWithdrawal)}" min="${minWithdrawal || 1}" max="${Math.floor(wallet.balance)}">
            </div>

            <div class="quiz-feedback" id="withdraw-feedback"></div>
            <button type="button" class="btn btn-primary btn-full" id="withdraw-submit-btn" disabled>Continuer</button>`;

        withdrawModalOverlay.querySelector('[data-close-withdraw-modal]').addEventListener('click', closeWithdrawModal);
        withdrawModalOverlay.querySelector('#withdraw-country-select').addEventListener('change', (e) => renderWithdrawMethods(e.target.value));

        withdrawModalOverlay.querySelector('#withdraw-submit-btn').addEventListener('click', () => {
            const feedbackEl = withdrawModalOverlay.querySelector('#withdraw-feedback');
            const recipientNameInput = withdrawModalOverlay.querySelector('#withdraw-recipient-name-input');
            const destinationInput = withdrawModalOverlay.querySelector('#withdraw-destination-input');
            const amountInput = withdrawModalOverlay.querySelector('#withdraw-amount-input');
            const amount = Number(amountInput.value);
            const recipientName = recipientNameInput.value.trim();
            const destination = destinationInput.value.trim();

            if (!selectedWithdrawMethod) { feedbackEl.textContent = 'Veuillez choisir un moyen de réception.'; feedbackEl.className = 'quiz-feedback error'; return; }
            if (!recipientName) { feedbackEl.textContent = 'Veuillez indiquer le nom de réception.'; feedbackEl.className = 'quiz-feedback error'; return; }
            if (!destination) { feedbackEl.textContent = 'Veuillez indiquer votre numéro / compte de réception.'; feedbackEl.className = 'quiz-feedback error'; return; }
            if (!amount || amount < minWithdrawal) { feedbackEl.textContent = `Montant minimum : ${formatFCFA(minWithdrawal)}.`; feedbackEl.className = 'quiz-feedback error'; return; }
            if (amount > wallet.balance) { feedbackEl.textContent = 'Le montant dépasse votre solde disponible.'; feedbackEl.className = 'quiz-feedback error'; return; }

            // Formulaire valide -> le code PIN est la dernière étape avant l'envoi
            renderWithdrawPinStep({ amount, recipientName, destination, method: selectedWithdrawMethod });
        });
    };

    // Étape 2 (finale) : vérification du code PIN, puis envoi effectif de la demande.
    // Sans PIN correct, la demande de retrait n'est jamais envoyée.
    const renderWithdrawPinStep = (withdrawData) => {
        withdrawModalOverlay.querySelector('.modal-card').innerHTML = `
            <button type="button" class="modal-close" data-close-withdraw-modal>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
            <span class="task-modal-badge">Retrait</span>
            <h2 class="task-modal-title">Confirmez votre code PIN</h2>
            <p class="task-modal-sub">Saisissez votre code PIN de retrait à 5 chiffres pour envoyer votre demande de <strong>${formatFCFA(withdrawData.amount)}</strong>.</p>

            <div class="form-group">
                <label class="form-label" for="withdraw-pin-input">Code PIN</label>
                <input type="password" id="withdraw-pin-input" class="form-control" maxlength="5" inputmode="numeric" placeholder="•••••">
            </div>

            <div class="quiz-feedback" id="withdraw-pin-feedback"></div>
            <button type="button" class="btn btn-outline btn-full" id="withdraw-pin-back-btn" style="margin-bottom:10px;">Retour</button>
            <button type="button" class="btn btn-primary btn-full" id="withdraw-pin-submit-btn">Envoyer ma demande de retrait</button>`;

        withdrawModalOverlay.querySelector('[data-close-withdraw-modal]').addEventListener('click', closeWithdrawModal);
        withdrawModalOverlay.querySelector('#withdraw-pin-back-btn').addEventListener('click', renderWithdrawForm);

        const pinInputEl = withdrawModalOverlay.querySelector('#withdraw-pin-input');
        const submitPin = async () => {
            const feedbackEl = withdrawModalOverlay.querySelector('#withdraw-pin-feedback');
            const submitBtn = withdrawModalOverlay.querySelector('#withdraw-pin-submit-btn');
            const pin = pinInputEl.value.trim();

            // Sans code PIN valide (absent ou incorrect) -> demande refusée, rien n'est envoyé
            if (!/^\d{5}$/.test(pin)) { feedbackEl.textContent = 'Le code PIN doit contenir 5 chiffres.'; feedbackEl.className = 'quiz-feedback error'; return; }

            const hash = await sha256Hex(pin + ':' + authUser.id);
            if (hash !== profile.withdrawal_pin_hash) {
                feedbackEl.textContent = 'Code PIN incorrect. Demande refusée.';
                feedbackEl.className = 'quiz-feedback error';
                pinInputEl.value = '';
                pinInputEl.focus();
                return;
            }

            // PIN correct -> envoi effectif de la demande de retrait
            submitBtn.disabled = true;
            submitBtn.textContent = 'Envoi en cours...';
            feedbackEl.textContent = '';

            try {
                const { error: insertError } = await window.supabaseClient.from('withdrawal_requests').insert({
                    user_id: authUser.id,
                    amount: withdrawData.amount,
                    method_name: withdrawData.method.name,
                    recipient_name: withdrawData.recipientName,
                    destination: withdrawData.destination,
                    status: 'pending'
                });
                if (insertError) throw insertError;

                window.showToast('<strong>Demande envoyée ✅</strong><br>Votre retrait sera traité après validation par notre équipe.', 'success', { extraClass: 'investment-toast' });
                closeWithdrawModal();
                await refreshDashboardData();
                await refreshNotifications();
            } catch (err) {
                feedbackEl.textContent = "Erreur : " + (err.message || "impossible d'envoyer la demande.");
                feedbackEl.className = 'quiz-feedback error';
                submitBtn.disabled = false;
                submitBtn.textContent = 'Envoyer ma demande de retrait';
            }
        };
        withdrawModalOverlay.querySelector('#withdraw-pin-submit-btn').addEventListener('click', submitPin);
        pinInputEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitPin(); });
        pinInputEl.focus();
    };

    const openWithdrawFlow = () => {
        const minWithdrawal = Number(siteSettings.min_withdrawal) || 0;

        if (!profile.withdrawal_pin_hash) {
            window.showToast("Définissez d'abord votre code PIN de retrait dans Mon Compte > Sécurité.", 'info');
            const link = document.querySelector('.nav-link[data-target="compte"], .bottom-nav-item[data-target="compte"]');
            if (link) link.click();
            openAccountSubview('securite');
            return;
        }
        if (wallet.balance < minWithdrawal) {
            window.showToast(`Solde insuffisant pour un retrait. Minimum requis : ${formatFCFA(minWithdrawal)}.`, 'error');
            return;
        }

        ensureWithdrawModal();
        renderWithdrawForm();
        withdrawModalOverlay.classList.add('active');
    };

    if (withdrawBtn) withdrawBtn.addEventListener('click', openWithdrawFlow);

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
            const originalLabel = pinSaveBtn.textContent;
            pinSaveBtn.disabled = true;
            pinSaveBtn.textContent = 'Enregistrement...';
            try {
                const hash = await sha256Hex(pin + ':' + authUser.id);
                const { error } = await window.supabaseClient.from('profiles').update({ withdrawal_pin_hash: hash }).eq('id', authUser.id);
                if (error) throw error;
                profile.withdrawal_pin_hash = hash;
                window.showToast('Code PIN enregistré !', 'success');
                pinInput.value = '';
                pinConfirmInput.value = '';
                showAccountMenu();
            } catch (err) {
                window.showToast('Erreur : ' + (err.message || "impossible d'enregistrer le code PIN."), 'error');
            } finally {
                pinSaveBtn.disabled = false;
                pinSaveBtn.textContent = originalLabel;
            }
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
