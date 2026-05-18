# Arbeitszeiterfassung DEV-Testapp

Diese zweite PWA liegt unter `/dev/` und ist von der echten App getrennt.

## Wichtige Trennungen

- eigener PWA-Scope: `/Arbeitszeiterfassung/dev/`
- eigene Manifest-ID: `/Arbeitszeiterfassung/dev/`
- eigener Service-Worker-Cache: `azdev-pwa-*`
- eigene IndexedDB: `az_pwa_db_dev`

Die echte App am Repo-Root bleibt unverändert.

## Testablauf

1. Echte App öffnen und ein JSON-Backup exportieren.
2. DEV-App öffnen: `https://slaxxmw.github.io/Arbeitszeiterfassung/dev/`
3. DEV-App installieren bzw. zum Startbildschirm hinzufügen.
4. Das JSON-Backup in der DEV-App wiederherstellen.
5. Änderungen nur in der DEV-App testen.

## Kompatibilitätsregel

Alte Restore-JSON-Dateien müssen weiter importierbar bleiben. Neue Datenfelder dürfen nur additiv ergänzt werden. Das bestehende Backup-Schema `schema: 1` darf nicht gebrochen werden.
