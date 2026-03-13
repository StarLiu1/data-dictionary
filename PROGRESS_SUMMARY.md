# Admin Portal + Azure Migration — Progress Summary

## Date: March 12, 2026

## What Was Accomplished

### Azure Infrastructure
- **Virtual Machine:** `data-dictionary` (Standard B2s, 2 vCPUs, 4 GiB RAM, Ubuntu 24.04)
  - Public IP: `52.146.18.204`
  - Resource group: `JH-SOM-INFORMATICS-DEV-RG`
  - SSH access: `ssh -i ~/Downloads/data-dictionary_key.pem azureuser@52.146.18.204`
  - Username: `azureuser`
- **PostgreSQL:** Installed directly on the VM (not a separate Azure service)
  - Database: `data_dictionary`
  - User: `ddadmin`
  - Connection: `postgresql://ddadmin:PASSWORD@localhost:5432/data_dictionary`
  - Tables: `dictionaries`, `admin_users`, `edit_history`
  - Seeded with `metadata.json` (67 tables, 2,272 columns from `deid.derived`)
  - `StarLiu1` added as initial superadmin
- **Decided against Azure PostgreSQL Flexible Server** — was provisioned initially (~$15/month Burstable B1ms) but switched to on-VM Postgres to save cost and reduce complexity. The Azure Flexible Server should be deleted if not already.

### FastAPI Backend (Step 2 — Complete)
Built and deployed at `http://52.146.18.204:8000`, proxied via Nginx at `/api/`.

**Files created in `backend/`:**
- `__init__.py`
- `config.py` — Pydantic settings, reads from `.env`
- `database.py` — SQLAlchemy engine + session
- `models.py` — `Dictionary` (JSONB metadata), `AdminUser`, `EditHistory`
- `main.py` — FastAPI app with CORS, mounts routers
- `seed.py` — Imports `metadata.json` into PostgreSQL, seeds initial admin
- `routers/__init__.py`
- `routers/metadata.py` — `GET /api/metadata/`, `GET /api/metadata/{dict_id}`, `GET /api/metadata/{dict_id}/tables/{table_name}`
- `routers/auth.py` — `GET /api/auth/me` (returns user info + admin status), `GET /api/auth/github/callback` (OAuth token exchange, replaces Cloudflare Worker)
- `routers/admin.py` — `PUT` endpoints for editing column/table metadata, admin user CRUD, edit history
- `requirements.txt` — fastapi, uvicorn, sqlalchemy, psycopg2-binary, pydantic-settings, httpx, python-dotenv

**Database schema:**
- `dictionaries` — id, name, schema_name, metadata_json (JSONB), created_at, updated_at
- `admin_users` — id, github_username, role ("admin"|"superadmin"), added_by, created_at
- `edit_history` — id, dictionary_id, table_name, column_name, field_name, old_value, new_value, edited_by, github_issue_number, created_at

### React Frontend Updates (Steps 4–7 — Complete)

**New files created in `src/`:**
- `api.js` — Centralized API client with auth headers, base URL from `VITE_API_URL` env var
- `EditableField.jsx` — Inline edit component (pencil icon on hover for admins, input/textarea toggle, save/cancel, keyboard shortcuts)
- `ApplyIssueModal.jsx` — Modal for admins to apply a GitHub issue's suggested change to metadata, optionally close the issue
- `AdminPanel.jsx` — Admin dashboard tab with three cards: open issues with "Apply" buttons, admin user management (add/remove), edit history log

**Modified files:**
- `data_dictionary_ui.jsx`:
  - Removed embedded `EMBEDDED_METADATA` constant
  - Now fetches metadata from `/api/metadata/1` via `apiFetch()`
  - Added `useAuth()` hook and `isAdmin` check
  - Column comment cells now use `<EditableField>` component
  - Table comment in header uses `<EditableField>`
  - Added "Admin" tab (visible only to admins) rendering `<AdminPanel>`
- `GitHubAuthProvider.jsx`:
  - After fetching GitHub user profile, calls `/api/auth/me` to check admin status
  - Stores `isAdmin` and `role` on the user object
- `github_auth.js`:
  - Changed `WORKER_URL` from Cloudflare Worker to `/api/auth` (relative URL, works in both dev and production)
- `vite.config.js`:
  - Changed `base` from `'/data-dictionary/'` to `'/'` (self-hosted, no longer GitHub Pages subpath)
  - Added dev proxy: `/api` → `http://localhost:8000`

### Deployment (Step 8 — Complete)

