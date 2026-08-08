# ToDo

ToDo is a deliberately focused task application for everyday use. It supports multiple lists, tasks and subtasks, due dates, recurring tasks, notes, stars, search, dark mode, installable PWA support, user accounts, shared lists, and German/English localization.

> **AI disclosure:** This project was developed with substantial assistance from large language models (LLMs). LLMs contributed to implementation, refactoring, documentation, and testing. The project owner directed the work and reviewed the generated results, but users should perform their own code and security review before a production deployment.

## Run locally

```bash
dotnet run
```

Local development requires PostgreSQL. The fallback connection uses `localhost:5432` with database, user, and password set to `todo`. Docker Compose is usually the easiest way to start the complete stack.

## Run with Docker

```bash
POSTGRES_PASSWORD='replace-with-a-long-secret' docker compose up -d --build
```

The application is available at `http://localhost:8080`. PostgreSQL data is stored in the named `postgres-data` volume and survives container replacement.

Without `POSTGRES_PASSWORD`, Compose uses the intentionally insecure local development value `todo-development-only`. Never use this default for a publicly reachable deployment. Put a strong secret in an untracked `.env` file or provide it through your deployment platform.

## Accounts, languages, and shared lists

Users register with an email address and password. A list owner can grant edit access to another existing account from the list options menu.

The web UI supports German and English. It initially follows the browser language. An authenticated user can choose another language in the user menu; this preference is stored with the account and therefore applies on other devices as well.

## Export Microsoft To Do to JSON

The Bash script `scripts/export-microsoft-todo.sh` exports Microsoft To Do lists, tasks, notes, and checklist items. It requires `bash`, `curl`, `jq`, and a short-lived Microsoft Graph access token with the delegated `Tasks.Read` permission.

Obtain the token from [Microsoft Graph Explorer](https://developer.microsoft.com/graph/graph-explorer) after signing in and consenting to `Tasks.Read`. Treat the token as a password: do not commit or retain it longer than necessary.

```bash
./scripts/export-microsoft-todo.sh --output microsoft-todo-export.json
```

The script prompts for the token without displaying it. It can also read the token from a protected file:

```bash
./scripts/export-microsoft-todo.sh \
  --token-file /secure/path/graph-token.txt \
  --output microsoft-todo-export.json
```

To import the result, open the user menu by selecting the displayed email address and choose **Import Microsoft To Do**. The application previews the number of lists and tasks before importing. Microsoft IDs are retained, so importing the same data again updates existing imported entries instead of creating duplicates.

## Data model notes

The application creates its PostgreSQL schema on startup. Compatibility SQL currently upgrades existing Docker volumes with newer columns and indexes. For a larger production deployment, replace this bootstrap mechanism with versioned Entity Framework Core migrations.

Imported Microsoft checklist items become subtasks. A parent task cannot be completed until all of its subtasks are complete, and tasks that still contain subtasks cannot be deleted.
