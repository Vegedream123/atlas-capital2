// ==========================================================================
// ATLAS CAPITAL — PAYS & MOYENS DE PAIEMENT
// ==========================================================================
// Ce fichier centralise :
//   1) La liste des pays proposés à l'inscription (COUNTRIES)
//   2) Les moyens de paiement disponibles pour le dépôt/retrait, par pays
//      (PAYMENT_METHODS_BY_COUNTRY) : uniquement la monnaie mobile locale
//      de chaque pays, plus l'USDT (TRC-20), qui est universel.
//
// ⚠️ IMPORTANT AVANT MISE EN PRODUCTION :
// Les numéros ci-dessous sont des VALEURS D'EXEMPLE (placeholders).
// Remplacez "number" par les vrais comptes Atlas Capital (numéros Mobile
// Money officiels) avant d'ouvrir les dépôts aux utilisateurs réels.
//
// L'adresse USDT (TRC-20), elle, n'est PAS codée en dur ici : elle est
// définie depuis le panneau admin (page admin.html → "Moyens de paiement"
// → "Adresse USDT-TRC-20", champ site_settings.deposit_usdt_address) puis
// injectée à l'exécution via AtlasPaymentMethods.setUsdtAddress(). Voir
// dashboard.js, qui appelle ce setter juste après avoir chargé
// site_settings.
// ==========================================================================

