# Deployment and operations

## Request path

The browser loads built React files from Nginx, uses relative `/api` requests, and receives FastAPI responses through the same origin. Nginx preserves the `/api/` prefix. Only the frontend's localhost port is published; the backend is reachable inside the Compose network. The frontend waits for backend health at startup.

Nginx's read timeout is 60 seconds, above the backend's 45-second analysis limit. Automatic proxy retries are disabled so a timed-out write is not replayed by Nginx. Docker DNS is resolved periodically to handle backend recreation. Health checks confirm the API process and database path; they do not confirm live provider credentials or quota.

Official references: [Compose service configuration](https://docs.docker.com/reference/compose-file/services/) and [Nginx proxy module](https://nginx.org/en/docs/http/ngx_http_proxy_module.html).

## Routine commands

```bash
docker compose ps
docker compose logs --tail=100 backend frontend
python scripts/smoke.py
docker compose stop
docker compose start
```

`docker compose down` removes containers and the network but retains the named database volume. **Do not use `docker compose down -v` unless intentionally deleting all stored scenarios.** The logical volume key is `akim_database`, under Compose project `akim-city`. Keep the same project name to reuse it.

Rebuild after source changes with `docker compose up --build --wait`. Before updating an existing deployment, take a database backup and retain the previous source release. This release has no schema migration system. Dataset fingerprint mismatches should be resolved with a new dataset/engine version; do not delete the database merely to bypass the check.

## Backup

The supplied SQLite backup tool uses SQLite's online backup API, including committed WAL contents. It refuses to overwrite existing output and runs `integrity_check` before reporting success. Use a fresh filename for each backup.

Local backend, from the project root:

```bash
python backend/scripts/person4_backup.py backend/var/akim.sqlite3 backups/before-update.sqlite3
```

Docker deployment:

```bash
docker compose exec backend python scripts/person4_backup.py var/akim.sqlite3 var/backups/before-update.sqlite3
```

Create a local `backups/` directory, then copy the backup off the container volume:

```bash
docker compose cp backend:/app/backend/var/backups/before-update.sqlite3 backups/before-update.sqlite3
```

A backup left only inside the database volume does not protect against losing that volume.

## Restore planning

Stop both services before restoring. Retain the current database and its WAL/SHM files as a separate recovery set, validate the backup with SQLite's `PRAGMA integrity_check`, and restore it as `akim.sqlite3` in the named volume. Do not pair restored data with stale WAL/SHM files from another database. Preserve write access for the container's `appuser`, then start the services with the matching source release and dataset and run the smoke check. Never remove WAL files while a database process is running. A container restore was not tested here; rehearse it on a separate volume before relying on it for an important deployment.

## Troubleshooting

- Backend unhealthy: inspect logs for missing AI key, dataset fingerprint conflict, database permissions or configuration errors.
- UI loads but `/api` fails: confirm both services are healthy and rebuild the frontend in API mode through Compose.
- AI request fails: verify server-side key, account/model access and quota. The saved score remains available; the app does not pretend the failed AI call succeeded.
- Unexpected old explanation: change `AKIM_ANALYSIS_VERSION` and recreate the backend after modifying the model or prompt.
- Port occupied: set `AKIM_PORT` in root `.env`, then recreate frontend. Same-origin requests continue to work.

## Hosting boundary

Bind-address and port are configurable, but changing `AKIM_BIND_ADDRESS` to `0.0.0.0` makes the app reachable from other hosts if network policy allows it. Public deployment needs HTTPS, access control, request/cost limits, backups and operational monitoring. The demo does not implement login, tenant isolation or billing controls. Keep SQLite on one persistent local volume with one backend instance for this prototype.
