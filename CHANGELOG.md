# Changelog

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
