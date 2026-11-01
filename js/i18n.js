/* ==========================================================================
   i18n.js — Atlas Capital
   Language selector (all world languages) + full-site translation.
   English is the default language. The user can search by language OR country.
   Translation engine: Google Website Translator (translates dynamic content too).
   ========================================================================== */
(function () {
    'use strict';

    var SOURCE = 'fr';      // language the page source is currently written in
    var DEFAULT = 'en';     // language shown by default
    var LS_KEY = 'atlas_lang';
    var RTL = ['ar', 'iw', 'fa', 'ur', 'ps', 'sd', 'ug', 'ckb', 'dv', 'yi'];

    // [code, English name, native name, countries / keywords]
    var L = [
        ['en', 'English', 'English', 'united states usa uk united kingdom canada australia ireland new zealand'],
        ['fr', 'French', 'Français', 'france belgium belgique switzerland suisse canada quebec senegal ivory coast cote d ivoire cameroon congo mali burkina niger togo benin gabon morocco maroc algeria algerie tunisia tunisie madagascar'],
        ['es', 'Spanish', 'Español', 'spain espana mexico argentina colombia chile peru venezuela ecuador bolivia uruguay paraguay cuba dominican guatemala honduras panama costa rica'],
        ['pt', 'Portuguese', 'Português', 'portugal brazil brasil angola mozambique cape verde'],
        ['de', 'German', 'Deutsch', 'germany deutschland austria osterreich switzerland schweiz liechtenstein'],
        ['it', 'Italian', 'Italiano', 'italy italia san marino vatican'],
        ['nl', 'Dutch', 'Nederlands', 'netherlands holland belgium suriname'],
        ['ar', 'Arabic', 'العربية', 'saudi arabia egypt uae emirates iraq jordan lebanon syria libya morocco algeria tunisia sudan yemen oman kuwait qatar bahrain mauritania'],
        ['zh-CN', 'Chinese (Simplified)', '简体中文', 'china singapore'],
        ['zh-TW', 'Chinese (Traditional)', '繁體中文', 'taiwan hong kong macau'],
        ['ja', 'Japanese', '日本語', 'japan'],
        ['ko', 'Korean', '한국어', 'south korea north korea'],
        ['hi', 'Hindi', 'हिन्दी', 'india'],
        ['bn', 'Bengali', 'বাংলা', 'bangladesh india'],
        ['ur', 'Urdu', 'اردو', 'pakistan india'],
        ['ru', 'Russian', 'Русский', 'russia belarus kazakhstan kyrgyzstan'],
        ['uk', 'Ukrainian', 'Українська', 'ukraine'],
        ['tr', 'Turkish', 'Türkçe', 'turkey turkiye cyprus'],
        ['fa', 'Persian', 'فارسی', 'iran afghanistan tajikistan'],
        ['iw', 'Hebrew', 'עברית', 'israel'],
        ['id', 'Indonesian', 'Bahasa Indonesia', 'indonesia'],
        ['ms', 'Malay', 'Bahasa Melayu', 'malaysia brunei singapore'],
        ['tl', 'Filipino', 'Filipino', 'philippines'],
        ['th', 'Thai', 'ไทย', 'thailand'],
        ['vi', 'Vietnamese', 'Tiếng Việt', 'vietnam'],
        ['pl', 'Polish', 'Polski', 'poland polska'],
        ['cs', 'Czech', 'Čeština', 'czech republic czechia'],
        ['sk', 'Slovak', 'Slovenčina', 'slovakia'],
        ['hu', 'Hungarian', 'Magyar', 'hungary'],
        ['ro', 'Romanian', 'Română', 'romania moldova'],
        ['bg', 'Bulgarian', 'Български', 'bulgaria'],
        ['el', 'Greek', 'Ελληνικά', 'greece cyprus'],
        ['sv', 'Swedish', 'Svenska', 'sweden finland'],
        ['no', 'Norwegian', 'Norsk', 'norway'],
        ['da', 'Danish', 'Dansk', 'denmark greenland'],
        ['fi', 'Finnish', 'Suomi', 'finland'],
        ['is', 'Icelandic', 'Íslenska', 'iceland'],
        ['et', 'Estonian', 'Eesti', 'estonia'],
        ['lv', 'Latvian', 'Latviešu', 'latvia'],
        ['lt', 'Lithuanian', 'Lietuvių', 'lithuania'],
        ['hr', 'Croatian', 'Hrvatski', 'croatia'],
        ['sr', 'Serbian', 'Српски', 'serbia'],
        ['bs', 'Bosnian', 'Bosanski', 'bosnia herzegovina'],
        ['sl', 'Slovenian', 'Slovenščina', 'slovenia'],
        ['mk', 'Macedonian', 'Македонски', 'north macedonia'],
        ['sq', 'Albanian', 'Shqip', 'albania kosovo'],
        ['mt', 'Maltese', 'Malti', 'malta'],
        ['ga', 'Irish', 'Gaeilge', 'ireland'],
        ['cy', 'Welsh', 'Cymraeg', 'wales'],
        ['gd', 'Scottish Gaelic', 'Gàidhlig', 'scotland'],
        ['ca', 'Catalan', 'Català', 'andorra catalonia spain'],
        ['eu', 'Basque', 'Euskara', 'basque country spain'],
        ['gl', 'Galician', 'Galego', 'galicia spain'],
        ['lb', 'Luxembourgish', 'Lëtzebuergesch', 'luxembourg'],
        ['be', 'Belarusian', 'Беларуская', 'belarus'],
        ['ka', 'Georgian', 'ქართული', 'georgia'],
        ['hy', 'Armenian', 'Հայերեն', 'armenia'],
        ['az', 'Azerbaijani', 'Azərbaycan', 'azerbaijan'],
        ['kk', 'Kazakh', 'Қазақша', 'kazakhstan'],
        ['uz', 'Uzbek', 'Oʻzbek', 'uzbekistan'],
        ['tk', 'Turkmen', 'Türkmen', 'turkmenistan'],
        ['ky', 'Kyrgyz', 'Кыргызча', 'kyrgyzstan'],
        ['tg', 'Tajik', 'Тоҷикӣ', 'tajikistan'],
        ['mn', 'Mongolian', 'Монгол', 'mongolia'],
        ['ne', 'Nepali', 'नेपाली', 'nepal'],
        ['si', 'Sinhala', 'සිංහල', 'sri lanka'],
        ['ta', 'Tamil', 'தமிழ்', 'india sri lanka singapore'],
        ['te', 'Telugu', 'తెలుగు', 'india'],
        ['kn', 'Kannada', 'ಕನ್ನಡ', 'india'],
        ['ml', 'Malayalam', 'മലയാളം', 'india'],
        ['mr', 'Marathi', 'मराठी', 'india'],
        ['gu', 'Gujarati', 'ગુજરાતી', 'india'],
        ['pa', 'Punjabi', 'ਪੰਜਾਬੀ', 'india pakistan'],
        ['or', 'Odia', 'ଓଡ଼ିଆ', 'india'],
        ['as', 'Assamese', 'অসমীয়া', 'india'],
        ['my', 'Burmese', 'မြန်မာ', 'myanmar burma'],
        ['km', 'Khmer', 'ខ្មែរ', 'cambodia'],
        ['lo', 'Lao', 'ລາວ', 'laos'],
        ['ps', 'Pashto', 'پښتو', 'afghanistan'],
        ['ku', 'Kurdish', 'Kurdî', 'kurdistan iraq turkey'],
        ['ckb', 'Kurdish (Sorani)', 'کوردی', 'iraq iran'],
        ['sd', 'Sindhi', 'سنڌي', 'pakistan'],
        ['ug', 'Uyghur', 'ئۇيغۇرچە', 'china'],
        ['sw', 'Swahili', 'Kiswahili', 'kenya tanzania uganda rwanda congo'],
        ['am', 'Amharic', 'አማርኛ', 'ethiopia'],
        ['ti', 'Tigrinya', 'ትግርኛ', 'eritrea ethiopia'],
        ['so', 'Somali', 'Soomaali', 'somalia djibouti'],
        ['ha', 'Hausa', 'Hausa', 'nigeria niger ghana'],
        ['yo', 'Yoruba', 'Yorùbá', 'nigeria benin'],
        ['ig', 'Igbo', 'Igbo', 'nigeria'],
        ['zu', 'Zulu', 'isiZulu', 'south africa'],
        ['xh', 'Xhosa', 'isiXhosa', 'south africa'],
        ['af', 'Afrikaans', 'Afrikaans', 'south africa namibia'],
        ['st', 'Sesotho', 'Sesotho', 'lesotho south africa'],
        ['sn', 'Shona', 'chiShona', 'zimbabwe'],
        ['ny', 'Chichewa', 'Chichewa', 'malawi zambia'],
        ['rw', 'Kinyarwanda', 'Kinyarwanda', 'rwanda'],
        ['mg', 'Malagasy', 'Malagasy', 'madagascar'],
        ['wo', 'Wolof', 'Wolof', 'senegal gambia'],
        ['ln', 'Lingala', 'Lingála', 'congo drc'],
        ['lg', 'Luganda', 'Luganda', 'uganda'],
        ['ak', 'Twi', 'Twi', 'ghana'],
        ['bm', 'Bambara', 'Bamanankan', 'mali'],
        ['ee', 'Ewe', 'Eʋegbe', 'ghana togo'],
        ['ht', 'Haitian Creole', 'Kreyòl ayisyen', 'haiti'],
        ['jw', 'Javanese', 'Basa Jawa', 'indonesia'],
        ['su', 'Sundanese', 'Basa Sunda', 'indonesia'],
        ['ceb', 'Cebuano', 'Cebuano', 'philippines'],
        ['haw', 'Hawaiian', 'ʻŌlelo Hawaiʻi', 'hawaii'],
        ['mi', 'Maori', 'Te Reo Māori', 'new zealand'],
        ['sm', 'Samoan', 'Gagana Samoa', 'samoa'],
        ['qu', 'Quechua', 'Runasimi', 'peru bolivia ecuador'],
        ['gn', 'Guarani', 'Avañeʼẽ', 'paraguay'],
        ['ay', 'Aymara', 'Aymar aru', 'bolivia peru'],
        ['la', 'Latin', 'Latina', 'vatican'],
        ['eo', 'Esperanto', 'Esperanto', 'international'],
        ['yi', 'Yiddish', 'ייִדיש', 'israel'],
        ['fy', 'Frisian', 'Frysk', 'netherlands'],
        ['co', 'Corsican', 'Corsu', 'corsica france'],
        ['hmn', 'Hmong', 'Hmoob', 'laos vietnam'],
        ['tt', 'Tatar', 'Татарча', 'russia tatarstan'],
        ['dv', 'Dhivehi', 'ދިވެހި', 'maldives']
    ];

    function norm(s) {
        return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }
    function find(code) {
        for (var i = 0; i < L.length; i++) if (L[i][0] === code) return L[i];
        return null;
    }
    function getLang() {
        try { var v = localStorage.getItem(LS_KEY); if (v && find(v)) return v; } catch (e) {}
        return DEFAULT;
    }
    function suggested() {
        var langs = navigator.languages || [navigator.language || ''];
        for (var i = 0; i < langs.length; i++) {
            var raw = String(langs[i] || '');
            var c = raw.toLowerCase();
            if (c === 'zh-tw' || c === 'zh-hk' || c === 'zh-hant') return 'zh-TW';
            if (c.indexOf('zh') === 0) return 'zh-CN';
            if (c === 'he') return 'iw';
            if (c === 'fil') return 'tl';
            if (c === 'jv') return 'jw';
            var base = c.split('-')[0];
            if (find(base)) return base;
        }
        return null;
    }

    /* ---- cookie used by the translation engine ---- */
    function setCookie(lang) {
        var host = location.hostname;
        var past = 'Thu, 01 Jan 1970 00:00:00 GMT';
        var val = lang === SOURCE ? '' : '/' + SOURCE + '/' + lang;
        var exp = lang === SOURCE ? '; expires=' + past : '';
        document.cookie = 'googtrans=' + val + '; path=/' + exp + '; SameSite=Lax';
        if (host.indexOf('.') > -1) {
            document.cookie = 'googtrans=' + val + '; path=/; domain=' + host + exp + '; SameSite=Lax';
        }
    }

    function applyLang(lang) {
        try { localStorage.setItem(LS_KEY, lang); } catch (e) {}
        setCookie(lang);
        location.reload();
    }

    /* ---- early: set cookie + hide flash of untranslated text ---- */
    var current = getLang();
    var root = document.documentElement;
    root.setAttribute('lang', current);
    root.setAttribute('dir', RTL.indexOf(current) > -1 ? 'rtl' : 'ltr');
    setCookie(current);

    var needsTranslation = current !== SOURCE;
    if (needsTranslation) {
        root.classList.add('atlas-i18n-wait');
        var releaseVeil = function () { root.classList.remove('atlas-i18n-wait'); };
        var mo = new MutationObserver(function () {
            if (root.className.indexOf('translated-') > -1) { releaseVeil(); mo.disconnect(); }
        });
        mo.observe(root, { attributes: true, attributeFilter: ['class'] });
        setTimeout(releaseVeil, 3500); // safety: never leave the page hidden
    }

    /* ---- styles ---- */
    var css = '' +
        'html.atlas-i18n-wait body{opacity:0}' +
        'body{transition:opacity .15s ease}' +
        'html{height:auto!important}body{top:0!important;position:static!important}' +
        '.goog-te-banner-frame,.goog-te-banner-frame.skiptranslate,iframe.skiptranslate,#goog-gt-tt,.goog-tooltip,.goog-te-balloon-frame{display:none!important;visibility:hidden!important}' +
        '.goog-text-highlight{background:none!important;box-shadow:none!important}' +
        '#google_translate_element{position:absolute;left:-9999px;top:-9999px;height:0;overflow:hidden}' +
        '.atlas-langbar{display:flex;justify-content:flex-end;align-items:center;padding:8px 16px;background:#fff;border-bottom:1px solid #E0E4EA;font-family:Inter,Arial,sans-serif;position:relative;z-index:1000}' +
        '.atlas-lang-btn{display:inline-flex;align-items:center;gap:8px;padding:7px 14px;border:1px solid #E0E4EA;border-radius:999px;background:#fff;color:#171B21;font:600 13px/1 Inter,Arial,sans-serif;cursor:pointer;transition:border-color .15s,box-shadow .15s}' +
        '.atlas-lang-btn:hover{border-color:#1B2A4A;box-shadow:0 0 0 3px rgba(27,42,74,.12)}' +
        '.atlas-lang-btn svg{width:16px;height:16px;flex:none}' +
        '.atlas-lang-overlay{position:fixed;inset:0;background:rgba(23,27,33,.45);display:none;align-items:flex-start;justify-content:center;z-index:100000;padding:56px 16px 16px}' +
        '.atlas-lang-overlay.open{display:flex}' +
        '.atlas-lang-panel{width:100%;max-width:440px;max-height:calc(100vh - 80px);background:#fff;border-radius:16px;box-shadow:0 24px 60px rgba(0,0,0,.25);display:flex;flex-direction:column;overflow:hidden;font-family:Inter,Arial,sans-serif;color:#171B21}' +
        '.atlas-lang-head{display:flex;align-items:center;justify-content:space-between;padding:16px 18px 8px;font-weight:700;font-size:16px}' +
        '.atlas-lang-close{border:0;background:none;font-size:24px;line-height:1;cursor:pointer;color:#60708B;padding:0 4px}' +
        '.atlas-lang-search{margin:6px 18px 10px;padding:11px 14px;border:1px solid #E0E4EA;border-radius:10px;font:500 14px Inter,Arial,sans-serif;outline:none;color:#171B21}' +
        '.atlas-lang-search:focus{border-color:#1B2A4A;box-shadow:0 0 0 3px rgba(27,42,74,.12)}' +
        '.atlas-lang-list{overflow-y:auto;padding:0 8px 12px;margin:0;list-style:none}' +
        '.atlas-lang-label{padding:8px 12px 4px;font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#60708B}' +
        '.atlas-lang-item{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;padding:10px 12px;border:0;background:none;border-radius:10px;cursor:pointer;text-align:left;font:500 14px Inter,Arial,sans-serif;color:#171B21}' +
        '.atlas-lang-item:hover{background:#F4F6F9}' +
        '.atlas-lang-item.active{background:#F1F3F6;color:#111C33;font-weight:700}' +
        '.atlas-lang-item small{color:#60708B;font-weight:500;font-size:12px}' +
        '.atlas-lang-empty{padding:18px;text-align:center;color:#60708B;font-size:14px}' +
        '@media(max-width:600px){.atlas-lang-overlay{padding:0;align-items:flex-end}.atlas-lang-panel{max-width:none;border-radius:18px 18px 0 0;max-height:85vh}.atlas-langbar{padding:6px 12px}}';

    var style = document.createElement('style');
    style.textContent = css;
    (document.head || root).appendChild(style);

    /* ---- UI ---- */
    function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

    function buildUI() {
        var bar = document.createElement('div');
        bar.className = 'atlas-langbar notranslate';
        bar.setAttribute('translate', 'no');
        var cur = find(current) || find(DEFAULT);
        bar.innerHTML =
            '<button type="button" class="atlas-lang-btn" aria-haspopup="dialog" aria-label="Language">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>' +
            '<span>' + esc(cur[2]) + '</span></button>';
        document.body.insertBefore(bar, document.body.firstChild);

        var ov = document.createElement('div');
        ov.className = 'atlas-lang-overlay notranslate';
        ov.setAttribute('translate', 'no');
        ov.innerHTML =
            '<div class="atlas-lang-panel" role="dialog" aria-modal="true" aria-label="Language">' +
            '<div class="atlas-lang-head"><span>Language · Langue · 语言 · لغة</span><button type="button" class="atlas-lang-close" aria-label="Close">&times;</button></div>' +
            '<input type="search" class="atlas-lang-search" placeholder="Search language or country…" autocomplete="off" autocapitalize="off" spellcheck="false">' +
            '<ul class="atlas-lang-list"></ul></div>';
        document.body.appendChild(ov);

        var list = ov.querySelector('.atlas-lang-list');
        var input = ov.querySelector('.atlas-lang-search');
        var sug = suggested();

        function item(l) {
            return '<li><button type="button" class="atlas-lang-item' + (l[0] === current ? ' active' : '') + '" data-code="' + esc(l[0]) + '">' +
                '<span>' + esc(l[2]) + '</span><small>' + esc(l[1]) + '</small></button></li>';
        }
        function render(q) {
            var n = norm(q).trim(), html = '', i, l;
            if (!n) {
                if (sug && sug !== current) html += '<li class="atlas-lang-label">Suggested</li>' + item(find(sug));
                html += '<li class="atlas-lang-label">All languages</li>';
                for (i = 0; i < L.length; i++) html += item(L[i]);
            } else {
                var found = 0;
                for (i = 0; i < L.length; i++) {
                    l = L[i];
                    if (norm(l[1]).indexOf(n) > -1 || norm(l[2]).indexOf(n) > -1 || norm(l[3]).indexOf(n) > -1 || norm(l[0]) === n) {
                        html += item(l); found++;
                    }
                }
                if (!found) html = '<li class="atlas-lang-empty">No language found</li>';
            }
            list.innerHTML = html;
        }
        function open() { render(''); input.value = ''; ov.classList.add('open'); document.body.style.overflow = 'hidden'; setTimeout(function () { input.focus(); }, 50); }
        function close() { ov.classList.remove('open'); document.body.style.overflow = ''; }

        bar.querySelector('.atlas-lang-btn').addEventListener('click', open);
        ov.querySelector('.atlas-lang-close').addEventListener('click', close);
        ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
        input.addEventListener('input', function () { render(input.value); });
        list.addEventListener('click', function (e) {
            var b = e.target.closest('.atlas-lang-item');
            if (!b) return;
            var code = b.getAttribute('data-code');
            if (code === current) { close(); return; }
            applyLang(code);
        });
    }

    /* ---- translation engine ---- */
    function loadEngine() {
        var holder = document.createElement('div');
        holder.id = 'google_translate_element';
        document.body.appendChild(holder);
        window.atlasTranslateInit = function () {
            new google.translate.TranslateElement({
                pageLanguage: SOURCE,
                autoDisplay: false,
                layout: google.translate.TranslateElement.InlineLayout.SIMPLE
            }, 'google_translate_element');
        };
        var s = document.createElement('script');
        s.src = 'https://translate.google.com/translate_a/element.js?cb=atlasTranslateInit';
        s.async = true;
        s.onerror = function () { root.classList.remove('atlas-i18n-wait'); };
        document.body.appendChild(s);
    }

    function boot() {
        buildUI();
        if (needsTranslation) loadEngine();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();

    window.AtlasI18n = { set: applyLang, get: getLang };
})();
