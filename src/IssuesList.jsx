/**
 * IssuesList
 * 
 * Lightweight component that shows a feedback count + link to GitHub Issues.
 * Fetches the count once on first mount (unless lazy), then caches it.
 * 
 * refreshKey is a string like "tableName::columnName::timestamp".
 * Only re-fetches if the refreshKey starts with this component's own cache key,
 * so submitting feedback on one column doesn't trigger re-fetches on all others.
 */
import { useState, useEffect } from 'react';
import { useAuth } from './GitHubAuthProvider.jsx';
import { fetchIssues } from './github_issues.js';

const REPO_OWNER = 'StarLiu1';
const REPO_NAME = 'data-dictionary';

// Module-level session cache: "tableName" or "tableName::columnName" → { open, total }
const countCache = new Map();

function cacheKey(tableName, columnName) {
  return columnName ? `${tableName}::${columnName}` : tableName;
}

function buildGitHubIssuesUrl(tableName, columnName) {
  let query = `is:issue is:open`;
  if (tableName) query += ` [table:${tableName}] in:title`;
  if (columnName) query += ` [column:${columnName}] in:title`;
  return `https://github.com/${REPO_OWNER}/${REPO_NAME}/issues?q=${encodeURIComponent(query)}`;
}

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '6px 0',
    flexWrap: 'wrap',
  },
  countText: {
    fontSize: '13px',
    color: '#24292e',
    fontWeight: 500,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
  },
  openDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#1a7f37',
    display: 'inline-block',
  },
  link: {
    fontSize: '13px',
    color: '#0969da',
    textDecoration: 'none',
    fontWeight: 500,
    transition: 'color 0.15s',
  },
  separator: {
    color: '#d0d7de',
    fontSize: '13px',
  },
  loading: {
    fontSize: '12px',
    color: '#8b949e',
    fontStyle: 'italic',
  },
  empty: {
    fontSize: '13px',
    color: '#8b949e',
  },
  error: {
    fontSize: '12px',
    color: '#cf222e',
  },
};

export default function IssuesList({ tableName, columnName, refreshKey, lazy = false }) {
  const { accessToken } = useAuth();
  const key = cacheKey(tableName, columnName);

  const [counts, setCounts] = useState(countCache.get(key) || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activated, setActivated] = useState(!lazy);

  // Check if a refreshKey is relevant to this instance
  function isRefreshRelevant(rk) {
    if (!rk) return false;
    // refreshKey format: "tableName::columnName::timestamp" or "tableName::timestamp"
    return rk.startsWith(key + '::') || rk.startsWith(key.split('::')[0] + '::' + Date) === false && rk.startsWith(tableName + '::') && !columnName;
  }

  // Smarter relevance check
  function shouldRefetch(rk) {
    if (!rk) return false;
    // Extract the table::column prefix from refreshKey (strip the timestamp)
    const parts = rk.split('::');
    if (columnName) {
      // Column-level: only refresh if refreshKey is for this exact table+column
      return parts[0] === tableName && parts[1] === columnName;
    } else {
      // Table-level: refresh if refreshKey is for this table (any column or table-level)
      return parts[0] === tableName;
    }
  }

  // Initial fetch (if not lazy)
  useEffect(() => {
    if (!activated) return;
    if (countCache.has(key)) {
      setCounts(countCache.get(key));
      return;
    }

    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const items = await fetchIssues(accessToken, tableName, columnName, 'all');
        const open = items.filter((i) => i.state === 'open').length;
        const result = { open, total: items.length };
        countCache.set(key, result);
        if (!cancelled) setCounts(result);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [accessToken, tableName, columnName, key, activated]);

  // Handle refreshKey changes — only re-fetch if relevant to this instance
  useEffect(() => {
    if (!refreshKey) return;
    if (!shouldRefetch(refreshKey)) return;

    // Activate if lazy
    if (!activated) setActivated(true);

    // Invalidate cache and re-fetch
    countCache.delete(key);
    let cancelled = false;
    async function reload() {
      setLoading(true);
      setError(null);
      try {
        const items = await fetchIssues(accessToken, tableName, columnName, 'all');
        const open = items.filter((i) => i.state === 'open').length;
        const result = { open, total: items.length };
        countCache.set(key, result);
        if (!cancelled) setCounts(result);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    reload();
    return () => { cancelled = true; };
  }, [refreshKey]);

  const ghUrl = buildGitHubIssuesUrl(tableName, columnName);

  // Lazy mode: show nothing until activated
  if (!activated) {
    if (countCache.has(key)) {
      const cached = countCache.get(key);
      if (cached.total > 0) {
        return (
          <div style={styles.container}>
            <span style={styles.countText}>
              <span style={styles.openDot} />
              {cached.open}
            </span>
            <a href={ghUrl} target="_blank" rel="noopener noreferrer" style={{ ...styles.link, fontSize: '12px' }}>
              →
            </a>
          </div>
        );
      }
      return null;
    }
    return null;
  }

  if (loading) {
    return <div style={styles.container}><span style={styles.loading}>Loading feedback…</span></div>;
  }

  if (error) {
    return (
      <div style={styles.container}>
        <span style={styles.error}>Couldn't load feedback</span>
        <span style={styles.separator}>·</span>
        <a href={ghUrl} target="_blank" rel="noopener noreferrer" style={styles.link}>
          View on GitHub →
        </a>
      </div>
    );
  }

  if (!counts || counts.total === 0) {
    if (lazy) return null;
    return (
      <div style={styles.container}>
        <span style={styles.empty}>No feedback yet</span>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <span style={styles.countText}>
        <span style={styles.openDot} />
        {counts.open} open {counts.open === 1 ? 'issue' : 'issues'}
        {counts.total > counts.open && (
          <span style={{ color: '#8b949e', fontWeight: 400 }}>
            {' '}({counts.total} total)
          </span>
        )}
      </span>
      <span style={styles.separator}>·</span>
      <a href={ghUrl} target="_blank" rel="noopener noreferrer" style={styles.link}>
        View on GitHub →
      </a>
    </div>
  );
}

export function clearIssuesCache() {
  countCache.clear();
}
