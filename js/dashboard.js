// dashboard.js
document.addEventListener('DOMContentLoaded', () => {
    // 1. VÃ©rification de l'authentification
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    if (isLoggedIn !== 'true') {
        window.location.href = 'index.html';
        return;
    }

    // Mise Ã  jour des informations de l'utilisateur
    const userName = localStorage.getItem('userName') || 'Utilisateur';
    const userEmail = localStorage.getItem('userEmail') || 'contact@atlascapital.com';
    
    document.querySelectorAll('.user-name').forEach(el => el.textContent = userName);
    document.querySelectorAll('.user-email').forEach(el => el.textContent = userEmail);
    
    // Initiales Avatar
    const initials = userName.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase();
    document.querySelectorAll('.avatar').forEach(el => el.textContent = initials);

    // Fonction Toast (globale pour pouvoir l'utiliser dans le HTML)
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

    // 2. Navigation Top & Bottom (Multi-View SPA)
    const navLinks = document.querySelectorAll('.nav-link, .bottom-nav-item');
    const views = document.querySelectorAll('.view-section');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const target = link.getAttribute('data-target');
            if(!target) return;

            // Update active states
            navLinks.forEach(l => l.classList.remove('active'));
            document.querySelectorAll(`[data-target="${target}"]`).forEach(l => l.classList.add('active'));

            // Switch views
            views.forEach(v => v.classList.remove('active'));
            const targetView = document.getElementById(`view-${target}`);
            if (targetView) targetView.classList.add('active');
            
            // Scroll to top
            window.scrollTo(0,0);
        });
    });

    // 3. Notifications Toggle
    const notifBtn = document.getElementById('notif-btn');
    const notifPanel = document.getElementById('notif-panel');
    
    if (notifBtn && notifPanel) {
        notifBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            notifPanel.classList.toggle('active');
        });
        
        // Hide panel when clicking outside
        document.addEventListener('click', (e) => {
            if (!notifPanel.contains(e.target)) {
                notifPanel.classList.remove('active');
            }
        });
    }

    // 4. DÃ©connexion
    document.querySelectorAll('.logout-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('isLoggedIn');
            window.showToast('DÃ©connexion en cours...', 'info');
            setTimeout(() => window.location.href = 'index.html', 1000);
        });
    });

    // 5. Graphique dynamique (simulation)
    const chartTabs = document.querySelectorAll('.tab-btn');
    const chartBars = document.querySelectorAll('.bar');

    chartTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            chartTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            chartBars.forEach(bar => {
                const randomHeight = Math.floor(Math.random() * 60) + 40; // 40% to 100%
                bar.style.height = `${randomHeight}%`;
            });
        });
    });

    // 6. Formulaire d'investissement & Estimateur
    const investForm = document.getElementById('invest-form');
    const planType = document.getElementById('plan-type');
    const investAmount = document.getElementById('invest-amount');
    const investDuration = document.getElementById('invest-duration');
    const estRate = document.getElementById('est-rate');
    const estGains = document.getElementById('est-gains');

    const formatFCFA = (amount) => {
        return new Intl.NumberFormat('fr-FR').format(Math.floor(amount)) + ' FCFA';
    };

    const calculateGains = () => {
        const amount = parseFloat(investAmount.value) || 0;
        const durationMonths = parseInt(investDuration.value);
        const selectedPlan = planType.options[planType.selectedIndex];
        const annualRate = parseFloat(selectedPlan.getAttribute('data-rate'));

        estRate.textContent = `+${annualRate.toFixed(1)}%`;

        if (amount > 0) {
            const gains = amount * (annualRate / 100) * (durationMonths / 12);
            estGains.textContent = `+${formatFCFA(gains)}`;
        } else {
            estGains.textContent = '0 FCFA';
        }
    };

    if (planType && investAmount && investDuration) {
        planType.addEventListener('change', calculateGains);
        investAmount.addEventListener('input', calculateGains);
        investDuration.addEventListener('change', calculateGains);
        calculateGains();
    }

    if (investForm) {
        investForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const amount = parseFloat(investAmount.value);
            if (amount >= 5000) {
                window.showToast(`Investissement de ${formatFCFA(amount)} confirmÃ© !`, 'success');
                investForm.reset();
                calculateGains();
            } else {
                window.showToast('Le montant minimum est de 5 000 FCFA.', 'error');
            }
        });
    }

    // 7. Filtrage du tableau des investissements
    const filterSelect = document.getElementById('investment-filter');
    const tableRows = document.querySelectorAll('#investments-body tr');

    if (filterSelect) {
        filterSelect.addEventListener('change', () => {
            const status = filterSelect.value;
            tableRows.forEach(row => {
                if (status === 'all' || row.getAttribute('data-status') === status) {
                    row.style.display = '';
                } else {
                    row.style.display = 'none';
                }
            });
        });
    }

    // 8. Animation des compteurs KPI
    const animateCounters = () => {
        const counters = document.querySelectorAll('.stat-number');
        
        counters.forEach(counter => {
            const target = parseFloat(counter.getAttribute('data-target'));
            const suffix = counter.getAttribute('data-suffix') || '';
            const isDecimal = target % 1 !== 0;
            const duration = 1500;
            const steps = 60;
            const increment = target / steps;
            let current = 0;
            let step = 0;

            const timer = setInterval(() => {
                step++;
                current += increment;

                if (step >= steps) {
                    current = target;
                    clearInterval(timer);
                }

                if (isDecimal) {
                    counter.textContent = current.toFixed(1) + suffix;
                } else {
                    counter.textContent = new Intl.NumberFormat('fr-FR').format(Math.ceil(current)) + suffix;
                }
            }, duration / steps);
        });
    };

    // Lancer l'animation
    animateCounters();
});

    // 9. Sub-Navigation pour l'onglet Finances
    const subnavBtns = document.querySelectorAll('.subnav-btn');
    const subViews = document.querySelectorAll('.sub-view');

    subnavBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = btn.getAttribute('data-sub');
            if(!target) return;

            // Update active states
            subnavBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Switch sub-views
            subViews.forEach(v => v.classList.remove('active'));
            const targetView = document.getElementById('sub-' + target);
            if (targetView) targetView.classList.add('active');
        });
    });




