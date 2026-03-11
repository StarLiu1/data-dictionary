"""
Metadata extraction for Databricks Unity Catalog schemas.

Usage from a notebook or script that already has a SparkSession:

    from extraction.extract_metadata import get_tables, get_columns, export_metadata

    # spark = your existing SparkSession (e.g. from Databricks Connect)
    schema = "deid.derived"

    tables = get_tables(spark, schema)
    columns = get_columns(spark, schema, "my_table")
    export_metadata(spark, schema, "outputs/metadata.json")
"""

import json
from pathlib import Path


def get_tables(spark, schema):
    """
    Return a list of table names in the given schema.

    Parameters
    ----------
    spark : SparkSession
    schema : str
        Fully qualified schema name (e.g. "deid.derived").

    Returns
    -------
    list[str]
        Sorted list of table names.
    """
    df = spark.sql(f"SHOW TABLES IN {schema}")
    tables = sorted([row.tableName for row in df.collect()])
    print(f"Found {len(tables)} tables in {schema}")
    return tables


def get_columns(spark, schema, table_name):
    """
    Return column metadata for a single table using DESCRIBE TABLE.

    Captures column name, full data type string, and the comment field
    (which contains column descriptions set in the schema).

    Parameters
    ----------
    spark : SparkSession
    schema : str
        Fully qualified schema name (e.g. "deid.derived").
    table_name : str
        Name of the table to describe.

    Returns
    -------
    list[dict]
        Each dict contains: column_name, data_type, comment.
    """
    full_name = f"{schema}.{table_name}"
    df = spark.sql(f"DESCRIBE TABLE {full_name}")

    columns = []
    for idx, row in enumerate(df.collect()):
        col_name = row.col_name.strip()

        # DESCRIBE TABLE returns partition info and blank rows after
        # the actual columns — skip those
        if col_name == "" or col_name.startswith("#"):
            break

        comment = ""
        if hasattr(row, "comment") and row.comment:
            comment = row.comment.strip()

        columns.append({
            "column_name": col_name,
            "data_type": row.data_type.strip(),
            "comment": comment,
            "ordinal_position": idx,
        })

    return columns


def get_table_detail(spark, schema, table_name):
    """
    Return extended table-level metadata using DESCRIBE TABLE EXTENDED.

    Extracts table properties like owner, location, created time, etc.

    Parameters
    ----------
    spark : SparkSession
    schema : str
    table_name : str

    Returns
    -------
    dict
        Table-level properties (e.g. owner, location, type, created).
    """
    full_name = f"{schema}.{table_name}"
    try:
        df = spark.sql(f"DESCRIBE TABLE EXTENDED {full_name}")
        rows = df.collect()

        # DESCRIBE EXTENDED returns columns first, then a separator row,
        # then key-value metadata (col_name = key, data_type = value).
        # Keys include: Catalog, Database, Table, Created Time, Last Access,
        # Created By, Type, Comment, Location, Provider, Owner, Table Properties
        in_detail = False
        detail = {}
        for row in rows:
            col_name = row.col_name.strip() if row.col_name else ""
            if col_name.startswith("# Detailed Table") or col_name.startswith("# Partition"):
                in_detail = True
                continue
            if col_name == "" and not in_detail:
                in_detail = True
                continue
            if in_detail and col_name and not col_name.startswith("#"):
                val = row.data_type.strip() if row.data_type else ""
                # Skip Table Properties — too long, not useful for master index
                if col_name == "Table Properties":
                    continue
                detail[col_name] = val
        return detail
    except Exception as e:
        print(f"  Warning: DESCRIBE EXTENDED failed for {table_name}: {e}")
        return {}


def get_row_count(spark, schema, table_name):
    """
    Return the row count for a table.

    Tries DESCRIBE DETAIL first (free for Delta tables — reads transaction
    log metadata, no table scan). Falls back to SELECT COUNT(*) for views
    or non-Delta tables.

    Parameters
    ----------
    spark : SparkSession
    schema : str
        Fully qualified schema name (e.g. "deid.derived").
    table_name : str
        Name of the table.

    Returns
    -------
    int or None
        Row count, or None if both methods fail.
    """
    full_name = f"{schema}.{table_name}"

    # Try Delta metadata first (free, no scan)
    try:
        df = spark.sql(f"DESCRIBE DETAIL {full_name}")
        row = df.collect()[0]
        if hasattr(row, "numRecords") and row.numRecords is not None:
            return row.numRecords
    except Exception:
        pass

    # Fallback: COUNT(*) — works for views and non-Delta tables
    try:
        df = spark.sql(f"SELECT COUNT(*) AS cnt FROM {full_name}")
        return df.collect()[0].cnt
    except Exception as e:
        print(f"  Warning: row count failed for {table_name}: {e}")
        return None


