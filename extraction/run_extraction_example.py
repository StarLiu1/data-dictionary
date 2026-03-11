"""
Quick-start: Run this from a REACH notebook to extract metadata.

Assumes:
  - REACH/shared/ is already on your path (as in your existing notebooks)
  - data-dictionary/ repo is cloned alongside REACH/
"""

import sys
import os

# --- 1. Your existing REACH setup (already in your notebooks) -----------
sys.path.insert(0, os.path.join(os.getcwd(), ".."))

from shared.config import DatabricksConfig
from shared.connection import get_databricks_connect_session

config = DatabricksConfig()
config.validate(mode="connect")

spark = get_databricks_connect_session(config)
print(f"Connected to Databricks cluster: {config.cluster_id}")
print(f"Spark version: {spark.version}")

# --- 2. Point to the data-dictionary repo --------------------------------
# Adjust this path based on where you cloned the repo relative to REACH
DATA_DICT_PATH = os.path.join(os.getcwd(), "..", "..", "data-dictionary")
sys.path.insert(0, DATA_DICT_PATH)

from extraction.extract_metadata import export_metadata

# --- 3. Extract and save ------------------------------------------------
SCHEMA = "deid.derived"
OUTPUT_PATH = os.path.join(DATA_DICT_PATH, "outputs", "metadata.json")

metadata = export_metadata(spark, SCHEMA, OUTPUT_PATH)

# --- 4. Quick summary ---------------------------------------------------
print(f"\n{'='*50}")
print(f"Schema: {metadata['schema']}")
print(f"Tables: {len(metadata['tables'])}")
for t in metadata["tables"]:
    print(f"  {t['table_name']:40s} ({len(t['columns'])} columns)")
