/* ==========================================================================
   main.js — Atlas Capital Landing Page
   Gestion de la navigation, modales, formulaires, animations et interactions
   ========================================================================== */

/* --- Fonctions globales (accessibles depuis les attributs onclick du HTML) --- */

/**
 * Ouvre une modale par son ID
 */
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

/**
 * Ferme une modale par son ID
 */
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

/**
 * Affiche une notification toast
 */
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = {
        success: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
        error: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
        info: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
    };

    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || icons.info}</span>
        <span class="toast-message">${message}</span>
    `;

    container.appendChild(toast);

    // Animation d'entrée
    requestAnimationFrame(() => toast.classList.add('show'));

    // Suppression automatique après 4 secondes
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

/**
 * Bascule la visibilité d'un champ mot de passe
 */
function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
}


/* --- Initialisation au chargement du DOM --- */
document.addEventListener('DOMContentLoaded', () => {

    // =========================================================================
    // 1. Effet de la navbar au scroll
    // =========================================================================
    const navbar = document.getElementById('navbar');
    if (navbar) {
        window.addEventListener('scroll', () => {
            navbar.classList.toggle('scrolled', window.scrollY > 50);
        }, { passive: true });
    }

    // =========================================================================
    // 2. Menu mobile (burger)
    // =========================================================================
    const burger = document.getElementById('burger');
    const navLinks = document.querySelector('.nav-links');
    const navActions = document.querySelector('.nav-actions');

    if (burger && navLinks) {
        burger.addEventListener('click', () => {
            burger.classList.toggle('active');
            navLinks.classList.toggle('active');
            if (navActions) navActions.classList.toggle('active');
            document.body.style.overflow = navLinks.classList.contains('active') ? 'hidden' : '';
        });

        // Fermer le menu quand on clique sur un lien
        navLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                burger.classList.remove('active');
                navLinks.classList.remove('active');
                if (navActions) navActions.classList.remove('active');
                document.body.style.overflow = '';
            });
        });

        // Fermer le menu quand on clique à l'extérieur
        document.addEventListener('click', (e) => {
            if (!burger.contains(e.target) && !navLinks.contains(e.target) && 
                !(navActions && navActions.contains(e.target)) && navLinks.classList.contains('active')) {
                burger.classList.remove('active');
                navLinks.classList.remove('active');
                if (navActions) navActions.classList.remove('active');
                document.body.style.overflow = '';
            }
        });
    }

    // =========================================================================
    // 3. Défilement fluide (smooth scroll)
    // =========================================================================
    document.querySelectorAll('a[href^="#"]').forEach(link => {
        link.addEventListener('click', function (e) {
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;

            const targetEl = document.querySelector(targetId);
            if (targetEl) {
                e.preventDefault();
                const offsetTop = targetEl.getBoundingClientRect().top + window.pageYOffset - 80;
                window.scrollTo({ top: offsetTop, behavior: 'smooth' });
            }
        });
    });

    // =========================================================================
    // 4. Fermeture des modales (overlay + Échap)
    // =========================================================================
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-overlay')) {
            e.target.classList.remove('active');
            document.body.style.overflow = '';
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal-overlay.active').forEach(modal => {
                modal.classList.remove('active');
            });
            document.body.style.overflow = '';
        }
    });

    // =========================================================================
    // 6. Validation d'email
    // =========================================================================
    const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    const showError = (input, message) => {
        clearError(input);
        const el = document.createElement('div');
        el.className = 'error-message';
        el.textContent = message;
        el.style.cssText = 'color:#EF4444;font-size:0.8rem;margin-top:4px;';
        input.parentElement.appendChild(el);
        input.style.borderColor = '#EF4444';
    };

    const clearError = (input) => {
        const err = input.parentElement.querySelector('.error-message');
        if (err) err.remove();
        input.style.borderColor = '';
    };

    // =========================================================================
    // 7. Formulaire de connexion (SUPABASE)
    // =========================================================================
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email');
            const password = document.getElementById('login-password');
            let valid = true;

            if (!validateEmail(email.value)) { showError(email, 'Email invalide.'); valid = false; } else clearError(email);
            if (password.value.length < 6) { showError(password, 'Le mot de passe doit faire au moins 6 caractères.'); valid = false; } else clearError(password);

            if (valid) {
                const btn = loginForm.querySelector('button[type="submit"]');
                const originalText = btn.textContent;
                btn.textContent = 'Connexion...';
                btn.disabled = true;

                try {
                    const { data, error } = await supabaseClient.auth.signInWithPassword({
                        email: email.value,
                        password: password.value,
                    });

                    if (error) {
                        showToast(error.message, 'error');
                        btn.textContent = originalText;
                        btn.disabled = false;
                    } else {
                        // Sauvegarde de la session pour dashboard.js
                        localStorage.setItem('isLoggedIn', 'true');
                        localStorage.setItem('userEmail', data.user.email);
                        localStorage.setItem('userName', (data.user.user_metadata && data.user.user_metadata.full_name) || data.user.email);

                        showToast('Connexion réussie !', 'success');
                        window.location.href = 'dashboard.html';
                    }
                } catch (err) {
                    showToast('Erreur : ' + err.message, 'error');
                    btn.textContent = originalText;
                    btn.disabled = false;
                }
            }
        });
    }

    // =========================================================================
    // 8. Formulaire d'inscription (SUPABASE)
    // =========================================================================
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('reg-name') || document.getElementById('register-name');
            const email = document.getElementById('reg-email') || document.getElementById('register-email');
            const password = document.getElementById('reg-password') || document.getElementById('register-password');
            const confirm = document.getElementById('reg-confirm') || document.getElementById('register-confirm');
            const terms = document.getElementById('terms') || document.getElementById('register-cgu');
            let valid = true;

            [name, email, password, confirm].forEach(input => { if (input) clearError(input); });

            if (name && name.value.trim().length < 2) { showError(name, 'Veuillez entrer votre nom.'); valid = false; }
            if (email && !validateEmail(email.value)) { showError(email, 'Email invalide.'); valid = false; }
            if (password && password.value.length < 6) { showError(password, 'Min 6 caractères.'); valid = false; }
            if (confirm && password && password.value !== confirm.value) { showError(confirm, 'Non correspondant.'); valid = false; }
            if (terms && !terms.checked) { showToast('Acceptez les CGU', 'error'); valid = false; }

            if (valid) {
                const btn = registerForm.querySelector('button[type="submit"]');
                const originalText = btn.textContent;
                btn.textContent = 'Création en cours...';
                btn.disabled = true;

                try {
                    const { data, error } = await supabaseClient.auth.signUp({
                        email: email.value,
                        password: password.value,
                        options: { data: { full_name: name ? name.value : 'Utilisateur' } }
                    });

                    if (error) {
                        showToast(error.message, 'error');
                        btn.textContent = originalText;
                        btn.disabled = false;
                    } else {
                        showToast('Compte créé ! Connectez-vous.', 'success');
                        if (typeof switchAuthTab === 'function') {
                            switchAuthTab('login');
                        } else {
                            closeModal('register-modal');
                            openModal('login-modal');
                        }
                        btn.textContent = originalText;
                        btn.disabled = false;
                    }
                } catch (err) {
                    showToast('Erreur inattendue : ' + err.message, 'error');
                    btn.textContent = originalText;
                    btn.disabled = false;
                }
            }
        });
    }

    // Validation en temps réel (sur blur)
    document.querySelectorAll('.modal-overlay input[type="email"]').forEach(input => {
        input.addEventListener('blur', () => {
            if (input.value && !validateEmail(input.value)) {
                showError(input, 'Adresse email invalide.');
            } else {
                clearError(input);
            }
        });
    });

    // =========================================================================
    // 9. FAQ Accordéon
    // =========================================================================
    const faqItems = document.querySelectorAll('.faq-item');
    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        if (!question) return;

        question.addEventListener('click', () => {
            const isActive = item.classList.contains('active');
            const answer = item.querySelector('.faq-answer');

            // Fermer tous les autres éléments
            faqItems.forEach(other => {
                other.classList.remove('active');
                const otherAnswer = other.querySelector('.faq-answer');
                if (otherAnswer) otherAnswer.style.maxHeight = null;
            });

            // Ouvrir l'élément cliqué s'il n'était pas déjà ouvert
            if (!isActive && answer) {
                item.classList.add('active');
                answer.style.maxHeight = answer.scrollHeight + 'px';
            }
        });
    });

    // =========================================================================
    // 10. Newsletter
    // =========================================================================
    const newsletterForm = document.querySelector('.newsletter-form');
    if (newsletterForm) {
        newsletterForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const emailInput = newsletterForm.querySelector('input[type="email"]');
            if (emailInput && validateEmail(emailInput.value)) {
                showToast('Inscription à la newsletter réussie !', 'success');
                emailInput.value = '';
            } else {
                showToast('Veuillez entrer une adresse email valide.', 'error');
            }
        });
    }

    // =========================================================================
    // 11. Animations au défilement (Intersection Observer)
    // =========================================================================
    const scrollObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                scrollObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

    document.querySelectorAll('.fade-in-up, .fade-in-left, .fade-in-right, .animate-on-scroll').forEach(el => {
        scrollObserver.observe(el);
    });

    // =========================================================================
    // 12. Compteurs animés
    // =========================================================================
    const animateCounter = (counter) => {
        const target = parseFloat(counter.getAttribute('data-target'));
        const suffix = counter.getAttribute('data-suffix') || '';
        const isDecimal = target % 1 !== 0;
        const duration = 2000;
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
    };

    const statsObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.querySelectorAll('.stat-number').forEach(counter => {
                    animateCounter(counter);
                });
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.3 });

    const statsBar = document.querySelector('.stats-bar');
    if (statsBar) statsObserver.observe(statsBar);

    // =========================================================================
    // 13. Surbrillance du lien de navigation actif au scroll
    // =========================================================================
    const sections = document.querySelectorAll('section[id]');
    const navLinksAll = document.querySelectorAll('.nav-links a');

    const sectionObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const id = entry.target.getAttribute('id');
                navLinksAll.forEach(link => {
                    link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
                });
            }
        });
    }, { threshold: 0.3 });

    sections.forEach(section => sectionObserver.observe(section));

    // =========================================================================
    // 14. Effet parallaxe subtil sur le hero (desktop uniquement)
    // =========================================================================
    if (window.innerWidth > 768) {
        const heroVisual = document.querySelector('.hero-visual, .hero-card, .parallax-el');
        if (heroVisual) {
            document.addEventListener('mousemove', (e) => {
                requestAnimationFrame(() => {
                    const x = (e.clientX / window.innerWidth - 0.5) * 15;
                    const y = (e.clientY / window.innerHeight - 0.5) * 15;
                    heroVisual.style.transform = `translate(${x}px, ${y}px)`;
                });
            });
        }
    }

});