// ==========================================================================
// WALLET — DÉPÔT & RETRAIT (Portefeuille)
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {

    const walletRoot = document.getElementById('view-portefeuille');
    if (!walletRoot) return; // sécurité si la page ne contient pas le wallet

    const formatCFA = (n) => new Intl.NumberFormat('fr-FR').format(Math.floor(n)) + ' FCFA';
    const genReference = (prefix) => `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`;

    // --------------------------------------------------------------------
    // 1. Résolution du pays de l'utilisateur (localStorage puis Supabase)
    // --------------------------------------------------------------------
    let userCountry = localStorage.getItem('userCountry') || '';
    let userCountryName = (userCountry && window.AtlasPaymentMethods)
        ? window.AtlasPaymentMethods.getCountryName(userCountry)
        : '';

    const countryNameEl = document.getElementById('wallet-country-name');
    const methodsPreviewEl = document.getElementById('wallet-methods-preview');

    function renderCountryInfo() {
        if (countryNameEl) countryNameEl.textContent = userCountryName || 'Non renseigné';
        if (methodsPreviewEl && window.AtlasPaymentMethods) {
            const methods = window.AtlasPaymentMethods.getPaymentMethods(userCountry);
            methodsPreviewEl.innerHTML = methods.map(m => `<span class="method-chip">${m.icon} ${m.name}</span>`).join('');
        }
    }
    renderCountryInfo();

    // --------------------------------------------------------------------
    // 2. Ouverture / fermeture des modales
    // --------------------------------------------------------------------
    function openWalletModal(id) {
        const el = document.getElementById(id);
        if (el) { el.classList.add('active'); document.body.style.overflow = 'hidden'; }
    }
    function closeWalletModal(id) {
        const el = document.getElementById(id);
        if (el) { el.classList.remove('active'); document.body.style.overflow = ''; }
    }
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
        btn.addEventListener('click', () => closeWalletModal(btn.getAttribute('data-close-modal')));
    });
    document.querySelectorAll('.wallet-modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => { if (e.target === overlay) closeWalletModal(overlay.id); });
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.wallet-modal-overlay.active').forEach(o => closeWalletModal(o.id));
        }
    });

    const openDepositBtn = document.getElementById('open-deposit-btn');
    const openWithdrawBtn = document.getElementById('open-withdraw-btn');
    if (openDepositBtn) openDepositBtn.addEventListener('click', () => openWalletModal('deposit-modal-overlay'));
    if (openWithdrawBtn) openWithdrawBtn.addEventListener('click', () => {
        const bal = document.getElementById('wallet-balance');
        const hint = document.getElementById('withdraw-balance-hint');
        if (bal && hint) hint.textContent = bal.textContent;
        openWalletModal('withdraw-modal-overlay');
    });

    // --------------------------------------------------------------------
    // 3. Références DOM — Dépôt
    // --------------------------------------------------------------------
    const depositAmountGrid = document.getElementById('deposit-amount-grid');
    const depositCustomAmount = document.getElementById('deposit-custom-amount');
    const depositMethodGrid = document.getElementById('deposit-method-grid');
    const depositInstructionsBlock = document.getElementById('deposit-instructions-block');
    const depositInstructionsContent = document.getElementById('deposit-instructions-content');
    const depositUploadBlock = document.getElementById('deposit-upload-block');
    const depositDropzone = document.getElementById('deposit-dropzone');
    const depositProofInput = document.getElementById('deposit-proof-input');
    const depositUploadPreview = document.getElementById('deposit-upload-preview');
    const depositSubmitBtn = document.getElementById('deposit-submit-btn');
    const depositForm = document.getElementById('deposit-form');

    // --------------------------------------------------------------------
    // 4. Références DOM — Retrait
    // --------------------------------------------------------------------
    const withdrawAmountInput = document.getElementById('withdraw-amount');
    const withdrawMethodGrid = document.getElementById('withdraw-method-grid');
    const withdrawDetailsBlock = document.getElementById('withdraw-details-block');
    const withdrawAccountInput = document.getElementById('withdraw-account');
    const withdrawHolderInput = document.getElementById('withdraw-holder');
    const withdrawSubmitBtn = document.getElementById('withdraw-submit-btn');
    const withdrawForm = document.getElementById('withdraw-form');

    // --------------------------------------------------------------------
    // 5. États
    // --------------------------------------------------------------------
    let depositState = { amount: 0, methodId: null, method: null, file: null, reference: null };
    let withdrawState = { methodId: null, method: null };

    // --------------------------------------------------------------------
    // 6. Construction dynamique de la grille des moyens de paiement
    //    (dépend du pays choisi à l'inscription)
    // --------------------------------------------------------------------
    function buildMethodGrid(container, kind) {
        if (!container || !window.AtlasPaymentMethods) return;
        const methods = window.AtlasPaymentMethods.getPaymentMethods(userCountry);
        container.innerHTML = methods.map(m => `
            <button type="button" class="payment-method-card" data-method-id="${m.id}">
                <span class="payment-method-icon">${m.icon}</span>
                <span>
                    <span class="payment-method-name">${m.name}</span><br>
                    <span class="payment-method-type">${m.type === 'mobile_money' ? 'Mobile Money' : (m.type === 'bank' ? 'Banque' : 'Carte')}</span>
                </span>
            </button>
        `).join('');

        container.querySelectorAll('.payment-method-card').forEach(card => {
            card.addEventListener('click', () => {
                container.querySelectorAll('.payment-method-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                const methodId = card.getAttribute('data-method-id');
                const method = methods.find(m => m.id === methodId);

                if (kind === 'deposit') {
                    depositState.methodId = methodId;
                    depositState.method = method;
                    showDepositInstructions(method);
                    validateDepositForm();
                } else {
                    withdrawState.methodId = methodId;
                    withdrawState.method = method;
                    if (withdrawDetailsBlock) withdrawDetailsBlock.style.display = 'block';
                    validateWithdrawForm();
                }
            });
        });
    }

    // --------------------------------------------------------------------
    // 7. Instructions de paiement (dépôt)
    // --------------------------------------------------------------------
    function copyToClipboard(text, btn) {
        if (!navigator.clipboard) return;
        navigator.clipboard.writeText(text).then(() => {
            const original = btn.textContent;
            btn.textContent = 'Copié !';
            setTimeout(() => { btn.textContent = original; }, 1500);
        }).catch(() => {});
    }

    function updateInstructionsAmount() {
        const amountEl = document.getElementById('deposit-instructions-amount');
        if (amountEl) amountEl.textContent = depositState.amount > 0 ? formatCFA(depositState.amount) : '—';
    }

    function showDepositInstructions(method) {
        if (!depositInstructionsBlock || !depositInstructionsContent) return;

        if (method.type === 'card') {
            depositInstructionsContent.innerHTML = `<p class="payment-instructions-note">${method.note}</p>`;
            if (depositUploadBlock) depositUploadBlock.style.display = 'none';
            depositState.file = null;
        } else {
            depositState.reference = depositState.reference || genReference('DEP');
            depositInstructionsContent.innerHTML = `
                <div class="payment-instructions-row">
                    <span class="pi-label">Numéro</span>
                    <span class="pi-value">${method.number} <button type="button" class="copy-btn" data-copy="${method.number}">Copier</button></span>
                </div>
                <div class="payment-instructions-row">
                    <span class="pi-label">Bénéficiaire</span>
                    <span class="pi-value">${method.holder}</span>
                </div>
                <div class="payment-instructions-row">
                    <span class="pi-label">Montant à envoyer</span>
                    <span class="pi-value" id="deposit-instructions-amount">—</span>
                </div>
                <p class="payment-instructions-note">${method.note}</p>
                <div class="payment-reference">Référence de votre dépôt : <strong>${depositState.reference}</strong> — merci de la conserver, elle sera demandée en cas de litige.</div>
            `;
            if (depositUploadBlock) depositUploadBlock.style.display = 'block';
            updateInstructionsAmount();
            depositInstructionsContent.querySelectorAll('.copy-btn').forEach(btn => {
                btn.addEventListener('click', () => copyToClipboard(btn.getAttribute('data-copy'), btn));
            });
        }
        depositInstructionsBlock.style.display = 'block';
    }

    // --------------------------------------------------------------------
    // 8. Validation des formulaires (active/désactive le bouton "Soumettre")
    // --------------------------------------------------------------------
    function validateDepositForm() {
        const method = depositState.method;
        const needsProof = !!method && method.type !== 'card';
        const ok = depositState.amount >= 1000 && !!depositState.methodId && (!needsProof || !!depositState.file);
        if (depositSubmitBtn) depositSubmitBtn.disabled = !ok;
        updateInstructionsAmount();
    }

    function getAvailableBalance() {
        const bal = document.getElementById('wallet-balance');
        if (!bal) return 0;
        const digits = bal.textContent.replace(/[^\d]/g, '');
        return parseInt(digits, 10) || 0;
    }

    function validateWithdrawForm() {
        const amount = parseInt(withdrawAmountInput ? withdrawAmountInput.value : '0', 10) || 0;
        const balance = getAvailableBalance();
        const ok = amount >= 1000 && amount <= balance && !!withdrawState.methodId &&
            (withdrawAccountInput && withdrawAccountInput.value.trim().length > 3) &&
            (withdrawHolderInput && withdrawHolderInput.value.trim().length > 1);
        if (withdrawSubmitBtn) withdrawSubmitBtn.disabled = !ok;
    }

    // --------------------------------------------------------------------
    // 9. Sélection du montant (dépôt)
    // --------------------------------------------------------------------
    function selectAmountBtn(amount) {
        depositState.amount = amount;
        if (depositAmountGrid) {
            depositAmountGrid.querySelectorAll('.amount-btn').forEach(b => {
                b.classList.toggle('selected', parseInt(b.getAttribute('data-amount'), 10) === amount);
            });
        }
        if (depositCustomAmount) depositCustomAmount.value = '';
        validateDepositForm();
    }

    if (depositAmountGrid) {
        depositAmountGrid.querySelectorAll('.amount-btn').forEach(btn => {
            btn.addEventListener('click', () => selectAmountBtn(parseInt(btn.getAttribute('data-amount'), 10)));
        });
    }
    if (depositCustomAmount) {
        depositCustomAmount.addEventListener('input', () => {
            if (depositAmountGrid) depositAmountGrid.querySelectorAll('.amount-btn').forEach(b => b.classList.remove('selected'));
            depositState.amount = parseInt(depositCustomAmount.value, 10) || 0;
            validateDepositForm();
        });
    }

    // --------------------------------------------------------------------
    // 10. Champs du retrait
    // --------------------------------------------------------------------
    if (withdrawAmountInput) withdrawAmountInput.addEventListener('input', validateWithdrawForm);
    if (withdrawAccountInput) withdrawAccountInput.addEventListener('input', validateWithdrawForm);
    if (withdrawHolderInput) withdrawHolderInput.addEventListener('input', validateWithdrawForm);

    // Construction des grilles de moyens de paiement (dépôt + retrait)
    buildMethodGrid(depositMethodGrid, 'deposit');
    buildMethodGrid(withdrawMethodGrid, 'withdraw');

    // Rattrapage : si le pays n'était pas encore connu localement, on va le
    // chercher dans Supabase puis on reconstruit les grilles.
    if (!userCountry && window.supabaseClient) {
        window.supabaseClient.auth.getUser().then(({ data }) => {
            const meta = data && data.user && data.user.user_metadata;
            if (meta && meta.country) {
                userCountry = meta.country;
                userCountryName = window.AtlasPaymentMethods ? window.AtlasPaymentMethods.getCountryName(userCountry) : '';
                localStorage.setItem('userCountry', userCountry);
                renderCountryInfo();
                buildMethodGrid(depositMethodGrid, 'deposit');
                buildMethodGrid(withdrawMethodGrid, 'withdraw');
            }
        }).catch(() => { /* pas grave : les méthodes universelles restent proposées */ });
    }

    // --------------------------------------------------------------------
    // 11. Upload de la preuve de paiement (dépôt)
    // --------------------------------------------------------------------
    function renderUploadPreview(file, container, onRemove) {
        container.style.display = 'flex';
        const sizeKb = (file.size / 1024).toFixed(0);
        const isImage = file.type.startsWith('image/');
        container.innerHTML = `
            ${isImage
                ? `<img id="__deposit_preview_img" alt="Aperçu">`
                : `<span class="file-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg></span>`}
            <div class="upload-preview-info">
                <div class="upload-preview-name">${file.name}</div>
                <div class="upload-preview-size">${sizeKb} Ko</div>
            </div>
            <button type="button" class="upload-remove-btn" aria-label="Retirer le fichier">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
        `;
        if (isImage) {
            const img = container.querySelector('#__deposit_preview_img');
            const reader = new FileReader();
            reader.onload = (e) => { img.src = e.target.result; };
            reader.readAsDataURL(file);
        }
        container.querySelector('.upload-remove-btn').addEventListener('click', onRemove);
    }

    function handleProofFile(file) {
        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
            window.showToast('Fichier trop volumineux (5 Mo maximum).', 'error');
            return;
        }
        const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf'];
        if (!allowed.includes(file.type)) {
            window.showToast('Format non supporté. Utilisez une image (JPG, PNG) ou un PDF.', 'error');
            return;
        }
        depositState.file = file;
        renderUploadPreview(file, depositUploadPreview, () => {
            depositState.file = null;
            if (depositProofInput) depositProofInput.value = '';
            if (depositUploadPreview) { depositUploadPreview.style.display = 'none'; depositUploadPreview.innerHTML = ''; }
            validateDepositForm();
        });
        validateDepositForm();
    }

    if (depositDropzone) {
        depositDropzone.addEventListener('dragover', (e) => { e.preventDefault(); depositDropzone.classList.add('dragover'); });
        depositDropzone.addEventListener('dragleave', () => depositDropzone.classList.remove('dragover'));
        depositDropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            depositDropzone.classList.remove('dragover');
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                if (depositProofInput) depositProofInput.files = e.dataTransfer.files;
                handleProofFile(e.dataTransfer.files[0]);
            }
        });
    }
    if (depositProofInput) {
        depositProofInput.addEventListener('change', () => {
            if (depositProofInput.files && depositProofInput.files[0]) {
                handleProofFile(depositProofInput.files[0]);
            }
        });
    }

    // --------------------------------------------------------------------
    // 12. Opérations en attente — affichage + persistance locale de secours
    // --------------------------------------------------------------------
    const pendingCard = document.getElementById('wallet-pending-card');
    const pendingList = document.getElementById('wallet-pending-list');

    function savePendingLocally(key, entry) {
        try {
            const arr = JSON.parse(localStorage.getItem(key) || '[]');
            arr.unshift(entry);
            localStorage.setItem(key, JSON.stringify(arr.slice(0, 20)));
        } catch (e) { /* stockage indisponible : on ignore silencieusement */ }
    }

    function addPendingTransaction({ type, method, amount, reference, date, negative }) {
        if (!pendingList || !pendingCard) return;
        pendingCard.style.display = 'block';
        const item = document.createElement('div');
        item.className = 'transaction-item';
        item.innerHTML = `
            <div class="transaction-icon ${negative ? 'bg-warning-light text-warning' : 'bg-primary-light text-primary'}">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            </div>
            <div class="transaction-info">
                <div class="transaction-title">${type} — ${method}</div>
                <div class="transaction-desc">Réf : ${reference} · En attente de validation</div>
            </div>
            <div class="transaction-meta">
                <div class="transaction-date">${date.toLocaleDateString('fr-FR')} - ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
                <div class="transaction-amount">${negative ? '-' : '+'}${formatCFA(amount)}</div>
            </div>
        `;
        pendingList.prepend(item);
    }

    // --------------------------------------------------------------------
    // 13. Réinitialisation des formulaires après soumission
    // --------------------------------------------------------------------
    function resetDepositForm() {
        depositState = { amount: 0, methodId: null, method: null, file: null, reference: null };
        if (depositForm) depositForm.reset();
        if (depositAmountGrid) depositAmountGrid.querySelectorAll('.amount-btn').forEach(b => b.classList.remove('selected'));
        if (depositMethodGrid) depositMethodGrid.querySelectorAll('.payment-method-card').forEach(c => c.classList.remove('selected'));
        if (depositInstructionsBlock) depositInstructionsBlock.style.display = 'none';
        if (depositUploadBlock) depositUploadBlock.style.display = 'none';
        if (depositUploadPreview) { depositUploadPreview.style.display = 'none'; depositUploadPreview.innerHTML = ''; }
        if (depositSubmitBtn) depositSubmitBtn.disabled = true;
    }

    function resetWithdrawForm() {
        withdrawState = { methodId: null, method: null };
        if (withdrawForm) withdrawForm.reset();
        if (withdrawMethodGrid) withdrawMethodGrid.querySelectorAll('.payment-method-card').forEach(c => c.classList.remove('selected'));
        if (withdrawDetailsBlock) withdrawDetailsBlock.style.display = 'none';
        if (withdrawSubmitBtn) withdrawSubmitBtn.disabled = true;
    }

    // --------------------------------------------------------------------
    // 14. Soumission du dépôt
    // --------------------------------------------------------------------
    if (depositForm) {
        depositForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const method = depositState.method;

            if (depositState.amount < 1000 || !method) {
                window.showToast('Veuillez compléter toutes les étapes.', 'error');
                return;
            }
            const needsProof = method.type !== 'card';
            if (needsProof && !depositState.file) {
                window.showToast('Veuillez joindre une preuve de paiement.', 'error');
                return;
            }

            const originalText = depositSubmitBtn.textContent;
            depositSubmitBtn.disabled = true;
            depositSubmitBtn.textContent = 'Envoi en cours...';

            const reference = depositState.reference || genReference('DEP');
            let proofUrl = null;
            let insertedToSupabase = false;

            try {
                if (window.supabaseClient) {
                    const { data: userData } = await window.supabaseClient.auth.getUser();
                    const uid = userData && userData.user ? userData.user.id : null;

                    if (uid && depositState.file) {
                        const path = `${uid}/${Date.now()}_${depositState.file.name}`;
                        const { error: uploadError } = await window.supabaseClient
                            .storage.from('deposit-proofs').upload(path, depositState.file);
                        if (!uploadError) {
                            const { data: publicUrlData } = window.supabaseClient
                                .storage.from('deposit-proofs').getPublicUrl(path);
                            proofUrl = publicUrlData ? publicUrlData.publicUrl : null;
                        }
                    }

                    if (uid) {
                        const { error: insertError } = await window.supabaseClient.from('deposits').insert({
                            user_id: uid,
                            amount: depositState.amount,
                            currency: 'FCFA',
                            payment_method: method.name,
                            country: userCountry,
                            reference,
                            proof_url: proofUrl,
                            status: 'pending'
                        });
                        if (!insertError) insertedToSupabase = true;
                    }
                }
            } catch (err) {
                insertedToSupabase = false;
            }

            if (!insertedToSupabase) {
                savePendingLocally('pendingDeposits', {
                    amount: depositState.amount, method: method.name, reference, date: new Date().toISOString()
                });
            }

            addPendingTransaction({
                type: 'Dépôt', method: method.name, amount: depositState.amount,
                reference, date: new Date()
            });

            window.showToast(`Dépôt de ${formatCFA(depositState.amount)} soumis. Référence ${reference} — en attente de validation.`, 'success');
            closeWalletModal('deposit-modal-overlay');
            resetDepositForm();
            depositSubmitBtn.textContent = originalText;
        });
    }

    // --------------------------------------------------------------------
    // 15. Soumission du retrait
    // --------------------------------------------------------------------
    if (withdrawForm) {
        withdrawForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const amount = parseInt(withdrawAmountInput.value, 10) || 0;
            const balance = getAvailableBalance();
            const method = withdrawState.method;

            if (amount < 1000) { window.showToast('Montant minimum : 1 000 FCFA.', 'error'); return; }
            if (amount > balance) { window.showToast('Solde insuffisant pour ce retrait.', 'error'); return; }
            if (!method) { window.showToast('Choisissez un moyen de réception.', 'error'); return; }
            if (!withdrawAccountInput.value.trim() || !withdrawHolderInput.value.trim()) {
                window.showToast('Renseignez vos informations de réception.', 'error');
                return;
            }

            const originalText = withdrawSubmitBtn.textContent;
            withdrawSubmitBtn.disabled = true;
            withdrawSubmitBtn.textContent = 'Envoi en cours...';

            const reference = genReference('RET');
            let insertedToSupabase = false;

            try {
                if (window.supabaseClient) {
                    const { data: userData } = await window.supabaseClient.auth.getUser();
                    const uid = userData && userData.user ? userData.user.id : null;
                    if (uid) {
                        const { error: insertError } = await window.supabaseClient.from('withdrawals').insert({
                            user_id: uid,
                            amount,
                            currency: 'FCFA',
                            payment_method: method.name,
                            country: userCountry,
                            destination_account: withdrawAccountInput.value.trim(),
                            account_holder: withdrawHolderInput.value.trim(),
                            reference,
                            status: 'pending'
                        });
                        if (!insertError) insertedToSupabase = true;
                    }
                }
            } catch (err) {
                insertedToSupabase = false;
            }

            if (!insertedToSupabase) {
                savePendingLocally('pendingWithdrawals', {
                    amount, method: method.name, reference,
                    account: withdrawAccountInput.value.trim(), date: new Date().toISOString()
                });
            }

            addPendingTransaction({
                type: 'Retrait', method: method.name, amount,
                reference, date: new Date(), negative: true
            });

            window.showToast(`Demande de retrait de ${formatCFA(amount)} soumise. Référence ${reference}.`, 'success');
            closeWalletModal('withdraw-modal-overlay');
            resetWithdrawForm();
            withdrawSubmitBtn.textContent = originalText;
        });
    }

    // --------------------------------------------------------------------
    // 16. Restaure les opérations en attente d'une session précédente
    //     (utilisé si l'enregistrement Supabase avait échoué)
    // --------------------------------------------------------------------
    (function restorePending() {
        try {
            const deposits = JSON.parse(localStorage.getItem('pendingDeposits') || '[]');
            const withdrawals = JSON.parse(localStorage.getItem('pendingWithdrawals') || '[]');
            deposits.forEach(d => addPendingTransaction({
                type: 'Dépôt', method: d.method, amount: d.amount, reference: d.reference, date: new Date(d.date)
            }));
            withdrawals.forEach(w => addPendingTransaction({
                type: 'Retrait', method: w.method, amount: w.amount, reference: w.reference, date: new Date(w.date), negative: true
            }));
        } catch (e) { /* silencieux */ }
    })();
});
