
(() => {
  'use strict';

  const body = document.body;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const network = navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
  const lowBandwidth = !!(network && /(2g|3g|slow-2g)/i.test(String(network.effectiveType || '')));
  const lowPowerMode = prefersReducedMotion || !!(network && network.saveData) || lowBandwidth;
  const siteConfig = window.SITE_CONFIG || {};

  const brandName = siteConfig.brandName || document.title.split('|')[0]?.trim() || 'Studio';
  const brandEmail = siteConfig.brandEmail || '';
  const brandTagline = siteConfig.brandTagline || '';
  const brandColor = siteConfig.brandColor || '#0ea5e9';

  const emailConfig = {
    publicKey: 'Qa7MjOQq3CmXw-6Wi',
    serviceId: 'service_iuscesf',
    templateIdClient: 'template_rypcoe9',
    templateIdTeam: 'template_yabh1l8',
    templateIdContact: ''
  };

  const q = (selector, root = document) => root.querySelector(selector);
  const qa = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  const sanitizeUrl = (value) => {
    if (!value) return '';

    try {
      const parsed = new URL(String(value).trim());
      if (!['http:', 'https:'].includes(parsed.protocol)) return '';

      const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
      const allowedDomains = ['cal.com', 'cal.dev', 'calendly.com'];
      const allowed = allowedDomains.some((domain) => host === domain || host.endsWith(`.${domain}`));
      return allowed ? parsed.toString() : '';
    } catch (error) {
      return '';
    }
  };

  const parseList = (value) =>
    String(value || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

  const runWhenIdle = (callback, timeout = 1200) => {
    if (typeof callback !== 'function') return;
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(() => callback(), { timeout });
      return;
    }
    window.setTimeout(callback, 180);
  };

  const isHoneypotTriggered = (form) => {
    if (!form) return false;
    const traps = qa('[data-hp]', form);
    return traps.some((field) => String(field.value || '').trim().length > 0);
  };

  const getSubmitCooldownLeft = (key, waitMs) => {
    try {
      const raw = localStorage.getItem(`submitCooldown:${key}`);
      const last = raw ? Number.parseInt(raw, 10) : 0;
      if (!last || Number.isNaN(last)) return 0;
      const elapsed = Date.now() - last;
      return elapsed >= waitMs ? 0 : waitMs - elapsed;
    } catch (error) {
      return 0;
    }
  };

  const markSubmitCooldown = (key) => {
    try {
      localStorage.setItem(`submitCooldown:${key}`, `${Date.now()}`);
    } catch (error) {
      // ignore storage errors
    }
  };

  const loadScript = (src) =>
    new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        if (existing.dataset.loaded === 'true') {
          resolve();
          return;
        }
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(new Error(`Script load error: ${src}`)), { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = () => {
        script.dataset.loaded = 'true';
        resolve();
      };
      script.onerror = () => reject(new Error(`Script load error: ${src}`));
      document.head.appendChild(script);
    });

  const downloadText = (content, filename) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const EVENT_STORE_KEY = 'funnelEvents_v1';
  const LEAD_STORE_KEY = 'pipelineLeads_v1';
  const ATTR_STORE_KEY = 'leadAttribution_v1';
  const analyticsMeasurementId = String(siteConfig.analyticsId || '').trim().toUpperCase();

  const readStore = (key, fallback = []) => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : fallback;
    } catch (error) {
      return fallback;
    }
  };

  const writeStore = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      // ignore storage errors
    }
  };

  const trackEvent = (name, params = {}) => {
    const payload = {
      event: String(name || 'event'),
      ts: new Date().toISOString(),
      ...params
    };

    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(payload);

    if (typeof window.gtag === 'function') {
      try {
        window.gtag('event', payload.event, params);
      } catch (error) {
        // ignore analytics errors
      }
    }

    const events = readStore(EVENT_STORE_KEY, []);
    events.push(payload);
    writeStore(EVENT_STORE_KEY, events.slice(-600));
  };

  const initAnalytics = async () => {
    if (!/^G-[A-Z0-9]+$/.test(analyticsMeasurementId)) return;

    try {
      await loadScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(analyticsMeasurementId)}`);
      window.dataLayer = window.dataLayer || [];
      window.gtag =
        window.gtag ||
        function gtagShim() {
          window.dataLayer.push(arguments);
        };

      window.gtag('js', new Date());
      window.gtag('config', analyticsMeasurementId, {
        anonymize_ip: true,
        transport_type: 'beacon'
      });
    } catch (error) {
      // ignore analytics load errors
    }
  };

  const getDeviceType = () => {
    const width = Math.max(window.innerWidth || 0, document.documentElement?.clientWidth || 0);
    if (width <= 767) return 'mobile';
    if (width <= 1199) return 'tablet';
    return 'desktop';
  };

  const captureAttribution = () => {
    const params = new URLSearchParams(window.location.search);
    const now = new Date().toISOString();
    const patch = {
      utm_source: params.get('utm_source') || '',
      utm_medium: params.get('utm_medium') || '',
      utm_campaign: params.get('utm_campaign') || '',
      utm_content: params.get('utm_content') || '',
      utm_term: params.get('utm_term') || '',
      gclid: params.get('gclid') || '',
      fbclid: params.get('fbclid') || '',
      referrer: document.referrer || '',
      landing_page: `${window.location.pathname}${window.location.search}`,
      locale: navigator.language || '',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
      device: getDeviceType(),
      last_seen_at: now
    };

    try {
      const current = readStore(ATTR_STORE_KEY, [])[0] || {};
      const merged = { ...current };
      Object.entries(patch).forEach(([key, value]) => {
        if (value) merged[key] = value;
      });
      if (!merged.first_seen_at) merged.first_seen_at = now;
      writeStore(ATTR_STORE_KEY, [merged]);
    } catch (error) {
      // ignore storage errors
    }
  };

  const getAttribution = () => {
    const fallback = {
      landing_page: `${window.location.pathname}${window.location.search}`,
      locale: navigator.language || '',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
      device: getDeviceType()
    };

    try {
      const stored = readStore(ATTR_STORE_KEY, [])[0];
      if (!stored || typeof stored !== 'object') return fallback;
      return { ...fallback, ...stored };
    } catch (error) {
      return fallback;
    }
  };

  const computeLeadOps = (payload, type = 'contact') => {
    const score = Number(payload.score || scoreLead(payload, type));
    const stage = score >= 80 ? 'hot' : score >= 60 ? 'qualified' : 'nurture';
    const priority = score >= 80 ? 'high' : score >= 60 ? 'medium' : 'low';

    const now = Date.now();
    const followupHours =
      type === 'booking' ? 6 : stage === 'hot' ? 8 : stage === 'qualified' ? 24 : 72;
    const nextActionAt = new Date(now + followupHours * 60 * 60 * 1000).toISOString();
    const nextActionType =
      type === 'booking' ? 'booking_confirmation' : stage === 'hot' ? 'same_day_discovery' : stage === 'qualified' ? 'scope_followup' : 'nurture_sequence';

    return {
      score,
      stage,
      priority,
      nextActionAt,
      nextActionType,
      owner: brandName || 'Owner'
    };
  };

  const enrichLeadPayload = (payload, type = 'contact') => {
    const ops = computeLeadOps(payload, type);
    const attribution = getAttribution();
    return {
      ...payload,
      ...ops,
      ...attribution,
      type
    };
  };

  const foldLeadValue = (value) =>
    normalizeI18nKey(value)
      .toLowerCase()
      .replace(/ı/g, 'i')
      .replace(/ğ/g, 'g')
      .replace(/ş/g, 's')
      .replace(/ç/g, 'c')
      .replace(/ö/g, 'o')
      .replace(/ü/g, 'u');

  const extractBudgetMax = (value) => {
    const parts = String(value || '')
      .split(/-|–|—|\+/)
      .map((part) => Number.parseInt(String(part).replace(/\D/g, ''), 10))
      .filter((num) => Number.isFinite(num) && num > 0);
    return parts.length ? Math.max(...parts) : 0;
  };

  const scoreLead = (payload, type = 'contact') => {
    const get = (key) => foldLeadValue(payload?.[key] || '');
    let score = 18;

    if (type === 'booking') score += 24;
    if (type === 'analysis') score += 16;

    const budgetRangeMax = extractBudgetMax(payload?.budget_range);
    const budgetMax = extractBudgetMax(payload?.budget);
    if (budgetRangeMax >= 750000 || budgetMax >= 80000) score += 26;
    else if (budgetRangeMax >= 300000 || budgetMax >= 40000) score += 18;
    else if (budgetRangeMax >= 100000 || budgetMax >= 20000) score += 10;

    if (get('timeline_pref').includes('0-30')) score += 16;
    else if (get('timeline_pref').includes('31-60')) score += 11;
    else if (get('timeline_pref').includes('61-90')) score += 7;

    const decisionRole = get('decision_role');
    if (
      decisionRole.includes('kurucu') ||
      decisionRole.includes('ortak') ||
      decisionRole.includes('c-level') ||
      decisionRole.includes('executive')
    ) {
      score += 16;
    } else if (decisionRole.includes('yonetici') || decisionRole.includes('manager')) {
      score += 10;
    }

    const urgency = get('urgency');
    if (urgency.includes('yuksek') || urgency.includes('high')) score += 10;
    else if (urgency.includes('orta') || urgency.includes('medium')) score += 6;

    if (String(payload?.company || '').trim()) score += 6;
    if (String(payload?.phone || '').trim()) score += 5;

    return clamp(score, 0, 100);
  };

  const saveLead = (lead) => {
    const leads = readStore(LEAD_STORE_KEY, []);
    const row = {
      id: `lead_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
      ...lead
    };

    leads.push(row);
    writeStore(LEAD_STORE_KEY, leads.slice(-400));
    document.dispatchEvent(new CustomEvent('pipeline:update'));
    return row;
  };

  const hexToRgb = (hex) => {
    if (!hex) return null;
    const cleaned = String(hex).replace('#', '').trim();
    if (![3, 6].includes(cleaned.length)) return null;

    const full = cleaned.length === 3 ? cleaned.split('').map((c) => c + c).join('') : cleaned;
    const n = Number.parseInt(full, 16);
    if (Number.isNaN(n)) return null;

    return {
      r: (n >> 16) & 255,
      g: (n >> 8) & 255,
      b: n & 255
    };
  };

  const LANG_STORAGE_KEY = 'siteLang';
  let activeLang = 'tr';
  const CTA_EXPERIMENT_STORAGE_KEY = 'exp_cta_v1';
  const CTA_EXPERIMENT_QUERY_KEY = 'cta_variant';
  const CTA_EXPERIMENT_VARIANTS = ['control', 'bold'];
  let ctaVariant = 'control';
  let ctaVariantSource = 'default';

  const CTA_VARIANT_COPY = {
    control: {
      tr: {
        nav: 'Görüşme Planla',
        hero_home: '15 dk Strateji Görüşmesi',
        hero_page: 'Görüşme Planla',
        cta_block: 'Rezervasyonu Başlat',
        case_card: 'Benzerini Planla',
        quick_slot: 'Hızlı Slot Seç'
      },
      en: {
        nav: 'Book a Call',
        hero_home: '15m Strategy Call',
        hero_page: 'Book a Call',
        cta_block: 'Start Booking',
        case_card: 'Plan Similar Project',
        quick_slot: 'Quick Slot'
      }
    },
    bold: {
      tr: {
        nav: 'Bugün Görüşme Planla',
        hero_home: '15 dk Ücretsiz Strateji',
        hero_page: 'Takvimde Yerini Ayır',
        cta_block: 'Hemen Rezervasyon Al',
        case_card: 'Bu Sonucu Kopyalayalım',
        quick_slot: 'Şimdi Slot Al'
      },
      en: {
        nav: 'Book Today',
        hero_home: '15m Free Strategy',
        hero_page: 'Reserve Your Slot',
        cta_block: 'Book Instantly',
        case_card: 'Replicate This Result',
        quick_slot: 'Grab a Slot Now'
      }
    }
  };

  const CTA_ROLE_SELECTORS = [
    {
      role: 'nav',
      selectors: ['[data-cta-role="nav"]']
    },
    {
      role: 'quick_slot',
      selectors: [
        '[data-cta-role="quick_slot"]',
        '[data-cta-role="quick_hub_booking"]',
        '[data-cta-role="strip_booking"]',
        '[data-cta-role="mobile_booking"]'
      ]
    },
    {
      role: 'hero_home',
      selectors: ['[data-cta-role="hero_home"]']
    },
    {
      role: 'hero_page',
      selectors: ['[data-cta-role="hero_page"]']
    },
    {
      role: 'cta_block',
      selectors: [
        '[data-cta-role="cta_block"]',
        '[data-cta-role="proof_booking"]'
      ]
    },
    {
      role: 'case_card',
      selectors: ['[data-cta-role="case_card"]']
    }
  ];

  const normalizeText = (value) =>
    String(value || '')
      .replace(/\s+/g, ' ')
      .trim();

  const withWhitespace = (original, translated) => {
    const lead = (String(original).match(/^\s*/) || [''])[0];
    const tail = (String(original).match(/\s*$/) || [''])[0];
    return `${lead}${translated}${tail}`;
  };

  const repairMojibake = (value) => {
    const input = String(value || '');
    try {
      const repaired = decodeURIComponent(escape(input));
      return repaired.includes('\ufffd') ? input : repaired;
    } catch (error) {
      return input;
    }
  };

  const normalizeI18nKey = (value) => normalizeText(repairMojibake(value));

  const buildLookup = (source) => {
    const table = {};
    Object.entries(source || {}).forEach(([key, value]) => {
      table[normalizeI18nKey(key)] = value;
    });
    return table;
  };

  const normalizeCtaVariant = (value) => {
    const candidate = String(value || '')
      .trim()
      .toLowerCase();
    return CTA_EXPERIMENT_VARIANTS.includes(candidate) ? candidate : '';
  };

  const persistCtaVariant = (variant) => {
    try {
      localStorage.setItem(CTA_EXPERIMENT_STORAGE_KEY, variant);
    } catch (error) {
      // ignore storage errors
    }
  };

  const resolveCtaVariant = () => {
    const params = new URLSearchParams(window.location.search);
    const queryVariant = normalizeCtaVariant(params.get(CTA_EXPERIMENT_QUERY_KEY));
    if (queryVariant) {
      ctaVariantSource = 'query';
      return queryVariant;
    }

    try {
      const saved = normalizeCtaVariant(localStorage.getItem(CTA_EXPERIMENT_STORAGE_KEY));
      if (saved) {
        ctaVariantSource = 'storage';
        return saved;
      }
    } catch (error) {
      // ignore storage errors
    }

    let bucket = Math.random();
    try {
      if (window.crypto?.getRandomValues) {
        const seed = new Uint32Array(1);
        window.crypto.getRandomValues(seed);
        bucket = seed[0] / 4294967295;
      }
    } catch (error) {
      // fallback to Math.random
    }

    ctaVariantSource = 'random';
    return bucket >= 0.5 ? 'bold' : 'control';
  };

  const getCtaVariantCopy = (role, fallback = '') => {
    const variantPack = CTA_VARIANT_COPY[ctaVariant] || CTA_VARIANT_COPY.control || {};
    const localePack =
      variantPack[activeLang] || variantPack.tr || CTA_VARIANT_COPY.control?.[activeLang] || CTA_VARIANT_COPY.control?.tr || {};
    return localePack[role] || fallback;
  };

  const applyCtaVariantCopy = () => {
    CTA_ROLE_SELECTORS.forEach((group) => {
      const label = getCtaVariantCopy(group.role);
      if (!label) return;

      group.selectors.forEach((selector) => {
        qa(selector).forEach((node) => {
          if (!node) return;
          node.dataset.ctaRole = group.role;
          node.dataset.ctaVariant = ctaVariant;
          node.textContent = label;
        });
      });
    });

    if (document?.documentElement) {
      document.documentElement.setAttribute('data-cta-variant', ctaVariant);
    }
  };

  const resolveCtaRole = (target) => {
    if (!target) return '';
    return (
      target.dataset?.ctaRole ||
      target.closest?.('[data-cta-role]')?.dataset?.ctaRole ||
      ''
    );
  };

  const initCtaExperiment = () => {
    ctaVariant = resolveCtaVariant();
    persistCtaVariant(ctaVariant);
    applyCtaVariantCopy();
    document.addEventListener('language:change', applyCtaVariantCopy);
    trackEvent('cta_variant_seen', {
      variant: ctaVariant,
      source: ctaVariantSource,
      lang: activeLang,
      path: window.location.pathname || '/'
    });
  };

  const TRUST_UI_COPY = {
    tr: {
      stripTitle: 'Bu hafta sinirli uygun zaman',
      stripPointA: '24 saat icinde teknik donus',
      stripPointB: 'NDA + gizlilik odakli surec',
      stripPointC: 'Uzaktan veya hibrit calisma',
      stripAnalysisCta: 'Ucretsiz Analiz',
      stripBookingCta: 'Gorusme Planla',
      proofEyebrow: 'Sosyal Kanit',
      proofTitle: 'Olculebilir etki ureten teslim sistemi',
      proofSubtitle: 'Sektor fark etmeden ayni teknik standartlarla ilerleyip sonuclari metriklerle takip ederim.',
      proofSectorsLabel: 'Calisilan alanlar',
      proofSectors: ['Fintech', 'E-Ticaret', 'SaaS', 'Saglik', 'Lojistik'],
      proofMetricAValue: '+21%',
      proofMetricALabel: 'Ortalama aktivasyon artisi',
      proofMetricBValue: '-27%',
      proofMetricBLabel: 'Operasyon suresi azalmasi',
      proofMetricCValue: '1.9s',
      proofMetricCLabel: 'Mobil hedef yukleme',
      proofProjectsCta: 'Vaka Kutuphanesi',
      proofBookingCta: 'Benzerini Planla',
      mobileAnalysisCta: 'Ucretsiz Analiz',
      mobileBookingCta: 'Gorusme Planla'
    },
    en: {
      stripTitle: 'Limited availability this week',
      stripPointA: 'Technical response within 24h',
      stripPointB: 'NDA-first confidential process',
      stripPointC: 'Remote or hybrid delivery',
      stripAnalysisCta: 'Free Analysis',
      stripBookingCta: 'Book a Call',
      proofEyebrow: 'Social Proof',
      proofTitle: 'A delivery system with measurable impact',
      proofSubtitle: 'I ship with the same engineering standards across industries and track outcomes with metrics.',
      proofSectorsLabel: 'Industries',
      proofSectors: ['Fintech', 'E-commerce', 'SaaS', 'Health', 'Logistics'],
      proofMetricAValue: '+21%',
      proofMetricALabel: 'Average activation uplift',
      proofMetricBValue: '-27%',
      proofMetricBLabel: 'Ops cycle-time reduction',
      proofMetricCValue: '1.9s',
      proofMetricCLabel: 'Mobile target load time',
      proofProjectsCta: 'Case Library',
      proofBookingCta: 'Plan Similar Project',
      mobileAnalysisCta: 'Free Analysis',
      mobileBookingCta: 'Book a Call'
    }
  };

  const getTrustCopy = () => TRUST_UI_COPY[activeLang] || TRUST_UI_COPY.tr;

  const upsertConversionStrip = () => {
    const page = body?.dataset.page || '';
    if (!page || page === 'sitemap') return;

    let strip = q('[data-conversion-strip]');
    if (!strip) {
      strip = document.createElement('aside');
      strip.className = 'conversion-strip';
      strip.setAttribute('data-conversion-strip', 'true');
      strip.innerHTML = `
        <div class="container conversion-strip-inner">
          <div class="conversion-strip-copy">
            <strong data-strip="title"></strong>
            <div class="conversion-strip-points">
              <span data-strip="point-a"></span>
              <span data-strip="point-b"></span>
              <span data-strip="point-c"></span>
            </div>
          </div>
          <div class="conversion-strip-actions">
            <a class="btn ghost" href="analysis.html" data-cta-role="strip_analysis"></a>
            <a class="btn primary" href="booking.html" data-cta-role="strip_booking"></a>
          </div>
        </div>
      `;

      const anchor = q('.attention-bar') || q('.site-header');
      const main = q('main');
      if (anchor) {
        anchor.insertAdjacentElement('afterend', strip);
      } else if (main) {
        main.insertAdjacentElement('beforebegin', strip);
      }

      if (!lowPowerMode) {
        requestAnimationFrame(() => strip.classList.add('is-mounted'));
      } else {
        strip.classList.add('is-mounted');
      }
    }

    const copy = getTrustCopy();
    const bookingLabel = getCtaVariantCopy('nav', copy.stripBookingCta);

    const title = q('[data-strip="title"]', strip);
    const pointA = q('[data-strip="point-a"]', strip);
    const pointB = q('[data-strip="point-b"]', strip);
    const pointC = q('[data-strip="point-c"]', strip);
    const analysisCta = q('[data-cta-role="strip_analysis"]', strip);
    const bookingCta = q('[data-cta-role="strip_booking"]', strip);

    if (title) title.textContent = copy.stripTitle;
    if (pointA) pointA.textContent = copy.stripPointA;
    if (pointB) pointB.textContent = copy.stripPointB;
    if (pointC) pointC.textContent = copy.stripPointC;
    if (analysisCta) analysisCta.textContent = copy.stripAnalysisCta;
    if (bookingCta) {
      bookingCta.textContent = bookingLabel;
      bookingCta.dataset.ctaVariant = ctaVariant;
    }
  };

  const upsertSocialProof = () => {
    const page = body?.dataset.page || '';
    if (!page || page === 'booking' || page === 'sitemap') return;

    let section = q('[data-social-proof]');
    if (!section) {
      section = document.createElement('section');
      section.className = 'section section-compact social-proof-section';
      section.setAttribute('data-social-proof', 'true');
      section.innerHTML = `
        <div class="container social-proof-shell" data-animate>
          <div class="social-proof-head">
            <span class="eyebrow" data-proof="eyebrow"></span>
            <h2 data-proof="title"></h2>
            <p data-proof="subtitle"></p>
          </div>
          <div class="social-proof-sectors-wrap">
            <span data-proof="sectors-label"></span>
            <div class="social-proof-sectors" data-proof="sectors"></div>
          </div>
          <div class="social-proof-metrics">
            <article>
              <strong data-proof="metric-a-value"></strong>
              <span data-proof="metric-a-label"></span>
            </article>
            <article>
              <strong data-proof="metric-b-value"></strong>
              <span data-proof="metric-b-label"></span>
            </article>
            <article>
              <strong data-proof="metric-c-value"></strong>
              <span data-proof="metric-c-label"></span>
            </article>
          </div>
          <div class="social-proof-actions">
            <a class="btn ghost" href="projects.html" data-cta-role="proof_projects"></a>
            <a class="btn primary" href="booking.html" data-cta-role="proof_booking"></a>
          </div>
        </div>
      `;

      const target = q('main .hero') || q('main .page-hero') || q('main .section');
      if (target) {
        target.insertAdjacentElement('afterend', section);
      } else {
        const main = q('main');
        if (main) main.appendChild(section);
      }

      if (!lowPowerMode) {
        requestAnimationFrame(() => section.classList.add('is-mounted'));
      } else {
        section.classList.add('is-mounted');
      }
    }

    const copy = getTrustCopy();
    const bookingLabel = getCtaVariantCopy('case_card', copy.proofBookingCta);

    const bind = (key, value) => {
      const node = q(`[data-proof="${key}"]`, section);
      if (node) node.textContent = value;
    };

    bind('eyebrow', copy.proofEyebrow);
    bind('title', copy.proofTitle);
    bind('subtitle', copy.proofSubtitle);
    bind('sectors-label', copy.proofSectorsLabel);
    bind('metric-a-value', copy.proofMetricAValue);
    bind('metric-a-label', copy.proofMetricALabel);
    bind('metric-b-value', copy.proofMetricBValue);
    bind('metric-b-label', copy.proofMetricBLabel);
    bind('metric-c-value', copy.proofMetricCValue);
    bind('metric-c-label', copy.proofMetricCLabel);

    const sectors = q('[data-proof="sectors"]', section);
    if (sectors) {
      sectors.innerHTML = '';
      copy.proofSectors.forEach((sector) => {
        const chip = document.createElement('span');
        chip.textContent = sector;
        sectors.appendChild(chip);
      });
    }

    const projectsCta = q('[data-cta-role="proof_projects"]', section);
    if (projectsCta) projectsCta.textContent = copy.proofProjectsCta;

    const bookingCta = q('[data-cta-role="proof_booking"]', section);
    if (bookingCta) {
      bookingCta.textContent = bookingLabel;
      bookingCta.dataset.ctaVariant = ctaVariant;
    }
  };

  const upsertMobileStickyCta = () => {
    const page = body?.dataset.page || '';
    const disabled = !page || page === 'booking' || page === 'sitemap';
    let sticky = q('[data-mobile-sticky]');

    if (disabled) {
      if (sticky) sticky.remove();
      body?.classList.remove('has-mobile-sticky-cta');
      return;
    }

    if (!sticky) {
      sticky = document.createElement('div');
      sticky.className = 'mobile-sticky-cta';
      sticky.setAttribute('data-mobile-sticky', 'true');
      sticky.innerHTML = `
        <a class="btn ghost" href="analysis.html" data-cta-role="mobile_analysis"></a>
        <a class="btn primary" href="booking.html" data-cta-role="mobile_booking"></a>
      `;
      body.appendChild(sticky);
    }

    const copy = getTrustCopy();
    const bookingLabel = getCtaVariantCopy('nav', copy.mobileBookingCta);
    const analysisCta = q('[data-cta-role="mobile_analysis"]', sticky);
    const bookingCta = q('[data-cta-role="mobile_booking"]', sticky);

    if (analysisCta) analysisCta.textContent = copy.mobileAnalysisCta;
    if (bookingCta) {
      bookingCta.textContent = bookingLabel;
      bookingCta.dataset.ctaVariant = ctaVariant;
    }

    body?.classList.add('has-mobile-sticky-cta');
  };

  const initTrustUi = () => {
    // Trust and conversion sections are now rendered explicitly in page markup.
    // Keep this as a no-op to avoid duplicate injected blocks.
  };

  const initHeroLaunch = () => {
    const heroBlocks = qa('.hero-copy, .page-hero-inner');
    if (!heroBlocks.length) return;

    const mount = () => {
      heroBlocks.forEach((block, index) => {
        block.style.setProperty('--hero-block-delay', `${Math.min(index, 3) * 70}ms`);
        block.classList.add('is-mounted');
      });
    };

    if (lowPowerMode) {
      mount();
      return;
    }

    requestAnimationFrame(mount);
  };

  const CTA_PULSE_SESSION_KEY = 'ctaPulseSeen_v1';
  const ENABLE_CTA_PULSE = false;

  const initCtaPulse = () => {
    if (!ENABLE_CTA_PULSE) return;
    if (lowPowerMode) return;

    try {
      if (sessionStorage.getItem(CTA_PULSE_SESSION_KEY) === '1') return;
    } catch (error) {
      // ignore storage errors
    }

    const targets = qa(
      [
        '.nav-cta',
        'body[data-page="home"] .hero-actions .btn.primary[href*="booking"]',
        '[data-cta-role="strip_booking"]',
        '[data-cta-role="proof_booking"]',
        '[data-cta-role="mobile_booking"]'
      ].join(',')
    ).filter(Boolean);

    if (!targets.length) return;

    targets.forEach((btn) => btn.classList.add('is-cta-pulse'));

    trackEvent('cta_pulse_activated', {
      variant: ctaVariant,
      count: targets.length,
      path: window.location.pathname || '/'
    });

    window.setTimeout(() => {
      targets.forEach((btn) => btn.classList.remove('is-cta-pulse'));
      try {
        sessionStorage.setItem(CTA_PULSE_SESSION_KEY, '1');
      } catch (error) {
        // ignore storage errors
      }
    }, 7600);
  };

  const I18N_TEXT_EN = {
    'Icerige atla': 'Skip to content',
    'İçeriğe atla': 'Skip to content',
    Menü: 'Menu',
    'Ana Sayfa': 'Home',
    Hizmetler: 'Services',
    Projeler: 'Projects',
    Teslimat: 'Delivery',
    Hakkımda: 'About',
    Teknoloji: 'Tech',
    'Çalışma Modeli': 'Work Model',
    'Ücretsiz Analiz': 'Free Analysis',
    Rezervasyon: 'Booking',
    SSS: 'FAQ',
    İletişim: 'Contact',
    'Bugün Müsait': 'Available Today',
    'Görüşme Planla': 'Book a Call',
    'Bu hafta': 'This week',
    'keşif slotu açık.': 'discovery slots are open.',
    'Rezervasyon alan müşterilere ücretsiz teknik yol haritası özeti gönderilir.':
      'Clients who book receive a free technical roadmap summary.',
    'Ücretsiz Analiz Al': 'Get Free Analysis',
    'Hemen Slot Seç': 'Pick a Slot Now',
    'Senior Full‑Stack Partner': 'Senior Full-Stack Partner',
    'Fikirden yayına, gelir odaklı yazılım sistemleri kuruyorum.':
      'From idea to launch, I build revenue-focused software systems.',
    'Sadece yazılım geliştirmiyorum; müşteri akışını hızlandıran, operasyonu sadeleştiren ve dönüşümü artıran web, mobil ve backend ürünleri uçtan uca teslim ediyorum.':
      'I do more than coding: I deliver end-to-end web, mobile, and backend products that speed up customer flow, simplify operations, and improve conversion.',
    '48 saatte teknik yol haritası': 'Technical roadmap in 48 hours',
    'Kapsam, riskler ve sprint planı net biçimde yazılı olarak paylaşılır.':
      'Scope, risks, and sprint plan are shared clearly in writing.',
    'Her sprintte ölçülebilir çıktı': 'Measurable output every sprint',
    'UI, backend ve entegrasyon kararları doğrudan iş hedeflerinize bağlanır.':
      'UI, backend, and integration decisions are directly aligned with your business goals.',
    'Yayın sonrası aktif teknik destek': 'Active technical support after launch',
    'İzleme, performans ve bakım süreçleriyle ürün canlıda stabil büyür.':
      'Monitoring, performance, and maintenance keep your product stable as it grows.',
    'Kurumsal Teslim Disiplini': 'Enterprise Delivery Discipline',
    'NDA + Gizlilik': 'NDA + Confidentiality',
    'Uzaktan / Hibrit': 'Remote / Hybrid',
    'Net Yol Haritası': 'Clear Roadmap',
    'İlk görüşmede kapsam ve riskler': 'Scope and risks clarified in the first call',
    'Hızlı Teslim': 'Fast Delivery',
    'Planlanan sprintlerle ölçülebilir çıktı': 'Measurable output with planned sprints',
    'Ölçeklenebilir Mimari': 'Scalable Architecture',
    'Güvenli, izlenebilir ve sürdürülebilir': 'Secure, observable, and sustainable',
    '15 dk Strateji Görüşmesi': '15-min Strategy Call',
    'Vaka Çalışmalarını Gör': 'View Case Studies',
    'Aynı gün ilk teknik geri dönüş': 'Same-day first technical response',
    'Kapsam soruları + uygulanabilir öneri seti': 'Scope questions + actionable recommendations',
    '72 saatte teklif ve teslim planı': 'Proposal and delivery plan in 72 hours',
    'Önceliklendirilmiş backlog + net zaman çizelgesi': 'Prioritized backlog + clear timeline',
    'Ücretsiz Ön Analiz Başlat': 'Start Free Pre-Analysis',
    'Tamamlanan Proje': 'Completed Projects',
    'Aktif Sektör': 'Active Industries',
    'Uptime Hedefi': 'Uptime Target',
    'Profesyonel teslim, sürdürülebilir ürün': 'Professional delivery, sustainable product',
    'Net gereksinim, temiz mimari, test ve ölçümleme ile uzun vadeli çözümler geliştiriyorum.':
      'I build long-term solutions with clear requirements, clean architecture, testing, and measurement.',
    'Güvenlik odaklı': 'Security-focused',
    'Performans hedefli': 'Performance-driven',
    Dokümantasyon: 'Documentation',
    Ölçeklenebilirlik: 'Scalability',
    'Basın & Ödül (Temsili)': 'Press & Awards (Representative)',
    'Gerçek projeler gizlilik gereği anonim; aşağıdaki rozetler temsili örneklerdir.':
      'Real projects are anonymized due to confidentiality; badges below are representative examples.',
    'Kalite Standartları': 'Quality Standards',
    'Her projede uygulanan temel kalite standartlarıyla en iyi sonucu hedefliyoruz.':
      'We target the best outcome with core quality standards applied to every project.',
    'Hızlı Brief': 'Quick Brief',
    'Bu alanı boş bırakın': 'Leave this field empty',
    '60 saniyelik form': '60-second form',
    'Ücretsiz ön analiz': 'Free pre-analysis',
    '24 saat içinde geri dönüş': 'Response within 24 hours',
    'Ad Soyad': 'Full Name',
    'E-Posta': 'Email',
    'Web Sitesi': 'Website',
    Hedef: 'Goal',
    Seçiniz: 'Select',
    'Ürün Performansı': 'Product Performance',
    'Mimari Refactor': 'Architecture Refactor',
    'Yeni Ürün / MVP': 'New Product / MVP',
    'Bütçe Aralığı': 'Budget Range',
    Not: 'Note',
    'Ücretsiz Analiz Talebi': 'Request Free Analysis',
    'Örnek PDF İndir': 'Download Sample PDF',
    'Form 60 saniye sürer. Örnek PDF demo verilerle indirilebilir.':
      'The form takes 60 seconds. A sample PDF can be downloaded with demo data.',
    'Ücretsiz Teknik Analiz + Yol Haritası': 'Free Technical Analysis + Roadmap',
    'Mevcut sisteminizi analiz edip net bir aksiyon listesi ve yol haritası oluşturuyorum.':
      'I analyze your current system and create a clear action list and roadmap.',
    'Formu doldurduğunuzda 24 saat içinde kısa bir değerlendirme briefi hazırlanır.':
      'After you submit the form, a brief assessment is prepared within 24 hours.',
    'Performans ve güvenlik analizi': 'Performance and security analysis',
    'Mimari iyileştirme önerileri': 'Architecture improvement recommendations',
    'Ürün yol haritası notları': 'Product roadmap notes',
    'PDF rapor': 'PDF report',
    'Risk matrisi': 'Risk matrix',
    'Sprint önerisi': 'Sprint suggestion',
    Rezervasyon: 'Booking',
    '15 dakikalık görüşme ile ihtiyacınızı netleştirelim.': 'Let’s clarify your needs in a 15-minute meeting.',
    'Bu hafta hızlı keşif için sınırlı slot var.': 'Limited discovery slots are available this week.',
    'Tarih ve saat seçtiğinizde takvim davetinizi anında sabitliyoruz.':
      'When you select date and time, we instantly lock your calendar invitation.',
    'Hızlı Slot Seç': 'Quick Slot',
    'Tarih & Saat': 'Date & Time',
    'Uygun günü seçin, saatleri otomatik listeliyoruz.': 'Pick a date and we list available times automatically.',
    'Kısa Bilgi': 'Short Brief',
    'Hedef ve ihtiyacınızı 60 saniyede özetleyin.': 'Summarize your goal and need in 60 seconds.',
    Onay: 'Confirmation',
    'Takvim daveti ve e‑posta onayı otomatik gönderilir.':
      'Calendar invite and email confirmation are sent automatically.',
    'Takvim + E-Posta Onayı': 'Calendar + Email Confirmation',
    'Randevu sonrası hem size hem bana otomatik bildirim gider.':
      'After booking, notifications are sent automatically to both sides.',
    'Toplantı Öncesi Hazırlık': 'Pre-meeting Preparation',
    'Görüşmeden önce kısa teknik özetinizi alıp hazırlıklı gelirim.':
      'I review your short technical summary before the call and come prepared.',
    'Net Sonraki Adım': 'Clear Next Step',
    'Görüşme sonunda uygulanabilir yol haritası çıkarırız.': 'At the end of the call, we define an actionable roadmap.',
    'Hızlı Rezervasyon': 'Quick Booking',
    'Canlı Takvim': 'Live Calendar',
    'Uygun Zamanlar': 'Available Times',
    'Takvimden tarih seçin, sistem size uygun saatleri otomatik listeler.':
      'Choose a date from the calendar and the system lists available times automatically.',
    'Görüşme süresi: 15 dk • Takvim 30 gün açık': 'Meeting length: 15 min • Calendar open for 30 days',
    Tarih: 'Date',
    'Seçilen zaman yok': 'No selected time',
    'Bilgilerinizi Bırakın': 'Leave Your Details',
    Telefon: 'Phone',
    'Şirket / Ürün': 'Company / Product',
    Konu: 'Topic',
    'Ürün / MVP': 'Product / MVP',
    'Web Uygulama': 'Web App',
    'Mobil Uygulama': 'Mobile App',
    'Backend / API': 'Backend / API',
    'DevOps / Cloud': 'DevOps / Cloud',
    'Otomasyon / Entegrasyon': 'Automation / Integration',
    'Rezervasyonu Tamamla': 'Complete Booking',
    'Bilgiler yalnızca görüşme planlamak için kullanılır. E‑posta onayı gönderilir.':
      'Your information is only used to schedule the meeting. Email confirmation is sent.',
    'Takvim URL': 'Calendar URL',
    'Takvimi Bağla': 'Connect Calendar',
    'URL kaydı için butona tıklayın.': 'Click the button to save the URL.',
    'URL Doğrulama': 'URL Validation',
    'Takvim Bağlantısı': 'Calendar Connection',
    'Toplantı Akışı': 'Meeting Flow',
    Bekleniyor: 'Pending',
    'Hazır değil': 'Not Ready',
    Pasif: 'Passive',
    'Takvim entegrasyonu yüklendiğinde burada görünecek.': 'The calendar integration will appear here once loaded.',
    'Entegrasyon Desteği Al': 'Get Integration Support',
    'Bu akışta neler var?': 'What is included in this flow?',
    'Gerçek zamanlı müsaitlik': 'Real-time availability',
    'Otomatik e-posta hatırlatmaları': 'Automatic email reminders',
    'Zoom/Meet bağlantısı': 'Zoom/Meet link',
    'Sık Sorulan Sorular': 'Frequently Asked Questions',
    'Merak edilenler ve çalışma düzeni.': 'Common questions and work process.',
    'Hangi projelerde destek olabilirsiniz?': 'What kinds of projects can you support?',
    'Proje süresi nasıl belirlenir?': 'How is project duration determined?',
    'Uzaktan veya hibrit çalışıyor musunuz?': 'Do you work remotely or hybrid?',
    'Bakım ve destek sunuyor musunuz?': 'Do you offer maintenance and support?',
    'Hızlı yanıt için bilgileri bırakın.': 'Leave your details for a quick response.',
    'Çalışma Modeli': 'Work Model',
    Konum: 'Location',
    Türkiye: 'Turkey',
    'Proje Talebi': 'Project Request',
    'Kısa bilgi yeterli. 24 saat içinde dönüş yaparım.': 'A short brief is enough. I reply within 24 hours.',
    '24 saat içinde dönüş': 'Response within 24 hours',
    'Gizli değerlendirme': 'Confidential review',
    'Ücretsiz ön görüşme': 'Free initial call',
    Mesaj: 'Message',
    'Mesaj Gönder': 'Send Message',
    'Projenizi birlikte netleştirelim.': "Let's clarify your project together.",
    '15 dakikalık görüşme ile ihtiyaçlarınızı netleştirip yol haritası çıkaralım.':
      "Let's clarify your needs and build a roadmap in a 15-minute meeting.",
    'Ücretsiz keşif': 'Free discovery',
    'Aynı gün dönüş': 'Same-day response',
    'Hızlı teslim': 'Fast delivery',
    'Başlangıçta net kapsam': 'Clear scope from the start',
    'Şeffaf teslim planı': 'Transparent delivery plan',
    'Yayına kadar teknik sahiplenme': 'Technical ownership until launch',
    'Rezervasyon Al': 'Book Now',
    'Takvimde': 'On the calendar',
    'hızlı görüşme slotu açık.': 'quick meeting slots are open.',
    'Rezervasyon sonrası kapsam + teknik yol haritası aynı gün paylaşılır.':
      'Scope and technical roadmap are shared on the same day after booking.',
    'Takvimi Aç': 'Open Calendar',
    'Ön Analiz Al': 'Get Pre-Analysis',
    'Ürün odaklı yazılım geliştirme, performans iyileştirme ve teknik danışmanlık.':
      'Product-focused software development, performance optimization, and technical consulting.',
    'NDA Uyumlu': 'NDA Compliant',
    Navigasyon: 'Navigation',
    'Hafta içi: 09:30 - 17:30': 'Weekdays: 09:30 - 17:30',
    'Konum: Türkiye (TR)': 'Location: Turkey (TR)',
    'Çalışma Biçimi': 'Working Style',
    'Proje bazlı teslim': 'Project-based delivery',
    'Aylık retainer destek': 'Monthly retainer support',
    'Refactor + performans sprinti': 'Refactor + performance sprint',
    'Tüm hakları saklıdır.': 'All rights reserved.',
    Görüşme: 'Call',
    Kapat: 'Close',
    Teknoloji: 'Technology',
    'Öne Çıkanlar': 'Highlights',
    'Sprint Planı': 'Sprint Plan',
    'Teknik Özet': 'Technical Summary',
    Önceki: 'Previous',
    Sonraki: 'Next',
    'Benzer Proje İsterim': 'I Need a Similar Project'
  };

  Object.assign(I18N_TEXT_EN, {
    Hizmetler: 'Services',
    Rezervasyon: 'Booking',
    'Güvenli veri akışı, kimlik doğrulama ve risk analizi.': 'Secure data flow, authentication, and risk analysis.',
    'Haftalık rapor': 'Weekly report',
    'MVP planı + sprint takvimi': 'MVP plan + sprint schedule',
    'Risk analizi': 'Risk analysis',
    'Keşif & Analiz': 'Discovery & Analysis',
    'Analiz + plan': 'Analysis + Plan',
    'Geniş kapsamlı projelerde analizden yayına kadar tüm aşamaları yönetiyorum. Amacım sadece çalışan bir ürün değil; sürdürülebilir, ölçülebilir ve büyüyen bir sistem kurmak.':
      'In large-scale projects, I manage every stage from analysis to launch. My goal is not just a working product, but a sustainable, measurable, and growing system.',
    'Analiz + yol haritası': 'Analysis + Roadmap',
    'Cal.com veya Calendly bağlantınızı girerek otomatik takvim gösterimi.':
      'Automatic calendar display by entering your Cal.com or Calendly link.',
    Konum: 'Location',
    Hizmet: 'Service',
    '2‑6 hafta': '2-6 weeks',
    '3‑8 hafta': '3-8 weeks',
    '4‑10 hafta': '4-10 weeks',
    '1‑3 hafta': '1-3 weeks',
    '1‑2 hafta': '1-2 weeks',
    '6 hafta': '6 weeks',
    '5 hafta': '5 weeks',
    '7 hafta': '7 weeks',
    '8 hafta': '8 weeks',
    'Hizmet Sektörü': 'Service Industry',
    'Fintech · 6 hafta': 'Fintech · 6 weeks',
    'SaaS · 5 hafta': 'SaaS · 5 weeks',
    'Lojistik · 8 hafta': 'Logistics · 8 weeks',
    'Performans ve altyapı iyileştirmeleriyle 3 hafta içinde üretim ortamında ölçülebilir hız artışı sağlandı.':
      'With performance and infrastructure improvements, measurable speed gains were achieved in production within 3 weeks.',
    'Performans raporu + risk listesi + 2 haftalık aksiyon planı.':
      'Performance report + risk list + 2-week action plan.',
    'Başarı Hikayeleri (Temsili)': 'Success Stories (Representative)',
    'Teknik Metrikler (Temsili)': 'Technical Metrics (Representative)',
    'KPI değerleri anonim ve temsili örneklerden türetilmiştir.':
      'KPI values are derived from anonymized representative examples.',
    'Not: Bu bölüm temsilidir; gerçek projeler gizlilik gereği anonimdir.':
      'Note: This section is representative; real projects are anonymized for confidentiality.'
  });

  Object.assign(I18N_TEXT_EN, {
    'Not: Rozetler temsili örneklerdir, gerçek kurum adı içermez.':
      'Note: Badges are representative examples and do not include real organization names.',
    'Performans Önceliği': 'Performance Priority',
    'Ölçüm, optimizasyon ve gerçek kullanıcı metrikleri ile hızlı deneyim.':
      'Fast experience with measurement, optimization, and real-user metrics.',
    '3G hedefi: < 2 sn': '3G target: < 2 sec',
    'LCP/TTFB takibi': 'LCP/TTFB tracking',
    'Bundle ve cache optimizasyonu': 'Bundle and cache optimization',
    'Güvenlik & Sağlamlık': 'Security & Reliability',
    'Role-based erişim': 'Role-based access',
    'Temel OWASP kontrolleri': 'Core OWASP checks',
    'Log ve audit izi': 'Logs and audit trail',
    'Modüler servisler ve esnek büyüme planı.': 'Modular services and a flexible growth plan.',
    'Modüler API tasarımı': 'Modular API design',
    'Queue / event stratejisi': 'Queue / event strategy',
    'Yük testi kılavuzu': 'Load testing guide',
    Observability: 'Observability',
    'Sorunları erken yakalayan izleme ve uyarı sistemi.': 'Monitoring and alerting system that catches issues early.',
    'APM + tracing': 'APM + tracing',
    'Hata izleme': 'Error tracking',
    'Uyarı eşikleri': 'Alert thresholds',
    'Şeffaf Süreç': 'Transparent Process',
    'Plan, çıktı ve riskleri her adımda görünür kılma.': 'Making plan, output, and risks visible at every step.',
    'Sprint planı': 'Sprint plan',
    'Net teslim kriteri': 'Clear delivery criteria',
    'Kalite Kontrol': 'Quality Control',
    'Test, kod standardı ve yayın öncesi checklist.': 'Testing, code standards, and pre-release checklist.',
    'Review + test': 'Review + test',
    'CI/CD kapıları': 'CI/CD quality gates',
    'Yayın sonrası izleme': 'Post-release monitoring',
    'Yazılımın tüm katmanlarında çözüm: planlama, geliştirme, entegrasyon ve bakım.':
      'Solutions across all software layers: planning, development, integration, and maintenance.',
    'Ürün & MVP Geliştirme': 'Product & MVP Development',
    'Fikir doğrulama, prototip ve hızlı MVP çıkışı için uçtan uca geliştirme.':
      'End-to-end development for idea validation, prototyping, and fast MVP launch.',
    Keşif: 'Discovery',
    MVP: 'MVP',
    Roadmap: 'Roadmap',
    'Çıktı:': 'Output:',
    'Web Uygulamaları': 'Web Applications',
    'Dashboard, yönetim paneli ve müşteri portalı gibi ölçeklenebilir web arayüzleri.':
      'Scalable web interfaces such as dashboards, admin panels, and customer portals.',
    'UI/UX': 'UI/UX',
    Dashboard: 'Dashboard',
    'Ölçeklenebilir web arayüzü': 'Scalable web interface',
    'Backend & API': 'Backend & API',
    'Güvenli ve ölçeklenebilir servisler, kimlik doğrulama ve entegrasyonlar.':
      'Secure and scalable services, authentication, and integrations.',
    API: 'API',
    Auth: 'Auth',
    Entegrasyon: 'Integration',
    'Dokümantasyonlu API katmanı': 'Documented API layer',
    'Mobil Uygulama': 'Mobile App',
    'iOS/Android uygulamaları, offline senaryolar ve bildirim akışları.':
      'iOS/Android apps, offline scenarios, and notification flows.',
    'iOS/Android': 'iOS/Android',
    Offline: 'Offline',
    Push: 'Push',
    'Store‑ready uygulama': 'Store-ready app',
    'DevOps & Cloud': 'DevOps & Cloud',
    'CI/CD, container, izleme, loglama ve maliyet optimizasyonu.':
      'CI/CD, containers, monitoring, logging, and cost optimization.',
    Docker: 'Docker',
    Monitoring: 'Monitoring',
    'Otomatik yayın hattı': 'Automated release pipeline',
    'Otomasyon & Entegrasyon': 'Automation & Integration',
    'CRM/ERP, ödeme, e‑posta ve üçüncü parti sistem entegrasyonları.':
      'CRM/ERP, payment, email, and third-party system integrations.',
    'CRM/ERP': 'CRM/ERP',
    Webhook: 'Webhook',
    Otomasyon: 'Automation',
    'Otomasyon senaryoları': 'Automation scenarios',
    'UI/UX & Tasarım Sistemi': 'UI/UX & Design System',
    'Kullanıcı akışları, wireframe ve tasarım sistemi ile ürün deneyimi tasarımı.':
      'Product experience design with user flows, wireframes, and a design system.',
    'UX Akışı': 'UX Flow',
    Prototip: 'Prototype',
    'Design System': 'Design System',
    'Tasarım sistemi + prototip': 'Design system + prototype',
    'Test & Güvenlik': 'Testing & Security',
    'Fonksiyonel test, performans ölçümü ve temel güvenlik kontrolleri.':
      'Functional tests, performance measurement, and core security checks.',
    QA: 'QA',
    Security: 'Security',
    'Test planı + güvenlik raporu': 'Test plan + security report',
    Hizmet: 'Service',
    'Tipik Teslim': 'Typical Delivery',
    Süre: 'Duration',
    Uygunluk: 'Fit',
    'Ürün & MVP': 'Product & MVP',
    'Prototip + MVP planı': 'Prototype + MVP plan',
    'Hızlı doğrulama': 'Fast validation',
    'Web Uygulama': 'Web App',
    'Dashboard / portal': 'Dashboard / portal',
    'Operasyon ekipleri': 'Operations teams',
    'Servis + dokümantasyon': 'Service + documentation',
    'Entegrasyon yoğun': 'Integration-heavy',
    Mobil: 'Mobile',
    'iOS/Android uygulama': 'iOS/Android app',
    'Saha / tüketici': 'Field / consumer',
    'CI/CD + izleme': 'CI/CD + monitoring',
    'Yayın standardı': 'Release standard',
    'UI/UX Tasarım': 'UI/UX Design',
    'Akış + prototip': 'Flow + prototype',
    'Ürün keşfi': 'Product discovery',
    'Test planı + rapor': 'Test plan + report',
    'Süreler proje kapsamına göre değişir; net plan keşif sonrasında paylaşılır.':
      'Durations vary by project scope; a clear plan is shared after discovery.',
    'Teslimat Tablosu': 'Delivery Matrix',
    'Net süreç, şeffaf çıktı ve ölçülebilir hedeflerle ilerliyoruz.':
      'We move forward with a clear process, transparent outputs, and measurable goals.',
    Faz: 'Phase',
    Not: 'Note',
    'Keşif & Analiz': 'Discovery & Analysis',
    'Kapsam, hedef, teknik ihtiyaç listesi': 'Scope, goals, and technical requirements list',
    '2‑5 gün': '2-5 days',
    'Risk ve önceliklendirme yapılır': 'Risk analysis and prioritization are completed',
    'MVP / Prototip': 'MVP / Prototype',
    'Çalışan demo + kullanıcı akışı': 'Working demo + user flow',
    'Hızlı doğrulama hedeflenir': 'Fast validation is targeted',
    Geliştirme: 'Development',
    'Frontend + backend + entegrasyon': 'Frontend + backend + integration',
    'Modüler ve ölçeklenebilir mimari': 'Modular and scalable architecture',
    'Test & Yayın': 'Testing & Release',
    'QA, performans, güvenlik kontrolleri': 'QA, performance, and security checks',
    '3‑7 gün': '3-7 days',
    'Dokümantasyon ve devir teslim': 'Documentation and handover',
    'İzleme & Bakım': 'Monitoring & Maintenance',
    'Hata izleme, iyileştirme, destek': 'Error tracking, improvements, support',
    Sürekli: 'Continuous',
    'Aylık raporlama opsiyonel': 'Monthly reporting optional',
    'Süreler proje kapsamına göre değişir; kesin plan, keşif sonrası netleşir.':
      'Durations vary by project scope; the final plan is confirmed after discovery.',
    'Seçilmiş Vaka Örnekleri': 'Selected Case Samples',
    'Gerçekçi senaryolarla performans, büyüme ve operasyonel verimlilik odaklı çalışmalar.':
      'Case studies focused on performance, growth, and operational efficiency with realistic scenarios.',
    'Ortalama aktivasyon artışı': 'Average activation increase',
    'Operasyon süresi azalması': 'Operations time reduction',
    'Mobil hedef yükleme süresi': 'Mobile target load time',
    'Benzer çıktıyı kendi ürününüzde görmek için en uygun vaka üzerinden başlayalım.':
      'Let’s start with the best-fit case to achieve similar outcomes for your product.',
    'Benim Vakamı Planla': 'Plan My Case',
    Tümü: 'All',
    Web: 'Web',
    Mobil: 'Mobile',
    Backend: 'Backend',
    'Operasyon Paneli': 'Operations Panel',
    'Ürün Yönetimi': 'Product Management',
    'Saha Uygulaması': 'Field App',
    'Randevu Sistemi': 'Appointment System',
    'Lojistik İzleme': 'Logistics Tracking',
    'Müşteri Destek': 'Customer Support',
    'Teslim Güveni': 'Delivery Confidence',
    'Aktivasyon Skoru': 'Activation Score',
    'Stabilite Skoru': 'Stability Score',
    'Randevu Verimi': 'Appointment Efficiency',
    'SLA Uyum Oranı': 'SLA Compliance Rate',
    'Destek Hızı': 'Support Speed',
    'Sonuçlar ve Güven Kanıtları': 'Outcomes and Trust Proof',
    'Hız, güvenlik ve ölçülebilir sonuçlar odaklı geliştirme.':
      'Delivery focused on speed, security, and measurable outcomes.',
    'Ortalama performans artışı': 'Average performance improvement',
    'Mobilde ortalama yükleme': 'Average mobile load time',
    'Ortalama müşteri puanı': 'Average client rating',
    'Gizlilik sözleşmesi': 'Confidentiality agreement',
    'SLA opsiyonları': 'SLA options',
    'Test senaryoları': 'Test scenarios',
    Performans: 'Performance',
    'CI/CD': 'CI/CD',
    'Ölçülebilir çıktılar ve hızlı teslim odaklı örnek senaryolar.':
      'Representative scenarios focused on measurable outcomes and fast delivery.',
    'Örnek Vaka (Simülasyon)': 'Sample Case (Simulation)',
    'B2B SaaS ürününde hız ve ölçeklenebilirlik': 'Speed and scalability in a B2B SaaS product',
    'Yavaşlanan sayfaları hızlandırmak ve teknik borcu azaltmak.': 'Speed up slow pages and reduce technical debt.',
    'Önbellekleme, sorgu optimizasyonu ve servis ayrıştırma.': 'Caching, query optimization, and service decomposition.',
    'Benzer Çözüm İsterim': 'I Want a Similar Solution',
    'Yanıt süresi iyileşmesi': 'Response time improvement',
    'Onboarding hızlanması': 'Onboarding acceleration',
    'Teslim süresi': 'Delivery time',
    'Cache hit artışı': 'Cache hit increase',
    'Geliştirme + test': 'Development + testing',
    'Yayın + izleme': 'Release + monitoring',
    Hakkımda: 'About',
    'Çok disiplinli, ürün odaklı yazılım geliştirici.': 'Multi-disciplinary, product-focused software developer.',
    'İş hedefleri, kullanıcı akışları ve teknik gereksinimler netleşir.':
      'Business goals, user flows, and technical requirements are clarified.',
    Mimari: 'Architecture',
    'Uygun teknoloji seçimi, ölçek ve güvenlik planı yapılır.':
      'Appropriate technology selection, scale, and security planning.',
    Teslim: 'Delivery',
    'Test, yayın ve izleme süreçleriyle güvenli teslim yapılır.':
      'Secure delivery through testing, release, and monitoring processes.',
    '3G hedef yükleme': '3G target load',
    'Mobil uyum': 'Mobile compatibility',
    'İlk geri dönüş': 'Initial response',
    '“Hedefim: çalışan, güvenli ve sürdürülebilir yazılım.”':
      '"My goal: software that works, stays secure, and scales sustainably."',
    'Teknoloji Yığını': 'Technology Stack',
    'Katman bazlı, ölçeklenebilir ve sürdürülebilir stack matrisi.':
      'Layer-based, scalable, and sustainable stack matrix.',
    Katman: 'Layer',
    Teknolojiler: 'Technologies',
    Odak: 'Focus',
    Frontend: 'Frontend',
    'Performans, erişilebilirlik': 'Performance, accessibility',
    'Modern UI/UX, SSR/SPA': 'Modern UI/UX, SSR/SPA',
    'API tasarımı, güvenlik': 'API design, security',
    'Clean architecture': 'Clean architecture',
    Veri: 'Data',
    'Modelleme, cache': 'Modeling, caching',
    'Performans optimizasyonu': 'Performance optimization',
    'Yayın, izleme': 'Release, monitoring',
    'Otomasyon ve ölçek': 'Automation and scale',
    'Logging, Metrics, Tracing': 'Logging, Metrics, Tracing',
    'Proaktif bakım': 'Proactive maintenance',
    'İhtiyaca göre teknoloji seçimi yapılır; standartlar proje ölçeğine göre uyarlanır.':
      'Technology is selected based on need; standards are adapted to project scale.',
    'Çalışma Modeli': 'Working Model',
    'Uzaktan veya hibrit; proje bazlı ya da sürekli destek.':
      'Remote or hybrid; project-based or continuous support.',
    Saatlik: 'Hourly',
    'Hızlı çözüm ve kısa geliştirmeler.': 'Fast solutions and short development tasks.',
    Esnek: 'Flexible',
    'Hızlı müdahale': 'Rapid intervention',
    'Bakım & iyileştirme': 'Maintenance & improvement',
    'Teknik danışmanlık': 'Technical consulting',
    'Görüşme Al': 'Book a Call',
    'En Popüler': 'Most Popular',
    'Proje Bazlı': 'Project-based',
    'MVP, ürün geliştirme ve entegrasyon.': 'MVP, product development, and integration.',
    Teklif: 'Proposal',
    'Uçtan uca teslim': 'End-to-end delivery',
    'Test + yayın': 'Testing + release',
    'Teklif Al': 'Get a Proposal',
    Retainer: 'Retainer',
    'Sürekli geliştirme ve destek.': 'Continuous development and support.',
    Aylık: 'Monthly',
    'Sürekli bakım': 'Continuous maintenance',
    'Öncelikli destek': 'Priority support',
    'Performans takibi': 'Performance tracking',
    Planlayalım: "Let's plan",
    Özellik: 'Feature'
  });

  Object.assign(I18N_TEXT_EN, {
    Çıktı: 'Output',
    Problem: 'Problem',
    Çözüm: 'Solution',
    Etki: 'Impact',
    'Çok kanallı sipariş yönetimi ve operasyon otomasyonu.':
      'Omnichannel order management and operations automation.',
    '1‑2 kişi': '1-2 people',
    'Rol: Full‑stack': 'Role: Full-stack',
    'S1 Keşif 1hft': 'S1 Discovery 1wk',
    'S2 Entegrasyon 3hft': 'S2 Integration 3wk',
    'S3 Yayın 2hft': 'S3 Launch 2wk',
    'Dağınık sipariş ve manuel süreç': 'Fragmented order flow and manual processes',
    'Tek panel + entegrasyon akışları': 'Single panel + integration flows',
    'Süre %27, hata %18 azaldı': 'Time -27%, error -18%',
    'Onboarding ve ürün analitiği ile aktivasyon artışı.':
      'Activation growth through onboarding and product analytics.',
    '1 kişi': '1 person',
    'S1 UX 1hft': 'S1 UX 1wk',
    'S2 Geliştirme 3hft': 'S2 Development 3wk',
    'S3 Optimizasyon 1hft': 'S3 Optimization 1wk',
    'Düşük aktivasyon oranı': 'Low activation rate',
    'Adım bazlı onboarding + rehber': 'Step-based onboarding + guide',
    'Aktivasyon %21 arttı': 'Activation increased by 21%',
    'Offline-first saha uygulaması ve görev yönetimi.':
      'Offline-first field app and task management.',
    '2 kişi': '2 people',
    'Rol: Mobil + API': 'Role: Mobile + API',
    'S1 Offline 1hft': 'S1 Offline 1wk',
    'S2 Mobil 4hft': 'S2 Mobile 4wk',
    'S3 Test 2hft': 'S3 Testing 2wk',
    'Bağlantı kopmalarında veri kaybı': 'Data loss during connection drops',
    'Offline cache + otomatik senkron': 'Offline cache + automatic sync',
    'Verimlilik %16 arttı': 'Efficiency increased by 16%',
    'Randevu ve CRM otomasyonu ile no‑show azaltma.':
      'Reducing no-show rates with appointment and CRM automation.',
    'S1 Akış 1hft': 'S1 Flow 1wk',
    'S2 Otomasyon 3hft': 'S2 Automation 3wk',
    'Yüksek no‑show oranı': 'High no-show rate',
    'Hatırlatma + kolay yeniden plan': 'Reminders + easy rescheduling',
    'No‑show %19 azaldı': 'No-show decreased by 19%',
    'IoT tabanlı rota izleme ve SLA yönetimi.':
      'IoT-based route tracking and SLA management.',
    '2‑3 kişi': '2-3 people',
    'Rol: Backend': 'Role: Backend',
    'S1 Model 2hft': 'S1 Model 2wk',
    'S2 Streaming 4hft': 'S2 Streaming 4wk',
    'S3 İzleme 2hft': 'S3 Monitoring 2wk',
    'Gecikme takibi yok': 'No delay tracking',
    'Gerçek zamanlı izleme + uyarı': 'Real-time monitoring + alerts',
    'SLA %17 yükseldi': 'SLA increased by 17%',
    'Omni‑channel destek platformu ve SLA yönetimi.':
      'Omnichannel support platform and SLA management.',
    'S2 Panel 3hft': 'S2 Panel 3wk',
    'Dağınık destek kanalları': 'Fragmented support channels',
    'Tek panel + SLA otomasyonu': 'Single panel + SLA automation',
    'İlk yanıt %35 kısaldı': 'First response time improved by 35%',
    '“Süreçleri sadeleştirerek operasyon yükümüz ciddi oranda azaldı.”':
      '"By simplifying processes, our operational load dropped significantly."',
    'Operasyon Ekibi': 'Operations Team',
    'Ürün Yöneticisi': 'Product Manager',
    '“API entegrasyonları sayesinde ekip artık manuel iş yapmıyor.”':
      '"With API integrations, the team no longer does manual work."',
    'SaaS Ekibi': 'SaaS Team',
    '“Mobil performans ve stabilite beklentinin üstünde.”':
      '"Mobile performance and stability exceeded expectations."',
    'Ödeme akışı yeniden tasarlandı': 'Payment flow redesigned',
    'Checkout akışı sadeleştirildi, kritik adımlar hızlandırıldı.':
      'Checkout flow simplified and critical steps accelerated.',
    '+18% dönüşüm': '+18% conversion',
    '-32% terk': '-32% drop-off',
    'Onboarding akışı optimize edildi': 'Onboarding flow optimized',
    'Adım bazlı rehber ve otomatik tetikleyiciler eklendi.':
      'Step-based guidance and automated triggers added.',
    '+21% aktivasyon': '+21% activation',
    'Rota izleme ve uyarılar': 'Route tracking and alerts',
    'Gerçek zamanlı izleme ile gecikme oranı düşürüldü.':
      'Delay rate reduced with real-time monitoring.',
    '-30% gecikme': '-30% delay',
    'Hata Oranı': 'Error Rate',
    'Cache Hit': 'Cache Hit',
    'Uygun Durum': 'Availability',
    'MVP / ürün geliştirme': 'MVP / product development',
    'MVP / Ürün geliştirme': 'MVP / product development',
    'Sürekli gelişim': 'Continuous improvement',
    Planlama: 'Planning',
    'Net yol haritası': 'Clear roadmap',
    'Aylık sprint': 'Monthly sprint',
    'Küçük iyileştirme': 'Small improvements',
    'Stabil büyüme': 'Stable growth',
    'SLA / Destek': 'SLA / Support',
    'İhtiyaç bazlı': 'Needs-based',
    Tanımlı: 'Defined',
    Öncelikli: 'Priority',
    Ödeme: 'Billing',
    Milestone: 'Milestone',
    'Detaylar proje kapsamına göre netleştirilir; teklif görüşmesiyle kesinleşir.':
      'Details are clarified by project scope and finalized during the proposal call.',
    'Örnek Çıktı Paketi': 'Sample Deliverable Package',
    'Kritik Sorun Tespiti': 'Critical Issue Detection',
    'Güvenlik, ölçek ve performans öncelikleri netleşir.':
      'Security, scale, and performance priorities are clarified.',
    'İsterseniz teklif + teslim planı birlikte çıkarılır.':
      'If you want, proposal and delivery plan are prepared together.',
    'Brief Toplama': 'Brief Collection',
    'Hedef, kitle ve teknik durum toplanır.':
      'Goals, audience, and technical context are collected.',
    'Hızlı Teknik Tarama': 'Rapid Technical Scan',
    'Performans, güvenlik ve mimari riskleri çıkarılır.':
      'Performance, security, and architectural risks are identified.',
    'Aksiyon Planı': 'Action Plan',
    'Önceliklendirilmiş yol haritası ve sprint önerisi gönderilir.':
      'A prioritized roadmap and sprint proposal are delivered.',
    'Mini Rapor Önizleme': 'Mini Report Preview',
    'Performans Skoru': 'Performance Score',
    'Risk Seviyesi': 'Risk Level',
    Orta: 'Medium',
    Öncelik: 'Priority',
    Ücretsiz: 'Free',
    'Bilgileriniz gizli tutulur. NDA istenirse memnuniyetle sağlanır.':
      'Your information is kept confidential. NDA is available upon request.',
    'Form tamamlanma: %0': 'Form completion: 0%',
    'Offline, bildirim': 'Offline, notifications',
    'MVP / ürün geliştirme': 'MVP / product development',
    'Web, mobil, backend, entegrasyon, performans ve refactor süreçlerinde destek olabilirim.':
      'I can support web, mobile, backend, integration, performance, and refactor projects.',
    'Kapsam ve hedefler netleşince yol haritası çıkarılır ve süre belirlenir.':
      'Once scope and goals are clear, a roadmap is prepared and timeline is defined.',
    'Evet. Uzaktan veya hibrit çalışmaya uygunum.': 'Yes. I am available for remote or hybrid work.',
    'Evet. Aylık retainer veya ihtiyaç bazlı destek sağlayabilirim.':
      'Yes. I can provide monthly retainer or on-demand support.',
    'E‑Posta': 'Email',
    '© 2026 Muhammet Acar. Tüm hakları saklıdır.': '© 2026 Muhammet Acar. All rights reserved.'
  });

  Object.assign(I18N_TEXT_EN, {
    'Bu hafta uygun zaman': 'Available this week',
    'Takvimde hızlı görüşme slotları açık': 'Fast call slots are open on the calendar',
    '15 dakikalık görüşmede kapsamı netleştirip uygulanabilir teknik yol haritası çıkaralım.':
      "Let's clarify scope in a 15-minute call and define an actionable technical roadmap.",
    'Kapsam + teslim planı': 'Scope + delivery plan',
    'Teknik yol haritası': 'Technical roadmap',
    'Yayın sonrası destek': 'Post-launch support',
    'İlk teknik yanıt': 'First technical response',
    '3 adım': '3 steps',
    'Keşif → Plan → Teslim': 'Discovery → Plan → Delivery',
    'Hedef uptime standardı': 'Target uptime standard'
  });

  Object.assign(I18N_TEXT_EN, {
    'Premium Teklif Paketleri': 'Premium Offer Packages',
    'Yüksek etkili projeler için net kapsam, net teslim ve ölçülebilir çıktı odaklı paketler.':
      'Packages focused on clear scope, clear delivery, and measurable outputs for high-impact projects.',
    'Hızlı gelir odaklı iyileştirme': 'Fast revenue-focused improvement',
    'Dönüşüm, hız ve teknik borç azaltımı için 3-5 haftalık odak sprint.':
      'A focused 3-5 week sprint for conversion, speed, and technical debt reduction.',
    'Performans + UX kritik iyileştirmeler': 'Performance + UX critical improvements',
    'Yayın sonrası 2 hafta destek': '2 weeks of post-launch support',
    'Bu Paketi Planla': 'Plan This Package',
    'Uçtan uca ürün + satış altyapısı': 'End-to-end product + sales infrastructure',
    'Web/mobil ürün + rezervasyon + lead yönetimi + otomasyon içeren ana paket.':
      'Core package including web/mobile product + booking + lead management + automation.',
    'Ürün geliştirme + entegrasyon': 'Product development + integration',
    'Lead qualification + CRM çıkışı': 'Lead qualification + CRM export',
    '60 gün optimizasyon desteği': '60 days optimization support',
    'Ana Paketi Görüş': 'Discuss Main Package',
    'Aylık teknik büyüme partnerliği': 'Monthly technical growth partnership',
    'Sürekli geliştirme, release yönetimi ve teknik yönetişim için retainer model.':
      'Retainer model for continuous development, release management, and technical governance.',
    'Öncelikli destek SLA': 'Priority support SLA',
    'Roadmap ve ekip mentörlüğü': 'Roadmap and team mentoring',
    'Retainer Başlat': 'Start Retainer',
    'Detaylı Vaka Sayfaları': 'Detailed Case Pages',
    'Satış görüşmelerinde paylaşabileceğiniz, gerçekçi ve yapılandırılmış case sayfaları.':
      'Realistic and structured case pages you can share in sales meetings.',
    'Vaka Sayfasını Aç': 'Open Case Page',
    'Benzerini Planla': 'Plan Similar Project',
    'Satış KPI Paneli': 'Sales KPI Panel',
    'Lead kalitesini, rezervasyon dönüşümünü ve takip durumunu tek panelde izleyin.':
      'Track lead quality, booking conversion, and follow-up status in one panel.',
    'Toplam Lead': 'Total Leads',
    'Nitelikli Lead': 'Qualified Leads',
    'Rezervasyon': 'Bookings',
    'Nitelikli Oran': 'Qualification Rate',
    'CRM CSV İndir': 'Download CRM CSV',
    'Panel Verisini Temizle': 'Clear Panel Data',
    'Kanal': 'Channel',
    Skor: 'Score',
    Durum: 'Stage',
    'Sonraki Aksiyon': 'Next Action',
    'Henüz lead kaydı yok.': 'No lead records yet.',
    'Panel verileri tarayıcıda lokal olarak tutulur ve CSV olarak dışa aktarılabilir.':
      'Panel data is stored locally in the browser and can be exported as CSV.',
    'Bütçe Seviyesi': 'Budget Level',
    'Hedef Yayın Zamanı': 'Target Launch Timeline',
    'Karar Rolü': 'Decision Role',
    'Öncelik Seviyesi': 'Priority Level',
    'Kurucu / Ortak': 'Founder / Partner',
    'C-Level / Yönetici': 'C-Level / Executive',
    'Ürün / Proje Yöneticisi': 'Product / Project Manager',
    'Teknik Ekip': 'Technical Team',
    Yüksek: 'High',
    Düşük: 'Low'
  });

  Object.assign(I18N_TEXT_EN, {
    'Büyüme Sprinti': 'Growth Sprint',
    'Gelir Motoru': 'Revenue Engine',
    'Ölçekleme Partneri': 'Scale Partner',
    'Haftalık KPI raporu': 'Weekly KPI report',
    'Aylık sprint planlama': 'Monthly sprint planning',
    '₺90.000 - ₺180.000': 'TRY 90,000 - 180,000',
    '₺220.000 - ₺600.000': 'TRY 220,000 - 600,000',
    '₺75.000 / ay+': 'TRY 75,000 / month+',
    'Operasyon süresi %27 azaldı, hata oranı %18 düştü.': 'Operation time dropped 27%, error rate dropped 18%.',
    'Aktivasyon %21 arttı, churn %12 azaldı.': 'Activation up 21%, churn down 12%.',
    'Veri kaybı %40 azaldı, saha verimliliği %16 arttı.': 'Data loss down 40%, field efficiency up 16%.',
    '₺100.000 altı': 'Under TRY 100,000',
    '₺100.000 - ₺300.000': 'TRY 100,000 - 300,000',
    '₺300.000 - ₺750.000': 'TRY 300,000 - 750,000',
    '₺750.000+': 'TRY 750,000+',
    '0-30 gün': '0-30 days',
    '31-60 gün': '31-60 days',
    '61-90 gün': '61-90 days',
    '90+ gün': '90+ days'
  });

  Object.assign(I18N_TEXT_EN, {
    'Kurumsal Güven Paketi': 'Enterprise Trust Package',
    'Teklif öncesi karar hızını artırmak için paylaşılan doğrulama materyalleri.':
      'Verification materials shared to speed up pre-proposal decisions.',
    'NDA Sonrası Canlı Demo': 'Live Demo After NDA',
    'Gerçek kod tabanı ve teslim süreçleri ekran paylaşımıyla gösterilir.':
      'Real codebase and delivery process are shown via screen share.',
    'Teknik Due Diligence Özeti': 'Technical Due Diligence Summary',
    'Mimari, güvenlik, performans ve risk başlıkları ölçülebilir metriklerle sunulur.':
      'Architecture, security, performance, and risk areas are presented with measurable metrics.',
    'Referans Doğrulama Görüşmesi': 'Reference Verification Call',
    'Uygun projelerde, NDA kapsamında referans doğrulama çağrısı planlanır.':
      'For suitable projects, a reference verification call is planned under NDA.',
    'Referans Doğrulama Talep Et': 'Request Reference Verification',
    'Karar Görüşmesi Planla': 'Schedule Decision Call',
    'Not: Gizlilik nedeniyle müşteri isimleri açık yayınlanmaz; doğrulama görüşme sırasında yapılır.':
      'Note: Client names are not publicly listed due to confidentiality; verification happens during the call.'
  });

  Object.assign(I18N_TEXT_EN, {
    Fiyatlar: 'Pricing',
    'Hızlı Erişim': 'Quick Access',
    'Hizmet, fiyat, proje ve rezervasyon alanlarına tek tıkla geçin.':
      'Jump to services, pricing, projects, and booking with one click.',
    'Web, mobil, backend, entegrasyon': 'Web, mobile, backend, integrations',
    'Paketler ve bütçe aralıkları': 'Packages and budget ranges',
    'Gerçekçi vaka ve çıktılar': 'Realistic cases and outcomes',
    '15 dakikada görüşme planla': 'Book a call in 15 minutes',
    'Net kapsam, hızlı teslim, sürdürülebilir yazılım.': 'Clear scope, fast delivery, sustainable software.',
    'Hedefe göre doğru mimariyi kurup web, mobil ve backend ürünleri uçtan uca teslim ediyorum.':
      'I design the right architecture for your goals and deliver web, mobile, and backend products end-to-end.'
  });

  Object.assign(I18N_TEXT_EN, {
    'İhtiyacınıza göre uçtan uca yazılım hizmeti': 'End-to-end software services tailored to your needs',
    'Planlama, geliştirme, entegrasyon ve bakım katmanlarında net teslim odaklı çalışıyorum.':
      'I work with clear delivery focus across planning, development, integration, and maintenance.',
    'Fiyatlandırmayı Gör': 'View Pricing',
    'Bütçenize uygun net paketler': 'Clear packages aligned with your budget',
    'Paket kapsamları, teslim ritmi ve bütçe aralıkları net şekilde sunulur.':
      'Package scope, delivery cadence, and budget ranges are presented clearly.',
    'Hizmetleri Gör': 'View Services',
    'Teklif Görüşmesi': 'Proposal Call',
    'Gerçekçi vaka kütüphanesi': 'Realistic case library',
    'Her vaka: problem, çözüm ve ölçülebilir etki formatında hazırlanmıştır.':
      'Each case is prepared in problem, solution, and measurable impact format.',
    'Fiyatları Gör': 'View Pricing',
    '15 dakikada teknik keşif görüşmesi': 'Technical discovery call in 15 minutes',
    'Hedeflerinizi netleştirip kapsam ve sonraki teknik adımı birlikte belirleyelim.':
      'Let’s clarify your goals and define scope with the next technical step together.',
    'Paketleri İncele': 'Review Packages',
    'Önce Mesaj Gönder': 'Send Message First',
    '24 saat içinde kısa teknik değerlendirme': 'Short technical assessment within 24 hours',
    'Mevcut ürününüz için riskleri, fırsatları ve hızlı aksiyon planını çıkaralım.':
      'Let’s map risks, opportunities, and a fast action plan for your current product.',
    'Vaka Örnekleri': 'Case Examples',
    'Kısa bir özet paylaşın, aynı gün içinde uygulanabilir bir sonraki adımı ileteyim.':
      'Share a short brief and I will send an actionable next step the same day.',
    'Direkt Rezervasyon': 'Direct Booking'
  });

  Object.assign(I18N_TEXT_EN, {
    'Site Haritası': 'Sitemap'
  });

  Object.assign(I18N_TEXT_EN, {
    'Ana Navigasyon': 'Main Navigation',
    'Ana Sayfa Bölümleri': 'Home Sections',
    'Hızlı Erişim': 'Quick Access',
    'Hero ve Değer Önerisi': 'Hero and Value Proposition',
    'Hizmet ve Fiyat Sayfaları': 'Services and Pricing Pages',
    'Hizmet Kataloğu': 'Service Catalog',
    'Paketler ve Fiyatlar': 'Packages and Pricing',
    'Proof Pack / Karar Desteği': 'Proof Pack / Decision Support',
    'Proje ve Vaka Arşivi': 'Project and Case Archive',
    'Vaka Kütüphanesi': 'Case Library',
    'Detaylı Proje Kartları': 'Detailed Project Cards',
    'Dönüşüm Akışları': 'Conversion Flows',
    'Satış KPI Paneli': 'Sales KPI Panel',
    'Son CTA Bölümü': 'Final CTA Section',
    'Destek ve Bilgi': 'Support and Information',
    'İletişim Kanalları': 'Contact Channels',
    'Ücretsiz Teknik Analiz': 'Free Technical Analysis',
    'Görüşme Planlama': 'Meeting Scheduling',
    'Dil Sürümleri (EN)': 'Language Versions (EN)',
    'Teknik ve SEO Dosyaları': 'Technical and SEO Files',
    'Headers Kuralları': 'Header Rules',
    'Bölüm': 'Section',
    Amaç: 'Purpose',
    'Tüm sayfalar ve hızlı geçiş bağlantıları': 'All pages and quick access links',
    "Navbar'da sade tuttuğumuz tüm kritik sayfalar burada kapsamlı şekilde listelenir.":
      'All critical pages we keep simplified in the navbar are listed here in detail.',
    'Teknik kapsam ve servis kategorileri': 'Technical scope and service categories',
    'Paket seçenekleri ve karar destek içerikleri': 'Package options and decision-support assets',
    'Vaka odaklı güven katmanı ve referans akışı': 'Case-focused trust layer and reference flow',
    'Takvim seçimi, lead toplama ve onay süreci': 'Calendar selection, lead capture, and confirmation flow',
    'İlk temas için düşük bariyerli giriş noktası': 'Low-friction entry point for first contact',
    'Alternatif iletişim kanalı ve SSS bölümü': 'Alternative contact channel and FAQ section',
    'Vaka Detayı': 'Case Detail',
    'Her vaka için ayrı detay, metrik ve teslim planı': 'Per-case detail, metrics, and delivery plan',
    'Kararsız kalırsanız ücretsiz analiz formunda hedef ve bütçe aralığını paylaşmanız yeterlidir.':
      'If you are unsure, sharing your target and budget range in the free analysis form is enough.',
    'Not: sitemap.xml arama motorları için teknik kayıttır; bu sayfa kullanıcı odaklı gezinme katmanıdır.':
      'Note: sitemap.xml is the technical index for search engines; this page is the user-facing navigation layer.',
    'Paket': 'Package',
    'Süre': 'Duration',
    'Odak': 'Focus',
    'İdeal Kullanım': 'Ideal Use',
    'Dönüşüm + performans': 'Conversion + performance',
    'Hızlı gelir artışı ve teknik borç azaltımı': 'Fast revenue uplift and technical debt reduction',
    '3-5 hafta': '3-5 weeks',
    '6-12 hafta': '6-12 weeks',
    Aylık: 'Monthly',
    'Ürün + satış altyapısı': 'Product + sales infrastructure',
    'Yeni ürün / kanal kurulumu ve ölçeklenebilir büyüme': 'New product/channel setup and scalable growth',
    'Sürekli geliştirme': 'Continuous development',
    'Canlı ürünlerde istikrarlı hız ve teknik yönetişim': 'Consistent velocity and technical governance in live products'
  });

  Object.assign(I18N_TEXT_EN, {
    'Gelir ve operasyon odaklı yazılım sistemleri geliştiriyorum': 'I build software systems focused on revenue and operations',
    'Ürün hedeflerinize göre web, mobil ve backend katmanlarını birlikte planlayıp teslim ediyorum.':
      'I plan and deliver web, mobile, and backend layers together based on your product goals.',
    'Teknik borcu azaltan, dönüşümü artıran ve operasyonu sadeleştiren sistemler kuruyorum.':
      'I build systems that reduce technical debt, increase conversion, and simplify operations.',
    '15 dk Görüşme Planla': 'Book a 15m Call',
    'Vaka Örneklerini Gör': 'View Case Examples',
    '24 saatte ilk dönüş': 'First response in 24h',
    'NDA uyumlu': 'NDA compliant',
    '8+ yıldır üretim odaklı geliştirme': '8+ years of production-focused development',
    'Anonimleştirilmiş Proje Örnekleri': 'Anonymized Project Examples',
    'Gizlilik nedeniyle kurum adları paylaşılmadan, karar sürecini destekleyen net vaka formatı.':
      'A clear case format supporting decisions without sharing company names due to confidentiality.',
    'Ne yaptım': 'What I did',
    'Ne yaptım:': 'What I did:',
    'E-posta': 'Email',
    'Sonuç': 'Outcome',
    Stack: 'Stack',
    '3 Ana Hizmet Modeli': '3 Core Service Models',
    'Karar yorgunluğu olmadan hızlı konumlanmanız için ana teklifleri sadeleştirdim.':
      'I simplified the core offers so you can position quickly without decision fatigue.',
    'MVP / Yeni Ürün': 'MVP / New Product',
    'Performans / Refactor Sprint': 'Performance / Refactor Sprint',
    'Aylık Teknik Partnerlik': 'Monthly Technical Partnership',
    'Neler dahil?': 'What is included?',
    'Görüşmeyi Sabitle': 'Confirm Meeting',
    'Sprint Planla': 'Plan Sprint',
    'Partnerlik Görüşmesi': 'Partnership Call',
    '3 Kısa Vaka Özeti': '3 Short Case Summaries',
    'Toplantı öncesi hızlı inceleme için özet formatı.': 'A summary format for quick pre-meeting review.',
    'Detayı Aç': 'Open Details',
    'Çalışma Süreci': 'Work Process',
    'Teknik ve operasyonel belirsizliği azaltan 3 adımlı akış.':
      'A 3-step flow that reduces technical and operational ambiguity.',
    'Kapsam ve Hedef': 'Scope and Goal',
    'Geliştirme ve Teslim': 'Build and Delivery',
    'Yayın ve İyileştirme': 'Release and Improvement',
    'Takvimden uygun zamanı seçin': 'Pick your suitable time in calendar',
    'Tek görüşmede kapsamı netleştirip uygulanabilir teknik plan çıkaralım.':
      'Let us define scope in one call and produce an actionable technical plan.',
    '15 dakikalık odak görüşme': '15-minute focused call',
    '24 saat içinde yazılı özet': 'Written summary within 24h',
    'Net sonraki adım planı': 'Clear next-step plan',
    'Tek kanal ve net yanıt süresi ile hızlı dönüş.': 'Fast response with one channel and clear response SLA.',
    'Yanıt Süresi': 'Response Time',
    '24 saat içinde geri dönüş': 'Response within 24h',
    'Hizmet Başlığı': 'Service Topic',
    'Teklif İste': 'Request Proposal',
    'Takvimden slot seçin, görüşmeyi sabitleyin': 'Choose a slot from the calendar and lock the meeting',
    'Birincil akış takvim odaklıdır. Slot seçiminden sonra 60 saniyelik mini form ile görüşmeyi netleştiririz.':
      'Primary flow is calendar-first. After selecting a slot, we finalize with a 60-second mini form.',
    '60 saniyelik mini form': '60-second mini form',
    'Slot seçiminiz sonrası kısa bilgiler yeterlidir. Onay e-postası otomatik gönderilir.':
      'After slot selection, short details are enough. Confirmation email is sent automatically.',
    'Takvimi Yeni Sekmede Aç': 'Open Calendar in New Tab',
    'Tek odaklı akış': 'Single-focus flow',
    'Takvim ana akıştır; karar noktasında gereksiz adım yoktur.':
      'Calendar is the main flow; there are no unnecessary steps at decision point.',
    'Gizlilik odaklı': 'Confidentiality-first',
    'Paylaşılan bilgiler gizli değerlendirme kapsamında işlenir.':
      'Shared information is handled under confidential evaluation.',
    'Net sonraki adım': 'Clear next step',
    'Görüşme sonrası kapsam, teslim planı ve öncelik listesi paylaşılır.':
      'After the meeting, scope, delivery plan, and priority list are shared.'
  });

  // Clean TR->EN keys for revised home and booking copy.
  Object.assign(I18N_TEXT_EN, {
    'Gelir ve operasyon odaklı yazılım sistemleri geliştiriyorum': 'I build software systems focused on revenue and operations',
    'Ürün hedeflerinize göre web, mobil ve backend katmanlarını birlikte planlayıp teslim ediyorum.':
      'I plan and deliver web, mobile, and backend layers together based on your product goals.',
    'Teknik borcu azaltan, dönüşümü artıran ve operasyonu sadeleştiren sistemler kuruyorum.':
      'I build systems that reduce technical debt, increase conversion, and simplify operations.',
    '15 dk Görüşme Planla': 'Book a 15m Call',
    'Vaka Örneklerini Gör': 'View Case Examples',
    '24 saatte ilk dönüş': 'First response in 24h',
    '8+ yıldır üretim odaklı geliştirme': '8+ years of production-focused development',
    'Gizlilik nedeniyle kurum adları paylaşılmadan, karar sürecini destekleyen net vaka formatı.':
      'A clear case format supporting decisions without sharing company names due to confidentiality.',
    'COO, perakende operasyon ekibi': 'COO, retail operations team',
    'Founder, hizmet platformu': 'Founder, service platform',
    'Ne yaptım': 'What I did',
    Sonuç: 'Outcome',
    'Sipariş operasyonu dağınık ve hata oranı yüksekti.': 'Order operations were fragmented and error rates were high.',
    'Tek panel operasyon ve stok/kargo otomasyon akışları kurdum.':
      'I built a single operations panel with stock and shipping automation flows.',
    'Süre %27 azaldı, operasyon hatası %18 düştü.': 'Cycle time dropped 27% and operational errors decreased 18%.',
    'Onboarding sonrası aktivasyon düşüktü, churn yüksekti.': 'Post-onboarding activation was low and churn was high.',
    'Event bazlı onboarding ve aktivasyon odaklı ürün akışı tasarladım.':
      'I designed an event-based onboarding flow focused on activation.',
    'Aktivasyon %21 arttı, churn %12 azaldı.': 'Activation increased 21% and churn decreased 12%.',
    'Saha ekiplerinde offline kullanımda veri kaybı yaşanıyordu.':
      'Field teams were losing data during offline usage.',
    'Offline-first mobil veri katmanı ve güvenli senkron akışı geliştirdim.':
      'I developed an offline-first mobile data layer with secure sync.',
    'Veri kaybı %40 azaldı, saha verimliliği %16 arttı.': 'Data loss dropped 40% and field efficiency increased 16%.',
    'Karar yorgunluğu olmadan hızlı konumlanmanız için ana teklifleri sadeleştirdim.':
      'I simplified core offers so you can position quickly without decision fatigue.',
    'Fikirden yayına kadar uçtan uca ürün geliştirme modeli.': 'End-to-end product development from idea to launch.',
    'Keşif ve kapsam netleştirme': 'Discovery and scope definition',
    'Web veya mobil ürün geliştirme': 'Web or mobile product development',
    'API ve temel entegrasyonlar': 'API and core integrations',
    'Canlı üründe hız, kalite ve sürdürülebilirlik odaklı kısa sprint.':
      'A short sprint focused on speed, quality, and sustainability in live products.',
    'Kritik dar boğaz analizi': 'Critical bottleneck analysis',
    'Refactor ve performans iyileştirmesi': 'Refactor and performance optimization',
    'Ölçümleme ve teknik raporlama': 'Measurement and technical reporting',
    'Sürekli geliştirme, release yönetimi ve teknik karar desteği.':
      'Continuous development, release management, and technical decision support.',
    'Aylık sprint ve öncelik planı': 'Monthly sprint and priority plan',
    'Yayın ve stabilite takibi': 'Release and stability tracking',
    'Ekiple teknik mentorluk': 'Technical mentoring for the team',
    'Toplantı öncesi hızlı inceleme için özet formatı.': 'A summary format for quick pre-meeting review.',
    'Sipariş süreçleri dağınıktı.': 'Order flows were fragmented.',
    'Operasyon paneli ve entegrasyon akışları.': 'Operations dashboard and integration flows.',
    'Süre %27, hata %18 azaldı.': 'Cycle time dropped 27%, errors dropped 18%.',
    'Aktivasyon düşüktü.': 'Activation was low.',
    'Onboarding akışı ve event analitiği.': 'Onboarding flow and event analytics.',
    'Aktivasyon %21 arttı.': 'Activation increased 21%.',
    'Offline veri kayıpları yaşanıyordu.': 'Offline data loss was occurring.',
    'Offline cache ve güvenli senkron.': 'Offline cache and secure sync.',
    'Veri kaybı %40 azaldı.': 'Data loss decreased 40%.',
    'Teknik ve operasyonel belirsizliği azaltan 3 adımlı akış.':
      'A 3-step flow that reduces technical and operational uncertainty.',
    'İlk görüşmede kapsam, risk ve başarı ölçütlerini netleştiririz.':
      'In the first call, we align on scope, risk, and success criteria.',
    'Sprint bazlı ilerler, kritik çıktıları düzenli paylaşırım.':
      'I progress in sprints and share critical outputs regularly.',
    'Canlıya alım sonrası performans ve stabilite iyileştirmesi yapılır.':
      'After release, performance and stability improvements continue.',
    'Takvimden uygun zamanı seçin': 'Pick your suitable time in calendar',
    'Tek görüşmede kapsamı netleştirip uygulanabilir teknik plan çıkaralım.':
      'Let us define scope in one call and produce an actionable technical plan.',
    '15 dakikalık odak görüşme': '15-minute focused call',
    '24 saat içinde yazılı özet': 'Written summary within 24h',
    'Net sonraki adım planı': 'Clear next-step plan',
    'Karar sürecinde en çok sorulan başlıklar.': 'Most asked topics in the decision process.',
    'Ne kadar sürede başlıyoruz?': 'How quickly do we start?',
    'Görüşme sonrası kapsam netleştiğinde aynı hafta içinde sprint planına başlarız.':
      'Once scope is clear after the meeting, we start sprint planning within the same week.',
    'Uzaktan veya hibrit çalışma mümkün mü?': 'Is remote or hybrid work possible?',
    'Evet. Uzaktan veya hibrit çalışma modeliyle ilerleyebilirim.':
      'Yes. I can work with remote or hybrid collaboration.',
    'NDA süreci nasıl ilerliyor?': 'How does the NDA process work?',
    'İhtiyaç halinde karşılıklı NDA ile teknik detay paylaşımına geçilir.':
      'When needed, technical details are shared under a mutual NDA.',
    'Bakım ve destek veriyor musunuz?': 'Do you provide maintenance and support?',
    'Evet. Proje sonrası aylık teknik partnerlik veya ihtiyaç bazlı destek sunuyorum.':
      'Yes. I provide monthly technical partnership or need-based support after launch.',
    'Tek kanal ve net yanıt süresi ile hızlı dönüş.': 'Fast response with one channel and clear response SLA.',
    'Takvimden slot seçin, görüşmeyi sabitleyin': 'Choose a slot from the calendar and lock the meeting',
    'Birincil akış takvim odaklıdır. Slot seçiminden sonra 60 saniyelik mini form ile görüşmeyi netleştiririz.':
      'Primary flow is calendar-first. After selecting a slot, we finalize with a 60-second mini form.',
    'Uygun tarih ve saati seçin. Takvim bağlantısı doğrudan canlı akışa bağlıdır.':
      'Pick your date and time. Calendar link is directly connected to the live flow.',
    'Takvim yükleniyor...': 'Loading calendar...',
    'Takvimi Yeni Sekmede Aç': 'Open Calendar in New Tab',
    'Slot seçiminiz sonrası kısa bilgiler yeterlidir. Onay e-postası otomatik gönderilir.':
      'After slot selection, short details are enough. Confirmation email is sent automatically.',
    'Kısa Not': 'Short Note',
    'Takvim ana akıştır; karar noktasında gereksiz adım yoktur.':
      'Calendar is the main flow; there are no unnecessary steps at decision point.',
    'Paylaşılan bilgiler gizli değerlendirme kapsamında işlenir.':
      'Shared information is handled under confidential evaluation.',
    'Görüşme sonrası kapsam, teslim planı ve öncelik listesi paylaşılır.':
      'After the meeting, scope, delivery plan, and priority list are shared.'
  });

  const I18N_TEXT_EN_LOOKUP = buildLookup(I18N_TEXT_EN);

  const I18N_ATTR_EN = {
    placeholder: {
      'Örn. Deniz Kaya': 'e.g. John Doe',
      'ornek@email.com': 'example@email.com',
      'Hedef kitlenizi ve istediğiniz sonucu kısaca yazın': 'Briefly describe your target audience and desired outcome',
      '+90 5xx xxx xx xx': '+90 / +1 ...',
      'Örn. Fintech SaaS': 'e.g. Fintech SaaS',
      'Kısa bir özet ekleyin': 'Add a short summary',
      'https://cal.com/kullanici/15min': 'https://cal.com/username/15min',
      'Kısaca ihtiyacınızı paylaşın': 'Briefly share your needs'
    },
    ariaLabel: {
      'Ana Sayfa': 'Home',
      'Hızlı rezervasyon bilgisi': 'Quick booking info',
      'Proje filtreleri': 'Project filters',
      'Analiz süreci': 'Analysis process',
      Kapat: 'Close',
      'Switch language': 'Switch language'
    },
    title: {
      Dolu: 'Full'
    }
  };

  const I18N_ATTR_EN_LOOKUP = {
    placeholder: buildLookup(I18N_ATTR_EN.placeholder),
    ariaLabel: buildLookup(I18N_ATTR_EN.ariaLabel),
    title: buildLookup(I18N_ATTR_EN.title)
  };

  const I18N_META = {
    tr: {
      title: 'Muhammet Acar | Senior Full‑Stack Developer',
      description: 'Senior full-stack developer: web, mobil, backend, DevOps ve entegrasyon çözümleriyle ürünleri hızlı ve güvenli yayına taşıyorum.',
      ogDescription: 'Ürün odaklı web, mobil ve backend çözümleri. Hızlı keşif, net plan, güvenli teslim.',
      twitterDescription: 'Web, mobil ve backend ürün geliştirme. Hızlı keşif, net teslim planı.',
      ogLocale: 'tr_TR'
    },
    en: {
      title: 'Muhammet Acar | Senior Full-Stack Developer',
      description: 'Senior full-stack developer delivering web, mobile, backend, DevOps, and integration solutions with speed and reliability.',
      ogDescription: 'Product-focused web, mobile, and backend solutions. Fast discovery, clear plan, secure delivery.',
      twitterDescription: 'Web, mobile, and backend product development. Fast discovery and clear delivery plan.',
      ogLocale: 'en_US'
    }
  };

  const I18N_MESSAGES = {
    tr: {
      form_completion: 'Form tamamlanma: %{percent}',
      loading_short: 'Gönderiliyor...',
      booking_received: 'Rezervasyon alındı.',
      cooldown_wait: 'Lütfen %{seconds} sn sonra tekrar deneyin.',
      booking_pick_datetime: 'Lütfen önce tarih ve saat seçin.',
      booking_slot_unavailable: 'Seçilen saat artık uygun değil. Lütfen farklı bir saat seçin.',
      booking_sending: 'Rezervasyon gönderiliyor...',
      booking_emailjs_pending: 'Rezervasyon alındı. EmailJS ayarları tamamlanmalı.',
      booking_confirm_sent: 'Rezervasyon alındı. Onay e-postası gönderildi.',
      send_error: 'Gönderim sırasında hata oluştu. Tekrar deneyin.',
      selected_slot: 'Seçili slot: %{date} - %{time}',
      booking_lock_copy: 'Formu göndererek bu slotu sabitleyebilirsiniz.',
      booking_complete: 'Görüşmeyi Sabitle',
      booking_wait_title: '%{date} için saat seçimi bekleniyor.',
      booking_wait_copy: 'Uygun saatlerden birini seçin, sonra bilgilerinizi gönderin.',
      pick_time: 'Saat Seç',
      quick_discovery_limited: 'Bu hafta hızlı keşif için sınırlı slot var.',
      booking_default_copy: 'Tarih ve saat seçtiğinizde takvim davetinizi anında sabitliyoruz.',
      quick_slot: 'Hızlı Slot Seç',
      no_selected_time: 'Seçilen zaman yok',
      selected_time: 'Seçilen zaman',
      slots_hint: 'Tarih seçtiğinizde uygun saatler listelenecek.',
      slot_full: 'Dolu',
      iframe_title_booking: 'Rezervasyon Takvimi',
      saved_url_loaded: 'Kayıtlı URL yüklendi.',
      calendar_url_saved: 'Takvim URL kaydedildi.',
      invalid_calendar_url: 'Geçersiz URL. Cal.com veya Calendly URL kullanın.',
      brief_preparing: 'Brief hazırlanıyor...',
      sample_preparing: 'Örnek rapor hazırlanıyor...',
      brief_pdf_downloaded: 'Brief PDF indirildi.',
      sample_pdf_downloaded: 'Örnek PDF indirildi.',
      brief_txt_downloaded: 'PDF oluşmadı; brief.txt indirildi.',
      sample_txt_downloaded: 'PDF oluşmadı; ornek-rapor.txt indirildi.',
      request_received_24h: 'Talebiniz alındı. 24 saat içinde geri dönüş sağlanacak.',
      message_sent: 'Mesajınız gönderildi.',
      contact_form_label: 'İletişim Formu',
      message_sending: 'Mesaj gönderiliyor...',
      message_emailjs_pending: 'Mesaj alındı. EmailJS ayarı tamamlanmalı.',
      send_failed_retry: 'Gönderim başarısız. Lütfen tekrar deneyin.',
      embed_pending: 'Bekleniyor',
      embed_not_ready: 'Hazır değil',
      embed_passive: 'Pasif',
      embed_valid_url: 'Geçerli URL',
      embed_waiting: 'Beklemede',
      embed_ready: 'Hazır',
      embed_connecting: 'Bağlanıyor...',
      embed_preparing: 'Hazırlanıyor',
      embed_verified: 'Doğrulandı',
      embed_live: 'Canlı',
      embed_active: 'Aktif',
      embed_invalid_url: 'Geçersiz URL',
      embed_failed: 'Başarısız',
      embed_stopped: 'Durduruldu',
      pipeline_clear_confirm: 'Panel verisi temizlensin mi?'
    },
    en: {
      form_completion: 'Form completion: %{percent}',
      loading_short: 'Sending...',
      booking_received: 'Booking received.',
      cooldown_wait: 'Please try again in %{seconds} sec.',
      booking_pick_datetime: 'Please select date and time first.',
      booking_slot_unavailable: 'Selected time is no longer available. Please choose another slot.',
      booking_sending: 'Sending booking...',
      booking_emailjs_pending: 'Booking received. EmailJS setup is still required.',
      booking_confirm_sent: 'Booking received. Confirmation email has been sent.',
      send_error: 'A sending error occurred. Please try again.',
      selected_slot: 'Selected slot: %{date} - %{time}',
      booking_lock_copy: 'Submit the form to lock this slot.',
      booking_complete: 'Confirm Meeting',
      booking_wait_title: 'Waiting for time selection on %{date}.',
      booking_wait_copy: 'Choose one of the available times, then submit your details.',
      pick_time: 'Pick Time',
      quick_discovery_limited: 'Limited discovery slots are available this week.',
      booking_default_copy: 'When you choose date and time, your calendar invite is locked instantly.',
      quick_slot: 'Quick Slot',
      no_selected_time: 'No selected time',
      selected_time: 'Selected time',
      slots_hint: 'Available times will be listed after you choose a date.',
      slot_full: 'Full',
      iframe_title_booking: 'Booking Calendar',
      saved_url_loaded: 'Saved URL loaded.',
      calendar_url_saved: 'Calendar URL saved.',
      invalid_calendar_url: 'Invalid URL. Please use a Cal.com or Calendly URL.',
      brief_preparing: 'Preparing brief...',
      sample_preparing: 'Preparing sample report...',
      brief_pdf_downloaded: 'Brief PDF downloaded.',
      sample_pdf_downloaded: 'Sample PDF downloaded.',
      brief_txt_downloaded: 'PDF failed; brief.txt downloaded.',
      sample_txt_downloaded: 'PDF failed; sample-report.txt downloaded.',
      request_received_24h: 'Request received. You will get a response within 24 hours.',
      message_sent: 'Your message has been sent.',
      contact_form_label: 'Contact Form',
      message_sending: 'Sending message...',
      message_emailjs_pending: 'Message received. EmailJS setup is still required.',
      send_failed_retry: 'Sending failed. Please try again.',
      embed_pending: 'Pending',
      embed_not_ready: 'Not ready',
      embed_passive: 'Passive',
      embed_valid_url: 'Valid URL',
      embed_waiting: 'Waiting',
      embed_ready: 'Ready',
      embed_connecting: 'Connecting...',
      embed_preparing: 'Preparing',
      embed_verified: 'Verified',
      embed_live: 'Live',
      embed_active: 'Active',
      embed_invalid_url: 'Invalid URL',
      embed_failed: 'Failed',
      embed_stopped: 'Stopped',
      pipeline_clear_confirm: 'Clear all panel data?',
      case_default_tag: 'Case',
      case_note: 'NOTE: This case content is representative and anonymized.'
    }
  };

  Object.assign(I18N_MESSAGES.tr, {
    case_default_tag: 'Vaka',
    case_note: 'NOT: Bu vaka içeriği temsili ve anonimleştirilmiştir.'
  });

  const WORK_CARD_EN = {
    'Commerce Ops Suite': {
      desc: 'Single-panel omnichannel order management and operations automation.',
      highlights: 'Single operations panel,Stock + shipping automation,Reporting dashboard',
      timeline: 'S1 Discovery 1wk,S2 Integration 3wk,S3 Launch 2wk',
      kpis: 'Time:-27%,Error:-18%,Lead time:6 weeks'
    },
    'SaaS Control': {
      desc: 'Activation growth via onboarding and product analytics improvements.',
      highlights: 'Step-by-step onboarding,A/B variants,Event analytics',
      timeline: 'S1 UX 1wk,S2 Development 3wk,S3 Optimization 1wk',
      kpis: 'Activation:+21%,TTFV:-32%,Churn:-12%'
    },
    FieldMobile: {
      desc: 'Offline-first field app and task management.',
      highlights: 'Offline cache,Smart sync,Push notifications',
      timeline: 'S1 Offline 1wk,S2 Mobile 4wk,S3 Testing 2wk',
      kpis: 'Efficiency:+16%,Data loss:-40%,Crash:-28%'
    },
    ClinicFlow: {
      desc: 'Appointment automation reducing no-show and call center load.',
      highlights: 'Appointment reminders,Self-service plan,CRM automation',
      timeline: 'S1 Flow 1wk,S2 Automation 3wk,S3 Launch 2wk',
      kpis: 'No-show:-19%,Calls:-23%,NPS:+11'
    },
    LogiTrack: {
      desc: 'IoT route tracking with stronger SLA performance and delay alerts.',
      highlights: 'IoT ingest,Real-time route,SLA alerts',
      timeline: 'S1 Model 2wk,S2 Streaming 4wk,S3 Monitoring 2wk',
      kpis: 'SLA:+17%,Delay:-30%,API p95:240ms'
    },
    ServicePulse: {
      desc: 'Omnichannel support center with faster first response and higher CSAT.',
      highlights: 'Omni-channel inbox,SLA automation,CSAT tracking',
      timeline: 'S1 Flow 1wk,S2 Panel 3wk,S3 Launch 2wk',
      kpis: 'First response:-35%,CSAT:+12%,Ticket:-22%'
    }
  };

  const i18nTextNodes = [];
  const i18nAttrNodes = [];
  let i18nRegistryReady = false;

  const interpolate = (template, vars = {}) =>
    Object.entries(vars).reduce((acc, [key, value]) => acc.replace(new RegExp(`%\\{${key}\\}`, 'g'), String(value)), String(template || ''));

  const t = (key, vars = {}) => {
    const table = I18N_MESSAGES[activeLang] || I18N_MESSAGES.tr;
    const fallback = I18N_MESSAGES.tr[key] || key;
    return interpolate(table[key] || fallback, vars);
  };

  const trDate = (value) => {
    if (!value) return '--';
    const d = new Date(`${value}T00:00:00`);
    if (Number.isNaN(d.getTime())) return value;
    const locale = activeLang === 'en' ? 'en-US' : 'tr-TR';
    return d.toLocaleDateString(locale, {
      weekday: 'short',
      day: '2-digit',
      month: 'short'
    });
  };

  const initI18nRegistry = () => {
    if (i18nRegistryReady || i18nTextNodes.length || i18nAttrNodes.length) {
      i18nRegistryReady = true;
      return;
    }

    const walker = document.createTreeWalker(body || document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(parent.tagName)) return NodeFilter.FILTER_REJECT;
        if (!normalizeText(node.nodeValue)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    while (walker.nextNode()) {
      const node = walker.currentNode;
      const normalized = normalizeText(node.nodeValue);
      i18nTextNodes.push({
        node,
        original: node.nodeValue,
        normalized,
        translatable: Boolean(I18N_TEXT_EN_LOOKUP[normalizeI18nKey(normalized)])
      });
    }

    qa('[placeholder], [aria-label], [title]').forEach((el) => {
      i18nAttrNodes.push({
        el,
        placeholder: el.getAttribute('placeholder'),
        ariaLabel: el.getAttribute('aria-label'),
        title: el.getAttribute('title')
      });
    });

    i18nRegistryReady = true;
  };

  const updateLangToggles = (lang) => {
    const next = lang === 'en' ? 'TR' : 'EN';
    qa('[data-lang-toggle]').forEach((btn) => {
      btn.textContent = next;
      btn.setAttribute('aria-label', lang === 'en' ? 'Switch to Turkish' : 'Switch to English');
    });
  };

  const applyLanguage = (lang) => {
    activeLang = lang === 'en' ? 'en' : 'tr';
    document.documentElement.lang = activeLang;

    if (activeLang === 'en' && !i18nRegistryReady) {
      initI18nRegistry();
    }

    const metaPack = I18N_META[activeLang] || I18N_META.tr;
    document.title = metaPack.title;
    const metaDescription = q('#meta-description');
    const metaOgDescription = q('#meta-og-description');
    const metaTwitterDescription = q('#meta-twitter-description');
    const metaOgLocale = q('#meta-og-locale');
    if (metaDescription) metaDescription.setAttribute('content', metaPack.description);
    if (metaOgDescription) metaOgDescription.setAttribute('content', metaPack.ogDescription);
    if (metaTwitterDescription) metaTwitterDescription.setAttribute('content', metaPack.twitterDescription);
    if (metaOgLocale) metaOgLocale.setAttribute('content', metaPack.ogLocale);

    if (i18nRegistryReady) {
      i18nTextNodes.forEach((item) => {
        if (!item.translatable) return;
        const translated = I18N_TEXT_EN_LOOKUP[normalizeI18nKey(item.normalized)];
        if (activeLang === 'en' && translated) {
          item.node.nodeValue = withWhitespace(item.original, translated);
        } else {
          item.node.nodeValue = item.original;
        }
      });

      i18nAttrNodes.forEach((item) => {
        const { el } = item;
        if (!el) return;

        if (item.placeholder !== null) {
          const key = normalizeI18nKey(item.placeholder);
          const value = activeLang === 'en' ? I18N_ATTR_EN_LOOKUP.placeholder[key] || item.placeholder : item.placeholder;
          el.setAttribute('placeholder', value);
        }

        if (item.ariaLabel !== null) {
          const key = normalizeI18nKey(item.ariaLabel);
          const value = activeLang === 'en' ? I18N_ATTR_EN_LOOKUP.ariaLabel[key] || item.ariaLabel : item.ariaLabel;
          el.setAttribute('aria-label', value);
        }

        if (item.title !== null) {
          const key = normalizeI18nKey(item.title);
          const value = activeLang === 'en' ? I18N_ATTR_EN_LOOKUP.title[key] || item.title : item.title;
          el.setAttribute('title', value);
        }
      });
    }

    try {
      localStorage.setItem(LANG_STORAGE_KEY, activeLang);
    } catch (error) {
      // ignore storage errors
    }

    updateLangToggles(activeLang);
    document.dispatchEvent(new CustomEvent('language:change', { detail: { lang: activeLang } }));
  };

  const initI18n = () => {
    qa('[data-lang-toggle]').forEach((button) => {
      button.addEventListener('click', () => {
        applyLanguage(activeLang === 'en' ? 'tr' : 'en');
      });
    });

    let targetLang = 'tr';
    const urlLang = new URLSearchParams(window.location.search).get('lang');
    if (urlLang === 'en' || urlLang === 'tr') {
      targetLang = urlLang;
    } else {
      try {
        const saved = localStorage.getItem(LANG_STORAGE_KEY);
        if (saved === 'en' || saved === 'tr') targetLang = saved;
      } catch (error) {
        // ignore storage errors
      }
    }

    applyLanguage(targetLang);
  };
  const initNav = () => {
    const toggle = q('.nav-toggle');
    const links = qa('.nav-links a');

    const setOpen = (open) => {
      body?.setAttribute('data-nav-open', open ? 'true' : 'false');
      if (toggle) toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    };

    if (toggle) {
      toggle.addEventListener('click', () => {
        const current = body?.getAttribute('data-nav-open') === 'true';
        setOpen(!current);
      });
    }

    links.forEach((link) => link.addEventListener('click', () => setOpen(false)));
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') setOpen(false);
    });

    const mappings = links
      .map((link) => {
        const href = link.getAttribute('href') || '';
        if (!href.startsWith('#')) return null;
        const section = q(href);
        return section ? { link, section } : null;
      })
      .filter(Boolean);

    if (!mappings.length) {
      const currentPath = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();
      links.forEach((link) => {
        const hrefRaw = String(link.getAttribute('href') || '').trim();
        if (!hrefRaw || hrefRaw.startsWith('#')) return;
        if (/^(https?:|mailto:|tel:)/i.test(hrefRaw)) return;

        const hrefPath = hrefRaw
          .split('#')[0]
          .split('?')[0]
          .replace(/^\.\//, '')
          .toLowerCase();

        const normalizedHref = hrefPath || 'index.html';
        const active = normalizedHref === currentPath || (normalizedHref === 'index.html' && currentPath === '');
        link.classList.toggle('is-active', active);
      });
      return;
    }

    if (!('IntersectionObserver' in window)) return;

    const activate = (id) => {
      links.forEach((link) => {
        const active = link.getAttribute('href') === `#${id}`;
        link.classList.toggle('is-active', active);
      });
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        if (!visible.length) return;
        activate(visible[0].target.id);
      },
      { threshold: [0.2, 0.35, 0.5], rootMargin: '-20% 0px -55% 0px' }
    );

    mappings.forEach(({ section }) => observer.observe(section));
  };

  const initReveal = () => {
    const targets = qa('[data-animate]');
    if (!targets.length) return;

    if (lowPowerMode || !('IntersectionObserver' in window)) {
      targets.forEach((el) => el.classList.add('in-view'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('in-view');
          obs.unobserve(entry.target);
        });
      },
      { threshold: 0.16, rootMargin: '0px 0px -10% 0px' }
    );

    targets.forEach((el) => observer.observe(el));
  };

  const initProgress = () => {
    const progress = q('#scroll-progress');
    const floating = q('.floating-cta');
    const mobileSticky = q('.mobile-sticky-cta');
    if (!progress && !floating && !mobileSticky) return;

    let frame = 0;
    const render = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const ratio = max > 0 ? clamp((window.scrollY / max) * 100, 0, 100) : 0;
      if (progress) progress.style.width = `${ratio}%`;
      if (floating) floating.classList.toggle('show', window.scrollY > 700);
      if (mobileSticky) mobileSticky.classList.toggle('show', window.scrollY > 220);
    };

    const scheduleRender = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        render();
      });
    };

    render();
    window.addEventListener('scroll', scheduleRender, { passive: true });
    window.addEventListener('resize', scheduleRender, { passive: true });
  };

  const initCounters = () => {
    const counters = qa('[data-count]');
    if (!counters.length) return;

    const draw = (el, val) => {
      const targetRaw = Number.parseFloat(el.dataset.count || '0');
      const defaultDecimals = Number.isInteger(targetRaw) ? 0 : 1;
      const decimals = Number.parseInt(el.dataset.decimals || `${defaultDecimals}`, 10);
      const prefix = el.dataset.prefix || '';
      const suffix = el.dataset.suffix || '';
      const text = decimals > 0 ? val.toFixed(decimals) : `${Math.round(val)}`;
      el.textContent = `${prefix}${text}${suffix}`;
    };

    const animate = (el) => {
      const target = Number.parseFloat(el.dataset.count || '0');
      if (!Number.isFinite(target)) return;
      const startedAt = performance.now();
      const duration = 1200;

      const tick = (time) => {
        const p = clamp((time - startedAt) / duration, 0, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        draw(el, target * eased);
        if (p < 1) requestAnimationFrame(tick);
      };

      requestAnimationFrame(tick);
    };

    if (lowPowerMode) {
      counters.forEach((el) => {
        const target = Number.parseFloat(el.dataset.count || '0');
        if (Number.isFinite(target)) draw(el, target);
      });
      return;
    }

    if (!('IntersectionObserver' in window)) {
      counters.forEach((el) => animate(el));
      return;
    }

    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          animate(entry.target);
          obs.unobserve(entry.target);
        });
      },
      { threshold: 0.45 }
    );

    counters.forEach((el) => observer.observe(el));
  };

  const initLiveSlots = () => {
    const targets = qa('[data-live-slots]');
    if (!targets.length) return;

    const now = new Date();
    const day = now.getDay();
    const base = [5, 4, 4, 3, 3, 2, 2][day] || 4;
    const variation = Math.round(Math.abs(Math.sin(now.getDate() * 0.63)) * 2);
    const slots = Math.max(2, base - (variation > 1 ? 1 : 0));

    targets.forEach((el) => {
      el.textContent = String(slots);
    });
  };

  const initSeoMeta = () => {
    const canonicalLink = q('#canonical-link');
    const ogUrl = q('#meta-og-url');
    const ogImage = q('#meta-og-image');
    const twitterImage = q('#meta-twitter-image');

    const configured = String(siteConfig.siteUrl || '')
      .trim()
      .replace(/\/+$/, '');

    const isLocalHost = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
    const runtime = isLocalHost ? '' : `${window.location.protocol}//${window.location.host}`;
    const base = configured || runtime;
    if (!base) return;

    const path = window.location.pathname || '/';
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const canonical = new URL(normalizedPath, `${base}/`).toString();
    if (canonicalLink) canonicalLink.setAttribute('href', canonical);
    if (ogUrl) ogUrl.setAttribute('content', canonical);

    const setAbsoluteUrl = (meta) => {
      if (!meta) return;
      const raw = String(meta.getAttribute('content') || '').trim();
      if (!raw) return;
      try {
        const abs = new URL(raw, canonical).toString();
        meta.setAttribute('content', abs);
      } catch (error) {
        // ignore invalid URL values
      }
    };

    setAbsoluteUrl(ogImage);
    setAbsoluteUrl(twitterImage);
  };

  const initFormCompletionMeters = () => {
    const setupMeter = (options) => {
      const { formSelector, meterSelector, labelSelector, extraCheck } = options;
      const form = q(formSelector);
      const meter = q(meterSelector);
      const label = q(labelSelector);
      if (!form || !meter || !label) return;

      const requiredFields = qa('input[required], select[required], textarea[required]', form).filter(
        (field) => field.type !== 'hidden'
      );

      const getFieldScore = () => {
        if (!requiredFields.length) return 0;
        return requiredFields.reduce((acc, field) => {
          if (field.type === 'checkbox' || field.type === 'radio') return acc + (field.checked ? 1 : 0);
          return acc + (String(field.value || '').trim() ? 1 : 0);
        }, 0);
      };

      const update = () => {
        const baseScore = getFieldScore();
        const extraScore = extraCheck ? extraCheck() : 0;
        const extraMax = extraCheck ? 1 : 0;
        const max = requiredFields.length + extraMax;
        const ratio = max > 0 ? Math.round(((baseScore + extraScore) / max) * 100) : 0;
        meter.style.width = `${clamp(ratio, 0, 100)}%`;
        label.textContent = t('form_completion', { percent: clamp(ratio, 0, 100) });
      };

      form.addEventListener('input', update);
      form.addEventListener('change', update);
      document.addEventListener('language:change', update);
      update();

      return update;
    };

    const bookingUpdater = setupMeter({
      formSelector: '#booking-form',
      meterSelector: '#booking-meter',
      labelSelector: '#booking-meter-label',
      extraCheck: () => {
        const dateValue = q('#selected-date')?.value || '';
        const timeValue = q('#selected-time')?.value || '';
        return dateValue && timeValue ? 1 : 0;
      }
    });

    setupMeter({
      formSelector: '.contact-form',
      meterSelector: '#contact-meter',
      labelSelector: '#contact-meter-label'
    });

    setupMeter({
      formSelector: '#analysis-form',
      meterSelector: '#analysis-meter',
      labelSelector: '#analysis-meter-label'
    });

    if (bookingUpdater) {
      document.addEventListener('booking:summary-update', bookingUpdater);
    }
  };

  const initWorkCardTilt = () => {
    const cards = qa('.work-card');
    if (!cards.length) return;
    if (lowPowerMode) return;
    if (!window.matchMedia('(pointer:fine)').matches) return;

    cards.forEach((card) => {
      let frame = null;

      const reset = () => {
        card.style.setProperty('--rx', '0deg');
        card.style.setProperty('--ry', '0deg');
        card.style.setProperty('--mx', '50%');
        card.style.setProperty('--my', '50%');
        card.classList.remove('is-hovered');
      };

      const onMove = (event) => {
        if (frame) cancelAnimationFrame(frame);

        frame = requestAnimationFrame(() => {
          const rect = card.getBoundingClientRect();
          if (!rect.width || !rect.height) return;

          const x = clamp((event.clientX - rect.left) / rect.width, 0, 1);
          const y = clamp((event.clientY - rect.top) / rect.height, 0, 1);
          const rx = ((0.5 - y) * 7).toFixed(2);
          const ry = ((x - 0.5) * 8).toFixed(2);

          card.style.setProperty('--rx', `${rx}deg`);
          card.style.setProperty('--ry', `${ry}deg`);
          card.style.setProperty('--mx', `${(x * 100).toFixed(2)}%`);
          card.style.setProperty('--my', `${(y * 100).toFixed(2)}%`);
          card.classList.add('is-hovered');
        });
      };

      card.addEventListener('pointermove', onMove);
      card.addEventListener('pointerenter', () => card.classList.add('is-hovered'));
      card.addEventListener('pointerleave', reset);
      card.addEventListener('blur', reset);
    });
  };

  const initPortfolio = () => {
    const cards = qa('.work-card');
    const chips = qa('.filter-chip');
    const lightbox = q('#lightbox');
    if (!cards.length || !lightbox) return;

    const image = q('#lightbox-image');
    const title = q('#lightbox-title');
    const desc = q('#lightbox-desc');
    const tag = q('#lightbox-tag');
    const tags = q('#lightbox-tags');
    const stack = q('#lightbox-stack');
    const highlights = q('#lightbox-highlights');
    const timeline = q('#lightbox-timeline');
    const kpis = q('#lightbox-kpis');
    const doc = q('#lightbox-doc');

    const closeBtns = qa('[data-lightbox-close]', lightbox);
    const prevBtn = q('[data-lightbox-prev]', lightbox);
    const nextBtn = q('[data-lightbox-next]', lightbox);

    let filter = 'all';
    let activeIndex = -1;

    cards.forEach((card) => {
      ['desc', 'highlights', 'timeline', 'kpis'].forEach((field) => {
        const trKey = `${field}Tr`;
        if (!card.dataset[trKey]) card.dataset[trKey] = card.dataset[field] || '';
      });

      const enPack = WORK_CARD_EN[card.dataset.title || ''];
      if (enPack) {
        card.dataset.descEn = enPack.desc || card.dataset.descEn || '';
        card.dataset.highlightsEn = enPack.highlights || card.dataset.highlightsEn || '';
        card.dataset.timelineEn = enPack.timeline || card.dataset.timelineEn || '';
        card.dataset.kpisEn = enPack.kpis || card.dataset.kpisEn || '';
      }
    });

    const getWorkField = (card, field) => {
      if (activeLang === 'en') {
        const enValue = card.dataset[`${field}En`];
        if (enValue) return enValue;
      }
      return card.dataset[`${field}Tr`] || card.dataset[field] || '';
    };

    const visibleCards = () => cards.filter((card) => card.style.display !== 'none');

    const makePills = (container, list) => {
      if (!container) return;
      container.innerHTML = '';
      list.forEach((item) => {
        const el = document.createElement('span');
        el.textContent = item;
        container.appendChild(el);
      });
    };

    const makeKpis = (list) => {
      if (!kpis) return;
      kpis.innerHTML = '';

      list.forEach((item) => {
        const [labelRaw, metricRaw] = item.split(':');
        const itemWrap = document.createElement('div');
        itemWrap.className = 'lightbox-kpi';

        const label = document.createElement('span');
        label.textContent = (labelRaw || 'KPI').trim();

        const metric = document.createElement('strong');
        metric.textContent = (metricRaw || '-').trim();

        itemWrap.appendChild(label);
        itemWrap.appendChild(metric);
        kpis.appendChild(itemWrap);
      });
    };

    const buildDoc = (card) => {
      const caseTitle = card.dataset.title || card.querySelector('h3')?.textContent?.trim() || 'Project';
      const caseDesc = getWorkField(card, 'desc') || '-';
      const caseStack = parseList(card.dataset.stack).join(' | ') || '-';
      const caseTimeline = parseList(getWorkField(card, 'timeline')).join(' -> ') || '-';
      const caseKpis = parseList(getWorkField(card, 'kpis')).join(' | ') || '-';

      return [
        `PROJECT: ${caseTitle}`,
        '',
        `SUMMARY: ${caseDesc}`,
        '',
        `STACK: ${caseStack}`,
        `TIMELINE: ${caseTimeline}`,
        `KPIS: ${caseKpis}`,
        '',
        t('case_note')
      ].join('\n');
    };

    const open = (card) => {
      const shown = visibleCards();
      activeIndex = shown.indexOf(card);
      if (activeIndex < 0) activeIndex = 0;

      const t = card.dataset.title || card.querySelector('h3')?.textContent?.trim() || '';
      const d = getWorkField(card, 'desc') || '';
      const img = card.dataset.image || card.querySelector('img')?.getAttribute('src') || '';
      const tagsList = parseList(card.dataset.tags);

      if (image) {
        image.src = img;
        image.alt = `${t} project image`;
      }
      if (title) title.textContent = t;
      if (desc) desc.textContent = d;
      if (tag) tag.textContent = tagsList[0] || t('case_default_tag');

      makePills(tags, tagsList);
      makePills(stack, parseList(card.dataset.stack));
      makePills(highlights, parseList(getWorkField(card, 'highlights')));
      makePills(timeline, parseList(getWorkField(card, 'timeline')));
      makeKpis(parseList(getWorkField(card, 'kpis')));
      if (doc) doc.textContent = buildDoc(card);

      lightbox.classList.add('is-open');
      lightbox.setAttribute('aria-hidden', 'false');
      body?.classList.add('modal-open');

      const many = shown.length > 1;
      if (prevBtn) prevBtn.disabled = !many;
      if (nextBtn) nextBtn.disabled = !many;
    };

    const close = () => {
      lightbox.classList.remove('is-open');
      lightbox.setAttribute('aria-hidden', 'true');
      body?.classList.remove('modal-open');
      activeIndex = -1;
    };

    const step = (direction) => {
      const shown = visibleCards();
      if (shown.length < 2) return;
      const next = (activeIndex + direction + shown.length) % shown.length;
      open(shown[next]);
    };

    const applyFilter = (value) => {
      filter = value;

      chips.forEach((chip) => {
        const active = chip.dataset.filter === value;
        chip.classList.toggle('is-active', active);
        chip.setAttribute('aria-selected', active ? 'true' : 'false');
      });

      cards.forEach((card) => {
        const category = String(card.dataset.category || '').toLowerCase().split(/\s+/);
        const match = value === 'all' || category.includes(value);
        card.style.display = match ? '' : 'none';
        card.setAttribute('aria-hidden', match ? 'false' : 'true');
      });

      if (lightbox.classList.contains('is-open')) {
        const shown = visibleCards();
        if (!shown.length) close();
        else if (activeIndex >= shown.length) open(shown[0]);
      }
    };

    cards.forEach((card) => {
      const openCard = () => open(card);
      card.addEventListener('click', openCard);
      card.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openCard();
        }
      });
    });

    chips.forEach((chip) => {
      chip.addEventListener('click', () => applyFilter(chip.dataset.filter || 'all'));
    });

    closeBtns.forEach((btn) => btn.addEventListener('click', close));
    if (prevBtn) prevBtn.addEventListener('click', () => step(-1));
    if (nextBtn) nextBtn.addEventListener('click', () => step(1));

    document.addEventListener('keydown', (event) => {
      if (!lightbox.classList.contains('is-open')) return;
      if (event.key === 'Escape') close();
      if (event.key === 'ArrowLeft') step(-1);
      if (event.key === 'ArrowRight') step(1);
    });

    applyFilter(filter);
  };

  const initStorySlider = () => {
    const slider = q('[data-story-slider]');
    if (!slider) return;

    const slides = qa('[data-story-slide]', slider);
    const dots = qa('[data-story-dot]', slider);
    const prev = q('[data-story-prev]', slider);
    const next = q('[data-story-next]', slider);
    if (!slides.length) return;

    let index = 0;
    let timer = null;

    const setActive = (nextIndex) => {
      index = (nextIndex + slides.length) % slides.length;

      slides.forEach((slide, i) => {
        const active = i === index;
        slide.classList.toggle('is-active', active);
        slide.setAttribute('aria-hidden', active ? 'false' : 'true');
      });

      dots.forEach((dot, i) => {
        const active = i === index;
        dot.classList.toggle('is-active', active);
        dot.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    };

    const stop = () => {
      if (timer) window.clearInterval(timer);
      timer = null;
    };

    const start = () => {
      if (lowPowerMode) return;
      stop();
      timer = window.setInterval(() => setActive(index + 1), 6000);
    };

    if (prev) {
      prev.addEventListener('click', () => {
        setActive(index - 1);
        start();
      });
    }

    if (next) {
      next.addEventListener('click', () => {
        setActive(index + 1);
        start();
      });
    }

    dots.forEach((dot, dotIndex) => {
      dot.addEventListener('click', () => {
        setActive(dotIndex);
        start();
      });
    });

    slider.addEventListener('mouseenter', stop);
    slider.addEventListener('mouseleave', start);
    slider.addEventListener('focusin', stop);
    slider.addEventListener('focusout', start);

    setActive(0);
    start();
  };

  let emailJsLoadPromise = null;
  let emailJsReady = false;

  const loadEmailJs = async () => {
    if (window.emailjs?.send) return window.emailjs;

    if (!emailJsLoadPromise) {
      emailJsLoadPromise = loadScript('https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js').then(
        () => window.emailjs
      );
    }

    return emailJsLoadPromise;
  };

  const ensureEmailJs = async () => {
    const client = await loadEmailJs();
    if (!client) throw new Error('EmailJS not loaded');

    if (!emailJsReady) {
      client.init({ publicKey: emailConfig.publicKey });
      emailJsReady = true;
    }

    return client;
  };

  const sendBookingEmails = async (payload) => {
    const { publicKey, serviceId, templateIdClient, templateIdTeam } = emailConfig;
    if (!publicKey || !serviceId || !templateIdClient || !templateIdTeam) return false;

    const emailjs = await ensureEmailJs();
    const shared = {
      ...payload,
      brandName,
      brandEmail,
      reply_to: payload.email || ''
    };

    await emailjs.send(serviceId, templateIdClient, {
      ...shared,
      to_email: payload.email || ''
    });

    await emailjs.send(serviceId, templateIdTeam, {
      ...shared,
      to_email: brandEmail || payload.email || ''
    });

    return true;
  };

  const sendContactEmail = async (payload) => {
    const { publicKey, serviceId, templateIdTeam, templateIdContact } = emailConfig;
    const templateId = templateIdContact || templateIdTeam;
    if (!publicKey || !serviceId || !templateId) return false;

    const emailjs = await ensureEmailJs();
    await emailjs.send(serviceId, templateId, {
      ...payload,
      brandName,
      brandEmail,
      to_email: brandEmail || payload.email || '',
      reply_to: payload.email || ''
    });

    return true;
  };
  const initBooking = () => {
    const tabs = qa('.booking-tab');
    const panels = qa('.booking-panel-group');

    const bookingDate = q('#booking-date');
    const slotWrap = q('#time-slots');
    const summary = q('#booking-summary');
    const selectedDateInput = q('#selected-date');
    const selectedTimeInput = q('#selected-time');
    const form = q('#booking-form');
    const status = q('#form-status');
    const submitButton = form ? q('button[type="submit"]', form) : null;
    const submitDefaultLabel = submitButton?.textContent || t('booking_complete');
    const bookingConversion = q('#booking-conversion');
    const bookingConversionTitle = q('#booking-conversion-title');
    const bookingConversionCopy = q('#booking-conversion-copy');
    const bookingConversionCta = q('#booking-conversion-cta');

    const embedShell = q('.embed-shell');
    const calendarInput = q('#calendar-url');
    const calendarApply = q('#calendar-apply');
    const calendarStatus = q('#calendar-status');
    const embedHealth = q('#embed-health');
    const embedCheckUrl = q('#embed-check-url');
    const embedCheckConnection = q('#embed-check-connection');
    const embedCheckFlow = q('#embed-check-flow');

    if (!form) return;
    const manualSlotMode = Boolean(bookingDate && slotWrap && summary);

    let offerInput = q('input[name="selected_offer"]', form);
    if (!offerInput) {
      offerInput = document.createElement('input');
      offerInput.type = 'hidden';
      offerInput.name = 'selected_offer';
      form.appendChild(offerInput);
    }

    try {
      const selectedOffer = localStorage.getItem('selectedOffer');
      if (selectedOffer) offerInput.value = selectedOffer;
    } catch (error) {
      // ignore storage errors
    }

    const embedPlaceholder = embedShell ? embedShell.innerHTML : '';

    let activeTab = tabs.length ? 'quick' : 'live';
    let selectedDate = '';
    let selectedTime = '';
    let isSubmitting = false;

    const setEmbedHealth = (state) => {
      const states = {
        idle: {
          url: t('embed_pending'),
          connection: t('embed_not_ready'),
          flow: t('embed_passive')
        },
        linked: {
          url: t('embed_valid_url'),
          connection: t('embed_waiting'),
          flow: t('embed_ready')
        },
        loading: {
          url: t('embed_valid_url'),
          connection: t('embed_connecting'),
          flow: t('embed_preparing')
        },
        ready: {
          url: t('embed_verified'),
          connection: t('embed_live'),
          flow: t('embed_active')
        },
        invalid: {
          url: t('embed_invalid_url'),
          connection: t('embed_failed'),
          flow: t('embed_stopped')
        }
      };

      const current = states[state] || states.idle;
      if (embedHealth) embedHealth.dataset.state = state || 'idle';
      if (embedCheckUrl) embedCheckUrl.textContent = current.url;
      if (embedCheckConnection) embedCheckConnection.textContent = current.connection;
      if (embedCheckFlow) embedCheckFlow.textContent = current.flow;
    };

    setEmbedHealth('idle');

    if (manualSlotMode && bookingDate) {
      const now = new Date();
      const minDate = now.toISOString().slice(0, 10);
      const maxDateObj = new Date();
      maxDateObj.setDate(maxDateObj.getDate() + 30);
      const maxDate = maxDateObj.toISOString().slice(0, 10);
      bookingDate.min = minDate;
      bookingDate.max = maxDate;
    }

    const slots = ['09:30', '10:00', '10:30', '11:00', '11:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30'];
    const draftKey = 'bookingDraft_v2';

    const saveDraft = () => {
      try {
        const payload = Object.fromEntries(new FormData(form).entries());
        payload.bookingDate = manualSlotMode ? (selectedDate || bookingDate?.value || '') : '';
        payload.selectedTime = selectedTime || '';
        localStorage.setItem(draftKey, JSON.stringify(payload));
      } catch (error) {
        // ignore storage errors
      }
    };

    const clearDraft = () => {
      try {
        localStorage.removeItem(draftKey);
      } catch (error) {
        // ignore storage errors
      }
    };

    const setConversionState = () => {
      if (!bookingConversion || !bookingConversionTitle || !bookingConversionCopy || !bookingConversionCta) return;

      if (selectedDate && selectedTime) {
        bookingConversion.classList.add('is-ready');
        bookingConversionTitle.textContent = t('selected_slot', { date: trDate(selectedDate), time: selectedTime });
        bookingConversionCopy.textContent = t('booking_lock_copy');
        bookingConversionCta.textContent = t('booking_complete');
        bookingConversionCta.setAttribute('href', '#booking-form');
        bookingConversionCta.dataset.ctaRole = 'booking_complete';
        bookingConversionCta.dataset.ctaVariant = ctaVariant;
        return;
      }

      if (selectedDate && !selectedTime) {
        bookingConversion.classList.remove('is-ready');
        bookingConversionTitle.textContent = t('booking_wait_title', { date: trDate(selectedDate) });
        bookingConversionCopy.textContent = t('booking_wait_copy');
        bookingConversionCta.textContent = t('pick_time');
        bookingConversionCta.setAttribute('href', '#time-slots');
        bookingConversionCta.dataset.ctaRole = 'booking_pick_time';
        bookingConversionCta.dataset.ctaVariant = ctaVariant;
        return;
      }

      bookingConversion.classList.remove('is-ready');
      bookingConversionTitle.textContent = t('quick_discovery_limited');
      bookingConversionCopy.textContent = t('booking_default_copy');
      bookingConversionCta.textContent = getCtaVariantCopy('quick_slot', t('quick_slot'));
      bookingConversionCta.setAttribute('href', '#booking-date');
      bookingConversionCta.dataset.ctaRole = 'quick_slot';
      bookingConversionCta.dataset.ctaVariant = ctaVariant;
    };

    const setSummary = () => {
      const label = summary.querySelector('span');
      const strong = summary.querySelector('strong');
      if (!label || !strong) return;

      if (!manualSlotMode) {
        if (selectedDateInput) selectedDateInput.value = '';
        if (selectedTimeInput) selectedTimeInput.value = '';
        saveDraft();
        document.dispatchEvent(new CustomEvent('booking:summary-update'));
        return;
      }

      if (!selectedDate || !selectedTime) {
        label.textContent = t('no_selected_time');
        strong.textContent = '--';
        if (selectedDateInput) selectedDateInput.value = '';
        if (selectedTimeInput) selectedTimeInput.value = '';
        setConversionState();
        saveDraft();
        document.dispatchEvent(new CustomEvent('booking:summary-update'));
        return;
      }

      label.textContent = t('selected_time');
      strong.textContent = `${trDate(selectedDate)} - ${selectedTime}`;
      if (selectedDateInput) selectedDateInput.value = selectedDate;
      if (selectedTimeInput) selectedTimeInput.value = selectedTime;
      setConversionState();
      saveDraft();
      document.dispatchEvent(new CustomEvent('booking:summary-update'));
    };

    const isAvailable = (dateText, slot, i) => {
      const seed = Math.floor(new Date(`${dateText}T00:00:00`).getTime() / 86400000);
      const hash = Math.abs(Math.sin((seed + 1) * (i + 3) * 7.13));
      if (slot === '11:30') return hash > 0.52;
      if (slot.startsWith('16:')) return hash > 0.37;
      return hash > 0.21;
    };

    const renderSlots = () => {
      if (!manualSlotMode || !slotWrap) return;
      slotWrap.innerHTML = '';

      if (!selectedDate) {
        const hint = document.createElement('div');
        hint.className = 'booking-hint';
        hint.textContent = t('slots_hint');
        slotWrap.appendChild(hint);
        setSummary();
        return;
      }

      slots.forEach((slot, i) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'time-slot';
        button.textContent = slot;

        const available = isAvailable(selectedDate, slot, i);
        button.disabled = !available;
        if (!available) button.title = t('slot_full');

        if (selectedTime === slot) button.classList.add('selected');

        button.addEventListener('click', () => {
          selectedTime = slot;
          qa('.time-slot', slotWrap).forEach((slotBtn) => slotBtn.classList.remove('selected'));
          button.classList.add('selected');
          setSummary();
        });

        slotWrap.appendChild(button);
      });

      setSummary();
    };

    if (manualSlotMode && bookingDate) {
      bookingDate.addEventListener('change', () => {
        selectedDate = bookingDate.value;
        selectedTime = '';
        renderSlots();
        saveDraft();
      });
    }

    const loadEmbed = (force = false) => {
      if (!embedShell) return;
      if (embedShell.dataset.loaded === 'true' && !force) return;

      const url = sanitizeUrl(embedShell.dataset.embedUrl || '');
      if (!url) {
        setEmbedHealth('idle');
        return;
      }

      const iframe = document.createElement('iframe');
      iframe.src = url;
      iframe.title = t('iframe_title_booking');
      iframe.loading = 'lazy';
      iframe.addEventListener(
        'load',
        () => {
          setEmbedHealth('ready');
        },
        { once: true }
      );
      iframe.addEventListener(
        'error',
        () => {
          setEmbedHealth('invalid');
        },
        { once: true }
      );

      embedShell.innerHTML = '';
      embedShell.appendChild(iframe);
      embedShell.dataset.loaded = 'true';
      setEmbedHealth('loading');
    };

    const setCalendar = (url, options = {}) => {
      if (!embedShell) return;

      embedShell.dataset.embedUrl = url;
      embedShell.dataset.loaded = 'false';
      embedShell.innerHTML = embedPlaceholder;

      if (calendarInput) calendarInput.value = url;
      if (!options.silent) {
        try {
          localStorage.setItem('calendarEmbedUrl', url);
        } catch (error) {
          // ignore storage errors
        }
      }

      if (calendarStatus) {
        calendarStatus.textContent = options.silent ? t('saved_url_loaded') : t('calendar_url_saved');
        calendarStatus.style.color = '#0f766e';
      }

      setEmbedHealth(activeTab === 'live' ? 'loading' : 'linked');

      if (activeTab === 'live') loadEmbed(true);
    };

    const defaultCalendarUrl = sanitizeUrl(siteConfig.bookingUrl || embedShell?.dataset.embedUrl || '');
    let saved = '';
    try {
      saved = localStorage.getItem('calendarEmbedUrl') || '';
    } catch (error) {
      saved = '';
    }

    if (saved) {
      const clean = sanitizeUrl(saved);
      if (clean) setCalendar(clean, { silent: true });
    } else if (defaultCalendarUrl) {
      setCalendar(defaultCalendarUrl, { silent: true });
    }

    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        activeTab = tab.dataset.tab || 'quick';

        tabs.forEach((btn) => {
          const active = btn === tab;
          btn.classList.toggle('is-active', active);
          btn.setAttribute('aria-selected', active ? 'true' : 'false');
        });

        panels.forEach((panel) => {
          panel.classList.toggle('is-active', panel.dataset.panel === activeTab);
        });

        if (activeTab === 'live') loadEmbed();
      });
    });

    if (calendarApply) {
      calendarApply.addEventListener('click', () => {
        const clean = sanitizeUrl(calendarInput?.value || '');
        if (!clean) {
          if (calendarStatus) {
            calendarStatus.textContent = t('invalid_calendar_url');
            calendarStatus.style.color = '#b91c1c';
          }
          setEmbedHealth('invalid');
          return;
        }

        setCalendar(clean);
      });
    }

    if (calendarInput) {
      calendarInput.addEventListener('input', () => {
        const raw = String(calendarInput.value || '').trim();
        if (!raw) {
          setEmbedHealth('idle');
          return;
        }
        const clean = sanitizeUrl(raw);
        setEmbedHealth(clean ? 'linked' : 'invalid');
      });
    }

    if (!tabs.length) {
      loadEmbed(true);
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (isSubmitting) return;

      if (isHoneypotTriggered(form)) {
        if (status) {
          status.textContent = t('booking_received');
          status.style.color = '#0f766e';
        }
        form.reset();
        if (bookingDate) bookingDate.value = '';
        selectedDate = '';
        selectedTime = '';
        renderSlots();
        clearDraft();
        return;
      }

      const cooldownLeft = getSubmitCooldownLeft('booking', 12000);
      if (cooldownLeft > 0) {
        if (status) {
          status.textContent = t('cooldown_wait', { seconds: Math.ceil(cooldownLeft / 1000) });
          status.style.color = '#a16207';
        }
        return;
      }

      if (manualSlotMode && (!selectedDate || !selectedTime)) {
        if (status) {
          status.textContent = t('booking_pick_datetime');
          status.style.color = '#b91c1c';
        }
        return;
      }

      if (manualSlotMode) {
        const slotIndex = slots.indexOf(selectedTime);
        if (slotIndex < 0 || !isAvailable(selectedDate, selectedTime, slotIndex)) {
          selectedTime = '';
          renderSlots();
          if (status) {
            status.textContent = t('booking_slot_unavailable');
            status.style.color = '#b91c1c';
          }
          return;
        }
      }

      isSubmitting = true;
      form.setAttribute('aria-busy', 'true');
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = t('loading_short');
      }

      let payload = Object.fromEntries(new FormData(form).entries());
      payload.selectedDate = manualSlotMode ? selectedDate : '';
      payload.selectedTime = manualSlotMode ? selectedTime : '';
      payload.brandName = brandName;
      payload.brandEmail = brandEmail;
      payload = enrichLeadPayload(payload, 'booking');
      trackEvent('booking_submit', {
        service: payload.service || '',
        budget_range: payload.budget_range || '',
        timeline_pref: payload.timeline_pref || '',
        score: payload.score,
        utm_source: payload.utm_source || '',
        utm_campaign: payload.utm_campaign || ''
      });
      markSubmitCooldown('booking');

      if (status) {
        status.textContent = t('booking_sending');
        status.style.color = '#0f766e';
      }

      try {
        const sent = await sendBookingEmails(payload);

        if (!sent) {
          if (status) {
            status.textContent = t('booking_emailjs_pending');
            status.style.color = '#a16207';
          }
        } else if (status) {
          status.textContent = t('booking_confirm_sent');
          status.style.color = '#0f766e';
        }

        saveLead(payload);
        trackEvent('booking_success', {
          service: payload.service || '',
          score: payload.score,
          qualified: payload.score >= 60
        });

        form.reset();
        try {
          offerInput.value = localStorage.getItem('selectedOffer') || '';
        } catch (error) {
          offerInput.value = '';
        }
        if (bookingDate) bookingDate.value = '';
        selectedDate = '';
        selectedTime = '';
        if (manualSlotMode) renderSlots();
        clearDraft();
        document.dispatchEvent(new CustomEvent('booking:summary-update'));
      } catch (error) {
        trackEvent('booking_failed');
        if (status) {
          status.textContent = t('send_error');
          status.style.color = '#b91c1c';
        }
      } finally {
        isSubmitting = false;
        form.removeAttribute('aria-busy');
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = submitDefaultLabel;
        }
      }
    });

    form.addEventListener('input', saveDraft);
    form.addEventListener('change', saveDraft);

    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved && typeof saved === 'object') {
          Object.entries(saved).forEach(([key, value]) => {
            if (key === 'bookingDate' || key === 'selectedTime' || key === 'selectedDate') return;
            const field = form.elements.namedItem(key);
            if (field && 'value' in field) field.value = String(value ?? '');
          });

          if (manualSlotMode && bookingDate) {
            const savedDate = String(saved.bookingDate || '').trim();
            const savedTime = String(saved.selectedTime || '').trim();
            if (savedDate) {
              selectedDate = savedDate;
              bookingDate.value = savedDate;
            }
            if (savedTime) {
              selectedTime = savedTime;
            }

            if (selectedDate && selectedTime) {
              const i = slots.indexOf(selectedTime);
              if (i < 0 || !isAvailable(selectedDate, selectedTime, i)) {
                selectedTime = '';
              }
            }
          }
        }
      }
    } catch (error) {
      // ignore draft parse errors
    }

    document.addEventListener('language:change', () => {
      setEmbedHealth(embedHealth?.dataset.state || 'idle');
      if (manualSlotMode) renderSlots();
      if (submitButton && !isSubmitting) submitButton.textContent = t('booking_complete');
    });

    if (manualSlotMode) renderSlots();
  };

  const buildBriefContent = (payload) => ({
    title: 'Teknik Degerlendirme Brief',
    lines: [
      `Tarih: ${new Date().toLocaleDateString('tr-TR')}`,
      `Uzman: ${brandName}`,
      '',
      `Ad Soyad: ${payload.name || '-'}`,
      `E-Posta: ${payload.email || '-'}`,
      `Web Sitesi: ${payload.website || '-'}`,
      `Hedef: ${payload.goal || '-'}`,
      `Butce: ${payload.budget || '-'}`,
      `Not: ${payload.note || '-'}`,
      '',
      'Sonraki adim: teknik yol haritasi 24 saat icinde paylasilir.'
    ]
  });

  const loadJsPdf = () =>
    new Promise((resolve, reject) => {
      if (window.jspdf?.jsPDF) {
        resolve(window.jspdf.jsPDF);
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';
      script.onload = () => resolve(window.jspdf.jsPDF);
      script.onerror = () => reject(new Error('jsPDF load error'));
      document.head.appendChild(script);
    });
  const initAnalysis = () => {
    const form = q('#analysis-form');
    const downloadBtn = q('#analysis-download');
    const status = q('#analysis-status');
    if (!form) return;

    const getPayload = () => Object.fromEntries(new FormData(form).entries());

    const generatePdf = async () => {
      const payload = getPayload();
      const valid = payload.name && payload.email && payload.website && payload.goal;
      if (!valid) {
        if (status) {
          status.textContent =
            activeLang === 'en'
              ? 'Fill in name, email, website, and goal fields to generate PDF.'
              : 'PDF için ad, e-posta, web sitesi ve hedef alanlarını doldurun.';
          status.style.color = '#a16207';
        }
        return;
      }

      const { title, lines } = buildBriefContent(payload);
      const reportTitle = title;
      const reportLines = lines;

      const summaryItems = [
        { label: 'Performans', value: '78/100' },
        { label: 'Risk', value: 'Orta' },
        { label: 'Oncelik', value: 'Cache + DB' }
      ];

      const findings = [
        'Cache hit orani dusuk, kritik endpointler optimize edilmeli.',
        'DB sorgu planlari ve indeksler tekrar duzenlenmeli.',
        'API p95 gecikmeleri icin hot-path iyilestirmesi onerilir.'
      ];

      const steps = [
        '2 haftalik iyilestirme sprinti',
        'APM + log standardizasyonu',
        'Staging performans testleri'
      ];

      const details = [
        `Web sitesi: ${payload.website || '-'}`,
        `Hedef: ${payload.goal || '-'}`,
        `Butce: ${payload.budget || '-'}`,
        `Not: ${payload.note || '-'}`
      ];

      if (status) {
        status.textContent = t('brief_preparing');
        status.style.color = '#0f766e';
      }

      try {
        const JsPdf = await loadJsPdf();
        const doc = new JsPdf();

        const accent = hexToRgb(brandColor) || { r: 14, g: 165, b: 233 };
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 14;
        const contentWidth = pageWidth - margin * 2;

        doc.setFillColor(accent.r, accent.g, accent.b);
        doc.rect(0, 0, pageWidth, 26, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text(brandName, margin, 16);

        if (brandTagline) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.text(brandTagline, margin, 22);
        }

        const initials = brandName
          .split(' ')
          .filter(Boolean)
          .map((word) => word[0])
          .join('')
          .slice(0, 2)
          .toUpperCase();

        if (initials) {
          const r = 8;
          const x = pageWidth - margin - r;
          const y = 13;

          doc.setFillColor(255, 255, 255);
          doc.circle(x, y, r, 'F');
          doc.setTextColor(accent.r, accent.g, accent.b);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.text(initials, x - doc.getTextWidth(initials) / 2, y + 3);
        }

        const chip = 'MUSTERI RAPORU';
        const chipWidth = doc.getTextWidth(chip) + 12;
        doc.setFillColor(232, 247, 255);
        doc.roundedRect(margin, 30, chipWidth, 10, 3, 3, 'F');
        doc.setTextColor(accent.r, accent.g, accent.b);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text(chip, margin + 6, 37);

        doc.setFillColor(accent.r, accent.g, accent.b);
        doc.rect(0, 0, 6, 297, 'F');

        doc.setTextColor(20, 20, 20);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text(reportTitle, margin, 46);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(90, 90, 90);
        doc.text(`Tarih: ${new Date().toLocaleDateString('tr-TR')}`, margin, 52);
        if (brandTagline) doc.text(brandTagline, margin, 58);

        const gap = 6;
        const boxWidth = (contentWidth - gap * 2) / 3;
        const boxY = 66;

        summaryItems.forEach((item, i) => {
          const x = margin + i * (boxWidth + gap);
          doc.setFillColor(244, 249, 255);
          doc.rect(x, boxY, boxWidth, 18, 'F');

          doc.setTextColor(20, 20, 20);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.text(item.label, x + 4, boxY + 6);

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10);
          doc.text(item.value, x + 4, boxY + 14);
        });

        let y = boxY + 26;

        doc.setTextColor(20, 20, 20);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text('Bulgular', margin, y);
        y += 6;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        const findingText = doc.splitTextToSize(findings.map((f) => `* ${f}`).join('\n'), contentWidth);
        doc.text(findingText, margin, y);
        y += findingText.length * 5 + 6;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text('Sonraki Adım', margin, y);
        y += 6;

        doc.setFont('helvetica', 'normal');
        const stepText = doc.splitTextToSize(steps.map((s) => `* ${s}`).join('\n'), contentWidth);
        doc.text(stepText, margin, y);
        y += stepText.length * 5 + 6;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text('Detaylar', margin, y);
        y += 6;

        doc.setFont('helvetica', 'normal');
        const detailText = doc.splitTextToSize(details.join('\n'), contentWidth);
        doc.text(detailText, margin, y);

        const footer = [];
        if (brandEmail) footer.push(`İletişim: ${brandEmail}`);
        const bookingUrl = sanitizeUrl(siteConfig.bookingUrl || '');
        if (bookingUrl) footer.push(`Rezervasyon: ${bookingUrl}`);

        if (footer.length) {
          doc.setTextColor(accent.r, accent.g, accent.b);
          doc.setFontSize(9);
          const footerText = doc.splitTextToSize(footer.join('   '), 180);
          doc.text(footerText, 14, 286);
        }

        doc.save('brief.pdf');

        if (status) {
          status.textContent = t('brief_pdf_downloaded');
          status.style.color = '#0f766e';
        }
      } catch (error) {
        downloadText([reportTitle, ...reportLines].join('\n'), 'brief.txt');
        if (status) {
          status.textContent = t('brief_txt_downloaded');
          status.style.color = '#a16207';
        }
      }
    };

    if (downloadBtn) {
      downloadBtn.addEventListener('click', generatePdf);
    }

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;

      const payload = Object.fromEntries(new FormData(form).entries());

      if (isHoneypotTriggered(form)) {
        if (status) {
          status.textContent = t('request_received_24h');
          status.style.color = '#0f766e';
        }
        form.reset();
        return;
      }

      const cooldownLeft = getSubmitCooldownLeft('analysis', 12000);
      if (cooldownLeft > 0) {
        if (status) {
          status.textContent = t('cooldown_wait', { seconds: Math.ceil(cooldownLeft / 1000) });
          status.style.color = '#a16207';
        }
        return;
      }

      markSubmitCooldown('analysis');

      const enrichedPayload = enrichLeadPayload(payload, 'analysis');
      saveLead(enrichedPayload);
      trackEvent('analysis_submit', {
        goal: enrichedPayload.goal || '',
        budget: enrichedPayload.budget || '',
        score: enrichedPayload.score,
        utm_source: enrichedPayload.utm_source || '',
        utm_campaign: enrichedPayload.utm_campaign || ''
      });

      if (status) {
        status.textContent = t('request_received_24h');
        status.style.color = '#0f766e';
      }

      form.reset();
    });
  };

  const initContact = () => {
    const form = q('.contact-form');
    const status = q('#contact-status');
    if (!form) return;

    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      if (isHoneypotTriggered(form)) {
        if (status) {
          status.textContent = t('message_sent');
          status.style.color = '#0f766e';
        }
        form.reset();
        return;
      }

      const cooldownLeft = getSubmitCooldownLeft('contact', 10000);
      if (cooldownLeft > 0) {
        if (status) {
          status.textContent = t('cooldown_wait', { seconds: Math.ceil(cooldownLeft / 1000) });
          status.style.color = '#a16207';
        }
        return;
      }

      markSubmitCooldown('contact');

      const payload = Object.fromEntries(new FormData(form).entries());
      payload.service = payload.service || t('contact_form_label');
      payload.selectedDate = payload.selectedDate || '-';
      payload.selectedTime = payload.selectedTime || '-';
      payload.note = payload.note || payload.message || '-';
      payload.phone = payload.phone || '-';
      payload.company = payload.company || '-';
      const enrichedPayload = enrichLeadPayload(payload, 'contact');

      trackEvent('contact_submit', {
        score: enrichedPayload.score,
        utm_source: enrichedPayload.utm_source || '',
        utm_campaign: enrichedPayload.utm_campaign || ''
      });

      if (status) {
        status.textContent = t('message_sending');
        status.style.color = '#0f766e';
      }

      try {
        const sent = await sendContactEmail(enrichedPayload);

        if (!sent) {
          if (status) {
            status.textContent = t('message_emailjs_pending');
            status.style.color = '#a16207';
          }
        } else if (status) {
          status.textContent = t('message_sent');
          status.style.color = '#0f766e';
        }

        saveLead(enrichedPayload);
        trackEvent('contact_success', {
          score: enrichedPayload.score,
          qualified: enrichedPayload.score >= 60
        });
        form.reset();
      } catch (error) {
        trackEvent('contact_failed');
        if (status) {
          status.textContent = t('send_failed_retry');
          status.style.color = '#b91c1c';
        }
      }
    });
  };

  const initRevenueEngine = () => {
    const leadsEl = q('#pipeline-kpi-leads');
    const qualifiedEl = q('#pipeline-kpi-qualified');
    const bookingsEl = q('#pipeline-kpi-bookings');
    const rateEl = q('#pipeline-kpi-rate');
    const tableBody = q('#pipeline-table-body');
    const exportBtn = q('#pipeline-export');
    const clearBtn = q('#pipeline-clear');
    if (!leadsEl && !qualifiedEl && !bookingsEl && !rateEl && !tableBody && !exportBtn && !clearBtn) return;

    const render = () => {
      const leads = readStore(LEAD_STORE_KEY, []);
      const qualified = leads.filter((item) => Number(item.score || 0) >= 60).length;
      const bookings = leads.filter((item) => item.type === 'booking').length;
      const rate = leads.length ? Math.round((qualified / leads.length) * 100) : 0;

      if (leadsEl) leadsEl.textContent = `${leads.length}`;
      if (qualifiedEl) qualifiedEl.textContent = `${qualified}`;
      if (bookingsEl) bookingsEl.textContent = `${bookings}`;
      if (rateEl) rateEl.textContent = `%${rate}`;

      if (!tableBody) return;

      if (!leads.length) {
        tableBody.innerHTML = `<tr><td colspan="6">${activeLang === 'en' ? 'No lead records yet.' : 'Hen\u00fcz lead kayd\u0131 yok.'}</td></tr>`;
        return;
      }

      const rows = leads
        .slice()
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 8);

      tableBody.innerHTML = rows
        .map((item) => {
          const created = new Date(item.createdAt);
          const createdLabel = Number.isNaN(created.getTime())
            ? '-'
            : created.toLocaleDateString(activeLang === 'en' ? 'en-US' : 'tr-TR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
              });
          const name = String(item.name || item.email || '-');
          const score = Number(item.score || 0);
          const stageKey = String(item.stage || (score >= 75 ? 'hot' : score >= 60 ? 'qualified' : 'nurture')).toLowerCase();
          const stage =
            stageKey === 'hot'
              ? activeLang === 'en'
                ? 'Hot'
                : 'S\u0131cak'
              : stageKey === 'qualified'
                ? activeLang === 'en'
                  ? 'Qualified'
                  : 'Nitelikli'
                : activeLang === 'en'
                  ? 'Nurture'
                  : 'Takip';
          const channelType = String(item.type || '').toLowerCase();
          const channel =
            channelType === 'booking'
              ? activeLang === 'en'
                ? 'Booking'
                : 'Rezervasyon'
              : channelType === 'analysis'
                ? activeLang === 'en'
                  ? 'Analysis'
                  : 'Analiz'
                : channelType === 'contact'
                  ? activeLang === 'en'
                    ? 'Contact'
                    : '\u0130leti\u015fim'
                  : item.type || '-';
          const nextActionDate = item.nextActionAt
            ? new Date(item.nextActionAt).toLocaleDateString(activeLang === 'en' ? 'en-US' : 'tr-TR')
            : '-';
          const nextActionType = String(item.nextActionType || '').toLowerCase();
          const nextActionLabel =
            nextActionType === 'booking_confirmation'
              ? activeLang === 'en'
                ? 'Booking confirmation'
                : 'Rezervasyon teyidi'
              : nextActionType === 'same_day_discovery'
                ? activeLang === 'en'
                  ? 'Same-day discovery call'
                  : 'Ayni gun kesif gorusmesi'
                : nextActionType === 'scope_followup'
                  ? activeLang === 'en'
                    ? 'Scope follow-up'
                    : 'Kapsam takip gorusmesi'
                  : nextActionType === 'nurture_sequence'
                    ? activeLang === 'en'
                      ? 'Nurture sequence'
                      : 'Nurture takip akisi'
                    : '';
          const nextAction = nextActionLabel && nextActionDate !== '-' ? `${nextActionDate} | ${nextActionLabel}` : nextActionDate;

          return `<tr>
            <td>${createdLabel}</td>
            <td>${channel}</td>
            <td>${name}</td>
            <td>${score}</td>
            <td>${stage}</td>
            <td>${nextAction}</td>
          </tr>`;
        })
        .join('');
    };

    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        const leads = readStore(LEAD_STORE_KEY, []);
        if (!leads.length) return;

        const header = [
          'createdAt',
          'type',
          'stage',
          'priority',
          'owner',
          'name',
          'email',
          'phone',
          'company',
          'service',
          'score',
          'selectedDate',
          'selectedTime',
          'budget_range',
          'timeline_pref',
          'decision_role',
          'urgency',
          'nextActionType',
          'nextActionAt',
          'utm_source',
          'utm_medium',
          'utm_campaign',
          'utm_content',
          'utm_term',
          'gclid',
          'fbclid',
          'referrer',
          'landing_page',
          'locale',
          'timezone',
          'device',
          'first_seen_at',
          'last_seen_at'
        ];
        const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const lines = [header.join(',')];

        leads.forEach((item) => {
          lines.push(header.map((key) => esc(item[key])).join(','));
        });

        downloadText(lines.join('\n'), 'crm-leads.csv');
        trackEvent('crm_export', { count: leads.length });
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (!window.confirm(t('pipeline_clear_confirm'))) return;
        writeStore(LEAD_STORE_KEY, []);
        writeStore(EVENT_STORE_KEY, []);
        writeStore(ATTR_STORE_KEY, []);
        trackEvent('pipeline_clear');
        render();
      });
    }

    document.addEventListener('pipeline:update', render);
    document.addEventListener('language:change', render);

    document.addEventListener('click', (event) => {
      const target = event.target.closest('a,button');
      if (!target) return;

      const href = target.getAttribute('href') || '';
      const offer = target.dataset.offer || '';
      const label = normalizeText(target.textContent || '');
      const role = resolveCtaRole(target);
      const ctaMeta = {
        cta_variant: ctaVariant,
        cta_role: role || undefined
      };

      if (offer) {
        try {
          localStorage.setItem('selectedOffer', offer);
        } catch (error) {
          // ignore storage errors
        }
      }

      if (href.startsWith('#booking') || href.includes('booking')) {
        trackEvent('cta_booking_click', { label, href, offer: offer || undefined, ...ctaMeta });
      } else if (href.startsWith('#analysis') || href.includes('analysis')) {
        trackEvent('cta_analysis_click', { label, href, ...ctaMeta });
      } else if (href.includes('cases/')) {
        trackEvent('cta_case_click', { label, href, ...ctaMeta });
      }
    });

    render();
  };

  const initFaq = () => {
    const items = qa('.faq-grid details');
    if (!items.length) return;

    items.forEach((item) => {
      item.addEventListener('toggle', () => {
        if (!item.open) return;
        items.forEach((other) => {
          if (other !== item) other.removeAttribute('open');
        });
      });
    });
  };

  const boot = () => {
    body?.classList.add('js-ready');
    const hasBookingForm = Boolean(q('#booking-form'));
    const hasContactForm = Boolean(q('.contact-form'));
    const hasAnalysisForm = Boolean(q('#analysis-form'));
    const hasPortfolioCards = Boolean(q('.work-card'));
    const hasFaq = Boolean(q('.faq-grid details'));
    const hasPipelinePanel = Boolean(q('#pipeline-kpi-leads, #pipeline-table-body, #pipeline-export, #pipeline-clear'));

    captureAttribution();
    initAnalytics();
    const sessionAttribution = getAttribution();
    trackEvent('session_start', {
      path: window.location.pathname || '/',
      utm_source: sessionAttribution.utm_source || '',
      utm_campaign: sessionAttribution.utm_campaign || '',
      referrer: sessionAttribution.referrer || ''
    });
    initI18n();
    initCtaExperiment();
    initTrustUi();
    initHeroLaunch();
    initCtaPulse();
    initSeoMeta();
    initLiveSlots();
    initNav();
    initReveal();
    initProgress();
    if (q('.stat strong')) initCounters();
    if (hasBookingForm) initBooking();
    if (hasContactForm) initContact();
    if (hasPipelinePanel) initRevenueEngine();
    if (hasBookingForm || hasContactForm || hasAnalysisForm) initFormCompletionMeters();

    runWhenIdle(() => {
      if (hasPortfolioCards) {
        initPortfolio();
        initWorkCardTilt();
      }
      if (q('[data-story-slider]')) initStorySlider();
      if (hasAnalysisForm) initAnalysis();
      if (hasFaq) initFaq();
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
