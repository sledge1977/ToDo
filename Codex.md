# ToDo – Codex Übergabe

## Überblick

Die Anwendung ist eine ASP.NET-Core-10-Web-App mit statischem JavaScript-Frontend und PostgreSQL. Der Einstiegspunkt ist `Program.cs`; die UI liegt unter `wwwroot/`.

## PWA und Offline-Verhalten

- `wwwroot/manifest.webmanifest`, `wwwroot/icon.svg` und `wwwroot/sw.js` bilden die PWA-Grundlage.
- `wwwroot/app.js` cached die zuletzt geladenen Listen in `localStorage.todoLists`.
- Mutationen werden bei Offline-Betrieb in `localStorage.todoOfflineQueue` abgelegt und lokal optimistisch angewendet.
- Beim `online`-Event werden die Mutationen nacheinander an die API gesendet und danach die Serverdaten geladen.
- Die UI zeigt unter dem Header Online-/Offline-Status sowie die Zahl ausstehender Offlineänderungen.

## Konflikte

Listen und Aufgaben besitzen `LastChangedAt`. Änderungen senden `ChangedAt`; auf dem Server wird eine Änderung nur angewendet, wenn ihr Zeitpunkt mindestens so aktuell ist wie der gespeicherte Zeitpunkt. Damit gilt für geteilte Listen Last Write Wins.

## Entwicklung und Test

```bash
dotnet build --no-restore
node --check wwwroot/app.js
docker compose up -d --build
curl http://localhost:8080/
```

Die Docker-Umgebung nutzt PostgreSQL und ist für lokale Tests gedacht. Mit `docker compose down --remove-orphans` werden die Container entfernt; Volumes bleiben erhalten. Für einen komplett frischen Datenbanktest zusätzlich gezielt `docker compose down -v` verwenden.

## Hinweise für Änderungen

Bei neuen schreibenden API-Aufrufen muss `app.js` die Mutation weiterhin mit `ChangedAt` versehen und offline lokal anwenden können. Neue statische Assets in `sw.js` aufnehmen und bei UI-Änderungen Cache-Version/Query-String erhöhen.
