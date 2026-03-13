# Admin Portal + Azure Migration — Progress Summary

## Date: March 12, 2026

## Current State

**Live at:** https://data-dictionary.eastus.cloudapp.azure.com/

**Everything is working:**
- React SPA loads and displays all 67 tables with 2,272 columns
- Metadata served from PostgreSQL via FastAPI
- HTTPS via Let's Encrypt (auto-renewing)
- Nginx reverse proxy (HTTPS → static build + API)
- GitHub OAuth login with admin role checking
- Inline editing for admins (table comments, column comments)
- Admin panel with issue review (apply/dismiss), search, filter, pagination
- Admin user management (add/remove)
- Edit history audit trail
- Feedback submission via GitHub Issues with auto-labeling
- Scoped refresh on feedback submission (no API spam)

---

## What Was Accomplished

### Azure Infrastructure
- **Virtual Machine:** `data-dictionary` (Standard B2s, 2 vCPUs, 4 GiB RAM, Ubuntu 24.04)
  - Public IP: `52.146.18.204`
  - Domain: `data-dictionary.eastus.cloudapp.azure.com`
  - Resource group: `JH-SOM-INFORMATICS-DEV-RG`
  - SSH access: `ssh -i ~/Downloads/data-dictionary_key.pem azureuser@52.146.18.204`
- **HTTPS:** Let's Encrypt via certbot, auto-renewing via systemd timer
- **PostgreSQL:** On-VM (localhost:5432), database `data_dictionary`
  - Tables: `dictionaries`, `admin_users`, `edit_history`
  - Seeded with `metadata.json` (67 tables, 2,272 columns from `deid.derived`)
  - `StarLiu1` added as initial superadmin
- **Decided against Azure PostgreSQL Flexible Server** — on-VM Postgres saves ~$15/month and reduces complexity

### FastAPI Backend
Deployed at port 8000, proxied via Nginx at `/api/`.

**Endpoints:**
- `GET /api/metadata/` — list all dictionaries
- `GET /api/metadata/{dict_id}` — full metadata for a dictionary
- `GET /api/metadata/{dict_id}/tables/{table_name}` — single table metadata
- `GET /api/auth/login` — redirect to GitHub OAuth
- `GET /api/auth/github/callback` — exchange code for token, redirect back with token
- `GET /api/auth/me` — current user info + admin status
- `PUT /api/admin/{dict_id}/tables/{table_name}` — edit table-level field
- `PUT /api/admin/{dict_id}/tables/{table_name}/columns/{column_name}` — edit column field
- `GET /api/admin/users` — list admins
- `POST /api/admin/users` — add admin
- `DELETE /api/admin/users/{username}` — remove admin
- `GET /api/admin/history` — edit history

**Database schema:**
- `dictionaries` — id, name, schema_name, metadata_json (JSONB), created_at, updated_at
- `admin_users` — id, github_username, role ("admin"|"superadmin"), added_by, created_at
- `edit_history` — id, dictionary_id, table_name, column_name, field_name, old_value, new_value, edited_by, github_issue_number, created_at

### React Frontend
**New components built for admin portal:**
- `api.js` — Centralized API client with auth token support
- `EditableField.jsx` — Inline edit (pencil icon, input toggle, save/cancel, keyboard shortcuts)
- `AdminPanel.jsx` — Admin dashboard with issue search/filter/pagination, user management, edit history
- `ApplyIssueModal.jsx` — Apply issue feedback to metadata, optionally close issue
- `DismissIssueModal.jsx` — Dismiss issue as "not planned" with optional reason

**Key changes to existing components:**
- `data_dictionary_ui.jsx` — fetches from API instead of embedded metadata, admin tab, inline editing
- `GitHubAuthProvider.jsx` — calls `/api/auth/me` for admin status after OAuth
- `github_auth.js` — points to `/api/auth` instead of Cloudflare Worker
- `IssuesList.jsx` — scoped refresh (only re-fetches relevant table/column), lazy loading for columns
- `vite.config.js` — `base: '/'`, dev proxy to FastAPI

### Bug Fixes Applied
- **Auth:** Added missing `/login` endpoint, `settings` and `RedirectResponse` imports in `auth.py`
- **Auth:** Added missing `API_BASE` declaration in `GitHubAuthProvider.jsx`
- **Inline editing:** Fixed `api.js` to accept token parameter instead of using localStorage (which was never set)
- **Inline editing:** Updated `data_dictionary_ui.jsx` to pass `accessToken` to `apiFetch` calls
- **API spam:** Changed `issueRefreshKey` from global counter to scoped string (`table::column::timestamp`)
- **API spam:** Updated `IssuesList` to only re-fetch when refreshKey matches its own table/column

---

## Deployment Workflow

On your Mac, push changes to GitHub. Then on the VM:
```bash
cd ~/data-dictionary
git pull
npm run build                          # if frontend changed
sudo systemctl restart data-dictionary  # if backend changed
```

---

## Key Files Reference

| File | Location | Purpose |
|------|----------|---------|
| SSH key | `~/Downloads/data-dictionary_key.pem` (Mac) | VM access |
| .env | `~/data-dictionary/.env` (VM) | Backend config (DB URL, GitHub OAuth) |
| Nginx config | `/etc/nginx/sites-available/data-dictionary` (VM) | Reverse proxy + HTTPS |
| systemd service | `/etc/systemd/system/data-dictionary.service` (VM) | FastAPI auto-start |
| React build | `~/data-dictionary/dist/` (VM) | Static frontend |
| Backend | `~/data-dictionary/backend/` (VM + repo) | FastAPI app |
| Frontend | `~/data-dictionary/src/` (repo) | React source |

---

## What Remains

### Immediate
- **Deprecate GitHub Pages site** — old site at `starliu1.github.io/data-dictionary/` has stale embedded metadata
- **Excel export from API** — regenerate workbook on-demand reflecting admin edits
- **AI-assisted column descriptions** — generate drafts for columns with no comments

### Future Enhancements
- Multiple dictionaries (upload additional metadata.json for other schemas)
- Hopkins SSO (Microsoft Entra ID as second auth provider)
- Move repo to Hopkins GitHub org
- Connectors for MSSQL, PostgreSQL, Snowflake, Generic JDBC
- Row counts when a faster method is available
