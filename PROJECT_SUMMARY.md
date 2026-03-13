# EHR Data Dictionary — Project Summary

## Overview

A reusable, generalizable **data dictionary package** for the Hopkins de-identified EHR dataset hosted on Databricks. The package extracts structured metadata from any database schema, generates a polished Excel workbook, and includes an interactive web UI with an admin portal for metadata management and a GitHub-backed feedback system.

**Live site:** https://data-dictionary.eastus.cloudapp.azure.com/
**Repo:** https://github.com/starliu1/data-dictionary (public)

**Target schema:** `deid.derived` (Databricks Unity Catalog)
**Cluster:** `adb-2976959560275018.18.azuredatabricks.net`
**Dataset:** 67 tables, 2,272 columns across clinical domains (encounters, labs, meds, vitals, diagnoses, surgeries, notes, billing, geocoding, etc.)

---

## Architecture

```
Databricks schema
    → Python extraction (extract_metadata.py)
        → JSON intermediate (metadata.json)
            → Excel generator (generate_excel.py)  →  data_dictionary.xlsx
            → Seed into PostgreSQL (seed.py)        →  dictionaries table (JSONB)

Browser (https://data-dictionary.eastus.cloudapp.azure.com)
    │
    ├── /api/* ──→ Nginx ──→ FastAPI (port 8000)
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

The `data-dictionary/` repo is **decoupled** from the REACH project. Extraction functions accept a SparkSession and schema name as arguments — the calling notebook handles connection setup.

### Infrastructure

- **VM:** `data-dictionary` (Azure Standard B2s, 2 vCPUs, 4 GiB RAM, Ubuntu 24.04)
- **Domain:** `data-dictionary.eastus.cloudapp.azure.com`
- **HTTPS:** Let's Encrypt via certbot, auto-renewing
- **PostgreSQL:** On-VM (localhost:5432), database `data_dictionary`
- **FastAPI:** Runs as systemd service on port 8000, proxied via Nginx
- **React:** Built with Vite, served as static files by Nginx

### Repo structure

```
data-dictionary/                       # public GitHub repo
  .github/workflows/
    deploy.yml                         # GitHub Actions → GitHub Pages (legacy)
    auto-label-issues.yml              # Auto-labels feedback issues
  backend/
    __init__.py
    config.py                          # Pydantic settings, reads from .env
    database.py                        # SQLAlchemy engine + session
    models.py                          # Dictionary, AdminUser, EditHistory
    main.py                            # FastAPI app entry point
    seed.py                            # Import metadata.json into PostgreSQL
    routers/
      metadata.py                      # GET /api/metadata endpoints
      auth.py                          # GitHub OAuth + admin check
      admin.py                         # Metadata editing, user mgmt, history
  extraction/
    extract_metadata.py                # metadata extraction module
  generators/
    generate_excel.py                  # Excel workbook builder
  outputs/
    metadata.json                      # extracted metadata (gitignored)
    data_dictionary.xlsx               # generated workbook (gitignored)
  src/
    App.jsx                            # React app entry
    main.jsx
    index.css
    api.js                             # Centralized API client
    data_dictionary_ui.jsx             # Main UI component (fetches from API)
    data_dictionary_ui_standalone.jsx   # Standalone version (fetches from JSON)
    github_auth.js                     # GitHub OAuth redirect flow
    github_issues.js                   # GitHub Issues API service
    GitHubAuthProvider.jsx             # Auth context provider
    SignInButton.jsx                   # Header sign-in component
    CreateIssueModal.jsx               # Issue creation form
    IssuesList.jsx                     # Scoped issue count + GitHub link
    FeedbackButton.jsx                 # Feedback trigger button
    EditableField.jsx                  # Inline edit for admins
    AdminPanel.jsx                     # Admin dashboard (issues, users, history)
    ApplyIssueModal.jsx                # Apply issue feedback to metadata
    DismissIssueModal.jsx              # Dismiss issue as no-change-needed
  public/
    metadata.json                      # static JSON (legacy standalone version)
  scripts/
    create_labels.sh                   # One-time label setup
  vite.config.js                       # base: '/', dev proxy to FastAPI
  package.json
  requirements.txt                     # Python backend dependencies
  README.md
  PROJECT_SUMMARY.md
  IMPLEMENTATION_PLAN.md
