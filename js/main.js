/* ==========================================================================
   main.js — Atlas Capital
   Gestion de la navigation, modales, formulaires, animations et interactions
   ========================================================================== */


/* --- Fonctions globales --- */

function openModal(modalId) {

    const modal =
        document.getElementById(modalId);

    if (modal) {

        modal.classList.add('active');

        document.body.style.overflow = 'hidden';

    }

}


function closeModal(modalId) {

    const modal =
        document.getElementById(modalId);

    if (modal) {

        modal.classList.remove('active');

        document.body.style.overflow = '';

    }

}


function showToast(
    message,
    type = 'info'
) {

    const container =
        document.getElementById(
            'toast-container'
        );

    if (!container) return;


    const toast =
        document.createElement('div');

    toast.className =
        `toast ${type}`;


    const icons = {

        success:
            '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',

        error:
            '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',

        info:
            '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'

    };


    toast.innerHTML = `

        <span class="toast-icon">
            ${icons[type] || icons.info}
        </span>

        <span class="toast-message">
            ${message}
        </span>

    `;


    container.appendChild(toast);


    requestAnimationFrame(() =>
        toast.classList.add('show')
    );


    setTimeout(() => {

        toast.classList.remove('show');

        setTimeout(
            () => toast.remove(),
            300
        );

    }, 4000);

}


function togglePassword(inputId) {

    const input =
        document.getElementById(inputId);

    if (!input) return;

    input.type =
        input.type === 'password'
            ? 'text'
            : 'password';

}



/* ==========================================================================
   INITIALISATION
   ========================================================================== */