(function (global) {

    // Liste des pays proposés (formulaire d'inscription)
    // code = ISO 3166-1 alpha-2, utilisé aussi comme clé pour les moyens de paiement
    const COUNTRIES = [
        { code: 'CM', name: 'Cameroun' },
        { code: 'CI', name: "Côte d'Ivoire" },
        { code: 'SN', name: 'Sénégal' },
        { code: 'GA', name: 'Gabon' },
        { code: 'CG', name: 'Congo-Brazzaville' },
        { code: 'CD', name: 'RD Congo' },
        { code: 'TD', name: 'Tchad' },
        { code: 'CF', name: 'Centrafrique' },
        { code: 'GQ', name: 'Guinée Équatoriale' },
        { code: 'BF', name: 'Burkina Faso' },
        { code: 'ML', name: 'Mali' },
        { code: 'NE', name: 'Niger' },
        { code: 'TG', name: 'Togo' },
        { code: 'BJ', name: 'Bénin' },
        { code: 'GW', name: 'Guinée-Bissau' },
        { code: 'GN', name: 'Guinée' },
        { code: 'RW', name: 'Rwanda' },
        { code: 'FR', name: 'France' },
        { code: 'BE', name: 'Belgique' },
        { code: 'CA', name: 'Canada' },
        { code: 'US', name: 'États-Unis' },
        { code: 'XX', name: 'Autre pays' }
    ];

    // Icônes simples (emoji) pour ne dépendre d'aucune ressource externe
    const ICONS = {
        orange: '🟠',
        mtn: '🟡',
        moov: '🔵',
        wave: '🌊',
        airtel: '🔴',
        mpesa: '🟢',
        usdt: '💵'
    };

    // Adresse USDT (TRC-20) courante, définie depuis l'admin via
    // setUsdtAddress(). Tant qu'elle n'a pas été chargée, le moyen de
    // paiement USDT reste masqué (on ne veut pas afficher une adresse
    // vide/placeholder aux utilisateurs).
    let usdtAddress = '';

    function setUsdtAddress(address) {
        usdtAddress = (address || '').trim();
    }

    // Liens de paiement par pays configurés depuis le panneau admin
    // (site_settings.country_payment_links). Prioritaires sur la liste
    // statique PAYMENT_METHODS_BY_COUNTRY ci-dessous si présents pour un pays.
    let dynamicMethodsByCountry = {};

    function setCountryPaymentLinks(links) {
        dynamicMethodsByCountry = {};
        (links || []).forEach(entry => {
            if (!entry || !entry.country) return;
            const methods = (entry.numbers || [])
                .filter(n => n && n.number)
                .map((n, i) => mobileMoney(
                    `${entry.country}_admin_${i}`,
                    n.network || 'Mobile Money',
                    ICONS.mtn,
                    n.number,
                    n.holder || 'ATLAS CAPITAL'
                ));
            if (methods.length) dynamicMethodsByCountry[entry.country] = methods;
        });
    }

    // Moyen de paiement universel ajouté à TOUS les pays : l'USDT (réseau
    // TRC-20). L'adresse vient uniquement du panneau admin.
    function getUsdtMethod() {
        if (!usdtAddress) return null;
        return {
            id: 'usdt_trc20',
            type: 'usdt',
            name: 'USDT (TRC-20)',
            icon: ICONS.usdt,
            number: usdtAddress,
            holder: 'Réseau TRON (TRC-20) uniquement',
            note: "N'envoyez que de l'USDT sur le réseau TRC-20 à cette adresse. Tout envoi sur un autre réseau sera perdu."
        };
    }

    const mobileMoney = (id, name, icon, number, holder) => ({
        id, type: 'mobile_money', name, icon,
        number, holder,
        note: 'Envoyez le montant exact à ce numéro puis joignez la capture de la confirmation.'
    });

    // Moyens de paiement spécifiques par pays (Mobile Money principalement)
    const PAYMENT_METHODS_BY_COUNTRY = {
        CM: [
            mobileMoney('orange_money_cm', 'Orange Money', ICONS.orange, '+237 690 000 000', 'ATLAS CAPITAL SARL'),
            mobileMoney('mtn_momo_cm', 'MTN Mobile Money', ICONS.mtn, '+237 670 000 000', 'ATLAS CAPITAL SARL')
        ],
        CI: [
            mobileMoney('orange_money_ci', 'Orange Money', ICONS.orange, '+225 07 00 000 000', 'ATLAS CAPITAL SARL'),
            mobileMoney('mtn_momo_ci', 'MTN Mobile Money', ICONS.mtn, '+225 05 00 000 000', 'ATLAS CAPITAL SARL'),
            mobileMoney('moov_money_ci', 'Moov Money', ICONS.moov, '+225 01 00 000 000', 'ATLAS CAPITAL SARL'),
            mobileMoney('wave_ci', 'Wave', ICONS.wave, '+225 07 00 000 001', 'ATLAS CAPITAL SARL')
        ],
        SN: [
            mobileMoney('orange_money_sn', 'Orange Money', ICONS.orange, '+221 77 000 00 00', 'ATLAS CAPITAL SARL'),
            mobileMoney('wave_sn', 'Wave', ICONS.wave, '+221 70 000 00 00', 'ATLAS CAPITAL SARL'),
            mobileMoney('free_money_sn', 'Free Money', ICONS.orange, '+221 76 000 00 00', 'ATLAS CAPITAL SARL')
        ],
        GA: [
            mobileMoney('airtel_money_ga', 'Airtel Money', ICONS.airtel, '+241 07 00 00 00', 'ATLAS CAPITAL SARL'),
            mobileMoney('moov_money_ga', 'Moov Money', ICONS.moov, '+241 06 00 00 00', 'ATLAS CAPITAL SARL')
        ],
        CG: [
            mobileMoney('mtn_momo_cg', 'MTN Mobile Money', ICONS.mtn, '+242 06 000 0000', 'ATLAS CAPITAL SARL'),
            mobileMoney('airtel_money_cg', 'Airtel Money', ICONS.airtel, '+242 05 000 0000', 'ATLAS CAPITAL SARL')
        ],
        CD: [
            mobileMoney('orange_money_cd', 'Orange Money', ICONS.orange, '+243 84 000 0000', 'ATLAS CAPITAL SARL'),
            mobileMoney('airtel_money_cd', 'Airtel Money', ICONS.airtel, '+243 99 000 0000', 'ATLAS CAPITAL SARL'),
            mobileMoney('mpesa_cd', 'M-Pesa', ICONS.mpesa, '+243 81 000 0000', 'ATLAS CAPITAL SARL')
        ],
        TD: [
            mobileMoney('airtel_money_td', 'Airtel Money', ICONS.airtel, '+235 60 00 00 00', 'ATLAS CAPITAL SARL'),
            mobileMoney('moov_money_td', 'Moov Money', ICONS.moov, '+235 66 00 00 00', 'ATLAS CAPITAL SARL')
        ],
        CF: [
            mobileMoney('orange_money_cf', 'Orange Money', ICONS.orange, '+236 70 00 00 00', 'ATLAS CAPITAL SARL')
        ],
        GQ: [],
        BF: [
            mobileMoney('orange_money_bf', 'Orange Money', ICONS.orange, '+226 70 00 00 00', 'ATLAS CAPITAL SARL'),
            mobileMoney('moov_money_bf', 'Moov Money', ICONS.moov, '+226 60 00 00 00', 'ATLAS CAPITAL SARL')
        ],
        ML: [
            mobileMoney('orange_money_ml', 'Orange Money', ICONS.orange, '+223 70 00 00 00', 'ATLAS CAPITAL SARL'),
            mobileMoney('moov_money_ml', 'Moov Money', ICONS.moov, '+223 60 00 00 00', 'ATLAS CAPITAL SARL')
        ],
        NE: [
            mobileMoney('airtel_money_ne', 'Airtel Money', ICONS.airtel, '+227 90 00 00 00', 'ATLAS CAPITAL SARL'),
            mobileMoney('orange_money_ne', 'Orange Money', ICONS.orange, '+227 96 00 00 00', 'ATLAS CAPITAL SARL')
        ],
        TG: [
            mobileMoney('tmoney_tg', 'T-Money (Togocom)', ICONS.orange, '+228 90 00 00 00', 'ATLAS CAPITAL SARL'),
            mobileMoney('moov_flooz_tg', 'Moov Money Flooz', ICONS.moov, '+228 96 00 00 00', 'ATLAS CAPITAL SARL')
        ],
        BJ: [
            mobileMoney('mtn_momo_bj', 'MTN Mobile Money', ICONS.mtn, '+229 90 00 00 00', 'ATLAS CAPITAL SARL'),
            mobileMoney('moov_money_bj', 'Moov Money', ICONS.moov, '+229 96 00 00 00', 'ATLAS CAPITAL SARL')
        ],
        GW: [
            mobileMoney('orange_money_gw', 'Orange Money', ICONS.orange, '+245 95 000 00 00', 'ATLAS CAPITAL SARL')
        ],
        GN: [
            mobileMoney('orange_money_gn', 'Orange Money', ICONS.orange, '+224 62 000 00 00', 'ATLAS CAPITAL SARL')
        ],
        RW: [
            mobileMoney('mtn_momo_rw', 'MTN Mobile Money', ICONS.mtn, '+250 78 000 0000', 'ATLAS CAPITAL SARL'),
            mobileMoney('airtel_money_rw', 'Airtel Money', ICONS.airtel, '+250 73 000 0000', 'ATLAS CAPITAL SARL')
        ],
        FR: [], BE: [], CA: [], US: [], XX: []
    };

    function getCountryName(code) {
        const c = COUNTRIES.find(c => c.code === code);
        return c ? c.name : code;
    }

    function getPaymentMethods(countryCode) {
        const specific = dynamicMethodsByCountry[countryCode] || PAYMENT_METHODS_BY_COUNTRY[countryCode] || [];
        const usdt = getUsdtMethod();
        return usdt ? [...specific, usdt] : [...specific];
    }

    global.AtlasCountries = COUNTRIES;
    global.AtlasPaymentMethods = {
        getCountryName,
        getPaymentMethods,
        setUsdtAddress,
        setCountryPaymentLinks
    };

})(window);
