# CSV-Export v1.7.1 - Summen und Kumulierte Werte

## 📊 Was ist neu?

Die CSV-Exporte enthalten jetzt **alle Summen und Salden** wie im Tool!

### 📅 CSV Monat-Export

**Am Ende der Datei findest du 3 zusätzliche Zeilen:**

```csv
;SUMME MONAT;;;;;;;120,00;152,50;32,50;;
;S. Vormonat;;;;;;;;-5,50;;
;SALDO;;;;;;;;27,00;;
```

**Bedeutung:**
- **SUMME MONAT**: Alle Soll/Ist/Diff-Stunden des Monats addiert
- **S. Vormonat**: Übertrag vom Vormonat (Startsaldo)
- **SALDO**: Endsaldo des Monats (S. Vormonat + Diff)

### Beispiel CSV Monat (Januar 2025):
```csv
## Arbeitszeiterfassung Export
## Firma: Zaunteam
## Name: Max Mustermann
## Export-Datum: 13.01.2025
## Export-Typ: Monat Januar 2025
Datum;Wochentag;Typ;Start;Ende;Pause_h;Soll_h;Ist_h;Diff_h;Ort;Notiz
01.01.2025;Mittwoch;Feiertag;;;;0,00;0,00;0,00;;"Neujahr"
02.01.2025;Donnerstag;Arbeitszeit;08:00;17:00;0,50;8,00;8,50;0,50;"Büro";
03.01.2025;Freitag;Arbeitszeit;08:00;16:30;0,50;8,00;8,00;0,00;"Büro";
06.01.2025;Montag;Feiertag;;;;0,00;0,00;0,00;;"Heilige Drei Könige"
...
;SUMME MONAT;;;;;;;160,00;168,50;8,50;;
;S. Vormonat;;;;;;;;-5,25;;
;SALDO;;;;;;;;3,25;;
```

✅ **In Excel:** Alle Summen am Ende sofort sichtbar!

---

### 📆 CSV Jahr-Export

**Viel übersichtlicher mit monatlichen Zwischensummen!**

Nach jedem Monat siehst du:
1. **Monatssumme**: Soll/Ist/Diff nur für diesen Monat
2. **KUMULIERT BIS [MONAT]**: Summen vom Jahresanfang bis zu diesem Monat
3. Leerzeile zur besseren Lesbarkeit

Am Ende: **JAHRESSUMME** mit Jahressaldo

### Beispiel CSV Jahr (2025):
```csv
## Arbeitszeiterfassung Export
## Firma: Zaunteam
## Name: Max Mustermann
## Export-Datum: 13.01.2025
## Export-Typ: Jahr 2025
Datum;Wochentag;Typ;Start;Ende;Pause_h;Soll_h;Ist_h;Diff_h;Ort;Notiz

=== JANUAR ===
01.01.2025;Mittwoch;Feiertag;;;;0,00;0,00;0,00;;
02.01.2025;Donnerstag;Arbeitszeit;08:00;17:00;0,50;8,00;8,50;0,50;;
...
;--- JANUAR 2025 ---;;;;;160,00;168,50;8,50;;"Monatssumme"
;KUMULIERT BIS JANUAR;;;;;160,00;168,50;8,50;;"Saldo: 3,25 h"
;;;;;;;;;

=== FEBRUAR ===
01.02.2025;Samstag;Ruhetag;;;;0,00;0,00;0,00;;
03.02.2025;Montag;Arbeitszeit;08:00;16:00;0,50;8,00;7,50;-0,50;;
...
;--- FEBRUAR 2025 ---;;;;;152,00;147,00;-5,00;;"Monatssumme"
;KUMULIERT BIS FEBRUAR;;;;;312,00;315,50;3,50;;"Saldo: -1,75 h"
;;;;;;;;;

...

========== JAHRESSUMME ==========
;========== JAHRESSUMME ==========;;;;;1920,00;1965,25;45,25;;"Jahressaldo: 40,00 h"
```

