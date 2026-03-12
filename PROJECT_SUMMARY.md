# EHR Data Dictionary — Project Summary

## Overview

A reusable, generalizable **data dictionary package** for the Hopkins de-identified EHR dataset hosted on Databricks. The package extracts structured metadata from any database schema, generates a polished Excel workbook, and includes an interactive web UI with a GitHub-backed feedback system.

**Live site:** https://starliu1.github.io/data-dictionary/
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
            → React web UI (Vite + GitHub Pages)   →  starliu1.github.io/data-dictionary/
            → Feedback system (GitHub Issues API)   →  github.com/starliu1/data-dictionary/issues
```

The `data-dictionary/` repo is **decoupled** from the REACH project. Extraction functions accept a SparkSession and schema name as arguments — the calling notebook handles connection setup.

### Repo structure

```
data-dictionary/                       # public GitHub repo
  .github/workflows/
    deploy.yml                         # GitHub Actions → GitHub Pages
    auto-label-issues.yml              # Auto-labels feedback issues
  extraction/
    extract_metadata.py                # metadata extraction module
  generators/
    generate_excel.py                  # Excel workbook builder
  outputs/
    metadata.json                      # extracted metadata (gitignored)
    data_dictionary.xlsx               # generated workbook (gitignored)
  src/
    App.jsx                            # React app entry
    App.css
    main.jsx
    index.css
    data_dictionary_ui.jsx             # main UI component (embedded metadata)
    data_dictionary_ui_standalone.jsx   # fetch-based version (for production)
    github_auth.js                     # GitHub OAuth redirect flow
    github_issues.js                   # GitHub Issues API service
    GitHubAuthProvider.jsx             # Auth context provider
    SignInButton.jsx                   # Header sign-in component
    CreateIssueModal.jsx               # Issue creation form
    IssuesList.jsx                     # Cached issue count + GitHub link
    FeedbackButton.jsx                 # Feedback trigger button
  public/
    metadata.json                      # static JSON for standalone version
  scripts/
    create_labels.sh                   # One-time label setup
  vite.config.js                       # base: '/data-dictionary/'
  package.json
  README.md
  PROJECT_SUMMARY.md
```

Cloned alongside the REACH project:

```
workspace/
  REACH/                               # existing project with shared/ modules
    shared/
      config.py
      connection.py
    notebooks/
  data-dictionary/                     # this repo
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

### Phase 3: Interactive Web UI (Live)

**URL:** https://starliu1.github.io/data-dictionary/

React SPA built with Vite, deployed via GitHub Actions to GitHub Pages.

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
- Metadata embedded in JSX (477KB compact JSON)
- GitHub Actions deployment to GitHub Pages
- `base: '/data-dictionary/'` in Vite config for project site routing

#### Two versions of the UI component
- `data_dictionary_ui.jsx` — embedded metadata, self-contained (currently active)
- `data_dictionary_ui_standalone.jsx` — fetches from `metadata.json` URL (for production when JSON is hosted separately)

### Phase 4: Feedback System (Live)

In-UI feedback backed by GitHub Issues, with GitHub OAuth authentication.

#### Authentication
- **OAuth flow:** Redirect-based GitHub OAuth via Cloudflare Worker proxy
- **Worker URL:** `github-oauth-proxy.star-sd-liu.workers.dev`
- **Flow:** User clicks "Sign in" → redirected to GitHub → approves → redirected back with token in URL fragment → app reads token and fetches user profile
- **Client ID:** `Ov23lisJDBtDNukA4X3o` (GitHub OAuth App)
- **Scope:** `public_repo` (allows creating issues on public repos)
- **No backend dependency:** Cloudflare Worker only handles the token exchange; all other API calls are direct from the browser
- **Azure-portable:** When migrating to Azure, replace the Cloudflare Worker with an Azure Function — same token exchange logic, different host

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
- Table and column labels created automatically on first issue