**On the VM:**
- Repo cloned to `~/data-dictionary`
- Node.js 20 installed, `npm run build` outputs to `dist/`
- FastAPI runs as systemd service: `data-dictionary.service`
  - ExecStart: `uvicorn backend.main:app --host 0.0.0.0 --port 8000`
  - Auto-restarts on failure
- Nginx reverse proxy configured:
  - `/api/` → proxied to FastAPI on port 8000
  - Everything else → serves React build from `dist/`
  - Config at `/etc/nginx/sites-available/data-dictionary`
- Port 80 open in NSG (was already open along with 443 and 8080)
- Home directory permissions fixed: `chmod 755 /home/azureuser`

**`.env` file on VM at `~/data-dictionary/.env`:**
```
DATABASE_URL=postgresql://ddadmin:PASSWORD@localhost:5432/data_dictionary
GITHUB_CLIENT_ID=Ov23lisJDBtDNukA4X3o
GITHUB_CLIENT_SECRET=<needs to be filled in>
CORS_ORIGINS=["http://localhost:5173","http://52.146.18.204"]
```

### Deployment Workflow (for future updates)
On your Mac, push changes to GitHub. Then on the VM:
```bash
cd ~/data-dictionary
git pull
npm run build                          # if frontend changed
sudo systemctl restart data-dictionary  # if backend changed
```

---

## Current State

**Live at:** `http://52.146.18.204/`

**Working:**
- React SPA loads and displays all 67 tables
- Metadata served from PostgreSQL via FastAPI
- Nginx proxying API and serving static build
- GitHub OAuth flow (needs GITHUB_CLIENT_SECRET in .env to complete token exchange)
- Admin tab visible when signed in as admin
- Inline editing UI components built

**Still needs verification/testing:**
- GitHub OAuth end-to-end flow (need to update GitHub OAuth App callback URL to `http://52.146.18.204/api/auth/github/callback` and fill in `GITHUB_CLIENT_SECRET` in `.env`)
- Admin inline editing (save to PostgreSQL and see changes persist)
- ApplyIssueModal (apply issue feedback → update metadata → close issue)
- AdminPanel (add/remove admin users, view edit history)

---

## What Remains (Next Steps)

### Immediate
1. **Complete OAuth setup:** Update GitHub OAuth App callback URL to `http://52.146.18.204/api/auth/github/callback`, add `GITHUB_CLIENT_SECRET` to `.env`, restart FastAPI
2. **Test admin flow end-to-end:** Sign in → verify admin badge → edit a field → confirm it persists → check edit history
3. **Test issue workflow:** Submit feedback → see it in Admin panel → apply it → verify field updated and issue closed on GitHub
4. **Delete Azure PostgreSQL Flexible Server** if not already done (stop unnecessary billing)

### Future Enhancements
- **HTTPS:** Add Let's Encrypt via certbot
- **GitHub Pages → VM redirect:** Update or deprecate the old GitHub Pages site
- **Multiple dictionaries:** Upload additional metadata.json files for other schemas
- **Hopkins SSO:** Add Microsoft Entra ID as a second auth provider
- **Organization repo:** Move to a Hopkins GitHub org
- **AI-assisted descriptions:** Use Claude API to generate draft column descriptions
- **Excel export from API:** Regenerate workbook on-demand from the database
- **Row counts:** When a faster method is available for materialized views

---

## Architecture Diagram

```
Browser (http://52.146.18.204)
    │
    ├── /api/* ──→ Nginx ──→ FastAPI (port 8000)
    │                            │
    │                            ├── /api/metadata/* (read metadata from Postgres)
    │                            ├── /api/auth/* (GitHub OAuth + admin check)
    │                            └── /api/admin/* (edit metadata, manage users)
    │                                     │
    │                                     ▼
    │                              PostgreSQL (localhost:5432)
    │                                 ├── dictionaries (JSONB metadata)
    │                                 ├── admin_users
    │                                 └── edit_history
    │
    └── /* ──→ Nginx ──→ React SPA (dist/index.html)
```

## Key Files Reference

| File | Location | Purpose |
|------|----------|---------|
| SSH key | `~/Downloads/data-dictionary_key.pem` (Mac) | VM access |
| .env | `~/data-dictionary/.env` (VM) | Backend config |
| Nginx config | `/etc/nginx/sites-available/data-dictionary` (VM) | Reverse proxy |
| systemd service | `/etc/systemd/system/data-dictionary.service` (VM) | FastAPI auto-start |
| React build | `~/data-dictionary/dist/` (VM) | Static frontend |
| Backend | `~/data-dictionary/backend/` (VM + repo) | FastAPI app |
| Frontend | `~/data-dictionary/src/` (repo) | React source |
