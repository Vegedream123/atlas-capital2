// dashboard.js
document.addEventListener('DOMContentLoaded', () => {
    // 1. Vérification de l'authentification
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    if (isLoggedIn !== 'true') {
        window.location.href = 'index.html';
        return;
    }

    // Mise à jour des informations de l'utilisateur
    const userName = localStorage.getItem('userName') || 'Utilisateur';
    const userEmail = localStorage.getItem('userEmail') || 'contact@atlascapital.com';
    
    document.querySelectorAll('.user-name').forEach(el => el.textContent = userName);
    document.querySelectorAll('.user-email').forEach(el => el.textContent = userEmail);
    
    // Initiales Avatar
    const initials = userName.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase();
    document.querySelectorAll('.avatar').forEach(el => el.textContent = initials);

    // 1bis. Copier le lien de parrainage
    const copyReferralBtn = document.getElementById('copy-referral-btn');
    const referralCodeEl = document.getElementById('referral-code');
    if (copyReferralBtn && referralCodeEl) {
        copyReferralBtn.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(referralCodeEl.textContent.trim());
                window.showToast('Lien de parrainage copié !', 'success');
            } catch (err) {
                window.showToast('Impossible de copier le lien.', 'error');
            }
        });
    }

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

    // 4. Déconnexion
    document.querySelectorAll('.logout-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('isLoggedIn');
            window.showToast('Déconnexion en cours...', 'info');
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
                window.showToast(`Investissement de ${formatFCFA(amount)} confirmé !`, 'success');
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