```

---

## What Was Built

### Phase 1: Metadata Extraction (`extraction/extract_metadata.py`)

| Function | Purpose |
|---|---|
| `get_tables(spark, schema)` | Returns sorted list of table names via `SHOW TABLES IN {schema}` |
| `get_columns(spark, schema, table_name)` | Column metadata via `DESCRIBE TABLE` — captures `column_name`, `data_type`, `comment`, `ordinal_position` |
| `get_columns_info_schema(spark, schema, table_name)` | Richer column metadata via `information_schema.columns` — adds `full_data_type` (e.g. `DECIMAL(18,0)`), `is_nullable`, `comment`. Falls back to `get_columns()` if unavailable |
| `get_table_detail(spark, schema, table_name)` | Table-level metadata via `DESCRIBE TABLE EXTENDED` — captures Catalog, Database, Type, Comment, Created Time, Last Access, Created By, Provider, Owner, Location |
| `get_row_count(spark, schema, table_name)` | Row count via `DESCRIBE DETAIL` (Delta) with fallback to `COUNT(*)`. **Disabled by default** (`include_row_counts=False`) — all tables are materialized views where `DESCRIBE DETAIL` fails, and `COUNT(*)` on 67 tables is slow |
| `extract_all(spark, schema)` | Orchestrates full extraction across all tables |
| `export_metadata(spark, schema, output_path)` | Runs `extract_all()` and writes result to JSON file |

**Key design decision:** Functions accept a `SparkSession` and `schema` string — no dependency on REACH's `shared.config` or `shared.connection`.

#### metadata.json structure

```json
{
  "schema": "deid.derived",
  "tables": [
    {
      "table_name": "adt_location_history",
      "columns": [
        {
          "column_name": "cohort_id",
          "data_type": "string",
          "data_type_short": "STRING",
          "is_nullable": "YES",
          "ordinal_position": 0,
          "comment": ""
        }
      ],
      "detail": {
        "Catalog": "deid",
        "Database": "derived",
        "Type": "MATERIALIZED_VIEW",
        "Comment": "Inpatient stay location timeline.",
        "Created Time": "Thu Dec 11 20:40:19 UTC 2025",
        ...
      }
    }
  ]
}
```

### Phase 2: Excel Data Dictionary (`generators/generate_excel.py`)

Generates a polished `.xlsx` workbook from `metadata.json` using openpyxl.

#### Workbook structure: 68 sheets (1 master + 67 table sheets)

**Master Index sheet** columns: #, Table Name (hyperlinked), Column Count, Row Count (when available), Catalog, Database, Type, Comment, Created Time, Last Access, Created By, Provider, Owner, Location

**Per-table sheets** columns: table_name, column_name, data_type, is_nullable, ordinal_position, comment, source (manual), description (manual)

#### Formatting: frozen headers, auto-filters, hyperlinks, back links, alternating row shading, dark header row, Arial font, thin borders, number formatting on row counts

### Phase 3: Interactive Web UI

**URL:** https://data-dictionary.eastus.cloudapp.azure.com/

React SPA built with Vite, deployed on Azure VM via Nginx.

#### Features
- Master table view with sortable columns and search
- Click-through to individual table column detail views
- Global column search across all 2,272 columns
- Data type color coding (STR, INT, NUM, DATE, BOOL, CPLX) with filtering
- Copy-to-clipboard for full table paths and column names
- Keyboard shortcut: `/` to focus search, `Esc` to clear
- Responsive layout

#### Tech stack
- React + Vite
- Inline styles (no CSS framework dependency)
- Metadata fetched from FastAPI backend (`/api/metadata/1`)
- Nginx serves static build, proxies `/api/` to FastAPI
- HTTPS via Let's Encrypt (certbot, auto-renewing)

### Phase 4: Feedback System

In-UI feedback backed by GitHub Issues, with GitHub OAuth authentication.

#### Authentication
- **OAuth flow:** Redirect-based GitHub OAuth via FastAPI backend
- **Flow:** User clicks "Sign in" → redirected to GitHub via `/api/auth/login` → approves → GitHub redirects to `/api/auth/github/callback` → backend exchanges code for token → redirects back to app with token in URL fragment → app reads token and fetches user profile + admin status
- **Client ID:** `Ov23lisJDBtDNukA4X3o` (GitHub OAuth App)
- **Scope:** `public_repo` (allows creating issues on public repos)
- **Admin check:** After OAuth, frontend calls `/api/auth/me` to check if user is in the `admin_users` table

#### Issue Creation
- Feedback buttons on both table headers and individual column rows
- Modal form with title, description, and priority (low/medium/high)
- Issues created with structured titles: `[table:lab_results] [column:result_value] User's title`
- Issue body includes context metadata (full table path, column name, priority)
- Footer: "Submitted via the Data Dictionary UI"

