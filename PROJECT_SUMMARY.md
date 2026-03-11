# EHR Data Dictionary — Project Summary

## Overview

We are building a reusable, generalizable **data dictionary package** for the Hopkins de-identified EHR dataset hosted on Databricks. The package extracts structured metadata from any database schema, generates a polished Excel workbook, and will eventually include an interactive web UI for browsing and an intake workflow for continuous improvement.

**Target schema:** `deid.derived` (Databricks Unity Catalog)  
**Cluster:** `adb-2976959560275018.18.azuredatabricks.net`  
**Dataset:** 67 tables across clinical domains (encounters, labs, meds, vitals, diagnoses, surgeries, notes, billing, geocoding, etc.)

---

## Architecture

```
Databricks schema
    → Python extraction (extract_metadata.py)
        → JSON intermediate (metadata.json)
            → Excel generator (generate_excel.py)  →  data_dictionary.xlsx
            → Web UI (Phase 3 — next)              →  React SPA
```

The `data-dictionary/` repo is **decoupled** from the REACH project. Extraction functions accept a SparkSession and schema name as arguments — the calling notebook handles connection setup. This makes the package reusable across any project or database.

### Repo structure

```
data-dictionary/               # standalone GitHub repo
  extraction/
    extract_metadata.py        # metadata extraction module
  generators/
    generate_excel.py          # Excel workbook builder
  outputs/
    metadata.json              # extracted metadata (gitignored)
    data_dictionary.xlsx       # generated workbook (gitignored)
  ui/                          # React web app (Phase 3)
  templates/                   # GitHub issue templates (Phase 4)
  README.md
  run.py                       # CLI entry point (future)
```

Cloned alongside the REACH project:

```
workspace/
  REACH/                       # existing project with shared/ modules
    shared/
      config.py
      connection.py
    notebooks/
  data-dictionary/             # this repo
```

---

## What Was Built (Phases 1–2)

### Phase 1: Metadata Extraction (`extraction/extract_metadata.py`)

A Python module with these functions:

| Function | Purpose |
|---|---|
| `get_tables(spark, schema)` | Returns sorted list of table names via `SHOW TABLES IN {schema}` |
| `get_columns(spark, schema, table_name)` | Column metadata via `DESCRIBE TABLE` — captures `column_name`, `data_type`, `comment`, `ordinal_position` |
| `get_columns_info_schema(spark, schema, table_name)` | Richer column metadata via `information_schema.columns` — adds `full_data_type` (e.g. `DECIMAL(18,0)`), `is_nullable`, `comment`. Falls back to `get_columns()` if unavailable |
| `get_table_detail(spark, schema, table_name)` | Table-level metadata via `DESCRIBE TABLE EXTENDED` — captures Catalog, Database, Type, Comment, Created Time, Last Access, Created By, Provider, Owner, Location |
| `extract_all(spark, schema)` | Orchestrates full extraction across all tables. Calls column + detail functions per table |
| `export_metadata(spark, schema, output_path)` | Runs `extract_all()` and writes result to JSON file |

