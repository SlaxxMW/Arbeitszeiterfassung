# Arbeitszeiterfassung v1.7.0 - Update-Anleitung

## 🎉 Neue Features

### 1. ⏰ Zeitraum-Eingabe für Urlaub/Krankheit
**Endlich mehrere Tage auf einmal erfassen!**

- **Wo:** Button "📅 Zeitraum" im Monatsansicht-Header
- **Wie:** 
  1. Von-Datum auswählen
  2. Bis-Datum auswählen
  3. Typ wählen (Urlaub/Krank/Ruhetag/Zeitausgleich)
  4. Optional: Notiz hinzufügen
  5. "Erfassen" klicken
- **Vorteil:** Urlaubswoche in 10 Sekunden statt 5x einzeln

### 2. 📊 Verbesserter CSV-Export
**Perfekt für Excel und andere Programme!**

- ✅ UTF-8 BOM für korrekte Umlaute in Excel
- ✅ Bessere Spaltenformatierung
- ✅ Korrekte Escape-Zeichen für Kommas/Anführungszeichen
- ✅ Windows-Zeilenumbrüche (Excel-Standard)
- ✅ 100% kompatibel mit Excel, LibreOffice, Numbers

**Tipp:** CSV in Excel öffnen → Umlaute werden jetzt korrekt angezeigt!

### 3. 🔔 Backup-Warnung vor Updates
**Deine Daten sind sicher!**

- Automatische Warnung wenn Backup älter als 7 Tage
- Bestätigung vor Update-Installation erforderlich
- "Letztes Backup" in Einstellungen sichtbar

## 📥 Installation

### Option A: Bestehende Installation aktualisieren
1. Öffne deine bestehende Arbeitszeiterfassung-App
2. Gehe zu **Einstellungen** (⚙️)
3. **WICHTIG:** Klicke auf "Backup JSON" und speichere die Datei sicher
4. Schließe die App
5. Ersetze alle Dateien mit den neuen aus diesem Update
6. Öffne die App neu
7. Falls Daten fehlen: "Restore JSON" in Einstellungen

### Option B: Neuinstallation
1. Kopiere alle Dateien in einen Ordner
2. Öffne `index.html` in einem Browser
3. Fertig!

### Option C: GitHub Pages (online)
1. Lade alle Dateien in dein GitHub Repository hoch
2. Settings → Pages → Deploy from branch
3. Fertig!

## 🔧 Verwendung

### Zeitraum erfassen (Beispiel: Weihnachtsurlaub)
```
1. Klicke auf "📅 Zeitraum"
2. Von: 23.12.2024
3. Bis: 02.01.2025
4. Typ: Urlaub
5. Notiz: "Weihnachtsferien"
6. Klick "Erfassen"
→ 11 Tage automatisch eingetragen!
```

### CSV exportieren
```
1. Einstellungen → Export
2. "CSV Monat" oder "CSV Jahr"
3. Datei wird heruntergeladen
4. In Excel öffnen → Umlaute perfekt! ✓
```

### Backup erstellen
```
1. Einstellungen → Export
2. "Backup JSON" klicken
3. Datei sicher aufbewahren (z.B. Google Drive)
```

## ⚠️ Wichtige Hinweise

### Vor dem Update
- **BACKUP ERSTELLEN!** (Einstellungen → Backup JSON)
- Alte Backup-Datei sicher aufbewahren

### Nach dem Update
- Cache/Cookies können gelöscht werden: Einstellungen → "Cache/Update-Reset"
- Falls App nicht lädt: Browser-Cache leeren (Strg+F5)
- Android: App evtl. neu installieren (deinstallieren → neu hinzufügen)

### Bei Problemen
1. Backup JSON erstellen (falls App noch läuft)
2. Cache/Update-Reset in Einstellungen
3. Browser neu laden (F5 oder Strg+F5)
4. Falls nichts hilft: Backup JSON wiederherstellen

## 📱 Kompatibilität

**Getestet auf:**
- ✅ Chrome/Edge (Desktop + Android)
- ✅ Firefox (Desktop + Android)
- ✅ Safari (macOS + iOS)
- ✅ Samsung Internet (Android)

**Anforderungen:**
- Moderner Browser mit JavaScript
- IndexedDB Support (alle modernen Browser)
- Optional: Service Worker für Offline-Nutzung

## 🐛 Bekannte Probleme & Lösungen

### Problem: CSV öffnet in Excel mit falschen Zeichen
**Gelöst in v1.7.0!** UTF-8 BOM sorgt für korrekte Darstellung.

### Problem: Update wird nicht angezeigt
1. Einstellungen → "Update suchen"
2. Falls nichts passiert: "Cache/Update-Reset"
3. Seite neu laden

### Problem: Zeitraum-Button fehlt
1. Browser-Cache leeren (Strg+Shift+Entf)
2. Seite neu laden (Strg+F5)
3. Falls weiter Probleme: "Cache/Update-Reset" in Einstellungen

## 📝 Changelog

### v1.7.0 (2025-01-13)
- NEU: Zeitraum-Eingabe für Urlaub/Krankheit
- VERBESSERT: CSV-Export (UTF-8 BOM, Excel-kompatibel)
- NEU: Backup-Warnung vor Updates
- Fix: CSV-Felder korrekt escaped
- Fix: Windows-Zeilenumbrüche für Excel

Alle Details: siehe CHANGELOG.md

## 💡 Tipps & Tricks

### Schnell-Workflow für Urlaub
1. Klick "📅 Zeitraum"
2. Urlaub auswählen
3. Dates eingeben
4. Fertig! ⚡

### Monatliches Backup
- Backup JSON am Monatsende erstellen
- In Cloud speichern (Google Drive, OneDrive, etc.)
- Bei Problemen: Backup wiederherstellen

### CSV für Buchhaltung
1. CSV Jahr exportieren
2. In Excel öffnen (Umlaute jetzt korrekt!)
3. An Steuerberater senden

## 🙏 Feedback & Support

Probleme oder Wünsche? 
- Thumbs-Down Button in der App nutzen
- Oder direkt Feedback geben

Viel Erfolg mit der neuen Version! 🎉
