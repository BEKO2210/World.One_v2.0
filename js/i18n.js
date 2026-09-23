/* ═══════════════════════════════════════════════════════════
   World.One 2.0 — Internationalization (DE/EN)
   ═══════════════════════════════════════════════════════════ */

// Übersetzungen liegen in i18n/de.json und i18n/en.json; geladen wird nur
// die aktive Sprache (vorher beide Sprachen, ~150 KB, bei jedem Besuch).
// Top-Level-await: importierende Module warten, bis die Sprache da ist,
// t() bleibt dadurch synchron.
const translations = {};

async function loadLanguage(lang) {
  if (translations[lang]) return translations[lang];
  const res = await fetch(new URL(`../i18n/${lang}.json`, import.meta.url));
  if (!res.ok) throw new Error(`i18n ${lang}: HTTP ${res.status}`);
  translations[lang] = await res.json();
  return translations[lang];
}

let _initialLang = 'de';
try { _initialLang = localStorage.getItem('world-one-lang') === 'en' ? 'en' : 'de'; } catch { /* Speicher blockiert */ }
// ?lang=de|en (Detail-Links) hat Vorrang — so wird nur eine Datei geladen
const _urlLang = new URLSearchParams(window.location.search).get('lang');
if (_urlLang === 'de' || _urlLang === 'en') _initialLang = _urlLang;
try {
  await loadLanguage(_initialLang);
} catch (err) {
  console.error('[i18n]', err.message);
  if (_initialLang !== 'de') { _initialLang = 'de'; await loadLanguage('de').catch(() => {}); }
}


// Englische Namen der Pipeline-Indikatoren (Pipeline liefert deutsche Namen)
const INDICATOR_NAMES_EN = {
  "Lebenserwartung": "Life expectancy",
  "Kindersterblichkeit": "Child mortality",
  "CO2-Konzentration": "CO₂ concentration",
  "Erneuerbare Energie": "Renewable energy",
  "Waldfläche": "Forest area",
  "Internet-Zugang": "Internet access",
  "BIP-Wachstum": "GDP growth",
  "Inflation": "Inflation",
  "Arbeitslosigkeit": "Unemployment",
  "BIP pro Kopf": "GDP per capita",
  "Globaler Handel": "Global trade",
  "Alphabetisierung": "Literacy",
  "Mobilfunk": "Mobile subscriptions",
  "F&E Ausgaben": "R&D spending",
  "Elektrizitätszugang": "Access to electricity",
  "Trinkwasser": "Drinking water",
  "CO2 pro Kopf": "CO₂ per capita",
  "Gesundheitsausgaben": "Health spending",
  "Urbanisierung": "Urbanisation",
  "Patentanmeldungen": "Patent applications",
  "Militärausgaben (% BIP)": "Military spending (% GDP)",
  "Globale Temperaturanomalie": "Global temperature anomaly",
  "Luftqualität (Global Avg AQI)": "Air quality (avg AQI)",
  "Arktis-Eisfläche": "Arctic sea ice",
  "Aktive Naturkatastrophen": "Active natural disasters",
  "Aktive Konflikte": "Active conflicts",
  "Trinkwasserzugang": "Access to drinking water",
  "Menschen auf der Flucht": "Forcibly displaced people",
  "Politische Freiheit": "Political freedom",
  "Gini-Index": "Gini index",
  "Extreme Armut": "Extreme poverty",
  "Internet-Durchdringung": "Internet penetration",
  "F&E Ausgaben (% BIP)": "R&D spending (% GDP)",
  "Mobilfunkverträge": "Mobile subscriptions",
  "GitHub Repositories": "GitHub repositories",
  "Wissenschaftliche Papers": "Scientific papers",
  "Internet-Nutzer": "Internet users"
};

