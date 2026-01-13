
## 1.7.1 (20250113-csv-summen)
- **VERBESSERT: CSV Monat-Export** - enthält jetzt Summenzeilen (Soll/Ist/Diff/S.Vormonat/Saldo) wie im Tool
- **VERBESSERT: CSV Jahr-Export** - zeigt monatliche Zwischensummen und kumulierte Werte bis zu jedem Monat
- CSV Jahr: Nach jedem Monat wird die Monatssumme und der kumulierte Stand (bis zu diesem Monat) angezeigt
- CSV Jahr: Am Ende steht die Jahressumme mit Jahressaldo
- Perfekt für Übersicht und Buchhaltung!

## 1.7.0 (20250113-zeitraum-csv-backup)
- **NEU: Zeitraum-Eingabe** für Urlaub/Krankheit - erfasse mehrere Tage auf einmal (Button "📅 Zeitraum" im Header)
- **VERBESSERT: CSV-Export** - UTF-8 BOM für perfekte Excel-Kompatibilität + bessere Formatierung
- **NEU: Backup-Warnung vor Updates** - automatische Warnung wenn Backup älter als 7 Tage
- Fix: CSV-Felder jetzt korrekt escaped (Anführungszeichen)
- Fix: Windows-Zeilenumbrüche für bessere Excel-Kompatibilität

## 1.6.4g (20251223-sw-ctrl-install)
- Android: Installierbarkeit gehärtet (Manifest+SW Scope/StartURL, Precache minimal, keine Precache-404s)
- Android/iOS: Layout unverändert (gleich wie 1.6.4b)

## 1.6.4a (20251223-084036)
- Android: Install-Diagnose in Einstellungen (Secure/SW/Controller/Prompt/Standalone) + "App installieren" Button (nur wenn Chrome beforeinstallprompt liefert).
- Android: optional chaining entfernt (kompatibler bei älteren WebViews).
- Intern: ServiceWorker Cache-Version auf 1.6.4a (keine Cache-Mix-Zustände).

## 1.6.3 (20251222-234900)
- UI: Nicht genutzte Header-Icons entfernt (⤓ Export & ⋮ Menü), damit nur funktionierende Buttons sichtbar sind.

## 1.6.2 (20251222-233459)
- Fix: iPhone Settings toggles (checkboxes) visible/clickable again (Mariä Himmelfahrt, Augsburger Friedensfest, Jahres-CSV).

## 1.6.1 (2025-12-23)
- Neu: Einstellungen zeigen "Letztes Backup" (Datum/Uhrzeit).
- Neu: CSV Import Modal mit "Abbrechen" (zusätzlich zum ✕), zurück zur App ohne festzuhängen.
- Fix: iPhone/kleine Screens – Settings-Checkboxes + CSV-Import nicht mehr abgeschnitten (Modal max-width + File-Input Shrink + iOS Scroll).

## 1.6.0 (2025-12-22)
- Neu: Auto-Backup Erinnerung (1x pro Woche) mit Popup + "Backup jetzt (JSON)".
- Fix: Einstellungen-Modal mobil ohne horizontales Verschieben (Overflow-X hidden, File-Input max-width, Import-Vorschau wrap).
- Info: Offline-Status sichtbar im Header (vX • build • offline).

## 1.5.9 (2025-12-22)
- Fix: iPhone Offline-Start zeigt keinen falschen "Service Worker nicht bereit"-Hinweis mehr (SW-Register wird offline nicht als Fehler gewertet).

## 1.5.8 (2025-12-22)
- Fix: Offline/PWA stabiler (Service Worker Navigation-Fallback + sichtbarer SW-Fehler)
- Fix: Version-Querystrings entfernt (bessere Precache-Treffer)

## 1.5.7 (20251222-220213)
- Export: Neuer "Handy Monat"-Report als HTML (WhatsApp-/Handy-lesbar: Karten-Ansicht + Tabelle + Summen).
- Export: PDF Monat/Jahr zeigt jetzt pro Tag zusätzlich Ist/Soll/Diff.
- Intern: Patchpoints/Marker ergänzt (Updates künftig schneller & sicherer).

## 1.5.6 (20251222-182127)
- Fix: Dezember 'S. Vormonat' / Saldo bleibt korrekt, auch wenn Okt/Nov nur per Monats-CSV vorhanden sind.
- Fix: ServiceWorker Cache-Version aktualisiert (Updates werden zuverlässig geladen).
# Changelog

## v1.5.5 (20251222-172134)
- Fix: "S. Vormonat"/Saldo explodiert nicht mehr im Dezember – Monate ohne echte Tagesdaten werden bei der Saldo-Kette ignoriert (kein -8h/Tag für Jan–Sep, wenn du erst ab Okt erfasst)
- Fix: Jahresübersicht nutzt ebenfalls nur Monate mit echten Tagesdaten (keine riesigen negativen Werte für nicht erfasste Monate)
- CSV Import UX: Nach Daily-CSV Import springt die Ansicht automatisch in den importierten Monat (damit es nicht "leer" wirkt)
- Export: Pause wird in CSV nur bei Arbeitszeit ausgegeben (bei Urlaub/Krank/Feiertag/Ruhetag leer)

## v1.5.4 (20251222-152900)
- Fix: Monatswerte (Soll/Ist/Diff/Saldo) werden wieder tagesaktuell aus den Tages-Einträgen berechnet (Import-Werte nur noch Fallback, wenn der Monat keine Tagesdaten hat)
- Export: CSV enthält jetzt Meta-Kopf (Firma/Name/Export-Datum/Export-Typ) – Import ignoriert diese Zeilen automatisch
- Export: PDF deutlich aufgeräumt (ohne Soll/Ist/Diff/Saldo-Spalten), aber mit Firma/Name/Export-Datum/Export-Typ im Header

## v1.5.3 (20251222-143730)
- CSV Import: Monats-CSV wird erkannt und als Monatswert in die Jahres-CSV-Struktur gemerged (Soll/Ist/Diff/Saldo sichtbar)
- CSV Import: Daily-CSV erkennt jetzt auch Spaltennamen wie "Tag" / "Arbeitstag" als Datum
- CSV Parser: robuster bei Monats-Headern (Monat/Soll/Ist/Vormonat)

## v1.4.0 (20251222-002827)
- Jahres-Saldo reset pro Jahr (Startsaldo pro Jahr in Einstellungen)
- Jahre < 2025 werden automatisch bereinigt
- CSV Import speichert jetzt wirklich in der Datenbank (Merge/Replace)
- Bundesland-Auswahl für Feiertage (Default BY), Mariä Himmelfahrt Toggle (Default an)
- Zaunteam-Farben im UI (grün/rot)
- Update-Anzeige + Update-Button (Service Worker) + Cache/Update-Reset
- PDF Export (Monat/Jahr) als Download

## 1.6.4b (20251223-090542)
- Android Layout-Fix: CSS+JS in index.html eingebettet, um Host/MIME/Redirect-Probleme auszuschließen.


## 1.6.4d (2025-12-23)
- Android: Installierbarkeit gehärtet (Manifest+SW Scope/StartURL, Precache minimal, keine Precache-404s)
- Android/iOS: Layout unverändert (gleich wie 1.6.4b)
