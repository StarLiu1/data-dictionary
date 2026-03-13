# EHR Data Dictionary

A reusable data dictionary package for the Hopkins de-identified EHR dataset. Extracts structured metadata from Databricks, generates a polished Excel workbook, and provides an interactive web UI with admin editing and a GitHub-backed feedback system.

**Live site:** [data-dictionary.eastus.cloudapp.azure.com](https://data-dictionary.eastus.cloudapp.azure.com/)

## Dataset

- **Schema:** `deid.derived` (Databricks Unity Catalog)
- **Tables:** 67 across clinical domains (encounters, labs, meds, vitals, diagnoses, surgeries, notes, billing, geocoding, etc.)
- **Columns:** 2,272 total

## Architecture

```
Databricks schema
  → Python extraction (extract_metadata.py)
    → JSON intermediate (metadata.json)
      → Excel generator (generate_excel.py)  →  data_dictionary.xlsx
      → PostgreSQL (seed.py)                 →  metadata as JSONB

Azure VM (data-dictionary.eastus.cloudapp.azure.com)
  → Nginx (HTTPS via Let's Encrypt)
    → /api/*  → FastAPI (metadata, auth, admin editing)
    → /*      → React SPA (static build)
```

## Quick Start

### 1. Extract metadata

Run from a notebook with an active Databricks Connect session:

```python
from extraction.extract_metadata import export_metadata

metadata = export_metadata(spark, "deid.derived", "outputs/metadata.json")
```

### 2. Generate Excel workbook

```bash
python generators/generate_excel.py outputs/metadata.json outputs/data_dictionary.xlsx
```

### 3. Run locally

```bash
# Frontend (proxies API to localhost:8000)
npm install
npm run dev

# Backend
pip install -r requirements.txt
uvicorn backend.main:app --reload --port 8000
```

### 4. Deploy updates

```bash
# Push from Mac, then on the VM:
cd ~/data-dictionary
git pull
npm run build                          # frontend changes
sudo systemctl restart data-dictionary  # backend changes
```

## Project Structure

```
data-dictionary/
  backend/                # FastAPI backend (auth, metadata API, admin editing)
  extraction/             # Metadata extraction module
  generators/             # Excel workbook builder
  outputs/                # Generated files (gitignored)
  src/                    # React web UI + admin portal
  .github/workflows/      # Auto-label issues on creation
```

## Web UI Features

- Master table view with search and sort
- Click-through to individual table column detail
- Global column search across all 2,272 columns
- Data type color coding and filtering
- Copy-to-clipboard for table paths and column names
- Keyboard shortcut: press `/` to focus search
- GitHub OAuth sign-in
- In-UI feedback submission (creates GitHub Issues with auto-labeling)

## Admin Portal

Sign in with an authorized GitHub account to access:

- **Inline editing** — edit table and column descriptions directly in the UI, persisted to PostgreSQL
- **Issue review** — search, filter, and paginate open issues; apply changes to metadata or dismiss
- **User management** — add/remove admin users
- **Edit history** — audit trail of all metadata changes

## Extraction Module

The extraction module is decoupled from any specific project. Functions accept a `SparkSession` and schema name — the calling script handles connection setup.

| Function | Purpose |
|---|---|
| `get_tables(spark, schema)` | List all tables in a schema |
| `get_columns(spark, schema, table)` | Column metadata via `DESCRIBE TABLE` |
| `get_columns_info_schema(spark, schema, table)` | Richer metadata via `information_schema` |
| `get_table_detail(spark, schema, table)` | Table properties via `DESCRIBE EXTENDED` |
| `export_metadata(spark, schema, path)` | Full extraction to JSON |

## Roadmap

- [ ] AI-assisted column description seeding
- [ ] Excel export on-demand from the database (reflects admin edits)
- [ ] Row counts via `COUNT(*)`
- [ ] Multiple dictionaries (additional schemas)
- [ ] Hopkins SSO (Microsoft Entra ID)
- [ ] Connectors for MSSQL, PostgreSQL, Snowflake