def get_columns_info_schema(spark, schema, table_name):
    """
    Return column metadata using information_schema (richer data).

    Falls back to get_columns() if information_schema is not accessible.

    Parameters
    ----------
    spark : SparkSession
    schema : str
        Fully qualified schema name (e.g. "deid.derived").
    table_name : str
        Name of the table to describe.

    Returns
    -------
    list[dict]
        Each dict contains: column_name, data_type, is_nullable,
        ordinal_position, comment.
    """
    catalog = schema.split(".")[0]
    schema_name = schema.split(".")[1]

    try:
        query = f"""
            SELECT
                column_name,
                full_data_type,
                data_type,
                is_nullable,
                ordinal_position,
                comment
            FROM {catalog}.information_schema.columns
            WHERE table_schema = '{schema_name}'
              AND table_name   = '{table_name}'
            ORDER BY ordinal_position
        """
        df = spark.sql(query)
        rows = df.collect()

        if len(rows) == 0:
            return get_columns(spark, schema, table_name)

        return [
            {
                "column_name": row.column_name,
                "data_type": row.full_data_type if hasattr(row, "full_data_type") and row.full_data_type else row.data_type,
                "data_type_short": row.data_type,
                "is_nullable": row.is_nullable,
                "ordinal_position": row.ordinal_position,
                "comment": row.comment.strip() if row.comment else "",
            }
            for row in rows
        ]

    except Exception as e:
        print(f"  information_schema not available ({e}), falling back to DESCRIBE")
        return get_columns(spark, schema, table_name)


def extract_all(spark, schema, use_info_schema=True, include_table_detail=True,
                include_row_counts=True):
    """
    Extract full metadata for all tables in a schema.

    Parameters
    ----------
    spark : SparkSession
    schema : str
        Fully qualified schema name (e.g. "deid.derived").
    use_info_schema : bool
        If True, try information_schema first (richer data).
        Falls back to DESCRIBE TABLE if unavailable.
    include_table_detail : bool
        If True, run DESCRIBE TABLE EXTENDED to capture table-level
        properties (owner, location, type, etc.).
    include_row_counts : bool
        If True, use DESCRIBE DETAIL to pull approximate row counts
        from Delta table metadata (essentially free — no table scans).

    Returns
    -------
    dict
        {
            "schema": "deid.derived",
            "tables": [
                {
                    "table_name": "...",
                    "columns": [ { "column_name": ..., "data_type": ..., "comment": ..., ... } ],
                    "detail": { "Owner": ..., "Type": ..., ... },
                    "row_count": 12345
                },
                ...
            ]
        }
    """
    tables = get_tables(spark, schema)
    col_fn = get_columns_info_schema if use_info_schema else get_columns

    result = {
        "schema": schema,
        "tables": [],
    }

    for i, table_name in enumerate(tables):
        print(f"  [{i+1}/{len(tables)}] Extracting: {table_name}")
        columns = col_fn(spark, schema, table_name)

        table_entry = {
            "table_name": table_name,
            "columns": columns,
        }

        if include_table_detail:
            table_entry["detail"] = get_table_detail(spark, schema, table_name)

        if include_row_counts:
            table_entry["row_count"] = get_row_count(spark, schema, table_name)

        result["tables"].append(table_entry)

    print(f"\nExtraction complete: {len(tables)} tables")
    return result


def export_metadata(spark, schema, output_path, use_info_schema=True):
    """
    Extract metadata and save to a JSON file.

    Parameters
    ----------
    spark : SparkSession
    schema : str
        Fully qualified schema name (e.g. "deid.derived").
    output_path : str
        Path for the output JSON file (e.g. "outputs/metadata.json").
    use_info_schema : bool
        If True, try information_schema first.

    Returns
    -------
    dict
        The extracted metadata (same dict that was written to file).
    """
    metadata = extract_all(spark, schema, use_info_schema=use_info_schema)

    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)

    with open(output, "w") as f:
        json.dump(metadata, f, indent=2)

    print(f"Metadata saved to {output_path}")
    return metadata
