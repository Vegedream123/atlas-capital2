// ==========================================================================
// ATLAS CAPITAL — PANEL ADMIN
// ==========================================================================
document.addEventListener('DOMContentLoaded', async () => {

    const formatFCFA = (amount) => new Intl.NumberFormat('fr-FR').format(Math.round(amount || 0)) + ' FCFA';
    const formatDate = (d) => d ? new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

    window.showToast = (message, type = 'info', duration = 4000) => {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<div>${message}</div>`;
        container.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, duration);
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
    // 1bis. Générateur de reçu (image PNG dessinée en Canvas, habillage
    // "Atlas Capital") — utilisé à la fois pour le reçu AUTOMATIQUE à la
    // validation d'un retrait et pour l'outil de reçu MANUEL du panel.
    // Compatible avec TOUS les navigateurs (y compris anciens
    // Android/WebView) : ctx.roundRect() est une API Canvas récente
    // absente sur certains téléphones, remplacée ici par un tracé manuel.
    // ----------------------------------------------------------------
    function tracePath(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }

    function drawReceiptCanvas({ statusLabel, statusColor, amount, netAmount, feeLabel, method, destination, recipientName, userName, userEmail, date, reference }) {
        const W = 1000, H = 1250;
        const canvas = document.createElement('canvas');
        canvas.width = W; canvas.height = H;
        const ctx = canvas.getContext('2d');

        // Fond
        ctx.fillStyle = '#f4f1ee';
        ctx.fillRect(0, 0, W, H);

        // Carte blanche centrale avec ombre légère
        const pad = 50;
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(0,0,0,0.12)';
        ctx.shadowBlur = 30;
        ctx.fillRect(pad, pad, W - pad * 2, H - pad * 2);
        ctx.shadowBlur = 0;

        // Bandeau haut (couleur marque Atlas Capital)
        ctx.fillStyle = '#c45a18';
        ctx.fillRect(pad, pad, W - pad * 2, 170);

        // Logo texte
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 42px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('🏛 Atlas Capital', pad + 40, pad + 100);

        ctx.font = '22px sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fillText('Reçu officiel de transaction', pad + 40, pad + 140);

        // Badge de statut
        ctx.font = 'bold 24px sans-serif';
        const statusText = statusLabel || 'VALIDÉ';
        const statusWidth = ctx.measureText(statusText).width + 50;
        ctx.fillStyle = statusColor || '#1f9d55';
        const badgeX = W - pad - statusWidth - 30;
        const badgeY = pad + 55;
        tracePath(ctx, badgeX, badgeY, statusWidth, 48, 24);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(statusText, badgeX + statusWidth / 2, badgeY + 32);

        // Montant principal
        ctx.textAlign = 'center';
        ctx.fillStyle = '#1a1a1a';
        ctx.font = 'bold 64px sans-serif';
        ctx.fillText(amount, W / 2, pad + 280);
        if (netAmount) {
            ctx.font = '22px sans-serif';
            ctx.fillStyle = '#6b6b6b';
            ctx.fillText(netAmount, W / 2, pad + 320);
        }

        // Ligne séparatrice
        ctx.strokeStyle = '#e6e2dd';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(pad + 40, pad + 360);
        ctx.lineTo(W - pad - 40, pad + 360);
        ctx.stroke();

        // Lignes de détail (label / valeur)
        const rows = [
            ['Bénéficiaire', userName || '—'],
            ['E-mail du compte', userEmail || '—'],
            ['Nom du destinataire', recipientName || '—'],
            ['Méthode', method || '—'],
            ['Destination', destination || '—'],
            ...(feeLabel ? [['Frais', feeLabel]] : []),
            ['Référence', reference || '—'],
            ['Date', date || '—'],
        ];

        let y = pad + 420;
        ctx.textAlign = 'left';
        rows.forEach(([label, value]) => {
            ctx.font = '22px sans-serif';
            ctx.fillStyle = '#8a8580';
            ctx.fillText(label, pad + 40, y);
            ctx.font = 'bold 24px sans-serif';
            ctx.fillStyle = '#1a1a1a';
            ctx.textAlign = 'right';
            ctx.fillText(value, W - pad - 40, y);
            ctx.textAlign = 'left';
            y += 58;
        });

        // Pied de page
        ctx.textAlign = 'center';
        ctx.font = '18px sans-serif';
        ctx.fillStyle = '#a8a29b';
        ctx.fillText('Document généré automatiquement — Atlas Capital', W / 2, H - pad - 30);

        return canvas;
    }

    function canvasToBlob(canvas) {
        return new Promise((resolve) => canvas.toBlob(resolve, 'image/png', 0.95));
    }

    async function uploadReceiptImage(canvas, filenamePrefix) {
        const blob = await canvasToBlob(canvas);
        const path = `${filenamePrefix}-${Date.now()}.png`;
        const { error: uploadError } = await window.supabaseClient.storage
            .from('receipts')
            .upload(path, blob, { contentType: 'image/png', upsert: true });
        if (uploadError) throw uploadError;
        const { data } = window.supabaseClient.storage.from('receipts').getPublicUrl(path);
        return data.publicUrl;
    }


    // ----------------------------------------------------------------
    // 1ter. Reçu "bannière" — image PAYSAGE (16:9) affichée dans le
    // carrousel de la page d'accueil pour TOUS les utilisateurs
    // (preuve de paiement). Volontairement ANONYMISÉ : jamais d'e-mail,
    // jamais de numéro/destination, nom masqué (ex. « K•••• D. »).
    // Le reçu complet (avec toutes les infos) reste envoyé en privé
    // à l'utilisateur concerné, dans ses notifications.
    // ----------------------------------------------------------------
    function maskPersonName(name) {
        const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
        if (!parts.length || String(name).includes('@')) return 'Client Atlas Capital';
        const mask = (w) => w.charAt(0).toUpperCase() + '•'.repeat(Math.max(2, Math.min(5, w.length - 1)));
        if (parts.length === 1) return mask(parts[0]);
        return mask(parts[0]) + ' ' + parts[parts.length - 1].charAt(0).toUpperCase() + '.';
    }

    function drawBannerReceiptCanvas({ isWithdrawal, mainAmount, subLine, method, maskedName, date }) {
        const W = 1280, H = 720;
        const canvas = document.createElement('canvas');
        canvas.width = W; canvas.height = H;
        const ctx = canvas.getContext('2d');

        // Fond aux couleurs de la marque
        const grad = ctx.createLinearGradient(0, 0, W, H);
        grad.addColorStop(0, '#d9691f');
        grad.addColorStop(1, '#8f3d0c');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);

        // Carte blanche
        const m = 36;
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(0,0,0,0.25)';
        ctx.shadowBlur = 30;
        tracePath(ctx, m, m, W - m * 2, H - m * 2, 28);
        ctx.fill();
        ctx.shadowBlur = 0;

        // En-tête : marque + badge de statut
        ctx.textAlign = 'left';
        ctx.fillStyle = '#c45a18';
        ctx.font = 'bold 44px sans-serif';
        ctx.fillText('🏛 Atlas Capital', m + 44, m + 90);

        const badgeText = isWithdrawal ? 'RETRAIT VALIDÉ' : 'DÉPÔT VALIDÉ';
        ctx.font = 'bold 28px sans-serif';
        const bw = ctx.measureText(badgeText).width + 56;
        const bx = W - m - 44 - bw, by = m + 48;
        ctx.fillStyle = '#1f9d55';
        tracePath(ctx, bx, by, bw, 56, 28);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(badgeText, bx + bw / 2, by + 38);

        // Libellé + montant principal (net envoyé pour un retrait)
        ctx.fillStyle = '#8a8580';
        ctx.font = '32px sans-serif';
        ctx.fillText(isWithdrawal ? 'Montant net envoyé' : 'Montant crédité', W / 2, m + 200);

        let size = 130;
        ctx.font = `bold ${size}px sans-serif`;
        while (ctx.measureText(mainAmount).width > W - 200 && size > 50) {
            size -= 4;
            ctx.font = `bold ${size}px sans-serif`;
        }
        ctx.fillStyle = '#1a1a1a';
        ctx.fillText(mainAmount, W / 2, m + 200 + size);

        if (subLine) {
            ctx.fillStyle = '#6b6b6b';
            ctx.font = '30px sans-serif';
            ctx.fillText(subLine, W / 2, m + 200 + size + 52);
        }

        // Séparateur
        const sepY = H - m - 190;
        ctx.strokeStyle = '#e6e2dd';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(m + 44, sepY);
        ctx.lineTo(W - m - 44, sepY);
        ctx.stroke();

        // 3 colonnes : bénéficiaire (masqué) / méthode / date
        const cols = [
            ['Bénéficiaire', maskedName || 'Client Atlas Capital'],
            ['Méthode', method || '—'],
            ['Date', date || '—'],
        ];
        const colW = (W - m * 2 - 88) / 3;
        cols.forEach(([label, value], i) => {
            const cx = m + 44 + colW * i + colW / 2;
            ctx.fillStyle = '#8a8580';
            ctx.font = '24px sans-serif';
            ctx.fillText(label, cx, sepY + 50);
            let vs = 32;
            ctx.font = `bold ${vs}px sans-serif`;
            while (ctx.measureText(value).width > colW - 20 && vs > 18) {
                vs -= 2;
                ctx.font = `bold ${vs}px sans-serif`;
            }
            ctx.fillStyle = '#1a1a1a';
            ctx.fillText(value, cx, sepY + 96);
        });

        ctx.fillStyle = '#a8a29b';
        ctx.font = '22px sans-serif';
        ctx.fillText('✔ Paiement vérifié — Atlas Capital', W / 2, H - m - 24);

        return canvas;
    }

    // Préférence de l'admin (sur cet appareil) : les reçus automatiques
    // arrivent en BROUILLON (visibles par lui seul) ou sont publiés direct.
    const isAutoPublishReceipts = () => {
        try { return localStorage.getItem('autoPublishReceipts') === '1'; } catch (e) { return false; }
    };

    // Génère le reçu-bannière d'une demande VALIDÉE (retrait ou dépôt) et
    // l'ajoute automatiquement en tête du carrousel d'accueil.
    async function publishReceiptBanner(kind, reqRow, profileRow) {
        const isWithdrawal = kind === 'withdrawals';
        const amount = Number(reqRow.amount) || 0;
        const fee = Number(reqRow.fee_amount) || 0;
        // Retrait : on affiche le NET réellement envoyé (montant − frais).
        const net = isWithdrawal
            ? (reqRow.net_amount != null ? Number(reqRow.net_amount) : amount - fee)
            : amount;
        const subLine = isWithdrawal && fee > 0
            ? `Montant demandé ${formatFCFA(amount)} · Frais ${reqRow.fee_percent}% (${formatFCFA(fee)})`
            : (isWithdrawal ? null : 'Dépôt confirmé et crédité sur le compte');

        const canvas = drawBannerReceiptCanvas({
            isWithdrawal,
            mainAmount: formatFCFA(net),
            subLine,
            method: reqRow.method_name,
            maskedName: maskPersonName(profileRow && profileRow.full_name),
            date: formatDate(new Date()),
        });
        const imageUrl = await uploadReceiptImage(canvas, `banner-${isWithdrawal ? 'withdrawal' : 'deposit'}-${reqRow.id}`);
        const { error } = await window.supabaseClient.rpc('admin_push_receipt_banner', {
            p_image_url: imageUrl,
            p_kind: isWithdrawal ? 'withdrawal' : 'deposit',
            p_published: isAutoPublishReceipts(),
        });
        if (error) throw error;
    }

    // Redimensionne (max 1600 px de large) et compresse en JPEG une image
    // choisie par l'admin avant l'envoi : légère, rapide à charger sur
    // mobile, et toujours dans un format que tous les navigateurs lisent.
    function resizeImageToBlob(file, maxWidth = 1600, quality = 0.85) {
        return new Promise((resolve, reject) => {
            const objectUrl = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => {
                const scale = Math.min(1, maxWidth / img.naturalWidth);
                const w = Math.max(1, Math.round(img.naturalWidth * scale));
                const h = Math.max(1, Math.round(img.naturalHeight * scale));
                const c = document.createElement('canvas');
                c.width = w; c.height = h;
                const cctx = c.getContext('2d');
                cctx.fillStyle = '#ffffff';
                cctx.fillRect(0, 0, w, h);
                cctx.drawImage(img, 0, 0, w, h);
                URL.revokeObjectURL(objectUrl);
                c.toBlob((b) => b ? resolve(b) : reject(new Error('Conversion de l\'image impossible.')), 'image/jpeg', quality);
            };
            img.onerror = () => {
                URL.revokeObjectURL(objectUrl);
                reject(new Error('Image illisible. Utilisez un fichier JPG, PNG ou WEBP.'));
            };
            img.src = objectUrl;
        });
    }

    async function uploadBannerImage(file) {
        const blob = await resizeImageToBlob(file);
        const path = `banners/banner-${Date.now()}.jpg`;
        const { error: uploadError } = await window.supabaseClient.storage
            .from('receipts')
            .upload(path, blob, { contentType: 'image/jpeg', upsert: true });
        if (uploadError) throw uploadError;
        const { data } = window.supabaseClient.storage.from('receipts').getPublicUrl(path);
        return data.publicUrl;
    }

    if (!window.supabaseClient) { window.location.href = 'index.html'; return; }

    const { data: sessionData } = await window.supabaseClient.auth.getSession();
    const session = sessionData && sessionData.session;
    if (!session) { window.location.href = 'index.html'; return; }
    // Renouvelle la fenêtre de "reste connecté" de 12h à chaque visite.
    localStorage.setItem('sessionExpiresAt', String(Date.now() + 12 * 60 * 60 * 1000));

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
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('sessionExpiresAt');
        window.location.href = 'index.html';
    });

    // ----------------------------------------------------------------
    // 2. Navigation latérale
    // ----------------------------------------------------------------
    const navItems = document.querySelectorAll('.admin-nav-item');
    const views = document.querySelectorAll('.admin-view');
    const titleMap = { apercu: 'Aperçu', produits: 'Produits', depots: 'Dépôts', retraits: 'Retraits', achats: 'Achats Machines', utilisateurs: 'Utilisateurs', codespromo: 'Codes Promo', parrainage: 'Top Promoteurs', parametres: 'Paramètres' };

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const target = item.getAttribute('data-target');
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            views.forEach(v => v.classList.remove('active'));
            document.getElementById('view-' + target).classList.add('active');
            document.getElementById('admin-view-title').textContent = titleMap[target] || '';
            if (target === 'apercu') { loadStats(); loadUpcomingMaturities(); }
            if (target === 'produits') { loadProducts(); }
            if (target === 'depots') loadRequests('deposits', currentDepositStatus);
            if (target === 'retraits') loadRequests('withdrawals', currentWithdrawalStatus);
            if (target === 'achats') loadPurchases(currentPurchaseStatus);
            if (target === 'utilisateurs') loadUsers();
            if (target === 'codespromo') loadPromoCodes();
            if (target === 'parrainage') loadTopReferrers();
            if (target === 'parametres') { loadSettings(); loadPaymentSettings(); loadBanners(); }
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
    // 3ter. Échéances à venir — vue anticipée des placements Revenu
    // Annuel encore actifs, triés par date d'échéance la plus proche,
    // pour préparer la liquidité (FCFA / USDT) avant les retraits.
    // ----------------------------------------------------------------
    async function loadUpcomingMaturities() {
        const tbody = document.getElementById('maturities-tbody');
        const summaryEl = document.getElementById('maturities-summary');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="6">Chargement…</td></tr>';

        const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        const { data, error } = await window.supabaseClient
            .from('user_investments')
            .select('amount, matures_at, locked_payout_amount, profiles(full_name, phone), investment_products(category)')
            .eq('status', 'active')
            .not('matures_at', 'is', null)
            .lte('matures_at', in30Days)
            .order('matures_at', { ascending: true })
            .limit(100);

        if (error) { tbody.innerHTML = `<tr><td colspan="6">Erreur de chargement.</td></tr>`; return; }

        // Toutes les catégories à échéance (pas seulement Atlas) : chacune
        // représente une vraie obligation de paiement au client à sa date.
        const PAYOUT_CATEGORIES = ['atlas', 'constant', 'analyse', 'quete', 'express'];
        const rows = (data || []).filter(inv => inv.investment_products && PAYOUT_CATEGORIES.includes(inv.investment_products.category));

        if (!rows.length) {
            tbody.innerHTML = `<tr><td colspan="6">Aucune échéance dans les 30 prochains jours.</td></tr>`;
            if (summaryEl) summaryEl.textContent = '';
            return;
        }

        const totalToPay = rows.reduce((sum, r) => sum + Number(r.locked_payout_amount || r.amount || 0), 0);
        if (summaryEl) {
            summaryEl.innerHTML = `<strong>${rows.length}</strong> placement(s) arrivent à échéance sous 30 jours, pour un total à payer d'environ <strong>${formatFCFA(totalToPay)}</strong>.`;
        }

        const MATURITY_CATEGORY_LABEL = { atlas: 'Revenu Annuel', constant: 'Actif — Constant', analyse: 'Actif — Analyse', quete: 'Quête', express: 'Express' };
        const now = Date.now();
        tbody.innerHTML = rows.map(inv => {
            const user = inv.profiles || {};
            const maturesDate = new Date(inv.matures_at);
            const daysLeft = Math.round((maturesDate.getTime() - now) / (24 * 60 * 60 * 1000));
            const daysLabel = daysLeft < 0
                ? `<span style="color:var(--danger,#e11);">en retard de ${Math.abs(daysLeft)} j</span>`
                : (daysLeft === 0 ? `<strong>aujourd'hui</strong>` : `dans ${daysLeft} j`);
            const payout = inv.locked_payout_amount ? formatFCFA(inv.locked_payout_amount) : formatFCFA(inv.amount);
            const categoryName = (inv.investment_products && MATURITY_CATEGORY_LABEL[inv.investment_products.category]) || '—';
            return `<tr>
                <td>${formatDate(inv.matures_at)}<br><span class="text-secondary" style="font-size:0.72rem;">${daysLabel}</span></td>
                <td>${categoryName}</td>
                <td>${user.full_name || '—'}</td>
                <td>${user.phone || '—'}</td>
                <td>${formatFCFA(inv.amount)}</td>
                <td><strong>${payout}</strong></td>
            </tr>`;
        }).join('');
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
                loadUpcomingMaturities();
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
    const productVipLevelInput = document.getElementById('product-vip-level');
    const productPriceInput = document.getElementById('product-price');
    const productRateInput = document.getElementById('product-rate');
    const productDurationInput = document.getElementById('product-duration');
    const productCyclePayoutInput = document.getElementById('product-cycle-payout');
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
        // 'quete' et 'express' fonctionnent maintenant exactement comme
        // 'constant'/'analyse' : cycle en jours + montant de fin de cycle
        // (pas de %/jour), gains accumulés et versés (capital + gains) à
        // l'échéance. Seule différence : 'express' n'a aucune condition
        // de déblocage (voir purchase_investment côté serveur).
        const isActifCycle = ['constant', 'analyse', 'quete', 'express'].includes(productCategoryInput.value);
        if (monthlyRevenuesGroup) monthlyRevenuesGroup.style.display = isAtlas ? 'block' : 'none';

        // Pour "Revenu Annuel", le %/jour et l'échéance en jours ne servent à
        // rien (le montant et la durée viennent du revenu mensuel ci-dessus) :
        // on les cache et on les rend optionnels pour éviter toute confusion.
        // Pour les produits Actif (constant/analyse/quete/express), le %/jour
        // est remplacé par un montant total fixe versé à la fin du cycle.
        const rateGroup = document.getElementById('product-rate-group');
        const durationGroup = document.getElementById('product-duration-group');
        const dailyGainGroup = document.getElementById('product-daily-gain-preview-group');
        const cyclePayoutGroup = document.getElementById('product-cycle-payout-group');
        if (rateGroup) rateGroup.style.display = (isAtlas || isActifCycle) ? 'none' : 'block';
        if (durationGroup) durationGroup.style.display = isAtlas ? 'none' : 'block';
        if (dailyGainGroup) dailyGainGroup.style.display = (isAtlas || isActifCycle) ? 'none' : 'block';
        if (cyclePayoutGroup) cyclePayoutGroup.style.display = isActifCycle ? 'block' : 'none';

        // Le champ "montant à la fin du cycle" a un sens différent pour
        // Offres Express (un seul revenu final, sans notion de capital
        // séparé) que pour Constant/Analyse/Quête (capital + gain rendus
        // ensemble) : on adapte le libellé et l'explication en conséquence.
        const cyclePayoutLabel = document.getElementById('product-cycle-payout-label');
        const cyclePayoutHelp = document.getElementById('product-cycle-payout-help');
        if (cyclePayoutLabel && cyclePayoutHelp) {
            if (productCategoryInput.value === 'express') {
                cyclePayoutLabel.textContent = 'Revenu final versé à la fin du cycle (FCFA)';
                cyclePayoutHelp.textContent = "Somme totale et unique reçue par l'utilisateur à la fin du cycle (il n'y a pas de capital distinct restitué séparément). Le gain/jour affiché est simplement ce montant divisé par la durée.";
            } else {
                cyclePayoutLabel.textContent = 'Montant total à la fin du cycle (FCFA)';
                cyclePayoutHelp.textContent = 'Capital + gain rendus en une fois à la fin du cycle (doit être supérieur au Prix). Remplace le %/jour pour les produits Actif.';
            }
        }
        productRateInput.required = !isAtlas && !isActifCycle;
        productDurationInput.required = !isAtlas;
        productCyclePayoutInput.required = isActifCycle;

        // Le niveau VIP relie les catégories entre elles pour le déblocage
        // progressif — sauf pour 'express', qui n'a aucune condition : le
        // champ reste juste une étiquette libre (ex: pour numéroter l'offre).
        const vipHint = document.getElementById('product-vip-level-hint');
        if (vipHint) {
            vipHint.textContent = productCategoryInput.value === 'express'
                ? "Simple étiquette pour ce produit Express (ex: 1, 2, 3…) — n'a aucun effet de déblocage, contrairement aux autres catégories."
                : "Relie ce produit aux autres catégories du même niveau : un Atlas VIP 1 débloque le Constant et l'Analyse VIP 1 (et uniquement ceux-là) ; les deux Actifs VIP 1 débloquent la Quête VIP 1 pendant 24h.";
        }
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

    const cycleGainPreview = document.getElementById('product-cycle-gain-preview');
    const updateCycleGainPreview = () => {
        if (!cycleGainPreview) return;
        const price = Number(productPriceInput.value) || 0;
        const total = Number(productCyclePayoutInput.value) || 0;
        const days = Number(productDurationInput.value) || 0;
        if (!price || !total || !days) { cycleGainPreview.textContent = '—'; return; }
        if (productCategoryInput.value === 'express') {
            // Offres Express : on affiche le montant total réparti sur la
            // durée (capital + gain confondus), pas le profit net —
            // demande explicite pour ce type d'offre.
            cycleGainPreview.textContent = `Total à verser : ${formatFCFA(total)} sur ${days} j (~${formatFCFA(total / days)} / jour)`;
        } else {
            const gain = total - price;
            cycleGainPreview.textContent = `Gain total : ${formatFCFA(gain)} sur ${days} j (~${formatFCFA(gain / days)} / jour)`;
        }
    };
    productPriceInput.addEventListener('input', updateCycleGainPreview);
    productDurationInput.addEventListener('input', updateCycleGainPreview);
    productCyclePayoutInput.addEventListener('input', updateCycleGainPreview);
    productCategoryInput.addEventListener('change', updateCycleGainPreview);

    const resetProductForm = () => {
        productForm.reset();
        productIdInput.value = '';
        selectedImageFile = null;
        editingImageUrl = null;
        productImagePreview.style.display = 'none';
        productDailyGainPreview.textContent = '—';
        if (cycleGainPreview) cycleGainPreview.textContent = '—';
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
            const category = productCategoryInput.value;
            const isActifCycle = ['constant', 'analyse', 'quete', 'express'].includes(category);
            const { error } = await window.supabaseClient.rpc('admin_upsert_product', {
                p_id: productIdInput.value || null,
                p_name: productNameInput.value.trim(),
                p_category: category,
                p_price: Number(productPriceInput.value),
                p_daily_rate: (category === 'atlas' || isActifCycle) ? 0 : Number(productRateInput.value),
                p_duration_days: category === 'atlas' ? 1 : Number(productDurationInput.value),
                p_image_url: imageUrl,
                p_sort_order: 0,
                p_is_active: true,
                p_vip_level: productVipLevelInput.value.trim(),
                p_monthly_revenues: category === 'atlas' ? getMonthlyRevenuesFromForm() : null,
                p_cycle_payout_amount: isActifCycle ? Number(productCyclePayoutInput.value) : null
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
        const { data: raw, error } = await window.supabaseClient.from('investment_products').select('*').order('category').order('sort_order');
        // Même tri que le dashboard : sort_order n'est jamais renseigné (0
        // partout), donc on trie explicitement par niveau VIP croissant.
        const data = raw ? [...raw].sort((a, b) => {
            if (a.category !== b.category) return a.category.localeCompare(b.category);
            const av = Number(a.vip_level) || 0;
            const bv = Number(b.vip_level) || 0;
            if (av !== bv) return av - bv;
            return (a.name || '').localeCompare(b.name || '');
        }) : raw;
        if (error) { tbody.innerHTML = `<tr><td colspan="10">Erreur de chargement.</td></tr>`; return; }
        if (!data.length) { tbody.innerHTML = `<tr><td colspan="10">Aucun produit pour le moment.</td></tr>`; return; }
        tbody.innerHTML = data.map(p => `
            <tr>
                <td>${p.image_url ? `<img src="${p.image_url}" class="admin-table-thumb">` : '—'}</td>
                <td>${p.name}</td>
                <td>${p.category}</td>
                <td>${p.vip_level || '—'}</td>
                <td>${formatFCFA(p.price)}</td>
                <td>${['constant', 'analyse', 'quete', 'express'].includes(p.category) ? formatFCFA(p.cycle_payout_amount || 0) + ' /cycle' : p.daily_rate + '%'}</td>
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
                productVipLevelInput.value = p.vip_level || '';
                productPriceInput.value = p.price;
                productRateInput.value = p.daily_rate;
                productDurationInput.value = p.duration_days;
                productCyclePayoutInput.value = p.cycle_payout_amount != null ? p.cycle_payout_amount : '';
                editingImageUrl = p.image_url;
                if (p.image_url) { productImagePreview.src = p.image_url; productImagePreview.style.display = 'block'; }
                updateDailyGainPreview();
                updateCycleGainPreview();
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
    let currentPurchaseStatus = 'all';
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
            const purchaseStatus = btn.getAttribute('data-purchase-status');
            const status = btn.getAttribute('data-status');
            const group = btn.closest('.admin-subnav');
            group.querySelectorAll('.admin-subnav-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            if (purchaseStatus) { currentPurchaseStatus = purchaseStatus; loadPurchases(purchaseStatus); return; }
            if (list === 'deposits') { currentDepositStatus = status; loadRequests('deposits', status); }
            else { currentWithdrawalStatus = status; loadRequests('withdrawals', status); }
        });
    });

    // ------------------------------------------------------------------
    // Achats de machines (user_investments) : tous les nouveaux achats
    // de produits par les utilisateurs, avec filtre actif/terminé et un
    // détail complet par ligne (compte, machine, rendement attendu).
    // ------------------------------------------------------------------
    async function loadPurchases(statusFilter) {
        const tbody = document.getElementById('purchases-tbody');
        tbody.innerHTML = '<tr><td colspan="9">Chargement…</td></tr>';

        let query = window.supabaseClient
            .from('user_investments')
            .select('*, investment_products(name, category), profiles(full_name, email)')
            .order('created_at', { ascending: false })
            .limit(300);
        if (statusFilter && statusFilter !== 'all') query = query.eq('status', statusFilter);

        const { data, error } = await query;
        if (error) { tbody.innerHTML = `<tr><td colspan="9">Erreur de chargement.</td></tr>`; return; }
        if (!data.length) { tbody.innerHTML = `<tr><td colspan="9">Aucun achat.</td></tr>`; return; }

        tbody.innerHTML = data.map(inv => {
            const product = inv.investment_products || {};
            const user = inv.profiles || {};
            const dureeLabel = inv.duration_months
                ? `${inv.duration_months} mois`
                : (inv.duration_days ? `${inv.duration_days} jours` : '—');
            const echeance = inv.matures_at ? formatDate(inv.matures_at) : '—';
            const rendement = inv.locked_payout_amount
                ? `${formatFCFA(inv.locked_payout_amount)} <span class="text-secondary" style="font-size:0.72rem;">(à l'échéance)</span>`
                : '—';
            return `<tr>
                <td>${formatDate(inv.created_at)}</td>
                <td>${user.full_name || user.email || inv.user_id}</td>
                <td>${product.name || '—'}</td>
                <td>${product.category || '—'}</td>
                <td>${formatFCFA(inv.amount)}</td>
                <td>${rendement}</td>
                <td>${dureeLabel}<br><span class="text-secondary" style="font-size:0.72rem;">Échéance : ${echeance}</span></td>
                <td><span class="admin-badge ${inv.status}">${inv.status}</span></td>
                <td><button class="admin-btn-sm admin-btn-detail" data-purchase-detail="${inv.id}">Détails</button></td>
            </tr>`;
        }).join('');

        tbody.querySelectorAll('[data-purchase-detail]').forEach(btn => {
            btn.addEventListener('click', () => viewPurchaseDetail(btn.getAttribute('data-purchase-detail')));
        });
    }

    async function viewPurchaseDetail(investmentId) {
        const { data: inv, error } = await window.supabaseClient
            .from('user_investments')
            .select('*, investment_products(name, category), profiles(full_name, email, phone)')
            .eq('id', investmentId)
            .single();
        if (error || !inv) { window.showToast('Impossible de charger cet achat.', 'error'); return; }

        const { data: wallet } = await window.supabaseClient.from('wallets').select('balance').eq('user_id', inv.user_id).maybeSingle();
        const product = inv.investment_products || {};
        const user = inv.profiles || {};

        document.getElementById('pd-detail-status').innerHTML = `<span class="admin-badge ${inv.status}">${inv.status}</span>`;
        document.getElementById('pd-detail-payout').textContent = inv.locked_payout_amount ? formatFCFA(inv.locked_payout_amount) : '—';
        document.getElementById('pd-detail-amount').textContent = formatFCFA(inv.amount);
        document.getElementById('pd-detail-date').textContent = formatDate(inv.created_at);
        document.getElementById('pd-detail-matures').textContent = inv.matures_at ? formatDate(inv.matures_at) : '—';

        document.getElementById('pd-detail-fullname').textContent = user.full_name || '—';
        document.getElementById('pd-detail-email').textContent = user.email || '—';
        document.getElementById('pd-detail-phone').textContent = user.phone || '—';
        document.getElementById('pd-detail-balance').textContent = wallet ? formatFCFA(wallet.balance) : '—';

        document.getElementById('pd-detail-product').textContent = product.name || '—';
        document.getElementById('pd-detail-category').textContent = product.category || '—';
        document.getElementById('pd-detail-duration').textContent = inv.duration_months ? `${inv.duration_months} mois` : (inv.duration_days ? `${inv.duration_days} jours` : '—');
        document.getElementById('pd-detail-last-task').textContent = inv.last_task_at ? formatDate(inv.last_task_at) : '—';
        document.getElementById('pd-detail-completed').textContent = inv.completed_at ? formatDate(inv.completed_at) : '—';

        openModal('purchase-detail-modal');
    }


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
                <button class="admin-btn-sm admin-btn-reject" data-reject="${r.id}">Rejeter</button>
                ${kind === 'withdrawals' ? `<button class="admin-btn-sm admin-btn-detail" data-wd-detail="${r.id}">Détails</button>` : ''}` :
                (kind === 'withdrawals' ? `<button class="admin-btn-sm admin-btn-detail" data-wd-detail="${r.id}">Détails</button>${status === 'approved' ? `<button class="admin-btn-sm admin-btn-edit" data-resend-receipt="${r.id}">Renvoyer le reçu</button>` : ''}` : '—');
            if (kind === 'deposits') {
                return `<tr>
                    <td>${formatDate(r.created_at)}</td>
                    <td>${u.full_name || u.email || r.user_id}</td>
                    <td>${formatFCFA(r.amount)}</td>
                    <td>${r.method_name || '—'}</td>
                    <td>${r.proof_url ? `<span class="admin-proof-link" data-img="${r.proof_url}">Voir la capture</span>` : '—'}</td>
                    <td><span class="admin-badge ${status}">${status}</span>${r.admin_note ? `<br><span class="text-secondary" style="font-size:0.72rem;">« ${r.admin_note} »</span>` : ''}</td>
                    <td>${actions}</td>
                </tr>`;
            }
            return `<tr>
                <td>${formatDate(r.created_at)}</td>
                <td>${u.full_name || u.email || r.user_id}</td>
                <td>${formatFCFA(r.amount)}${r.fee_amount ? `<br><span class="text-secondary" style="font-size:0.72rem;">frais ${r.fee_percent}% (${formatFCFA(r.fee_amount)}) → <strong>net ${formatFCFA(r.net_amount)}</strong></span>` : ''}</td>
                <td>${r.method_name || '—'}</td>
                <td>${r.destination || '—'}</td>
                <td>${r.recipient_name || '—'}</td>
                <td><span class="admin-badge ${status}">${status}</span>${r.admin_note ? `<br><span class="text-secondary" style="font-size:0.72rem;">« ${r.admin_note} »</span>` : ''}</td>
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
            btn.addEventListener('click', () => promptRejectReason(kind, btn.getAttribute('data-reject')));
        });
        tbody.querySelectorAll('[data-wd-detail]').forEach(btn => {
            btn.addEventListener('click', () => viewWithdrawalDetail(btn.getAttribute('data-wd-detail')));
        });
        tbody.querySelectorAll('[data-resend-receipt]').forEach(btn => {
            btn.addEventListener('click', () => resendWithdrawalReceipt(btn.getAttribute('data-resend-receipt'), btn));
        });
    }

    // ------------------------------------------------------------------
    // Renvoie/régénère le reçu d'un retrait déjà validé (ex: retraits
    // validés avant la correction du bug de compatibilité Canvas). Crée
    // une NOUVELLE notification avec l'image du reçu jointe, visible
    // immédiatement par l'utilisateur.
    // ------------------------------------------------------------------
    async function resendWithdrawalReceipt(id, btn) {
        btn.disabled = true;
        btn.textContent = 'Génération…';
        try {
            const { data: reqRow, error: reqError } = await window.supabaseClient
                .from('withdrawal_requests')
                .select('*')
                .eq('id', id)
                .single();
            if (reqError || !reqRow) throw new Error("Demande de retrait introuvable.");

            const { data: profileRow } = await window.supabaseClient
                .from('profiles')
                .select('full_name, email')
                .eq('id', reqRow.user_id)
                .single();

            const canvas = drawReceiptCanvas({
                statusLabel: 'RETRAIT VALIDÉ',
                statusColor: '#1f9d55',
                amount: formatFCFA(reqRow.amount),
                netAmount: reqRow.fee_amount ? `Montant net envoyé : ${formatFCFA(reqRow.net_amount)}` : null,
                feeLabel: reqRow.fee_amount ? `${reqRow.fee_percent}% (${formatFCFA(reqRow.fee_amount)})` : null,
                method: reqRow.method_name,
                destination: reqRow.destination,
                recipientName: reqRow.recipient_name,
                userName: (profileRow && profileRow.full_name) || '—',
                userEmail: (profileRow && profileRow.email) || '—',
                date: formatDate(reqRow.reviewed_at || reqRow.created_at),
                reference: reqRow.id,
            });
            const receiptImageUrl = await uploadReceiptImage(canvas, `withdrawal-resend-${id}`);

            const { error: notifError } = await window.supabaseClient.rpc('admin_send_receipt_notification', {
                p_user_id: reqRow.user_id,
                p_title: 'Reçu de votre retrait',
                p_body: `Voici le reçu de votre retrait de ${formatFCFA(reqRow.amount)}.`,
                p_image_url: receiptImageUrl
            });
            if (notifError) throw notifError;

            window.showToast(`Reçu envoyé à l'utilisateur. <a href="${receiptImageUrl}" target="_blank" rel="noopener" style="color:inherit;text-decoration:underline;font-weight:600;">Télécharger le reçu</a>`, 'success', 15000);
        } catch (err) {
            window.showToast("Erreur : " + err.message, 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Renvoyer le reçu';
        }
    }

    async function reviewRequest(kind, id, approve, note) {
        if (approve && !confirm('Valider cette demande ?')) return;
        const rpcName = kind === 'deposits' ? 'admin_review_deposit' : 'admin_review_withdrawal';

        let receiptImageUrl = null;
        let bannerCtx = null; // données pour le reçu affiché sur la bannière
        if (approve) {
            try {
                const { data: reqRow } = await window.supabaseClient
                    .from(kind === 'deposits' ? 'deposit_requests' : 'withdrawal_requests')
                    .select('*')
                    .eq('id', id)
                    .single();
                if (reqRow) {
                    const { data: profileRow } = await window.supabaseClient
                        .from('profiles')
                        .select('full_name, email')
                        .eq('id', reqRow.user_id)
                        .single();
                    bannerCtx = { reqRow, profileRow };
                    if (kind === 'withdrawals') {
                        const canvas = drawReceiptCanvas({
                            statusLabel: 'RETRAIT VALIDÉ',
                            statusColor: '#1f9d55',
                            amount: formatFCFA(reqRow.amount),
                            netAmount: reqRow.fee_amount ? `Montant net envoyé : ${formatFCFA(reqRow.net_amount)}` : null,
                            feeLabel: reqRow.fee_amount ? `${reqRow.fee_percent}% (${formatFCFA(reqRow.fee_amount)})` : null,
                            method: reqRow.method_name,
                            destination: reqRow.destination,
                            recipientName: reqRow.recipient_name,
                            userName: (profileRow && profileRow.full_name) || '—',
                            userEmail: (profileRow && profileRow.email) || '—',
                            date: formatDate(new Date()),
                            reference: reqRow.id,
                        });
                        receiptImageUrl = await uploadReceiptImage(canvas, `withdrawal-${id}`);
                    }
                }
            } catch (err) {
                console.error('Génération du reçu impossible :', err);
                window.showToast("La demande sera validée, mais le reçu n'a pas pu être généré (" + err.message + ").", 'error');
                // On ne bloque jamais la validation si le reçu échoue.
            }
        }

        const { error } = await window.supabaseClient.rpc(rpcName, {
            p_request_id: id,
            p_approve: approve,
            p_note: note || null,
            ...(kind === 'withdrawals' ? { p_receipt_image_url: receiptImageUrl } : {}),
        });
        if (error) { window.showToast("Erreur : " + error.message, 'error'); return; }

        // Reçu automatiquement ajouté sur la bannière d'accueil (validation uniquement)
        let bannerOk = false;
        const bannerNote = isAutoPublishReceipts()
            ? ' Reçu publié sur la bannière.'
            : ' Reçu ajouté à la bannière en BROUILLON (visible par vous seul) — publiez-le dans Paramètres.';
        if (approve && bannerCtx) {
            try {
                await publishReceiptBanner(kind, bannerCtx.reqRow, bannerCtx.profileRow);
                bannerOk = true;
            } catch (err) {
                console.error('Reçu bannière impossible :', err);
                window.showToast("Demande validée, mais le reçu n'a pas pu être ajouté à la bannière (" + err.message + ").", 'error');
            }
        }

        if (approve && kind === 'withdrawals' && receiptImageUrl) {
            window.showToast(`Demande validée.${bannerOk ? bannerNote : ''} <a href="${receiptImageUrl}" target="_blank" rel="noopener" style="color:inherit;text-decoration:underline;font-weight:600;">Télécharger le reçu</a>`, 'success', 15000);
        } else if (approve) {
            window.showToast(`Demande validée.${bannerOk ? bannerNote : ''}`, 'success');
        } else {
            window.showToast('Demande rejetée.', 'success');
        }
        loadRequests(kind, kind === 'deposits' ? currentDepositStatus : currentWithdrawalStatus);
        loadStats();
    }

    // ------------------------------------------------------------------
    // Rejet d'une demande (dépôt ou retrait) : ouvre une fenêtre pour que
    // l'admin puisse taper la raison du rejet, envoyée à l'utilisateur.
    // ------------------------------------------------------------------
    let pendingRejection = null;

    function promptRejectReason(kind, id) {
        pendingRejection = { kind, id };
        const input = document.getElementById('reject-reason-input');
        if (input) input.value = '';
        openModal('reject-reason-modal');
    }

    const rejectReasonConfirmBtn = document.getElementById('reject-reason-confirm-btn');
    if (rejectReasonConfirmBtn) {
        rejectReasonConfirmBtn.addEventListener('click', async () => {
            if (!pendingRejection) return;
            const reason = (document.getElementById('reject-reason-input').value || '').trim();
            const { kind, id } = pendingRejection;
            pendingRejection = null;
            closeModal('reject-reason-modal');
            await reviewRequest(kind, id, false, reason);
        });
    }

    // ------------------------------------------------------------------
    // Détail complet d'une demande de retrait : montant net à envoyer,
    // e-mail du compte, et détail des machines/produits qui ont permis
    // à l'utilisateur d'atteindre ce solde.
    // ------------------------------------------------------------------
    const dailyGainOfInvestment = (inv) => {
        // Offres Express : locked_payout_amount est déjà le gain PUR (le prix
        // payé n'est jamais restitué) — ne pas soustraire inv.amount.
        const isExpressGainOnly = inv.investment_products && inv.investment_products.category === 'express';
        if (inv.locked_payout_amount != null) {
            const totalGain = isExpressGainOnly ? Number(inv.locked_payout_amount) : (Number(inv.locked_payout_amount) - Number(inv.amount));
            if (inv.duration_months) {
                return totalGain / (Number(inv.duration_months) * 30);
            }
            if (inv.duration_days) {
                return totalGain / Number(inv.duration_days);
            }
        }
        if (inv.duration_months && inv.locked_rate_percent != null) {
            return Number(inv.amount) * Number(inv.locked_rate_percent) / 100 / (Number(inv.duration_months) * 30);
        }
        return Number(inv.amount) * Number((inv.investment_products && inv.investment_products.daily_rate) || 0) / 100;
    };

    async function viewWithdrawalDetail(requestId) {
        const [{ data: r, error: rErr }] = await Promise.all([
            window.supabaseClient.from('withdrawal_requests').select('*').eq('id', requestId).single()
        ]);
        if (rErr || !r) { window.showToast('Impossible de charger cette demande.', 'error'); return; }

        const [{ data: profile }, { data: wallet }, { data: investments }, { data: transactions }] = await Promise.all([
            window.supabaseClient.from('profiles').select('*').eq('id', r.user_id).maybeSingle(),
            window.supabaseClient.from('wallets').select('*').eq('user_id', r.user_id).maybeSingle(),
            window.supabaseClient.from('user_investments').select('*, investment_products(name, category, daily_rate, vip_level)').eq('user_id', r.user_id).order('created_at', { ascending: false }),
            window.supabaseClient.from('transactions').select('*').eq('user_id', r.user_id).order('created_at', { ascending: false }).limit(200)
        ]);

        const netAmount = r.net_amount != null ? r.net_amount : (r.amount - (r.fee_amount || 0));

        document.getElementById('wd-detail-net-amount').textContent = formatFCFA(netAmount);
        document.getElementById('wd-detail-gross-amount').textContent = formatFCFA(r.amount);
        document.getElementById('wd-detail-fee').textContent = r.fee_amount
            ? `${formatFCFA(r.fee_amount)} (${r.fee_percent || 0}%)` : 'Aucun';
        document.getElementById('wd-detail-status').innerHTML = `<span class="admin-badge ${r.status}">${r.status}</span>`;
        document.getElementById('wd-detail-date').textContent = formatDate(r.created_at);
        document.getElementById('wd-detail-method').textContent = r.method_name || '—';
        document.getElementById('wd-detail-destination').textContent = r.destination || '—';
        document.getElementById('wd-detail-recipient').textContent = r.recipient_name || '—';

        document.getElementById('wd-detail-fullname').textContent = (profile && profile.full_name) || '—';
        document.getElementById('wd-detail-email').textContent = (profile && profile.email) || '—';
        document.getElementById('wd-detail-phone').textContent = (profile && profile.phone) || '—';
        document.getElementById('wd-detail-registered').textContent = profile ? formatDate(profile.created_at) : '—';

        document.getElementById('wd-detail-balance').textContent = wallet ? formatFCFA(wallet.balance) : '—';
        document.getElementById('wd-detail-referral-earnings').textContent = wallet ? formatFCFA(wallet.referral_earnings || 0) : '0 FCFA';

        const tbody = document.getElementById('wd-detail-investments');
        const list = investments || [];
        if (!list.length) {
            tbody.innerHTML = `<tr><td colspan="6">Aucune machine/produit acheté par cet utilisateur.</td></tr>`;
        } else {
            tbody.innerHTML = list.map(inv => {
                const prod = inv.investment_products || {};
                const productName = prod.name || inv.product_name || 'Produit supprimé';
                const category = prod.category || '—';
                const daysElapsed = Math.max(0, Math.floor((Date.now() - new Date(inv.created_at).getTime()) / (24 * 60 * 60 * 1000)));
                const dailyGain = dailyGainOfInvestment(inv);
                const maxGain = inv.locked_payout_amount != null
                    ? (category === 'express' ? Number(inv.locked_payout_amount) : (Number(inv.locked_payout_amount) - Number(inv.amount)))
                    : null;
                let totalEarned = dailyGain * daysElapsed;
                if (maxGain != null) totalEarned = Math.min(totalEarned, maxGain);
                const statusLabel = inv.status === 'active' ? 'En cours' : (inv.status === 'completed' ? 'Terminé' : (inv.status || '—'));
                const statusClass = inv.status === 'active' ? 'validated' : (inv.status === 'completed' ? 'active' : 'pending');
                return `<tr>
                    <td>${productName}<br><span class="text-secondary" style="font-size:0.72rem;">${category}${prod.vip_level ? ' · VIP ' + prod.vip_level : ''}</span></td>
                    <td>${formatFCFA(inv.amount)}</td>
                    <td>${formatDate(inv.created_at)}</td>
                    <td>${daysElapsed} j</td>
                    <td>${formatFCFA(Math.round(dailyGain))}/j<br><span class="text-secondary" style="font-size:0.72rem;">≈ ${formatFCFA(Math.round(totalEarned))} accumulé</span></td>
                    <td><span class="admin-badge ${statusClass}">${statusLabel}</span></td>
                </tr>`;
            }).join('');
        }

        const txLabelMap = {
            deposit: 'Dépôt', withdrawal: 'Retrait', investment: 'Investissement',
            gain: 'Gain généré', referral_commission: 'Commission de parrainage', quest: 'Quête journalière'
        };
        const txBody = document.getElementById('wd-detail-transactions');
        const txList = transactions || [];
        txBody.innerHTML = txList.length ? txList.map(t => {
            const amount = Number(t.amount) || 0;
            const positive = amount >= 0;
            return `<tr>
                <td>${formatDate(t.created_at)}</td>
                <td>${txLabelMap[t.type] || t.type || '—'}</td>
                <td>${t.description || '—'}</td>
                <td style="color:${positive ? 'var(--success)' : 'var(--danger)'}; font-weight:700;">${positive ? '+' : ''}${formatFCFA(amount)}</td>
            </tr>`;
        }).join('') : `<tr><td colspan="4">Aucune transaction enregistrée.</td></tr>`;

        openModal('withdrawal-detail-modal');
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

    // ------------------------------------------------------------------
    // 2bis. Top Promoteurs — classement des utilisateurs par nombre de
    //       filleuls directs (referred_by = leur referral_code), du plus
    //       grand au plus petit. Calculé côté client à partir de tous les
    //       profils + portefeuilles, pour éviter une requête par utilisateur.
    // ------------------------------------------------------------------
    let allReferrersData = [];

    async function loadTopReferrers() {
        const tbody = document.getElementById('referrers-tbody');
        tbody.innerHTML = `<tr><td colspan="9">Chargement…</td></tr>`;

        const [{ data: profiles, error }, { data: wallets }] = await Promise.all([
            window.supabaseClient.from('profiles').select('id, full_name, email, phone, referral_code, referred_by, created_at'),
            window.supabaseClient.from('wallets').select('user_id, balance, referral_earnings')
        ]);

        if (error) { tbody.innerHTML = `<tr><td colspan="9">Erreur de chargement.</td></tr>`; return; }

        const walletMap = {};
        (wallets || []).forEach(w => walletMap[w.user_id] = w);

        // Compte le nombre de filleuls directs par code de parrainage.
        const referralCounts = {};
        (profiles || []).forEach(p => {
            if (p.referred_by) referralCounts[p.referred_by] = (referralCounts[p.referred_by] || 0) + 1;
        });

        allReferrersData = (profiles || [])
            .filter(p => p.referral_code && referralCounts[p.referral_code] > 0)
            .map(p => ({
                ...p,
                referralCount: referralCounts[p.referral_code] || 0,
                balance: (walletMap[p.id] && walletMap[p.id].balance) || 0,
                referralEarnings: (walletMap[p.id] && walletMap[p.id].referral_earnings) || 0
            }))
            .sort((a, b) => b.referralCount - a.referralCount);

        renderReferrersTable(allReferrersData);
    }

    function renderReferrersTable(list) {
        const tbody = document.getElementById('referrers-tbody');
        if (!list.length) { tbody.innerHTML = `<tr><td colspan="9">Aucun promoteur pour le moment.</td></tr>`; return; }
        tbody.innerHTML = list.map((u, i) => `
            <tr>
                <td>${i + 1}</td>
                <td>${u.full_name || '—'}</td>
                <td>${u.phone || u.email || '—'}</td>
                <td>${u.referral_code || '—'}</td>
                <td><strong>${u.referralCount}</strong></td>
                <td>${formatFCFA(u.referralEarnings)}</td>
                <td>${formatFCFA(u.balance)}</td>
                <td>${formatDate(u.created_at)}</td>
                <td><button class="admin-btn-sm admin-btn-view" data-view-referrer="${u.id}">Voir</button></td>
            </tr>`).join('');

        tbody.querySelectorAll('[data-view-referrer]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const userId = btn.getAttribute('data-view-referrer');
                // viewUserDetail() s'appuie sur allUsersData (liste "Utilisateurs") ;
                // on la charge si nécessaire avant d'ouvrir la fiche détaillée.
                if (!allUsersData.length) await loadUsers();
                if (!allUsersData.some(u => u.id === userId)) await loadUsers();
                viewUserDetail(userId);
            });
        });
    }

    const referrerSearchInput = document.getElementById('referrer-search');
    if (referrerSearchInput) {
        referrerSearchInput.addEventListener('input', (e) => {
            const q = e.target.value.trim().toLowerCase();
            renderReferrersTable(allReferrersData.filter(u =>
                (u.full_name || '').toLowerCase().includes(q) ||
                (u.email || '').toLowerCase().includes(q) ||
                (u.referral_code || '').toLowerCase().includes(q)
            ));
        });
    }

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

        const [{ data: deposits }, { data: withdrawals }, { count: referralCount }, { data: investments }] = await Promise.all([
            window.supabaseClient.from('deposit_requests').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
            window.supabaseClient.from('withdrawal_requests').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
            user.referral_code
                ? window.supabaseClient.from('profiles').select('id', { count: 'exact', head: true }).eq('referred_by', user.referral_code)
                : Promise.resolve({ count: 0 }),
            window.supabaseClient.from('user_investments').select('*, investment_products(name, category, vip_level)').eq('user_id', userId).order('created_at', { ascending: false })
        ]);

        const depositsBody = document.getElementById('user-detail-deposits');
        depositsBody.innerHTML = (deposits && deposits.length) ? deposits.map(d => `
            <tr><td>${formatDate(d.created_at)}</td><td>${formatFCFA(d.amount)}</td><td>${d.method_name || '—'}</td><td><span class="admin-badge ${d.status}">${d.status}</span></td></tr>
        `).join('') : `<tr><td>Aucun dépôt.</td></tr>`;

        const withdrawalsBody = document.getElementById('user-detail-withdrawals');
        withdrawalsBody.innerHTML = (withdrawals && withdrawals.length) ? withdrawals.map(w => `
            <tr><td>${formatDate(w.created_at)}</td><td>${formatFCFA(w.amount)}</td><td>${w.method_name || '—'}</td><td>${w.recipient_name || '—'}</td><td><span class="admin-badge ${w.status}">${w.status}</span></td></tr>
        `).join('') : `<tr><td>Aucun retrait.</td></tr>`;

        const investmentsBody = document.getElementById('user-detail-investments');
        document.getElementById('user-detail-investments-count').textContent = (investments || []).length;
        investmentsBody.innerHTML = (investments && investments.length) ? investments.map(i => {
            const productName = (i.investment_products && i.investment_products.name) || i.product_name || 'Produit supprimé';
            const category = (i.investment_products && i.investment_products.category) || '—';
            const statusLabel = i.status === 'active' ? 'En cours' : (i.status === 'completed' ? 'Terminé' : (i.status || '—'));
            const statusClass = i.status === 'active' ? 'validated' : (i.status === 'completed' ? 'active' : 'pending');
            return `
            <tr><td>${formatDate(i.created_at)}</td><td>${productName} <span style="color:var(--text-secondary); font-size:0.75rem;">(${category})</span></td><td>${formatFCFA(i.amount)}</td><td><span class="admin-badge ${statusClass}">${statusLabel}</span></td></tr>`;
        }).join('') : `<tr><td>Aucune machine/produit acheté.</td></tr>`;

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

        document.getElementById('user-detail-tree-sponsor-label').textContent =
            user.referred_by ? `(parrainé par ${user.referred_by})` : '';
        loadUserGenealogyTree(user.referral_code);

        openModal('user-detail-modal');
    }

    // ------------------------------------------------------------------
    // Arbre généalogique (3 niveaux) — pour chaque filleul : nom, total
    // déposé (dépôts approuvés) et statut actif (au moins un
    // investissement au statut 'active' dans user_investments).
    // ------------------------------------------------------------------
    async function loadUserGenealogyTree(rootReferralCode) {
        const listEls = {
            1: document.getElementById('tree-l1-list'),
            2: document.getElementById('tree-l2-list'),
            3: document.getElementById('tree-l3-list'),
        };
        const countEls = {
            1: document.getElementById('tree-l1-count'),
            2: document.getElementById('tree-l2-count'),
            3: document.getElementById('tree-l3-count'),
        };
        [1, 2, 3].forEach(n => {
            listEls[n].innerHTML = `<span class="admin-tree-empty">Chargement…</span>`;
            countEls[n].textContent = '0';
        });

        if (!rootReferralCode) {
            [1, 2, 3].forEach(n => { listEls[n].innerHTML = `<span class="admin-tree-empty">Aucun</span>`; });
            return;
        }

        const fetchLevel = async (codes) => {
            if (!codes.length) return [];
            const { data } = await window.supabaseClient
                .from('profiles')
                .select('id, full_name, phone, email, referral_code, created_at')
                .in('referred_by', codes);
            return data || [];
        };

        const level1 = await fetchLevel([rootReferralCode]);
        const level2 = await fetchLevel(level1.map(u => u.referral_code).filter(Boolean));
        const level3 = await fetchLevel(level2.map(u => u.referral_code).filter(Boolean));

        const allIds = [...level1, ...level2, ...level3].map(u => u.id);
        let depositsByUser = {};
        let activeUserIds = new Set();

        if (allIds.length) {
            const [{ data: deposits }, { data: activeInv }] = await Promise.all([
                window.supabaseClient.from('deposit_requests').select('user_id, amount, status').in('user_id', allIds),
                window.supabaseClient.from('user_investments').select('user_id, status').in('user_id', allIds),
            ]);
            (deposits || []).forEach(d => {
                if (d.status !== 'approved') return;
                depositsByUser[d.user_id] = (depositsByUser[d.user_id] || 0) + Number(d.amount || 0);
            });
            (activeInv || []).forEach(i => { if (i.status === 'active') activeUserIds.add(i.user_id); });
        }

        const renderLevel = (n, users) => {
            countEls[n].textContent = users.length;
            if (!users.length) {
                listEls[n].innerHTML = `<span class="admin-tree-empty">Aucun</span>`;
                return;
            }
            listEls[n].innerHTML = users.map(u => {
                const isActive = activeUserIds.has(u.id);
                const deposited = depositsByUser[u.id] || 0;
                return `
                    <div class="admin-tree-item">
                        <div>
                            <div class="admin-tree-item-name">${u.full_name || u.email || 'Utilisateur'}</div>
                            <div class="admin-tree-item-sub">${u.phone || u.email || '—'} · inscrit le ${formatDate(u.created_at)}</div>
                        </div>
                        <div style="display:flex; align-items:center; gap:8px;">
                            <span class="admin-tree-item-deposit">${formatFCFA(deposited)}</span>
                            <span class="admin-tree-item-badge ${isActive ? 'actif' : 'inactif'}">${isActive ? 'Actif' : 'Inactif'}</span>
                        </div>
                    </div>`;
            }).join('');
        };

        renderLevel(1, level1);
        renderLevel(2, level2);
        renderLevel(3, level3);
    }

    const treeToggleBtn = document.getElementById('user-detail-tree-toggle');
    if (treeToggleBtn) {
        treeToggleBtn.addEventListener('click', () => {
            treeToggleBtn.closest('.admin-tree-card').classList.toggle('collapsed');
        });
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

    // Bonus personnel : génère un code promo réservé UNIQUEMENT à cet
    // utilisateur (assigned_to), avec un montant aléatoire jusqu'au plafond
    // donné. L'utilisateur reçoit une notification avec le code à saisir
    // dans Compte > Code promo ; personne d'autre ne peut l'utiliser.
    document.getElementById('user-detail-give-bonus').addEventListener('click', async () => {
        if (!currentDetailUserId) return;
        const rawAmount = prompt('Plafond du bonus pour cet utilisateur (FCFA) :');
        if (rawAmount === null) return;
        const maxAmount = Number(rawAmount);
        if (!maxAmount || maxAmount <= 0) { window.showToast('Montant invalide.', 'error'); return; }
        const reason = prompt('Raison du bonus (optionnel, visible par l\'utilisateur) :', 'Bonne conduite');

        const { data, error } = await window.supabaseClient.rpc('admin_generate_targeted_promo_code', {
            p_user_id: currentDetailUserId,
            p_max_amount: maxAmount,
            p_reason: reason || null
        });
        if (error) { window.showToast("Erreur : " + error.message, 'error'); return; }
        window.showToast(`Bonus attribué. Code : ${data.code} (l'utilisateur a été notifié).`, 'success');
    });

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
    // 6bis. Codes Promo
    //       Déjà sécurisé côté serveur par les fonctions Postgres existantes
    //       `admin_generate_promo_codes(p_max_amount, p_count)` (génère un ou
    //       plusieurs codes, montant tiré au hasard jusqu'au plafond donné),
    //       `admin_deactivate_promo_code(p_id)`, et côté dashboard.js
    //       `redeem_promo_code(p_code)` (crédite le portefeuille une seule
    //       fois par code, voir table promo_code_redemptions).
    // ----------------------------------------------------------------
    const promoForm = document.getElementById('promo-form');
    const promoTbody = document.getElementById('promo-tbody');

    async function loadPromoCodes() {
        const { data: codes, error } = await window.supabaseClient
            .from('promo_codes')
            .select('*, used_by_profile:used_by(full_name, email), assigned_to_profile:assigned_to(full_name, email)')
            .order('created_at', { ascending: false });
        if (error) { promoTbody.innerHTML = `<tr><td colspan="8">Erreur de chargement.</td></tr>`; return; }
        if (!codes.length) { promoTbody.innerHTML = `<tr><td colspan="8">Aucun code pour le moment.</td></tr>`; return; }

        const codeValues = codes.map(c => c.code);
        const { data: redemptions } = await window.supabaseClient
            .from('promo_code_redemptions').select('code, amount_credited').in('code', codeValues);
        const creditedByCode = {};
        (redemptions || []).forEach(r => { creditedByCode[r.code] = r.amount_credited; });

        promoTbody.innerHTML = codes.map(c => {
            const used = c.used_count >= c.max_uses;
            const statusLabel = !c.is_active ? 'Désactivé' : (used ? 'Utilisé' : 'Disponible');
            const statusCls = !c.is_active || used ? 'blocked' : 'active';
            const credited = creditedByCode[c.code];
            return `
            <tr>
                <td><code>${c.code}</code></td>
                <td>${c.assigned_to_profile ? `🔒 ${c.assigned_to_profile.full_name || c.assigned_to_profile.email}` : 'Tout le monde'}</td>
                <td>Jusqu'à ${formatFCFA(c.max_amount)}</td>
                <td>${credited != null ? formatFCFA(credited) : '—'}</td>
                <td><span class="admin-badge ${statusCls}">${statusLabel}</span></td>
                <td>${c.used_by_profile ? (c.used_by_profile.full_name || c.used_by_profile.email) : '—'}</td>
                <td>${formatDate(c.created_at)}</td>
                <td>${(!used && c.is_active) ? `<button class="admin-btn-sm admin-btn-reject" data-deactivate-promo="${c.id}">Désactiver</button>` : '—'}</td>
            </tr>`;
        }).join('');

        promoTbody.querySelectorAll('[data-deactivate-promo]').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!confirm('Désactiver ce code promo non utilisé ?')) return;
                const { error } = await window.supabaseClient.rpc('admin_deactivate_promo_code', { p_id: btn.getAttribute('data-deactivate-promo') });
                if (error) { window.showToast("Erreur : " + error.message, 'error'); return; }
                window.showToast('Code désactivé.', 'success');
                loadPromoCodes();
            });
        });
    }

    if (promoForm) {
        promoForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const maxAmount = Number(document.getElementById('promo-max-amount').value);
            const count = Number(document.getElementById('promo-count').value);
            if (!maxAmount || maxAmount <= 0) { window.showToast('Plafond invalide.', 'error'); return; }
            if (!count || count < 1 || count > 500) { window.showToast('Le nombre de codes doit être entre 1 et 500.', 'error'); return; }
            const submitBtn = document.getElementById('promo-submit-btn');
            submitBtn.disabled = true;
            const { data, error } = await window.supabaseClient.rpc('admin_generate_promo_codes', { p_max_amount: maxAmount, p_count: count });
            submitBtn.disabled = false;
            if (error) { window.showToast("Erreur : " + error.message, 'error'); return; }
            const codesList = (data || []).map(c => c.code).join(', ');
            window.showToast(data && data.length > 1 ? `${data.length} codes générés.` : `Code généré : ${codesList}`, 'success');
            promoForm.reset();
            document.getElementById('promo-count').value = 1;
            loadPromoCodes();
        });
    }

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
        document.getElementById('setting-telegram-group').value = data.telegram_group || '';
        document.getElementById('setting-telegram-username').value = data.telegram_support_username || '';
        document.getElementById('setting-whatsapp-group').value = data.whatsapp_group || '';
        document.getElementById('setting-referral-rate-l1').value = data.referral_rate_l1 ?? data.referral_rate ?? '';
        document.getElementById('setting-referral-rate-l2').value = data.referral_rate_l2 ?? '';
        document.getElementById('setting-referral-rate-l3').value = data.referral_rate_l3 ?? '';
        document.getElementById('setting-min-deposit').value = data.min_deposit ?? '';
        document.getElementById('setting-min-withdrawal').value = data.min_withdrawal ?? '';
        document.getElementById('setting-withdrawal-fee-percent').value = data.withdrawal_fee_percent ?? '';
        document.getElementById('setting-maintenance-mode').checked = !!data.maintenance_mode;
        document.getElementById('setting-max-daily-withdrawal').value = data.max_daily_withdrawal_amount ?? '';
        document.getElementById('setting-withdrawal-hour-start').value = data.withdrawal_hour_start ?? '';
        document.getElementById('setting-withdrawal-hour-end').value = data.withdrawal_hour_end ?? '';
        const allowedDays = (data.withdrawal_allowed_days || []).map(String);
        document.querySelectorAll('.setting-withdrawal-day').forEach(cb => {
            cb.checked = allowedDays.includes(cb.value);
        });
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
            telegram_group: document.getElementById('setting-telegram-group').value.trim(),
            telegram_support_username: document.getElementById('setting-telegram-username').value.trim().replace(/^@/, ''),
            whatsapp_group: document.getElementById('setting-whatsapp-group').value.trim(),
            referral_rate_l1: Number(document.getElementById('setting-referral-rate-l1').value) || 0,
            referral_rate_l2: Number(document.getElementById('setting-referral-rate-l2').value) || 0,
            referral_rate_l3: Number(document.getElementById('setting-referral-rate-l3').value) || 0,
            min_deposit: Number(document.getElementById('setting-min-deposit').value) || 0,
            min_withdrawal: Number(document.getElementById('setting-min-withdrawal').value) || 0,
            withdrawal_fee_percent: Number(document.getElementById('setting-withdrawal-fee-percent').value) || 0,
            maintenance_mode: document.getElementById('setting-maintenance-mode').checked,
            max_daily_withdrawal_amount: document.getElementById('setting-max-daily-withdrawal').value ? Number(document.getElementById('setting-max-daily-withdrawal').value) : null,
            withdrawal_hour_start: document.getElementById('setting-withdrawal-hour-start').value !== '' ? Number(document.getElementById('setting-withdrawal-hour-start').value) : null,
            withdrawal_hour_end: document.getElementById('setting-withdrawal-hour-end').value !== '' ? Number(document.getElementById('setting-withdrawal-hour-end').value) : null,
            withdrawal_allowed_days: Array.from(document.querySelectorAll('.setting-withdrawal-day:checked')).map(cb => Number(cb.value))
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
                <div class="admin-form-group" style="margin:10px 0;">
                    <label style="font-size:0.82rem;">Lien de paiement en ligne ${entry.country === 'CM' ? '(optionnel — le Cameroun utilise les numéros ci-dessous)' : "(ce lien gère tout le dépôt : l'utilisateur sera redirigé directement dessus)"}</label>
                    <input type="text" placeholder="https://..." value="${(entry.payment_link || '').replace(/"/g, '&quot;')}" data-country-link-index="${ci}" class="payment-link-input">
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

        countryPaymentListEl.querySelectorAll('.payment-link-input').forEach(input => {
            input.addEventListener('input', () => {
                countryPaymentData[Number(input.getAttribute('data-country-link-index'))].payment_link = input.value;
            });
        });

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
                payment_link: (c.payment_link || '').trim(),
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
    // 7quater. Bannières carrousel (page d'accueil du dashboard)
    // ----------------------------------------------------------------
    const bannersListEl = document.getElementById('banners-list');
    const addBannerBtn = document.getElementById('add-banner-btn');
    const bannersSubmitBtn = document.getElementById('banners-submit-btn');
    // Structure : [{ image_url: '', title: '', link_url: '' }]
    let bannersData = [];
    let bannersLoadedUrls = new Set(); // photo de l'état chargé (évite d'écraser les reçus ajoutés entre-temps)

    async function loadBanners() {
        if (!bannersListEl) return;
        const { data, error } = await window.supabaseClient
            .from('site_settings').select('home_banners').eq('id', 1).single();

        if (error) {
            window.showToast("Impossible de charger les bannières.", 'error');
            return;
        }
        bannersData = Array.isArray(data.home_banners) ? data.home_banners : [];
        bannersLoadedUrls = new Set(bannersData.map(b => b && b.image_url));
        renderBanners();
    }

    function renderBanners() {
        if (!bannersListEl) return;
        if (!bannersData.length) {
            bannersListEl.innerHTML = `<p class="country-payment-empty">Aucune bannière pour le moment. Cliquez sur "Ajouter une bannière" ci-dessous.</p>`;
            return;
        }
        bannersListEl.innerHTML = bannersData.map((b, i) => `
            <div class="country-payment-item">
                <div class="country-payment-header">
                    <span style="font-weight:600;">Bannière ${i + 1}${b.type === 'receipt' ? ' <span class="admin-badge validated" style="margin-left:6px;">🧾 Reçu automatique</span>' : ''}
                        <span class="admin-badge ${b.published === false ? 'pending' : 'validated'}" style="margin-left:6px;">${b.published === false ? '🔒 Brouillon' : '🌍 Publié'}</span></span>
                    <button type="button" class="remove-country-btn" data-remove-banner="${i}">Supprimer</button>
                </div>
                <div class="admin-form-row" style="align-items:flex-start; gap:14px;">
                    <img data-banner-preview="${i}" src="${(b.image_url || '').replace(/"/g, '&quot;')}" alt=""
                        style="width:120px; height:64px; object-fit:cover; border-radius:8px; border:1px solid var(--gray-200,#e5e7eb); background:var(--gray-100,#f5f5f4); flex-shrink:0;"
                        onerror="this.style.opacity='0.25'" onload="this.style.opacity='1'">
                    <div style="flex:1; min-width:0;">
                        <div class="admin-form-group" style="margin-bottom:8px;">
                            <label style="font-size:0.8rem;">Image (obligatoire) — choisissez un fichier ou collez une URL</label>
                            <input type="file" accept="image/*" data-banner-upload="${i}" style="margin-bottom:6px;">
                            <input type="text" placeholder="https://.../banniere.jpg" value="${(b.image_url || '').replace(/"/g, '&quot;')}" data-banner-index="${i}" data-banner-field="image_url">
                        </div>
                        <div class="admin-form-group" style="margin-bottom:8px;">
                            <label style="font-size:0.8rem;">Titre affiché sur la bannière (optionnel)</label>
                            <input type="text" placeholder="Ex : Nouveau ! Retraits instantanés" value="${(b.title || '').replace(/"/g, '&quot;')}" data-banner-index="${i}" data-banner-field="title">
                        </div>
                        <div class="admin-form-group" style="margin-bottom:8px;">
                            <label style="font-size:0.8rem;">Visibilité</label>
                            <select data-banner-published="${i}">
                                <option value="draft" ${b.published === false ? 'selected' : ''}>🔒 Brouillon — visible par moi seul (aperçu sur mon tableau de bord)</option>
                                <option value="live" ${b.published === false ? '' : 'selected'}>🌍 Publié — visible par tous les utilisateurs</option>
                            </select>
                        </div>
                        <div class="admin-form-group" style="margin-bottom:0;">
                            <label style="font-size:0.8rem;">Lien au clic (optionnel)</label>
                            <input type="text" placeholder="https://..." value="${(b.link_url || '').replace(/"/g, '&quot;')}" data-banner-index="${i}" data-banner-field="link_url">
                        </div>
                    </div>
                </div>
            </div>
        `).join('');

        bannersListEl.querySelectorAll('input[data-banner-field]').forEach(input => {
            input.addEventListener('input', () => {
                const i = Number(input.getAttribute('data-banner-index'));
                const field = input.getAttribute('data-banner-field');
                bannersData[i][field] = input.value;
                // Met à jour uniquement l'aperçu de l'image concernée, sans
                // reconstruire toute la liste (sinon le champ perd le focus
                // à chaque lettre tapée).
                if (field === 'image_url') {
                    const preview = bannersListEl.querySelector(`img[data-banner-preview="${i}"]`);
                    if (preview) preview.src = input.value;
                }
            });
        });
        bannersListEl.querySelectorAll('select[data-banner-published]').forEach(sel => {
            sel.addEventListener('change', () => {
                const i = Number(sel.getAttribute('data-banner-published'));
                bannersData[i].published = sel.value === 'live';
                renderBanners();
            });
        });
        bannersListEl.querySelectorAll('input[data-banner-upload]').forEach(fileInput => {
            fileInput.addEventListener('change', async () => {
                const file = fileInput.files && fileInput.files[0];
                if (!file) return;
                const i = Number(fileInput.getAttribute('data-banner-upload'));
                fileInput.disabled = true;
                try {
                    window.showToast('Envoi de l\'image en cours…', 'success', 2500);
                    bannersData[i].image_url = await uploadBannerImage(file);
                    renderBanners();
                    window.showToast('Image ajoutée. N\'oubliez pas de cliquer sur « Enregistrer les bannières ».', 'success');
                } catch (err) {
                    fileInput.disabled = false;
                    window.showToast("Erreur : " + err.message, 'error');
                }
            });
        });
        bannersListEl.querySelectorAll('[data-remove-banner]').forEach(btn => {
            btn.addEventListener('click', () => {
                bannersData.splice(Number(btn.getAttribute('data-remove-banner')), 1);
                renderBanners();
            });
        });
    }

    const autoPublishCheckbox = document.getElementById('auto-publish-receipts');
    if (autoPublishCheckbox) {
        autoPublishCheckbox.checked = isAutoPublishReceipts();
        autoPublishCheckbox.addEventListener('change', () => {
            try { localStorage.setItem('autoPublishReceipts', autoPublishCheckbox.checked ? '1' : '0'); } catch (e) {}
        });
    }

    if (addBannerBtn) {
        addBannerBtn.addEventListener('click', () => {
            bannersData.push({ image_url: '', title: '', link_url: '', published: false });
            renderBanners();
        });
    }

    if (bannersSubmitBtn) {
        bannersSubmitBtn.addEventListener('click', async () => {
            bannersSubmitBtn.disabled = true;
            bannersSubmitBtn.textContent = 'Enregistrement…';

            const cleanBanners = bannersData
                .filter(b => (b.image_url || '').trim())
                .map(b => ({
                    image_url: b.image_url.trim(),
                    title: (b.title || '').trim(),
                    link_url: (b.link_url || '').trim(),
                    published: b.published !== false,
                    // On conserve les marqueurs des reçus automatiques
                    ...(b.type ? { type: b.type } : {}),
                    ...(b.kind ? { kind: b.kind } : {}),
                    ...(b.created_at ? { created_at: b.created_at } : {})
                }));

            // Reçus ajoutés automatiquement depuis le chargement de cet écran
            // (ex. validation dans un autre onglet) : on ne les écrase pas.
            const { data: latest } = await window.supabaseClient
                .from('site_settings').select('home_banners').eq('id', 1).single();
            const localUrls = new Set(cleanBanners.map(b => b.image_url));
            const freshReceipts = (latest && Array.isArray(latest.home_banners) ? latest.home_banners : [])
                .filter(b => b && b.type === 'receipt' && !bannersLoadedUrls.has(b.image_url) && !localUrls.has(b.image_url));
            cleanBanners.unshift(...freshReceipts);

            const { error } = await window.supabaseClient.from('site_settings').upsert({ id: 1, home_banners: cleanBanners });

            bannersSubmitBtn.disabled = false;
            bannersSubmitBtn.textContent = 'Enregistrer les bannières';

            if (error) { window.showToast("Erreur : " + error.message, 'error'); return; }
            bannersData = cleanBanners;
            bannersLoadedUrls = new Set(cleanBanners.map(b => b.image_url));
            renderBanners();
            window.showToast('Bannières enregistrées ! Les bannières « Publié » sont visibles par tous ; les « Brouillon » seulement par vous.', 'success');
        });
    }

    // ----------------------------------------------------------------
    // 7ter. Annonces — notification + push envoyée à tous les utilisateurs
    // ----------------------------------------------------------------
    const broadcastForm = document.getElementById('broadcast-form');
    if (broadcastForm) {
        const titleInput = document.getElementById('broadcast-title');
        const bodyInput = document.getElementById('broadcast-body');
        const imageInput = document.getElementById('broadcast-image');
        const previewTitle = document.getElementById('broadcast-preview-title');
        const previewBody = document.getElementById('broadcast-preview-body');
        const previewImg = document.getElementById('broadcast-preview-img');

        const updatePreview = () => {
            previewTitle.textContent = titleInput.value.trim() || 'Titre de la notification';
            previewBody.textContent = bodyInput.value.trim() || 'Le message apparaîtra ici au fur et à mesure que vous tapez.';
            const url = imageInput.value.trim();
            if (url) { previewImg.src = url; previewImg.style.display = 'block'; }
            else { previewImg.style.display = 'none'; }
        };
        [titleInput, bodyInput, imageInput].forEach(el => el.addEventListener('input', updatePreview));
        updatePreview();

        broadcastForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const title = titleInput.value.trim();
            const body = bodyInput.value.trim();
            const image = imageInput.value.trim();

            if (!title) { window.showToast('Le titre est obligatoire.', 'error'); return; }
            if (!confirm(`Envoyer cette annonce à TOUS les utilisateurs ?\n\n"${title}"`)) return;

            const submitBtn = document.getElementById('broadcast-submit-btn');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Envoi en cours...';

            const { data, error } = await window.supabaseClient.rpc('admin_broadcast_notification', {
                p_title: title,
                p_body: body,
                p_image_url: image || null,
                p_test_only: false,
            });

            submitBtn.disabled = false;
            submitBtn.textContent = 'Envoyer à tous les utilisateurs';

            if (error) { window.showToast("Erreur : " + error.message, 'error'); return; }
            window.showToast(`Annonce envoyée à ${data} utilisateur(s).`, 'success');
            broadcastForm.reset();
            updatePreview();
        });

        const testBtn = document.getElementById('broadcast-test-btn');
        if (testBtn) {
            testBtn.addEventListener('click', async () => {
                const title = titleInput.value.trim();
                const body = bodyInput.value.trim();
                const image = imageInput.value.trim();
                if (!title) { window.showToast('Le titre est obligatoire.', 'error'); return; }

                testBtn.disabled = true;
                testBtn.textContent = 'Envoi du test...';

                const { error } = await window.supabaseClient.rpc('admin_broadcast_notification', {
                    p_title: title,
                    p_body: body,
                    p_image_url: image || null,
                    p_test_only: true,
                });

                testBtn.disabled = false;
                testBtn.textContent = 'Envoyer un test (à moi uniquement)';

                if (error) { window.showToast("Erreur : " + error.message, 'error'); return; }
                window.showToast('Test envoyé — vérifiez votre cloche et votre téléphone.', 'success');
            });
        }
    }

    // ----------------------------------------------------------------
    // 7quater. Reçu personnalisé — outil manuel, indépendant des retraits
    // ----------------------------------------------------------------
    const receiptForm = document.getElementById('receipt-form');
    if (receiptForm) {
        const previewWrap = document.getElementById('receipt-preview-wrap');
        const previewImg = document.getElementById('receipt-preview-img');

        function buildReceiptCanvasFromForm() {
            const feeInput = ''; // pas de champ frais dédié dans l'outil manuel
            return drawReceiptCanvas({
                statusLabel: document.getElementById('receipt-status').value,
                statusColor: document.getElementById('receipt-status').value === 'REJETÉ' ? '#d9534f' : '#1f9d55',
                amount: document.getElementById('receipt-amount').value.trim() || '—',
                netAmount: null,
                feeLabel: feeInput || null,
                method: document.getElementById('receipt-method').value.trim(),
                destination: document.getElementById('receipt-destination').value.trim(),
                recipientName: document.getElementById('receipt-recipient').value.trim(),
                userName: document.getElementById('receipt-username').value.trim(),
                userEmail: document.getElementById('receipt-email').value.trim(),
                date: formatDate(new Date()),
                reference: document.getElementById('receipt-reference').value.trim() || ('REF-' + Date.now()),
            });
        }

        document.getElementById('receipt-preview-btn').addEventListener('click', async () => {
            const canvas = buildReceiptCanvasFromForm();
            const blob = await canvasToBlob(canvas);
            previewImg.src = URL.createObjectURL(blob);
            previewWrap.style.display = 'block';
        });

        document.getElementById('receipt-download-btn').addEventListener('click', async () => {
            const canvas = buildReceiptCanvasFromForm();
            const blob = await canvasToBlob(canvas);
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'recu-atlas-capital.png';
            a.click();
        });

        const uploadBtn = document.getElementById('receipt-upload-btn');
        uploadBtn.addEventListener('click', async () => {
            uploadBtn.disabled = true;
            uploadBtn.textContent = 'Upload...';
            try {
                const canvas = buildReceiptCanvasFromForm();
                const url = await uploadReceiptImage(canvas, 'manual');
                await navigator.clipboard.writeText(url);
                window.showToast('Lien copié dans le presse-papier : ' + url, 'success');
                previewImg.src = url;
                previewWrap.style.display = 'block';
            } catch (err) {
                window.showToast('Erreur upload : ' + err.message, 'error');
            } finally {
                uploadBtn.disabled = false;
                uploadBtn.textContent = 'Uploader et copier le lien';
            }
        });
    }

    // ----------------------------------------------------------------
    // 8. Chargement initial
    // ----------------------------------------------------------------
    loadStats();
    loadUpcomingMaturities();
});