#### Auto-Labeling
- GitHub Action (`auto-label-issues.yml`) triggers on issue creation
- Parses `[table:xxx]` and `[column:xxx]` from title, `**Priority:** xxx` from body
- Creates labels if they don't exist (blue for tables, purple for columns, color-coded for priority)
- Pre-created labels: `priority:low` (green), `priority:medium` (yellow), `priority:high` (red)

#### Issue Display
- Lightweight count + link component (not full inline display)
- Scoped refresh: submitting feedback on one column only re-fetches that column's count, not all columns
- Table-level IssuesList auto-fetches; column-level uses lazy loading
- Shows: "● 3 open issues (5 total) · View on GitHub →"

### Phase 5: Admin Portal

Admin-only features for metadata management, visible after signing in as an authorized GitHub user.

#### Admin Authentication
- `admin_users` table in PostgreSQL stores authorized GitHub usernames and roles (`admin` | `superadmin`)
- After GitHub OAuth, `/api/auth/me` returns `is_admin: true/false`
- Admin tab and edit controls only visible to authorized users

#### Inline Editing
- Pencil icon appears on hover for admins on table comments and column comments
- Click to switch to input/textarea with save/cancel
- Saves directly to PostgreSQL via `PUT /api/admin/{dict_id}/tables/{table_name}/columns/{column_name}`
- All edits recorded in `edit_history` table with who, what, when, and optional linked issue number

#### Issue Review Workflow
- **Admin Panel** shows all open GitHub issues with search, priority filter, and pagination (10/25/50 per page)
- **Apply:** Opens modal to apply an issue's suggested change to metadata — picks field to update, enters new value, optionally closes the issue on GitHub with a resolution comment
- **Dismiss:** Opens modal to close an issue as "not planned" with an optional reason comment on GitHub
- Issues removed from the list after apply/dismiss

#### Admin User Management
- View all current admins with roles
- Add new admins by GitHub username
- Remove admins (cannot remove yourself)

#### Edit History
- Shows recent edits with who, what field, old → new values, and linked issue number
- Filterable by dictionary and table

#### Components
| File | Purpose |
|---|---|
| `api.js` | Centralized API client with auth token support |
| `EditableField.jsx` | Inline edit component (pencil icon, input toggle, save/cancel) |
| `AdminPanel.jsx` | Admin dashboard with issue search/filter/pagination, user management, edit history |
| `ApplyIssueModal.jsx` | Apply issue feedback to metadata with field selection |
| `DismissIssueModal.jsx` | Dismiss issue as no-change-needed |

---

## How to Run

### Extract metadata (from REACH notebook)

```python
import sys, os

sys.path.insert(0, os.path.join(os.getcwd(), ".."))
from shared.config import DatabricksConfig
from shared.connection import get_databricks_connect_session

config = DatabricksConfig()
config.validate(mode="connect")
spark = get_databricks_connect_session(config)

DATA_DICT_PATH = os.path.join(os.getcwd(), "..", "..", "data-dictionary")
sys.path.insert(0, DATA_DICT_PATH)
from extraction.extract_metadata import export_metadata

metadata = export_metadata(spark, "deid.derived",
    os.path.join(DATA_DICT_PATH, "outputs", "metadata.json"))
```

### Generate Excel workbook

