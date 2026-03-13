import { useState, useEffect, useMemo, useRef } from "react";
import SignInButton from './SignInButton.jsx';
import FeedbackButton from './FeedbackButton.jsx';
import IssuesList from './IssuesList.jsx';
import EditableField from './EditableField.jsx';
import AdminPanel from './AdminPanel.jsx';
import { apiFetch } from './api.js';
import { useAuth } from './GitHubAuthProvider.jsx';

// ── Icons (inline SVG to avoid dependencies) ──
const Icons = {
  Search: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
    </svg>
  ),
  Table: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v18" /><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M3 9h18" /><path d="M3 15h18" />
    </svg>
  ),
  Column: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3h18" /><path d="M3 9h18" /><path d="M3 15h18" /><path d="M3 21h18" />
    </svg>
  ),
  Back: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 18-6-6 6-6" />
    </svg>
  ),
  Database: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5v14a9 3 0 0 0 18 0V5" /><path d="M3 12a9 3 0 0 0 18 0" />
    </svg>
  ),
  Filter: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  ),
  X: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" /><path d="m6 6 12 12" />
    </svg>
  ),
  Nullable: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 8v4" /><path d="M12 16h.01" /></svg>
  ),
  Copy: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="14" height="14" x="8" y="8" rx="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  ),
};

// ── Data type color coding ──
function getTypeColor(dataType) {
  const t = (dataType || "").toLowerCase();
  if (t.includes("string") || t.includes("char") || t.includes("text")) return { bg: "#dbeafe", fg: "#1e40af", label: "STR" };
  if (t.includes("int") || t.includes("long") || t.includes("short")) return { bg: "#dcfce7", fg: "#166534", label: "INT" };
  if (t.includes("decimal") || t.includes("float") || t.includes("double") || t.includes("numeric")) return { bg: "#fef3c7", fg: "#92400e", label: "NUM" };
  if (t.includes("timestamp") || t.includes("date") || t.includes("time")) return { bg: "#fae8ff", fg: "#86198f", label: "DATE" };
  if (t.includes("boolean") || t.includes("bool")) return { bg: "#fee2e2", fg: "#991b1b", label: "BOOL" };
  if (t.includes("binary") || t.includes("blob")) return { bg: "#f1f5f9", fg: "#475569", label: "BIN" };
  if (t.includes("array") || t.includes("map") || t.includes("struct")) return { bg: "#e0e7ff", fg: "#3730a3", label: "CPLX" };
  return { bg: "#f3f4f6", fg: "#374151", label: "OTHER" };
}

function TypeBadge({ dataType }) {
  const { bg, fg } = getTypeColor(dataType);
  return (
    <span style={{ background: bg, color: fg, padding: "2px 8px", borderRadius: "4px", fontSize: "11px", fontFamily: "'IBM Plex Mono', 'SF Mono', 'Fira Code', monospace", fontWeight: 600, letterSpacing: "0.02em", whiteSpace: "nowrap" }}>
      {dataType}
    </span>
  );
}

// ── Sortable column header ──
function SortHeader({ label, sortKey, currentSort, onSort, style = {} }) {
  const active = currentSort.key === sortKey;
  const dir = active ? currentSort.dir : null;
  return (
    <th
      onClick={() => onSort(sortKey)}
      style={{ cursor: "pointer", userSelect: "none", padding: "10px 12px", textAlign: "left", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: active ? "#1e3a5f" : "#64748b", borderBottom: "2px solid #e2e8f0", position: "sticky", top: 0, background: "#f8fafc", zIndex: 2, whiteSpace: "nowrap", ...style }}
    >
      {label}
      <span style={{ marginLeft: "4px", opacity: active ? 1 : 0.3, fontSize: "10px" }}>
        {dir === "asc" ? "▲" : dir === "desc" ? "▼" : "▲"}
      </span>
    </th>
  );
}

