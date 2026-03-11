/**
 * IssuesList
 * 
 * Lightweight component that shows a feedback count + link to GitHub Issues.
 * Fetches the count once on first mount, then caches it in a module-level Map
 * so navigating back to the same table doesn't re-fetch.
 * 
 * Displays: "● 3 open issues (5 total) · View on GitHub →"
 * Or:       "No feedback yet"
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

/**
 * Build a GitHub Issues URL pre-filtered by table/column search query
 */
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

export default function IssuesList({ tableName, columnName, refreshKey }) {
  const { accessToken } = useAuth();
  const key = cacheKey(tableName, columnName);

  const [counts, setCounts] = useState(countCache.get(key) || null);
  const [loading, setLoading] = useState(!countCache.has(key));
  const [error, setError] = useState(null);

  useEffect(() => {
    // If cached and no refresh requested, skip fetch
    if (countCache.has(key) && !refreshKey) {
      setCounts(countCache.get(key));
      setLoading(false);
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
  }, [accessToken, tableName, columnName, refreshKey, key]);

  // Invalidate cache when refreshKey changes (after creating an issue)
  useEffect(() => {
    if (refreshKey) {
      countCache.delete(key);
    }
  }, [refreshKey, key]);

  const ghUrl = buildGitHubIssuesUrl(tableName, columnName);

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

/**
 * Utility: clear the entire session cache (e.g., on sign-out)
 */
export function clearIssuesCache() {
  countCache.clear();
}
