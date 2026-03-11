# EHR Data Dictionary

A reusable data dictionary package for the Hopkins de-identified EHR dataset. Extracts structured metadata from Databricks, generates a polished Excel workbook, and provides an interactive web UI for browsing.

**Live site:** [data dictionary →](https://yourusername.github.io/data-dictionary/)

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
      → React web UI                         →  GitHub Pages
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

### 3. Run the web UI locally

```bash
npm install
npm run dev
```

## Project Structure

```
data-dictionary/
  .github/workflows/    # GitHub Pages deployment
  extraction/           # Metadata extraction module
  generators/           # Excel workbook builder
  outputs/              # Generated files (gitignored)
  src/                  # React web UI
  public/               # Static assets (metadata.json)
```

## Web UI Features

- Master table view with search and sort
- Click-through to individual table column detail
- Global column search across all 2,272 columns
- Data type color coding and filtering
- Copy-to-clipboard for table paths and column names
- Keyboard shortcut: press `/` to focus search

## Deployment

The site deploys automatically to GitHub Pages on push to `main` via GitHub Actions. To deploy manually, run `npm run build` and serve the `dist/` folder.

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

- [ ] In-UI discussion/comments backed by GitHub Issues API
- [ ] AI-assisted column description seeding
- [ ] Row counts via `COUNT(*)` 
- [ ] Connectors for MSSQL, PostgreSQL, Snowflake