// ── Main App ──
export default function DataDictionaryApp() {
  const [metadata, setMetadata] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState("master"); // "master" | "table" | "columns"
  const [selectedTable, setSelectedTable] = useState(null);
  const [search, setSearch] = useState("");
  const [columnSearch, setColumnSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [masterSort, setMasterSort] = useState({ key: "table_name", dir: "asc" });
  const [detailSort, setDetailSort] = useState({ key: "ordinal_position", dir: "asc" });
  const [copied, setCopied] = useState(null);
  const searchRef = useRef(null);
  const [issueRefreshKey, setIssueRefreshKey] = useState(0);
  const { user } = useAuth();
  const isAdmin = user?.isAdmin || false;

  // Load embedded metadata
  useEffect(() => {
    async function loadMetadata() {
      try {
        const data = await apiFetch('/metadata/1');  // dict_id = 1 for deid.derived
        setMetadata(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadMetadata();
  }, []);

  // Keyboard shortcut: / to focus search
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "/" && document.activeElement.tagName !== "INPUT") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "Escape") {
        setSearch("");
        setColumnSearch("");
        searchRef.current?.blur();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ── Derived data ──
  const tables = metadata?.tables || [];

  const allDataTypes = useMemo(() => {
    const types = new Set();
    tables.forEach((t) => t.columns.forEach((c) => {
      const tc = getTypeColor(c.data_type);
      types.add(tc.label);
    }));
    return Array.from(types).sort();
  }, [tables]);

  // All columns flattened for global column search
  const allColumns = useMemo(() => {
    const cols = [];
    tables.forEach((t) => {
      t.columns.forEach((c) => {
        cols.push({ ...c, table_name: t.table_name, table_comment: t.detail?.Comment || "" });
      });
    });
    return cols;
  }, [tables]);

  // Filtered + sorted master table list
  const filteredTables = useMemo(() => {
    let filtered = tables;
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter((t) =>
        t.table_name.toLowerCase().includes(q) ||
        (t.detail?.Comment || "").toLowerCase().includes(q)
      );
    }
    return [...filtered].sort((a, b) => {
      const { key, dir } = masterSort;
      let av, bv;
      if (key === "table_name") { av = a.table_name; bv = b.table_name; }
      else if (key === "column_count") { av = a.columns.length; bv = b.columns.length; }
      else if (key === "type") { av = a.detail?.Type || ""; bv = b.detail?.Type || ""; }
      else if (key === "comment") { av = a.detail?.Comment || ""; bv = b.detail?.Comment || ""; }
      else { av = a.table_name; bv = b.table_name; }
      if (typeof av === "string") { av = av.toLowerCase(); bv = bv.toLowerCase(); }
      if (av < bv) return dir === "asc" ? -1 : 1;
      if (av > bv) return dir === "asc" ? 1 : -1;
      return 0;
    });
  }, [tables, search, masterSort]);

  // Filtered columns for table detail view
  const filteredColumns = useMemo(() => {
    if (!selectedTable) return [];
    let cols = selectedTable.columns;
    if (columnSearch) {
      const q = columnSearch.toLowerCase();
      cols = cols.filter((c) =>
        c.column_name.toLowerCase().includes(q) ||
        (c.comment || "").toLowerCase().includes(q) ||
        (c.data_type || "").toLowerCase().includes(q)
      );
    }
    if (typeFilter !== "all") {
      cols = cols.filter((c) => getTypeColor(c.data_type).label === typeFilter);
    }
    return [...cols].sort((a, b) => {
      const { key, dir } = detailSort;
      let av = a[key] ?? "", bv = b[key] ?? "";
      if (typeof av === "string") { av = av.toLowerCase(); bv = bv.toLowerCase(); }
      if (av < bv) return dir === "asc" ? -1 : 1;
      if (av > bv) return dir === "asc" ? 1 : -1;
      return 0;
    });
  }, [selectedTable, columnSearch, typeFilter, detailSort]);

  // Filtered columns for global column search
  const filteredAllColumns = useMemo(() => {
    if (!search) return [];
    const q = search.toLowerCase();
    return allColumns.filter((c) =>
      c.column_name.toLowerCase().includes(q) ||
      (c.comment || "").toLowerCase().includes(q)
    ).slice(0, 100); // cap at 100 for performance
  }, [allColumns, search]);

  // ── Handlers ──
  function handleMasterSort(key) {
    setMasterSort((prev) => ({
      key,
      dir: prev.key === key && prev.dir === "asc" ? "desc" : "asc",
    }));
  }

  function handleDetailSort(key) {
    setDetailSort((prev) => ({
      key,
      dir: prev.key === key && prev.dir === "asc" ? "desc" : "asc",
    }));
  }

  function openTable(table) {
    setSelectedTable(table);
    setView("table");
    setColumnSearch("");
    setTypeFilter("all");
    setDetailSort({ key: "ordinal_position", dir: "asc" });
  }

  function goBack() {
    setView("master");
    setSelectedTable(null);
    setColumnSearch("");
    setTypeFilter("all");
  }

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 1500);
  }

  // ── Styles ──
  const S = {
    app: { fontFamily: "'IBM Plex Sans', 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif", background: "#f1f5f9", minHeight: "100vh", color: "#0f172a" },
    header: { background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)", padding: "24px 32px", borderBottom: "3px solid #3b82f6" },
    headerInner: { maxWidth: "1400px", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "16px" },
    logo: { display: "flex", alignItems: "center", gap: "12px", color: "#fff" },
    logoText: { fontSize: "20px", fontWeight: 700, letterSpacing: "-0.02em" },
    schema: { fontSize: "12px", fontFamily: "'IBM Plex Mono', monospace", color: "#93c5fd", marginTop: "2px" },
    stats: { display: "flex", gap: "24px" },
    stat: { textAlign: "center", color: "#cbd5e1" },
    statNum: { fontSize: "22px", fontWeight: 700, color: "#fff", lineHeight: 1 },
    statLabel: { fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: "2px" },
    main: { maxWidth: "1400px", margin: "0 auto", padding: "24px 32px" },
    searchBar: { display: "flex", alignItems: "center", gap: "8px", background: "#fff", border: "2px solid #e2e8f0", borderRadius: "10px", padding: "10px 16px", marginBottom: "20px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", transition: "border-color 0.2s" },
    searchInput: { border: "none", outline: "none", flex: 1, fontSize: "14px", fontFamily: "inherit", background: "transparent", color: "#0f172a" },
    kbd: { fontSize: "10px", fontFamily: "monospace", background: "#f1f5f9", color: "#64748b", padding: "2px 6px", borderRadius: "4px", border: "1px solid #e2e8f0" },
    card: { background: "#fff", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)", overflow: "hidden" },
    tableRow: { cursor: "pointer", transition: "background 0.15s" },
    badge: { display: "inline-flex", alignItems: "center", gap: "4px", padding: "2px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: 600 },
    backBtn: { display: "inline-flex", alignItems: "center", gap: "6px", background: "none", border: "none", color: "#3b82f6", cursor: "pointer", fontSize: "13px", fontWeight: 600, padding: "6px 0", fontFamily: "inherit" },
    tabBar: { display: "flex", gap: "0", marginBottom: "20px", background: "#fff", borderRadius: "10px", padding: "4px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" },
    tab: (active) => ({ padding: "8px 20px", borderRadius: "8px", border: "none", background: active ? "#0f172a" : "transparent", color: active ? "#fff" : "#64748b", fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s", display: "flex", alignItems: "center", gap: "6px" }),
    filterChip: (active) => ({ padding: "4px 12px", borderRadius: "20px", border: active ? "2px solid #3b82f6" : "1px solid #e2e8f0", background: active ? "#eff6ff" : "#fff", color: active ? "#1e40af" : "#64748b", fontSize: "12px", fontWeight: 500, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }),
    emptyState: { textAlign: "center", padding: "60px 20px", color: "#94a3b8" },
  };

  // ── Loading / Error ──
  if (loading) {
    return (
      <div style={{ ...S.app, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", color: "#64748b" }}>
          <div style={{ width: "40px", height: "40px", border: "3px solid #e2e8f0", borderTopColor: "#3b82f6", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <div style={{ fontSize: "14px" }}>Loading data dictionary…</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ ...S.app, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", color: "#ef4444", maxWidth: "400px" }}>
          <div style={{ fontSize: "18px", fontWeight: 600, marginBottom: "8px" }}>Failed to load metadata</div>
          <div style={{ fontSize: "13px", color: "#94a3b8" }}>{error}</div>
          <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "12px" }}>
            Make sure <code style={{ background: "#f1f5f9", padding: "2px 6px", borderRadius: "4px" }}>metadata.json</code> is in the same directory as this app.
          </div>
        </div>
      </div>
    );
  }

  const totalColumns = tables.reduce((sum, t) => sum + t.columns.length, 0);

  // ── Table Detail View ──
  if (view === "table" && selectedTable) {
    const detail = selectedTable.detail || {};
    const colTypeGroups = {};
    selectedTable.columns.forEach((c) => {
      const tc = getTypeColor(c.data_type);
      colTypeGroups[tc.label] = (colTypeGroups[tc.label] || 0) + 1;
    });

    return (
      <div style={S.app}>
        <header style={S.header}>
          <div style={S.headerInner}>
            <div style={S.logo}>
              <Icons.Database />
              <div>
                <div style={S.logoText}>EHR Data Dictionary</div>
                <div style={S.schema}>{metadata.schema}</div>
              </div>
            </div>
          </div>
        </header>

        <main style={S.main}>
          <button onClick={goBack} style={S.backBtn}>
            <Icons.Back /> Back to all tables
          </button>
          {/* Table header info */}
          <div style={{ ...S.card, padding: "24px", marginTop: "12px", marginBottom: "20px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "16px" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <h2 style={{ margin: 0, fontSize: "22px", fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace" }}>{selectedTable.table_name}</h2>
                  <button onClick={() => copyToClipboard(`${metadata.schema}.${selectedTable.table_name}`)} title="Copy full path" style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: "4px" }}>
                    <Icons.Copy />
                  </button>
                  {copied === `${metadata.schema}.${selectedTable.table_name}` && <span style={{ fontSize: "11px", color: "#22c55e" }}>Copied!</span>}
                  <FeedbackButton
                    tableName={selectedTable.table_name}
                    onIssueCreated={() => setIssueRefreshKey(k => k + 1)}
                  />
                </div>
                {<EditableField
                  value={detail.Comment}
                  placeholder="Add table description…"
                  multiline={true}
                  onSave={async (newValue) => {
                    await apiFetch(`/admin/1/tables/${selectedTable.table_name}`, {
                      method: 'PUT',
                      body: JSON.stringify({ field_name: 'Comment', new_value: newValue }),
                    });
                    detail.Comment = newValue;
                  }}
                /> && <p style={{ margin: "8px 0 0", color: "#64748b", fontSize: "14px", lineHeight: 1.5, maxWidth: "700px" }}>{detail.Comment}</p>}

                
              </div>
              <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
                {detail.Type && (
                  <div style={S.stat}>
                    <div style={{ ...S.statNum, color: "#0f172a", fontSize: "16px" }}>{detail.Type}</div>
                    <div style={{ ...S.statLabel, color: "#94a3b8" }}>Type</div>
                  </div>
                )}
                <div style={S.stat}>
                  <div style={{ ...S.statNum, color: "#0f172a", fontSize: "16px" }}>{selectedTable.columns.length}</div>
                  <div style={{ ...S.statLabel, color: "#94a3b8" }}>Columns</div>
                </div>
                {detail.Provider && (
                  <div style={S.stat}>
                    <div style={{ ...S.statNum, color: "#0f172a", fontSize: "16px" }}>{detail.Provider}</div>
                    <div style={{ ...S.statLabel, color: "#94a3b8" }}>Provider</div>
                  </div>
                )}
              </div>
            </div>

            {/* Metadata details row */}
            {(detail["Created Time"] || detail["Created By"] || detail.Owner) && (
              <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: "1px solid #f1f5f9", display: "flex", gap: "24px", flexWrap: "wrap", fontSize: "12px", color: "#94a3b8" }}>
                {detail["Created Time"] && <span>Created: <strong style={{ color: "#64748b" }}>{detail["Created Time"]}</strong></span>}
                {detail["Created By"] && <span>By: <strong style={{ color: "#64748b" }}>{detail["Created By"]}</strong></span>}
              </div>
            )}
            <IssuesList
              tableName={selectedTable.table_name}
              refreshKey={issueRefreshKey}
            />
          </div>
          
          {/* Search + type filter bar */}
          <div style={{ display: "flex", gap: "12px", marginBottom: "16px", flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ ...S.searchBar, flex: 1, minWidth: "200px", marginBottom: 0 }}>
              <Icons.Search />
              <input
                ref={searchRef}
                style={S.searchInput}
                placeholder="Search columns…"
                value={columnSearch}
                onChange={(e) => setColumnSearch(e.target.value)}
              />
              {columnSearch && (
                <button onClick={() => setColumnSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: "2px" }}>
                  <Icons.X />
                </button>
              )}
            </div>
            <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
              <Icons.Filter />
              <button style={S.filterChip(typeFilter === "all")} onClick={() => setTypeFilter("all")}>All</button>
              {Object.entries(colTypeGroups).sort().map(([label, count]) => (
                <button key={label} style={S.filterChip(typeFilter === label)} onClick={() => setTypeFilter(typeFilter === label ? "all" : label)}>
                  {label} <span style={{ opacity: 0.6 }}>({count})</span>
                </button>
              ))}
            </div>
          </div>

          {/* Columns table */}
          <div style={{ ...S.card, overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <SortHeader label="#" sortKey="ordinal_position" currentSort={detailSort} onSort={handleDetailSort} style={{ width: "50px", textAlign: "center" }} />
                  <SortHeader label="Column Name" sortKey="column_name" currentSort={detailSort} onSort={handleDetailSort} />
                  <SortHeader label="Data Type" sortKey="data_type" currentSort={detailSort} onSort={handleDetailSort} />
                  <SortHeader label="Nullable" sortKey="is_nullable" currentSort={detailSort} onSort={handleDetailSort} style={{ textAlign: "center" }} />
                  <SortHeader label="Comment" sortKey="comment" currentSort={detailSort} onSort={handleDetailSort} />
                  <th style={{ padding: "10px 12px", fontSize: "12px", color: "#94a3b8" }}>Feedback</th>
                </tr>
              </thead>
              <tbody>
                {filteredColumns.map((col, idx) => (
                  <tr key={col.column_name} style={{ ...S.tableRow, background: idx % 2 === 1 ? "#f8fafc" : "#fff" }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "#eff6ff"}
                    onMouseLeave={(e) => e.currentTarget.style.background = idx % 2 === 1 ? "#f8fafc" : "#fff"}
                  >
                    <td style={{ padding: "10px 12px", fontSize: "12px", color: "#94a3b8", textAlign: "center", borderBottom: "1px solid #f1f5f9" }}>
                      {col.ordinal_position + 1}
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #f1f5f9" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <code style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "13px", fontWeight: 500 }}>{col.column_name}</code>
                        <button onClick={() => copyToClipboard(col.column_name)} style={{ background: "none", border: "none", cursor: "pointer", color: "#cbd5e1", padding: "2px", opacity: 0.5 }}
                          onMouseEnter={(e) => e.currentTarget.style.opacity = 1}
                          onMouseLeave={(e) => e.currentTarget.style.opacity = 0.5}
                        >
                          <Icons.Copy />
                        </button>
                        {copied === col.column_name && <span style={{ fontSize: "10px", color: "#22c55e" }}>Copied!</span>}
                      </div>
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #f1f5f9" }}>
                      <TypeBadge dataType={col.data_type} />
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "center", borderBottom: "1px solid #f1f5f9" }}>
                      {col.is_nullable === "YES" ? (
                        <span style={{ color: "#f59e0b", fontSize: "12px" }} title="Nullable">●</span>
                      ) : col.is_nullable === "NO" ? (
                        <span style={{ color: "#22c55e", fontSize: "12px" }} title="Not null">●</span>
                      ) : (
                        <span style={{ color: "#cbd5e1", fontSize: "11px" }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #f1f5f9", maxWidth: "400px" }}>
                      <EditableField
                        value={col.comment}
                        placeholder="Add a description…"
                        multiline={true}
                        onSave={async (newValue) => {
                          await apiFetch(`/admin/1/tables/${selectedTable.table_name}/columns/${col.column_name}`, {
                            method: 'PUT',
                            body: JSON.stringify({ field_name: 'comment', new_value: newValue }),
                          });
                          col.comment = newValue;
                        }}
                      />
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #f1f5f9" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <FeedbackButton
                          tableName={selectedTable.table_name}
                          columnName={col.column_name}
                          label=""
                          onIssueCreated={() => setIssueRefreshKey(k => k + 1)}
                        />
                        <IssuesList
                          tableName={selectedTable.table_name}
                          columnName={col.column_name}
                          refreshKey={issueRefreshKey}
                          lazy={true}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredColumns.length === 0 && (
              <div style={S.emptyState}>
                <div style={{ fontSize: "14px" }}>No columns match your filters</div>
              </div>
            )}
          </div>

          {/* Column count summary */}
          <div style={{ marginTop: "12px", fontSize: "12px", color: "#94a3b8", textAlign: "right" }}>
            Showing {filteredColumns.length} of {selectedTable.columns.length} columns
          </div>
        </main>
      </div>
    );
  }

  // ── Master View ──
  return (
    
    <div style={S.app}>
      <header style={S.header}>
        <div style={S.headerInner}>
          <div style={S.logo}>
            <Icons.Database />
            <div>
              <div style={S.logoText}>EHR Data Dictionary</div>
              <div style={S.schema}>{metadata.schema}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={S.stats}>
              <div style={S.stat}>
                <div style={S.statNum}>{tables.length}</div>
                <div style={S.statLabel}>Tables</div>
              </div>
              <div style={S.stat}>
                <div style={S.statNum}>{totalColumns.toLocaleString()}</div>
                <div style={S.statLabel}>Columns</div>
              </div>
            </div>
            <SignInButton />
          </div>
        </div>
      </header>

      <main style={S.main}>
        {/* Tab bar */}
        <div style={S.tabBar}>
          <button style={S.tab(view === "master")} onClick={() => setView("master")}>
            <Icons.Table /> Tables
          </button>
          <button style={S.tab(view === "columns")} onClick={() => setView("columns")}>
            <Icons.Column /> Column Search
          </button>
          {isAdmin && (
            <button style={S.tab(view === "admin")} onClick={() => setView("admin")}>
              🔧 Admin
            </button>
          )}

        </div>

        {/* Search bar */}
        <div style={S.searchBar}>
          <Icons.Search />
          <input
            ref={searchRef}
            style={S.searchInput}
            placeholder={view === "columns" ? "Search across all columns…" : "Search tables by name or description…"}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: "2px" }}>
              <Icons.X />
            </button>
          )}
          <span style={S.kbd}>/</span>
        </div>
        {view === "admin" && <AdminPanel dictId={1} />}
        {/* Column Search View */}
        {view === "columns" && (
          <div>
            {!search ? (
              <div style={S.emptyState}>
                <Icons.Search />
                <div style={{ marginTop: "12px", fontSize: "14px" }}>Type to search across all {totalColumns.toLocaleString()} columns</div>
                <div style={{ fontSize: "12px", marginTop: "4px" }}>Search by column name or comment</div>
              </div>
            ) : filteredAllColumns.length === 0 ? (
              <div style={S.emptyState}>
                <div style={{ fontSize: "14px" }}>No columns match "{search}"</div>
              </div>
            ) : (
              <div style={{ ...S.card, overflow: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={{ padding: "10px 12px", textAlign: "left", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#64748b", borderBottom: "2px solid #e2e8f0", background: "#f8fafc", position: "sticky", top: 0, zIndex: 2 }}>Table</th>
                      <th style={{ padding: "10px 12px", textAlign: "left", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#64748b", borderBottom: "2px solid #e2e8f0", background: "#f8fafc", position: "sticky", top: 0, zIndex: 2 }}>Column</th>
                      <th style={{ padding: "10px 12px", textAlign: "left", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#64748b", borderBottom: "2px solid #e2e8f0", background: "#f8fafc", position: "sticky", top: 0, zIndex: 2 }}>Type</th>
                      <th style={{ padding: "10px 12px", textAlign: "left", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#64748b", borderBottom: "2px solid #e2e8f0", background: "#f8fafc", position: "sticky", top: 0, zIndex: 2 }}>Comment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAllColumns.map((col, idx) => (
                      <tr key={`${col.table_name}-${col.column_name}`} style={{ ...S.tableRow, background: idx % 2 === 1 ? "#f8fafc" : "#fff" }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "#eff6ff"}
                        onMouseLeave={(e) => e.currentTarget.style.background = idx % 2 === 1 ? "#f8fafc" : "#fff"}
                      >
                        <td style={{ padding: "10px 12px", borderBottom: "1px solid #f1f5f9" }}>
                          <button onClick={() => openTable(tables.find((t) => t.table_name === col.table_name))}
                            style={{ background: "none", border: "none", color: "#3b82f6", cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", fontWeight: 500, padding: 0 }}
                          >
                            {col.table_name}
                          </button>
                        </td>
                        <td style={{ padding: "10px 12px", borderBottom: "1px solid #f1f5f9" }}>
                          <code style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "13px" }}>{col.column_name}</code>
                        </td>
                        <td style={{ padding: "10px 12px", borderBottom: "1px solid #f1f5f9" }}>
                          <TypeBadge dataType={col.data_type} />
                        </td>
                        <td style={{ padding: "10px 12px", borderBottom: "1px solid #f1f5f9", fontSize: "13px", color: "#64748b", maxWidth: "350px" }}>
                          {col.comment || <span style={{ color: "#cbd5e1" }}>—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredAllColumns.length >= 100 && (
                  <div style={{ padding: "12px", textAlign: "center", fontSize: "12px", color: "#94a3b8", borderTop: "1px solid #f1f5f9" }}>
                    Showing first 100 results — narrow your search for more specific matches
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Master Table View */}
        {view === "master" && (
          <div style={{ ...S.card, overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <SortHeader label="#" sortKey="table_name" currentSort={masterSort} onSort={handleMasterSort} style={{ width: "50px", textAlign: "center" }} />
                  <SortHeader label="Table Name" sortKey="table_name" currentSort={masterSort} onSort={handleMasterSort} />
                  <SortHeader label="Columns" sortKey="column_count" currentSort={masterSort} onSort={handleMasterSort} style={{ textAlign: "center" }} />
                  <SortHeader label="Type" sortKey="type" currentSort={masterSort} onSort={handleMasterSort} />
                  <SortHeader label="Description" sortKey="comment" currentSort={masterSort} onSort={handleMasterSort} />
                </tr>
              </thead>
              <tbody>
                {filteredTables.map((table, idx) => {
                  const detail = table.detail || {};
                  return (
                    <tr key={table.table_name} style={{ ...S.tableRow, background: idx % 2 === 1 ? "#f8fafc" : "#fff" }}
                      onClick={() => openTable(table)}
                      onMouseEnter={(e) => e.currentTarget.style.background = "#eff6ff"}
                      onMouseLeave={(e) => e.currentTarget.style.background = idx % 2 === 1 ? "#f8fafc" : "#fff"}
                    >
                      <td style={{ padding: "12px", fontSize: "12px", color: "#94a3b8", textAlign: "center", borderBottom: "1px solid #f1f5f9" }}>
                        {idx + 1}
                      </td>
                      <td style={{ padding: "12px", borderBottom: "1px solid #f1f5f9" }}>
                        <code style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "13px", fontWeight: 600, color: "#1e3a5f" }}>{table.table_name}</code>
                      </td>
                      <td style={{ padding: "12px", textAlign: "center", borderBottom: "1px solid #f1f5f9", fontSize: "13px", fontWeight: 600, color: "#475569" }}>
                        {table.columns.length}
                      </td>
                      <td style={{ padding: "12px", borderBottom: "1px solid #f1f5f9" }}>
                        {detail.Type && (
                          <span style={{ ...S.badge, background: detail.Type === "MATERIALIZED_VIEW" ? "#fef3c7" : "#dcfce7", color: detail.Type === "MATERIALIZED_VIEW" ? "#92400e" : "#166534" }}>
                            {detail.Type === "MATERIALIZED_VIEW" ? "MAT VIEW" : detail.Type}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "12px", borderBottom: "1px solid #f1f5f9", fontSize: "13px", color: "#64748b", maxWidth: "450px" }}>
                        {detail.Comment || <span style={{ color: "#cbd5e1", fontStyle: "italic" }}>No description</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredTables.length === 0 && (
              <div style={S.emptyState}>
                <div style={{ fontSize: "14px" }}>No tables match "{search}"</div>
              </div>
            )}
          </div>
        )}

        {/* Footer count */}
        {view === "master" && (
          <div style={{ marginTop: "12px", fontSize: "12px", color: "#94a3b8", textAlign: "right" }}>
            Showing {filteredTables.length} of {tables.length} tables
          </div>
        )}
      </main>
    </div>
    
  );
}
