# Arbeitszeiterfassung (PWA, offline, Single-User)

Dieses Projekt ist eine **installierbare PWA** (iOS/Android), die **offline** funktioniert und **genau im Layout-Stil** der Referenz-Screenshots aufgebaut ist:
- oben: **fixer Monatsblock** (Soll/Ist/Vormonat/Saldo)
- darunter: **alle Tage des Monats** als scrollbare Liste
- Klick auf Tag → **Edit-Panel klappt auf** (ohne Springen)

## Funktionen
- 40h/Woche (Mo–Fr Soll = 8,0h), Sa/So automatisch „Ruhetag“
- Tagestypen: Arbeitszeit, Urlaub, Krank, Feiertag, Ruhetag, Zeitausgleich
- Bayern-Feiertage **offline vor-eingetragen** (feste + bewegliche)
- Ort/Baustelle + Tagesnotiz
- Monats- & Jahresübersicht
- Export: **CSV + PDF + JSON-Backup**
- Import: CSV (merge/replace), JSON-Restore
- Offline-Cache (Service Worker)

## Start (lokal testen)
Am besten mit einem kleinen lokalen Webserver starten (damit Service Worker sauber läuft):

### Option A: VS Code Live Server
- Ordner öffnen
- „Live Server“ starten

### Option B: Python
```bash
python -m http.server 8080
```
Dann im Browser öffnen:
- http://localhost:8080/

## Installation als App (PWA)
### Android (Chrome)
- Seite öffnen
- Menü → **„Zum Startbildschirm hinzufügen“** / „App installieren“

### iOS (Safari)
- Seite öffnen
- Share → **„Zum Home-Bildschirm“**

## GitHub Pages Deployment
1. Neues Repo erstellen (z.B. `arbeitszeiterfassung`)
2. Diese Dateien ins Repo pushen (Root-Verzeichnis)
3. GitHub → Settings → Pages
   - Source: `Deploy from a branch`
   - Branch: `main` / `/ (root)`
4. Danach ist die App unter GitHub Pages erreichbar und installierbar.

## Dateien
- `index.html` – UI
- `styles.css` – Layout im Screenshot-Stil (Header sticky, Liste)
- `app.js` – Logik, Rendering, Editor, Jahransicht, Export/Import UI
- `holidays.js` – Feiertage Bayern (offline)
- `export.js` – CSV/JSON + **PDF-Generator (ohne externe Lib)**
- `db.js` – IndexedDB Speicher (Fallback localStorage)
- `sw.js` – Offline Cache
- `manifest.webmanifest` – PWA Manifest
- `icon-192.png`, `icon-512.png` – Icons

## Tipp
Für eine perfekte „Screenshot-Optik“ kannst du in `styles.css` noch minimal an Abständen/Fonts drehen – die Struktur ist schon korrekt.