**Key design decision:** Functions accept a `SparkSession` and `schema` string — no dependency on REACH's `shared.config` or `shared.connection`. The calling notebook/script handles its own connection setup and passes the session in.

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
          "data_type": "STRING",
          "is_nullable": "YES",
          "ordinal_position": 0,
          "comment": ""
        }
      ],
      "detail": {
        "Catalog": "deid",
        "Database": "derived",
        "Type": "EXTERNAL",
        "Comment": "Inpatient stay location timeline.",
        "Created Time": "Fri Oct 04 17:11:42 UTC 2024",
        "Last Access": "UNKNOWN",
        "Created By": "Spark",
        "Provider": "delta",
        "Owner": "ec33417c-8068-4d0a-899d-8272ae9cd74c",
        "Location": "abfss://commons-prod@pmdcomstor01.dfs.core.windows.net/..."
      }
    }
  ]
}
```

### Phase 2: Excel Data Dictionary (`generators/generate_excel.py`)

Generates a polished `.xlsx` workbook from `metadata.json` using openpyxl.

#### Workbook structure: 68 sheets (1 master + 67 table sheets)

**Master Index sheet** — one row per table with columns:

| Column | Source |
|---|---|
| # | Auto-numbered |
| Table Name | Extracted — hyperlinked to the table's dedicated sheet |
| Column Count | Extracted — number of columns in the table |
| Catalog | From DESCRIBE EXTENDED |
| Database | From DESCRIBE EXTENDED |
| Type | From DESCRIBE EXTENDED (e.g. EXTERNAL, MANAGED) |
| Comment | From DESCRIBE EXTENDED — table-level description |
| Created Time | From DESCRIBE EXTENDED |
| Last Access | From DESCRIBE EXTENDED |
| Created By | From DESCRIBE EXTENDED |
| Provider | From DESCRIBE EXTENDED (e.g. delta) |
| Owner | From DESCRIBE EXTENDED |
| Location | From DESCRIBE EXTENDED — storage path |

**Per-table sheets** (named after the table, truncated to 31 chars) — one row per column:

| Column | Source |
|---|---|
| table_name | Extracted — repeated for context when sheets are exported individually |
| column_name | Extracted |
| data_type | Extracted — full Spark SQL type (e.g. `DECIMAL(18,0)`, `STRING`, `TIMESTAMP`) |
| is_nullable | Extracted — `YES` / `NO` |
| ordinal_position | Extracted — column order in the table |
| comment | Extracted — column description from schema (populated where set) |
| source | Manual entry — origin system or ETL pipeline (blank, to be filled by team) |
| description | Manual / AI-assisted — plain-language description (blank, to be filled) |

#### Excel formatting features

- **Frozen header rows** on all sheets (row 1 on master, row 2 on table sheets since row 1 has back link)
- **Auto-filters** on all columns
- **Hyperlinks** from Master Index table names → dedicated table sheets
- **"← Back to Master Index" link** at the top of every table sheet
- **Alternating row shading** (white / light blue) for readability
- **Dark header row** with white text
- **Professional styling** — Arial font, thin borders, centered alignment where appropriate

---

## How to Run

### Step 1: Extract metadata (run from REACH notebook)

```python
import sys, os

# Your existing REACH connection setup
sys.path.insert(0, os.path.join(os.getcwd(), ".."))
from shared.config import DatabricksConfig
from shared.connection import get_databricks_connect_session

config = DatabricksConfig()
config.validate(mode="connect")
spark = get_databricks_connect_session(config)

# Point to data-dictionary repo
DATA_DICT_PATH = os.path.join(os.getcwd(), "..", "..", "data-dictionary")
sys.path.insert(0, DATA_DICT_PATH)
from extraction.extract_metadata import export_metadata

# Extract and save
metadata = export_metadata(spark, "deid.derived",
    os.path.join(DATA_DICT_PATH, "outputs", "metadata.json"))
```

### Step 2: Generate Excel workbook

```bash
cd /path/to/data-dictionary
python generators/generate_excel.py outputs/metadata.json outputs/data_dictionary.xlsx
```

---

## Phase 3: Interactive Web UI (Next)

A lightweight, read-only React SPA for browsing and searching the data dictionary. Designed to be hosted as a static site.

### Planned features

- Master table view with search/filter across all tables
- Click-through navigation to individual table detail views
- Column-level search across the entire dictionary
- Responsive layout for desktop and tablet
- Reads from a hosted JSON file (the same `metadata.json` output)

### Tech stack

- React single-page application
- Tailwind CSS for styling
- Client-side search and filtering (no backend needed for v1)

### Data source options

- GitHub repository (raw JSON file, updated via CI or manual push)
- Static file hosted alongside the UI
- REST API endpoint (future)

---

## Phase 4: Intake & Feedback Workflow (Future)

- GitHub Issues as intake mechanism with structured templates
- Issue labels for auto-categorization (description-update, data-quality, question)
- CI/CD pipeline: approved changes trigger metadata re-export and workbook regeneration

---

## Open Questions

- **Description seeding:** Use AI-assisted descriptions as starting drafts based on column names and data types?
- **Row counts:** Include approximate row counts per table in master index? (Requires full table scans)
- **Hosting:** GitHub Pages vs. internal server vs. shared drive for the web UI?
- **Access control:** Any restrictions on who can view the data dictionary?
- **Extensibility:** Future connectors for MSSQL (pyodbc/SQLAlchemy), PostgreSQL, Snowflake, Generic JDBC
