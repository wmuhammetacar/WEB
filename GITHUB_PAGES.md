# GitHub Pages Yayin Rehberi

## 1) Repo hazirla
1. Projeyi GitHub'a push et:
   - `git init`
   - `git add .`
   - `git commit -m "Initial portfolio release"`
   - `git branch -M main`
   - `git remote add origin https://github.com/<kullanici>/<repo>.git`
   - `git push -u origin main`

## 2) Pages ayari
1. GitHub repo -> `Settings` -> `Pages`
2. `Build and deployment` altinda `Source` secenegini `GitHub Actions` yap.

## 3) Otomatik deploy
1. Bu projede workflow hazir:
   - `.github/workflows/pages.yml`
2. `main` branch'e her push sonrasi otomatik deploy olur.
3. Workflow durumu:
   - `Actions` sekmesinden kontrol et.

## 4) Canli URL
1. Deploy tamamlaninca URL:
   - `https://<kullanici>.github.io/<repo>/`
2. Eger repo adi `<kullanici>.github.io` ise URL dogrudan root olur:
   - `https://<kullanici>.github.io/`

## 5) Son kontrol
1. Hard refresh yap (`Ctrl+F5`).
2. `robots.txt` ve `site.webmanifest` erisilebilir mi kontrol et.
3. Rezervasyon ve iletisim formlarini canlida 1 kez test et.