#### Issue Display
- Lightweight count + link component (not full inline display)
- Fetches issue count once per table/column, caches in module-level Map for the session
- Shows: "● 3 open issues (5 total) · View on GitHub →"
- Link opens pre-filtered GitHub Issues search
- Cache invalidated after new issue creation via `refreshKey` prop

#### Components
| File | Purpose |
|---|---|
| `github_auth.js` | OAuth redirect flow (startSignIn, extractTokenFromUrl, fetchUser) |
| `github_issues.js` | GitHub Issues API (createIssue, fetchIssues, fetchAllIssues, parseIssueTitle) |
| `GitHubAuthProvider.jsx` | React context managing auth state across components |
| `SignInButton.jsx` | Header component — sign in button / user avatar + sign out |
| `CreateIssueModal.jsx` | Issue creation form with context pre-fill and priority picker |
| `IssuesList.jsx` | Cached count display + GitHub link |
| `FeedbackButton.jsx` | Small trigger button placed on tables and columns |

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
```

### Deploy web UI

Push to `main` — GitHub Actions builds and deploys automatically.

---

## Resolved Decisions

| Question | Decision |
|---|---|
| Description seeding | Yes — AI-assisted drafts based on column name, type, table context. **Not yet implemented.** |
| Row counts | Yes in principle, but **deferred** — all tables are materialized views where `DESCRIBE DETAIL` fails. `COUNT(*)` fallback exists but too slow for 67 tables. `include_row_counts=False` by default. |
| Hosting | GitHub Pages (public repo) at `starliu1.github.io/data-dictionary/` |
| Access control | Public — metadata only, no patient data |
| Feedback mechanism | GitHub Issues via in-UI forms with OAuth authentication and auto-labeling |
| OAuth approach | Redirect-based flow via Cloudflare Worker (replaced device flow due to browser CORS limitations) |
| Feedback display | Lightweight cached count + link to GitHub (not full inline display, to minimize API calls) |
| Auto-labeling | GitHub Action parses structured title tags and applies labels automatically |

---

## Next Steps

### Feedback → Metadata Pipeline
The feedback system collects issues from users. The next step is building a pipeline that takes approved feedback and updates the actual metadata:
- **Admin review UI or workflow:** Authorized users (repo maintainers) review submitted issues and approve changes
- **Metadata update mechanism:** Approved changes (e.g., corrected column descriptions, source annotations) get written back to `metadata.json`
- **Rebuild trigger:** Updated metadata triggers regeneration of the Excel workbook and redeployment of the web UI with the new data
- **Access control:** Only select users with repo write access can approve and merge metadata changes — separate from the broader feedback submission access

### AI-Assisted Column Description Seeding
- Generate draft descriptions for all 2,272 columns based on column name, data type, table context, and existing comments
- Present drafts for team review before merging into metadata
- Prioritize columns with no existing comments (`clarity_medication`, `edgicd`, `geocode_patient`, `flowsheet_data`, and others)

### Other Future Work
- Row counts when a faster method is available
- Migration to Hopkins Microsoft Azure hosting (Cloudflare Worker → Azure Function for OAuth)
- Connectors for MSSQL (pyodbc/SQLAlchemy), PostgreSQL, Snowflake, Generic JDBC
- Additional category labels for issue classification (description-update, data-quality, question)

---

## Technical Notes

- All 67 tables are `MATERIALIZED_VIEW` type (Delta-backed)
- `DESCRIBE DETAIL` fails for all tables (not standard Delta tables)
- `information_schema.columns` works and provides richer metadata than `DESCRIBE TABLE`
- Table comments from schema are well-populated for most tables
- Column comments are well-populated for most tables except `clarity_medication`, `edgicd`, `geocode_patient`, `flowsheet_data` (partial), and a few others
- GitHub device flow OAuth does not work from browsers due to CORS — redirect flow via Cloudflare Worker is required
- Cloudflare Workers free tier: 100,000 requests/day (more than sufficient for OAuth token exchange)
- GitHub API rate limits: 30 search requests/minute (authenticated), 5,000 general requests/hour — session caching in `IssuesList` minimizes API calls