✅ **Perfekt um zu sehen:**
- Wie entwickelt sich mein Saldo über das Jahr?
- In welchem Monat hatte ich Überstunden?
- Gesamtübersicht für die Buchhaltung

---

## 🎯 Vorteile

### Für dich:
✅ Keine manuelle Berechnung mehr nötig
✅ Sofort sehen: Überstunden oder Unterstunden?
✅ Monatsentwicklung auf einen Blick (Jahres-CSV)

### Für die Buchhaltung:
✅ Alle Zahlen wie im Tool
✅ Kumulierte Werte pro Monat
✅ Jahressaldo am Ende
✅ Professionell und übersichtlich

### Für Excel:
✅ Umlaute perfekt (UTF-8 BOM)
✅ Summen automatisch am Ende
✅ Filter und Pivot-Tabellen möglich
✅ Direkt weiterverarbeiten

---

## 📝 Verwendung

### Monats-CSV exportieren:
```
1. Einstellungen öffnen (⚙️)
2. Export → "CSV Monat" klicken
3. Datei wird heruntergeladen
4. In Excel öffnen
5. Summen am Ende prüfen ✓
```

### Jahres-CSV exportieren:
```
1. Einstellungen öffnen (⚙️)
2. Export → "CSV Jahr" klicken
3. Datei wird heruntergeladen
4. In Excel öffnen
5. Monatliche Entwicklung verfolgen ✓
```

---

## 💡 Tipps

### In Excel weiterarbeiten:
1. CSV öffnen
2. Spalten anpassen (Breite)
3. Filter auf Header-Zeile setzen
4. Summenzeilen fett markieren
5. Für Buchhaltung: Als .xlsx speichern

### Für Zeiterfassungs-Software:
Die CSV ist kompatibel mit den meisten Tools:
- Personio
- BambooHR
- Sage
- DATEV
- Lexoffice

### Für Steuerberater:
Jahres-CSV enthält alles:
- Monatliche Übersicht
- Kumulierte Werte
- Jahressaldo
- Alle Einzeltage

---

## 🔍 Technische Details

### Berechnung der Werte:

**Monatssumme:**
```
Soll_Monat  = Summe aller Soll_h des Monats
Ist_Monat   = Summe aller Ist_h des Monats
Diff_Monat  = Ist_Monat - Soll_Monat
```

**Monatssaldo:**
```
S. Vormonat = Saldo vom Vormonat (oder Jahresstartsaldo bei Januar)
Saldo       = S. Vormonat + Diff_Monat
```

**Kumulierte Werte (Jahr):**
```
Kumuliert_Soll  = Summe von Jan bis aktueller Monat
Kumuliert_Ist   = Summe von Jan bis aktueller Monat
Kumuliert_Diff  = Kumuliert_Ist - Kumuliert_Soll
Jahressaldo     = Jahresstartsaldo + Kumuliert_Diff
```

### CSV-Format:
- **Trenner:** Semikolon (;)
- **Dezimal:** Komma (,)
- **Encoding:** UTF-8 mit BOM
- **Zeilenumbruch:** Windows (CRLF)
- **Escape:** Doppelte Anführungszeichen

---

## ⚠️ Wichtig

### Meta-Header ignorieren:
Die ersten 5 Zeilen mit `##` sind Meta-Informationen.
Excel erkennt sie automatisch als Kommentar.
Beim Re-Import werden sie automatisch übersprungen.

### Summenzeilen erkennen:
- Datum-Spalte ist leer
- Wochentag-Spalte enthält den Text (z.B. "SUMME MONAT")
- Beim Re-Import werden Summenzeilen automatisch ignoriert

---

## 🎉 Zusammenfassung

**v1.7.1 macht CSV-Export perfekt!**

✅ Monat: Summen am Ende (wie im Tool)
✅ Jahr: Monatliche Zwischensummen + kumulierte Werte
✅ Excel-kompatibel (UTF-8 BOM)
✅ Für Buchhaltung geeignet
✅ Keine manuelle Berechnung mehr nötig

**Probier es aus und spare Zeit!** ⏰
