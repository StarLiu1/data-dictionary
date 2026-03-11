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
    Return column metadata for a single table.

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
        Each dict contains: column_name, data_type, is_nullable.
    """
    full_name = f"{schema}.{table_name}"
    df = spark.sql(f"DESCRIBE TABLE {full_name}")
    
    columns = []
    for row in df.collect():
        col_name = row.col_name.strip()

        # DESCRIBE TABLE returns partition info and blank rows after
        # the actual columns — skip those
        if col_name == "" or col_name.startswith("#"):
            break

        columns.append({
            "column_name": col_name,
            "data_type": row.data_type.strip(),
            "is_nullable": "YES",  # default; updated below if info_schema available
        })

    return columns


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
        Each dict contains: column_name, data_type, is_nullable, ordinal_position.
    """
    catalog = schema.split(".")[0]
    schema_name = schema.split(".")[1]

    try:
        query = f"""
            SELECT
                column_name,
                data_type,
                is_nullable,
                ordinal_position
            FROM {catalog}.information_schema.columns
            WHERE table_schema = '{schema_name}'
              AND table_name   = '{table_name}'
            ORDER BY ordinal_position
        """
        df = spark.sql(query)
        rows = df.collect()

        if len(rows) == 0:
            # Might not have access — fall back
            return get_columns(spark, schema, table_name)

        return [
            {
                "column_name": row.column_name,
                "data_type": row.data_type,
                "is_nullable": row.is_nullable,
                "ordinal_position": row.ordinal_position,
            }
            for row in rows
        ]

    except Exception as e:
        print(f"  information_schema not available ({e}), falling back to DESCRIBE")
        return get_columns(spark, schema, table_name)


def extract_all(spark, schema, use_info_schema=True):
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

    Returns
    -------
    dict
        {
            "schema": "deid.derived",
            "tables": [
                {
                    "table_name": "...",
                    "columns": [ { "column_name": ..., "data_type": ..., ... } ]
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
        result["tables"].append({
            "table_name": table_name,
            "columns": columns,
        })

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