```bash
cd /path/to/data-dictionary
python generators/generate_excel.py outputs/metadata.json outputs/data_dictionary.xlsx
```

### Run web UI locally

```bash
npm install
npm run dev
# Frontend at http://localhost:5173, API proxied to http://localhost:8000
```

### Run backend locally

```bash
pip install -r requirements.txt
# Create .env with DATABASE_URL, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, CORS_ORIGINS
uvicorn backend.main:app --reload --port 8000
```

### Deploy updates to Azure VM

```bash
# On your Mac:
git add -A && git commit -m "description" && git push

# On the VM:
cd ~/data-dictionary
git pull
npm run build                          # if frontend changed
sudo systemctl restart data-dictionary  # if backend changed
```

---

## Resolved Decisions

| Question | Decision |
|---|---|
| Description seeding | Yes — AI-assisted drafts based on column name, type, table context. **Not yet implemented.** |
| Row counts | Yes in principle, but **deferred** — all tables are materialized views where `DESCRIBE DETAIL` fails. `COUNT(*)` fallback exists but too slow for 67 tables. `include_row_counts=False` by default. |
| Hosting | Azure VM at `data-dictionary.eastus.cloudapp.azure.com` with HTTPS (Let's Encrypt) |
| Access control | Public — metadata only, no patient data. Admin editing restricted to `admin_users` table. |
| Feedback mechanism | GitHub Issues via in-UI forms with OAuth authentication and auto-labeling |
| OAuth approach | Redirect-based flow via FastAPI backend (replaced Cloudflare Worker after Azure migration) |
| Feedback display | Lightweight cached count + link to GitHub, with scoped refresh and lazy loading for column-level |
| Auto-labeling | GitHub Action parses structured title tags and applies labels automatically |
| Database | PostgreSQL on-VM (chose over Azure Flexible Server to save ~$15/month) |
| Admin workflow | Apply (update metadata + close issue) or Dismiss (close as not planned) |

---

## Next Steps

### AI-Assisted Column Description Seeding
- Generate draft descriptions for all 2,272 columns based on column name, data type, table context, and existing comments
- Present drafts for team review before merging into metadata
- Prioritize columns with no existing comments (`clarity_medication`, `edgicd`, `geocode_patient`, `flowsheet_data`, and others)

### Excel Export from API
- Add endpoint to regenerate the Excel workbook on-demand from the database
- Reflects any admin edits made through the UI

### Other Future Work
- Row counts when a faster method is available
- Multiple dictionaries (upload additional metadata.json files for other schemas)
- Hopkins SSO (Microsoft Entra ID as a second auth provider)
- Move repo to Hopkins GitHub org, restrict feedback to org members
- Connectors for MSSQL (pyodbc/SQLAlchemy), PostgreSQL, Snowflake, Generic JDBC

---

## Technical Notes

- All 67 tables are `MATERIALIZED_VIEW` type (Delta-backed)
- `DESCRIBE DETAIL` fails for all tables (not standard Delta tables)
- `information_schema.columns` works and provides richer metadata than `DESCRIBE TABLE`
- Table comments from schema are well-populated for most tables
- Column comments are well-populated for most tables except `clarity_medication`, `edgicd`, `geocode_patient`, `flowsheet_data` (partial), and a few others
- GitHub API rate limits: 30 search requests/minute (authenticated), 5,000 general requests/hour — scoped refresh and lazy loading in `IssuesList` minimizes API calls
- Let's Encrypt certificates auto-renew via certbot systemd timer

## Key Files Reference (on VM)

| File | Location | Purpose |
|------|----------|---------|
| SSH key | `~/Downloads/data-dictionary_key.pem` (Mac) | VM access |
| .env | `~/data-dictionary/.env` (VM) | Backend config |
| Nginx config | `/etc/nginx/sites-available/data-dictionary` (VM) | Reverse proxy + HTTPS |
| systemd service | `/etc/systemd/system/data-dictionary.service` (VM) | FastAPI auto-start |
| React build | `~/data-dictionary/dist/` (VM) | Static frontend |
| Backend | `~/data-dictionary/backend/` (VM + repo) | FastAPI app |
| Frontend | `~/data-dictionary/src/` (repo) | React source |
