# Final QA Checklist

## A) Layout / Responsive
- [ ] 360px genislikte hero, nav ve CTA tasmiyor.
- [ ] 390px genislikte booking tablari ve butonlar tek satir bozulmuyor.
- [ ] 768px tablette grid bloklari dengeli gorunuyor.
- [ ] 1024px uzeri desktopta sticky hero-card dogru calisiyor.

## B) Core Flows
- [ ] Booking hizli akista tarih + saat secilebiliyor.
- [ ] Booking formu secili saat olmadan gonderime izin vermiyor.
- [ ] Booking submit sirasinda buton kilitleniyor ve tekrar tik engelleniyor.
- [ ] Booking taslak verisi sayfa yenilenince geri geliyor.
- [ ] Live calendar URL dogrulamasi calisiyor.
- [ ] Embed health paneli `idle -> loading -> ready` gecislerini veriyor.

## C) Forms / Security
- [ ] Analysis formu gonderim sonrasi durum mesaji veriyor.
- [ ] Contact formu gonderim sonrasi durum mesaji veriyor.
- [ ] Honeypot alanlari UI'da gorunmuyor.
- [ ] Hizli tekrar submitte cooldown mesaji gorunuyor.

## D) SEO / Technical
- [ ] Canonical URL canli domain olarak setleniyor.
- [ ] OG/Twitter image URL'leri absolute URL'e donusuyor.
- [ ] `robots.txt` ve `site.webmanifest` erisilebilir.
- [ ] Console'da kritik JS/CSP hatasi yok.