document.addEventListener(
    'DOMContentLoaded',
    () => {


        /* =================================================================
           0. CODE DE PARRAINAGE
           ================================================================= */

        const refParam =
            new URLSearchParams(
                window.location.search
            ).get('ref');

        if (refParam) {

            localStorage.setItem(
                'referredBy',
                refParam
            );

        }



        /* =================================================================
           1. NAVBAR
           ================================================================= */

        const navbar =
            document.getElementById('navbar');

        if (navbar) {

            window.addEventListener(
                'scroll',
                () => {

                    navbar.classList.toggle(
                        'scrolled',
                        window.scrollY > 50
                    );

                },
                {
                    passive: true
                }
            );

        }



        /* =================================================================
           2. MENU MOBILE
           ================================================================= */

        const burger =
            document.getElementById('burger');

        const navLinks =
            document.querySelector(
                '.nav-links'
            );

        const navActions =
            document.querySelector(
                '.nav-actions'
            );


        if (burger && navLinks) {

            burger.addEventListener(
                'click',
                () => {

                    burger.classList.toggle(
                        'active'
                    );

                    navLinks.classList.toggle(
                        'active'
                    );

                    if (navActions) {

                        navActions.classList.toggle(
                            'active'
                        );

                    }

                    document.body.style.overflow =
                        navLinks.classList.contains(
                            'active'
                        )
                            ? 'hidden'
                            : '';

                }
            );


            navLinks
                .querySelectorAll('a')
                .forEach(link => {

                    link.addEventListener(
                        'click',
                        () => {

                            burger.classList.remove(
                                'active'
                            );

                            navLinks.classList.remove(
                                'active'
                            );

                            if (navActions) {

                                navActions.classList.remove(
                                    'active'
                                );

                            }

                            document.body.style.overflow =
                                '';

                        }
                    );

                });


            document.addEventListener(
                'click',
                e => {

                    if (
                        !burger.contains(e.target) &&
                        !navLinks.contains(e.target) &&
                        !(
                            navActions &&
                            navActions.contains(e.target)
                        ) &&
                        navLinks.classList.contains(
                            'active'
                        )
                    ) {

                        burger.classList.remove(
                            'active'
                        );

                        navLinks.classList.remove(
                            'active'
                        );

                        if (navActions) {

                            navActions.classList.remove(
                                'active'
                            );

                        }

                        document.body.style.overflow =
                            '';

                    }

                }
            );

        }



        /* =================================================================
           3. SCROLL FLUIDE
           ================================================================= */

        document
            .querySelectorAll(
                'a[href^="#"]'
            )
            .forEach(link => {

                link.addEventListener(
                    'click',
                    function (e) {

                        const targetId =
                            this.getAttribute(
                                'href'
                            );

                        if (targetId === '#')
                            return;


                        const targetEl =
                            document.querySelector(
                                targetId
                            );


                        if (targetEl) {

                            e.preventDefault();

                            const offsetTop =
                                targetEl
                                    .getBoundingClientRect()
                                    .top +
                                window.pageYOffset -
                                80;


                            window.scrollTo({

                                top: offsetTop,

                                behavior: 'smooth'

                            });

                        }

                    }
                );

            });



        /* =================================================================
           4. FERMETURE MODALES
           ================================================================= */

        window.addEventListener(
            'click',
            e => {

                if (
                    e.target.classList.contains(
                        'modal-overlay'
                    )
                ) {

                    e.target.classList.remove(
                        'active'
                    );

                    document.body.style.overflow =
                        '';

                }

            }
        );


        document.addEventListener(
            'keydown',
            e => {

                if (e.key === 'Escape') {

                    document
                        .querySelectorAll(
                            '.modal-overlay.active'
                        )
                        .forEach(modal => {

                            modal.classList.remove(
                                'active'
                            );

                        });

                    document.body.style.overflow =
                        '';

                }

            }
        );



        /* =================================================================
           6. VALIDATION EMAIL + TÉLÉPHONE
           ================================================================= */

        const validateEmail =
            email =>
                /^[^\s@]+@[^\s@]+\.[^\s@]+$/
                    .test(email);


        /*
         * Convertit un numéro local vers le format international.
         *
         * Exemple :
         *
         * 690123456 + +237
         *
         * devient :
         *
         * +237690123456
         */

        const normalizePhoneNumber =
            (
                value,
                dialCode
            ) => {

                let digits =
                    String(value || '')
                        .replace(/\D/g, '');


                let dial =
                    String(dialCode || '')
                        .replace(/\D/g, '');


                if (!digits)
                    return '';


                /*
                 * Exemple :
                 *
                 * 00237690123456
                 *
                 * devient :
                 *
                 * +237690123456
                 */

                if (
                    digits.startsWith('00')
                ) {

                    digits =
                        digits.substring(2);

                    if (
                        dial &&
                        digits.startsWith(dial)
                    ) {

                        return '+' + digits;

                    }

                }


                /*
                 * Numéro déjà international
                 */

                if (
                    dial &&
                    digits.startsWith(dial)
                ) {

                    return '+' + digits;

                }


                /*
                 * Numéro local commençant par 0
                 */

                if (
                    digits.startsWith('0')
                ) {

                    digits =
                        digits.substring(1);

                }


                return dial
                    ? '+' + dial + digits
                    : '+' + digits;

            };


        const showError =
            (
                input,
                message
            ) => {

                if (!input) return;

                clearError(input);


                const el =
                    document.createElement(
                        'div'
                    );


                el.className =
                    'error-message';


                el.textContent =
                    message;


                el.style.cssText =
                    'color:#EF4444;font-size:0.8rem;margin-top:4px;';


                input.parentElement
                    .appendChild(el);


                input.style.borderColor =
                    '#EF4444';

            };


        const clearError =
            input => {

                if (!input) return;


                const err =
                    input.parentElement
                        .querySelector(
                            '.error-message'
                        );


                if (err)
                    err.remove();


                input.style.borderColor =
                    '';

            };



        /* =================================================================
           7. CONNEXION SUPABASE
              EMAIL OU TÉLÉPHONE
           ================================================================= */

        const loginForm =
            document.getElementById(
                'login-form'
            );


        if (loginForm) {

            loginForm.addEventListener(
                'submit',
                async e => {

                    e.preventDefault();


                    const method =
                        window.loginMethod ||
                        'email';


                    const email =
                        document.getElementById(
                            'login-email'
                        );


                    const phone =
                        document.getElementById(
                            'login-phone'
                        );


                    const phoneCountry =
                        document.getElementById(
                            'login-phone-country'
                        );


                    const password =
                        document.getElementById(
                            'login-password'
                        );


                    let valid = true;


                    [
                        email,
                        phone,
                        password
                    ].forEach(
                        input => {

                            if (input)
                                clearError(input);

                        }
                    );



                    /* EMAIL */

                    if (
                        method === 'email'
                    ) {

                        if (
                            !email ||
                            !validateEmail(
                                email.value.trim()
                            )
                        ) {

                            showError(
                                email,
                                'Email invalide.'
                            );

                            valid = false;

                        }

                    }



                    /* TÉLÉPHONE */

                    else {

                        if (
                            !phone ||
                            phone.value
                                .replace(/\D/g, '')
                                .length < 6
                        ) {

                            showError(
                                phone,
                                'Numéro de téléphone invalide.'
                            );

                            valid = false;

                        }

                    }



                    /* MOT DE PASSE */

                    if (
                        !password ||
                        password.value.length < 6
                    ) {

                        showError(
                            password,
                            'Le mot de passe doit faire au moins 6 caractères.'
                        );

                        valid = false;

                    }


                    if (!valid)
                        return;


                    const btn =
                        loginForm.querySelector(
                            'button[type="submit"]'
                        );


                    const originalText =
                        btn.textContent;


                    btn.textContent =
                        'Connexion...';


                    btn.disabled = true;


                    try {

                        let credentials;


                        /*
                         * CONNEXION TÉLÉPHONE
                         */

                        if (
                            method === 'phone'
                        ) {

                            const dial =
                                phoneCountry
                                    ? phoneCountry.value
                                    : '';


                            const normalizedPhone =
                                normalizePhoneNumber(
                                    phone.value,
                                    dial
                                );


                            if (
                                !normalizedPhone
                            ) {

                                showError(
                                    phone,
                                    'Numéro de téléphone invalide.'
                                );

                                btn.textContent =
                                    originalText;

                                btn.disabled =
                                    false;

                                return;

                            }


                            credentials = {

                                phone:
                                    normalizedPhone,

                                password:
                                    password.value

                            };

                        }


                        /*
                         * CONNEXION EMAIL
                         */

                        else {

                            credentials = {

                                email:
                                    email.value.trim(),

                                password:
                                    password.value

                            };

                        }


                        const {
                            data,
                            error
                        } =
                            await supabaseClient
                                .auth
                                .signInWithPassword(
                                    credentials
                                );


                        if (error) {

                            showToast(
                                error.message,
                                'error'
                            );

                            btn.textContent =
                                originalText;

                            btn.disabled =
                                false;

                            return;

                        }


                        const user =
                            data.user;


                        const identifier =
                            user.email ||
                            user.phone ||
                            '';


                        const displayName =
                            (
                                user.user_metadata &&
                                user.user_metadata.full_name
                            ) ||
                            identifier ||
                            'Utilisateur';


                        localStorage.setItem(
                            'isLoggedIn',
                            'true'
                        );


                        localStorage.setItem(
                            'userEmail',
                            identifier
                        );


                        localStorage.setItem(
                            'userName',
                            displayName
                        );


                        showToast(
                            'Connexion réussie !',
                            'success'
                        );


                        window.location.href =
                            'dashboard.html';

                    }

                    catch (err) {

                        showToast(
                            'Erreur : ' +
                            err.message,
                            'error'
                        );


                        btn.textContent =
                            originalText;


                        btn.disabled =
                            false;

                    }

                }
            );

        }



        /* =================================================================
           8. INSCRIPTION SUPABASE
              EMAIL OU TÉLÉPHONE
           ================================================================= */

        const registerForm =
            document.getElementById(
                'register-form'
            );


        if (registerForm) {

            registerForm.addEventListener(
                'submit',
                async e => {

                    e.preventDefault();


                    const method =
                        window.registerMethod ||
                        'email';


                    const name =
                        document.getElementById(
                            'reg-name'
                        ) ||
                        document.getElementById(
                            'register-name'
                        );


                    const email =
                        document.getElementById(
                            'reg-email'
                        ) ||
                        document.getElementById(
                            'register-email'
                        );


                    const phone =
                        document.getElementById(
                            'reg-phone'
                        );


                    const phoneCountry =
                        document.getElementById(
                            'reg-phone-country'
                        );


                    const password =
                        document.getElementById(
                            'reg-password'
                        ) ||
                        document.getElementById(
                            'register-password'
                        );


                    const confirm =
                        document.getElementById(
                            'reg-confirm'
                        ) ||
                        document.getElementById(
                            'register-confirm'
                        );


                    const country =
                        document.getElementById(
                            'reg-country'
                        );


                    const terms =
                        document.getElementById(
                            'terms'
                        ) ||
                        document.getElementById(
                            'register-cgu'
                        );


                    let valid = true;


                    [
                        name,
                        email,
                        phone,
                        password,
                        confirm,
                        country
                    ].forEach(
                        input => {

                            if (input)
                                clearError(input);

                        }
                    );



                    /* NOM */

                    if (
                        name &&
                        name.value.trim().length < 2
                    ) {

                        showError(
                            name,
                            'Veuillez entrer votre nom.'
                        );

                        valid = false;

                    }



                    /* EMAIL */

                    if (
                        method === 'email'
                    ) {

                        if (
                            email &&
                            !validateEmail(
                                email.value.trim()
                            )
                        ) {

                            showError(
                                email,
                                'Email invalide.'
                            );

                            valid = false;

                        }

                    }



                    /* TÉLÉPHONE */

                    else {

                        if (
                            !phone ||
                            phone.value
                                .replace(/\D/g, '')
                                .length < 6
                        ) {

                            showError(
                                phone,
                                'Numéro de téléphone invalide.'
                            );

                            valid = false;

                        }

                    }



                    /* MOT DE PASSE */

                    if (
                        password &&
                        password.value.length < 6
                    ) {

                        showError(
                            password,
                            'Min 6 caractères.'
                        );

                        valid = false;

                    }



                    /* CONFIRMATION */

                    if (
                        confirm &&
                        password &&
                        password.value !==
                            confirm.value
                    ) {

                        showError(
                            confirm,
                            'Les mots de passe ne correspondent pas.'
                        );

                        valid = false;

                    }



                    /* PAYS */

                    if (
                        country &&
                        !country.value
                    ) {

                        showError(
                            country,
                            'Veuillez sélectionner votre pays.'
                        );

                        valid = false;

                    }



                    /* CGU */

                    if (
                        terms &&
                        !terms.checked
                    ) {

                        showToast(
                            'Acceptez les CGU',
                            'error'
                        );

                        valid = false;

                    }


                    if (!valid)
                        return;


                    const btn =
                        registerForm.querySelector(
                            'button[type="submit"]'
                        );


                    const originalText =
                        btn.textContent;


                    btn.textContent =
                        'Création en cours...';


                    btn.disabled = true;


                    try {

                        const referredBy =
                            localStorage.getItem(
                                'referredBy'
                            ) ||
                            null;


                        const metadata = {

                            full_name:
                                name
                                    ? name.value.trim()
                                    : 'Utilisateur',

                            country:
                                country
                                    ? country.value
                                    : null,

                            referred_by:
                                referredBy

                        };


                        let signupData;



                        /*
                         * INSCRIPTION TÉLÉPHONE
                         */

                        if (
                            method === 'phone'
                        ) {

                            const dial =
                                phoneCountry
                                    ? phoneCountry.value
                                    : '';


                            const normalizedPhone =
                                normalizePhoneNumber(
                                    phone.value,
                                    dial
                                );


                            if (
                                !normalizedPhone
                            ) {

                                showError(
                                    phone,
                                    'Numéro de téléphone invalide.'
                                );

                                btn.textContent =
                                    originalText;

                                btn.disabled =
                                    false;

                                return;

                            }


                            metadata.phone_country =
                                phoneCountry
                                    ? phoneCountry
                                        .options[
                                            phoneCountry
                                                .selectedIndex
                                        ]
                                        .dataset
                                        .code
                                    : null;


                            metadata.phone =
                                normalizedPhone;


                            signupData = {

                                phone:
                                    normalizedPhone,

                                password:
                                    password.value,

                                options: {

                                    data:
                                        metadata

                                }

                            };

                        }



                        /*
                         * INSCRIPTION EMAIL
                         */

                        else {

                            signupData = {

                                email:
                                    email.value.trim(),

                                password:
                                    password.value,

                                options: {

                                    data:
                                        metadata

                                }

                            };

                        }


                        const {
                            data,
                            error
                        } =
                            await supabaseClient
                                .auth
                                .signUp(
                                    signupData
                                );


                        if (error) {

                            showToast(
                                error.message,
                                'error'
                            );

                            btn.textContent =
                                originalText;

                            btn.disabled =
                                false;

                            return;

                        }


                        localStorage.removeItem(
                            'referredBy'
                        );


                        if (
                            method === 'phone'
                        ) {

                            showToast(
                                'Compte créé. Vérifiez le code SMS reçu pour confirmer votre numéro.',
                                'success'
                            );

                        }

                        else {

                            showToast(
                                'Inscription réussie ! Veuillez vous connecter pour accéder à votre Dashboard.',
                                'success'
                            );

                        }


                        if (
                            typeof switchAuthTab ===
                            'function'
                        ) {

                            switchAuthTab(
                                'login'
                            );

                        }

                        else {

                            closeModal(
                                'register-modal'
                            );

                            openModal(
                                'login-modal'
                            );

                        }


                        btn.textContent =
                            originalText;


                        btn.disabled =
                            false;

                    }

                    catch (err) {

                        showToast(
                            'Erreur inattendue : ' +
                            err.message,
                            'error'
                        );


                        btn.textContent =
                            originalText;


                        btn.disabled =
                            false;

                    }

                }
            );

        }



        /* =================================================================
           VALIDATION EMAIL EN TEMPS RÉEL
           ================================================================= */

        document
            .querySelectorAll(
                'input[type="email"]'
            )
            .forEach(
                input => {

                    input.addEventListener(
                        'blur',
                        () => {

                            if (
                                input.value &&
                                !validateEmail(
                                    input.value
                                )
                            ) {

                                showError(
                                    input,
                                    'Adresse email invalide.'
                                );

                            }

                            else {

                                clearError(
                                    input
                                );

                            }

                        }
                    );

                }
            );



        /* =================================================================
           9. FAQ ACCORDÉON
           ================================================================= */

        const faqItems =
            document.querySelectorAll(
                '.faq-item'
            );


        faqItems.forEach(
            item => {

                const question =
                    item.querySelector(
                        '.faq-question'
                    );


                if (!question)
                    return;


                question.addEventListener(
                    'click',
                    () => {

                        const isActive =
                            item.classList.contains(
                                'active'
                            );


                        const answer =
                            item.querySelector(
                                '.faq-answer'
                            );


                        faqItems.forEach(
                            other => {

                                other.classList.remove(
                                    'active'
                                );


                                const otherAnswer =
                                    other.querySelector(
                                        '.faq-answer'
                                    );


                                if (otherAnswer)
                                    otherAnswer.style.maxHeight =
                                        null;

                            }
                        );


                        if (
                            !isActive &&
                            answer
                        ) {

                            item.classList.add(
                                'active'
                            );


                            answer.style.maxHeight =
                                answer.scrollHeight +
                                'px';

                        }

                    }
                );

            }
        );



        /* =================================================================
           10. NEWSLETTER
           ================================================================= */

        const newsletterForm =
            document.querySelector(
                '.newsletter-form'
            );


        if (newsletterForm) {

            newsletterForm.addEventListener(
                'submit',
                e => {

                    e.preventDefault();


                    const emailInput =
                        newsletterForm.querySelector(
                            'input[type="email"]'
                        );


                    if (
                        emailInput &&
                        validateEmail(
                            emailInput.value
                        )
                    ) {

                        showToast(
                            'Inscription à la newsletter réussie !',
                            'success'
                        );


                        emailInput.value =
                            '';

                    }

                    else {

                        showToast(
                            'Veuillez entrer une adresse email valide.',
                            'error'
                        );

                    }

                }
            );

        }



        /* =================================================================
           11. ANIMATIONS AU DÉFILEMENT
           ================================================================= */

        const scrollObserver =
            new IntersectionObserver(
                entries => {

                    entries.forEach(
                        entry => {

                            if (
                                entry.isIntersecting
                            ) {

                                entry.target
                                    .classList
                                    .add(
                                        'visible'
                                    );


                                scrollObserver
                                    .unobserve(
                                        entry.target
                                    );

                            }

                        }
                    );

                },
                {
                    threshold: 0.1,
                    rootMargin:
                        '0px 0px -50px 0px'
                }
            );


        document
            .querySelectorAll(
                '.fade-in-up, .fade-in-left, .fade-in-right, .animate-on-scroll'
            )
            .forEach(
                el =>
                    scrollObserver.observe(el)
            );



        /* =================================================================
           12. COMPTEURS ANIMÉS
           ================================================================= */

        const animateCounter =
            counter => {

                const target =
                    parseFloat(
                        counter.getAttribute(
                            'data-target'
                        )
                    );


                const suffix =
                    counter.getAttribute(
                        'data-suffix'
                    ) ||
                    '';


                const isDecimal =
                    target % 1 !== 0;


                const duration =
                    2000;


                const steps =
                    60;


                const increment =
                    target / steps;


                let current =
                    0;


                let step =
                    0;


                const timer =
                    setInterval(
                        () => {

                            step++;

                            current +=
                                increment;


                            if (
                                step >= steps
                            ) {

                                current =
                                    target;

                                clearInterval(
                                    timer
                                );

                            }


                            if (
                                isDecimal
                            ) {

                                counter.textContent =
                                    current.toFixed(
                                        1
                                    ) +
                                    suffix;

                            }

                            else {

                                counter.textContent =
                                    new Intl.NumberFormat(
                                        'fr-FR'
                                    ).format(
                                        Math.ceil(
                                            current
                                        )
                                    ) +
                                    suffix;

                            }

                        },
                        duration / steps
                    );

            };


        const statsObserver =
            new IntersectionObserver(
                (entries, observer) => {

                    entries.forEach(
                        entry => {

                            if (
                                entry.isIntersecting
                            ) {

                                entry.target
                                    .querySelectorAll(
                                        '.stat-number'
                                    )
                                    .forEach(
                                        counter =>
                                            animateCounter(
                                                counter
                                            )
                                    );


                                observer.unobserve(
                                    entry.target
                                );

                            }

                        }
                    );

                },
                {
                    threshold: 0.3
                }
            );


        const statsBar =
            document.querySelector(
                '.stats-bar'
            );


        if (statsBar)
            statsObserver.observe(
                statsBar
            );



        /* =================================================================
           13. LIEN NAVIGATION ACTIF
           ================================================================= */

        const sections =
            document.querySelectorAll(
                'section[id]'
            );


        const navLinksAll =
            document.querySelectorAll(
                '.nav-links a'
            );


        const sectionObserver =
            new IntersectionObserver(
                entries => {

                    entries.forEach(
                        entry => {

                            if (
                                entry.isIntersecting
                            ) {

                                const id =
                                    entry.target
                                        .getAttribute(
                                            'id'
                                        );


                                navLinksAll
                                    .forEach(
                                        link => {

                                            link.classList.toggle(
                                                'active',

                                                link.getAttribute(
                                                    'href'
                                                ) ===
                                                `#${id}`
                                            );

                                        }
                                    );

                            }

                        }
                    );

                },
                {
                    threshold: 0.3
                }
            );


        sections.forEach(
            section =>
                sectionObserver.observe(
                    section
                )
        );



        /* =================================================================
           14. PARALLAXE HERO
           ================================================================= */

        if (
            window.innerWidth >
            768
        ) {

            const heroVisual =
                document.querySelector(
                    '.hero-visual, .hero-card, .parallax-el'
                );


            if (heroVisual) {

                document.addEventListener(
                    'mousemove',
                    e => {

                        requestAnimationFrame(
                            () => {

                                const x =
                                    (
                                        e.clientX /
                                        window.innerWidth -
                                        0.5
                                    ) *
                                    15;


                                const y =
                                    (
                                        e.clientY /
                                        window.innerHeight -
                                        0.5
                                    ) *
                                    15;


                                heroVisual.style.transform =
                                    `translate(${x}px, ${y}px)`;

                            }
                        );

                    }
                );

            }

        }

    }

);