class I18n {
  constructor() {
    this._lang = _initialLang;
    this._listeners = [];
    // Global placeholder values (Run 4): merged into every t() call so
    // strings containing {currentYear}, {tempLatestYear}, {freedomStreak},
    // {popLatestYear} are substituted site-wide without per-call wiring.
    // Defaults here cover the first render before world-state.json is loaded;
    // app.js refines them via setGlobalParams() once live data arrives.
    const _now = new Date().getFullYear();
    this._globalParams = {
      currentYear:    _now,
      tempLatestYear: _now - 1,   // NASA GISTEMP is annual, one year lag
      popLatestYear:  _now,
      freedomStreak:  18,         // Freedom House 2024 published streak
      freeCount: '–', partlyFreeCount: '–', notFreeCount: '–', popBillion: '–',
      billionaireWealthT: '–', billionairesYear: '–', povertyYear: '–'
    };
  }

  setGlobalParams(params) {
    this._globalParams = { ...this._globalParams, ...params };
    this._applyToDOM();   // re-render with new values
  }

  get lang() { return this._lang; }

  /** Anzeigename eines Pipeline-Indikators in der aktuellen Sprache */
  indicatorName(name) {
    return (this._lang === 'en' && INDICATOR_NAMES_EN[name]) || name;
  }

  /** Wert-Text eines Pipeline-Indikators („73.48 Jahre“) für EN übersetzen */
  indicatorValue(text) {
    if (this._lang !== 'en') return text;
    return text
      .replace(/\bMio km²/g, 'M km²')
      .replace(/\bMio t\b/g, 'Mt')
      .replace(/\bJahre\b/g, 'years')
      .replace(/\bMio\b/g, 'M')
      .replace(/\blaufend\b/g, 'ongoing')
      .replace(/\bPkt\b/g, 'pts')
      .replace(/\bunfrei\b/g, 'not free')
      .replace(/\bfrei\b/g, 'free')
      .replace(/\bheute\b/g, 'today');
  }

  /** Sprache wechseln; lädt die Übersetzungsdatei bei Bedarf nach. */
  async setLanguage(value) {
    if (value !== 'de' && value !== 'en') return;
    await loadLanguage(value);
    this.lang = value;
  }

  set lang(value) {
    if (value !== 'de' && value !== 'en') return;
    if (!translations[value]) { this.setLanguage(value); return; }
    this._lang = value;
    localStorage.setItem('world-one-lang', value);
    document.documentElement.lang = value;
    this._applyToDOM();
    this._listeners.forEach(fn => fn(value));
  }

  toggle() {
    return this.setLanguage(this._lang === 'de' ? 'en' : 'de');
  }

  t(key, params = {}) {
    let str = translations[this._lang]?.[key] || translations.de?.[key] || key;
    // Merge global params (set via setGlobalParams) with per-call params.
    // Per-call wins over global for identical keys.
    const merged = { ...this._globalParams, ...params };
    Object.entries(merged).forEach(([k, v]) => {
      str = str.replaceAll(`{${k}}`, v);
    });
    return str;
  }

  onChange(fn) {
    this._listeners.push(fn);
  }

  _applyToDOM() {
    // Translate all elements with data-i18n attribute
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const translation = this.t(key);
      if (el.hasAttribute('data-i18n-html')) {
        // Sanitize: only allow safe inline tags, strip everything else.
        // This prevents XSS via translation keys (CodeQL alert #2).
        const safe = translation
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          // Re-allow only <br>, <b>, <strong>, <em>, <i>, <span>
          .replace(/&lt;(\/?(br|b|strong|em|i|span)\s*\/?)&gt;/gi, '<$1>');
        el.innerHTML = safe;
      } else {
        el.textContent = translation;
      }
    });

    // Translate aria-labels
    document.querySelectorAll('[data-i18n-aria]').forEach(el => {
      el.setAttribute('aria-label', this.t(el.getAttribute('data-i18n-aria')));
    });

    // Update toggle button text
    const toggleLabel = document.querySelector('.lang-toggle__label');
    if (toggleLabel) {
      toggleLabel.textContent = this._lang === 'de' ? 'EN' : 'DE';
    }
  }

  init() {
    document.documentElement.lang = this._lang;
    this._applyToDOM();
  }
}

export const i18n = new I18n();
