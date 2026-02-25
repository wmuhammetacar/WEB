# Deploy Notları

## 1) Yayın Öncesi Kontrol
- Lokal doğrulama: `node --check app.js`
- `index.html` içindeki `window.SITE_CONFIG.bookingUrl` alanını kontrol et.
- `index.html` içindeki `window.SITE_CONFIG.analyticsId` alanına GA4 ID gir:
  - Örnek: `G-XXXXXXXXXX`
- Gerekirse sabit domain tanımla:
  - `siteUrl: 'https://senindomainin.com'`

## 2) Dosyaları Yayınla
- Statik hosting seçenekleri: Netlify, Vercel, Cloudflare Pages, GitHub Pages.
- Klasörü root olarak yayınla (`index.html` root'ta olmalı).
- Şu dosyaları birlikte yayınla:
  - `_headers`
  - `robots.txt`
  - `sitemap.xml`
  - `site.webmanifest`

## 3) Canlı Smoke Test (Zorunlu)
- Ana sayfa açılıyor mu, mobil menü düzgün çalışıyor mu?
- Dil değiştirici:
  - TR/EN geçişinde metinler tutarlı mı?
- Rezervasyon akışı:
  - Tarih/saat seç
  - Formu doldur
  - Gönderim ve durum mesajını kontrol et
- Canlı takvim sekmesi:
  - Geçerli URL gir
  - `embed-health` durumları `ready` seviyesine geçiyor mu?
- İletişim ve analiz formlarını en az 1 kez test et.
- Pipeline paneli:
  - 1 analiz + 1 rezervasyon formu gönder
  - `CRM CSV İndir` ile dosya al
  - CSV içinde `utm_*`, `stage`, `priority`, `nextActionType` alanlarını doğrula

## 4) SEO / Güvenlik Son Kontrol
- `https://domainin.com/robots.txt` erişilebilir olmalı.
- `https://domainin.com/sitemap.xml` erişilebilir olmalı.
- `sitemap.xml` içindeki `https://your-domain.com` alanlarını kendi domainin ile değiştir.
- Tarayıcı konsolunda CSP kaynaklı engel var mı kontrol et.
- Google Search Console'da property doğrula ve sitemap gönder.

## 5) Performans Hedefi
- Chrome Lighthouse (mobile) çalıştır.
- Hedef:
  - Performance `90+`
  - Best Practices `95+`
  - SEO `95+`
  - Accessibility `90+`
