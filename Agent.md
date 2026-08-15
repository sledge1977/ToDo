# Agent.md

## Arbeitsregeln für zukünftige Sessions

1. Vor Änderungen `Codex.md`, `README.md`, `Program.cs` und `wwwroot/app.js` prüfen.
2. Bestehende Benutzeränderungen nicht überschreiben; zuerst `git status --short` ausführen.
3. Nach Backend-Änderungen `dotnet build --no-restore` ausführen.
4. Nach JavaScript-Änderungen `node --check wwwroot/app.js` ausführen.
5. Für einen Integrationscheck Docker mit `docker compose up -d --build` starten und `/`, Manifest und Service Worker über Port 8080 prüfen.
6. Offline-Szenarien im Browser mit Application-Cache/Netzwerk-Simulation testen: App online laden, Netzwerk trennen, Aufgabe/Liste anlegen, Queue-Zähler prüfen, Netzwerk wieder aktivieren und Synchronisierung kontrollieren.
7. Bei geteilten Daten die Last-Write-Wins-Regel über `ChangedAt` und `LastChangedAt` beibehalten.

## Projektstruktur

- `Program.cs`: Authentifizierung, API, EF-Core-Modelle und idempotente Datenbank-Upgrades.
- `wwwroot/index.html`: UI-Struktur und Dialoge.
- `wwwroot/app.js`: Übersetzungen, UI, API-Client, Offline-Cache und Sync-Queue.
- `wwwroot/app.css`: Layout und responsive Darstellung.
- `wwwroot/sw.js`: PWA-Cache und statische Offline-Auslieferung.
- `compose.yaml`: ToDo- und PostgreSQL-Container.
