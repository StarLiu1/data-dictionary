/**
 * IssuesList
 * 
 * Displays existing GitHub issues for a given table (and optionally column).
 * Loads issues on mount, shows them inline with expand/collapse.
 */
import { useState, useEffect } from 'react';
import { useAuth } from './GitHubAuthProvider.jsx';
import { fetchIssues, parseIssueTitle } from './github_issues.js';

const styles = {
  container: {
    marginTop: '12px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer',
    padding: '8px 0',
    userSelect: 'none',
  },
  headerIcon: {
    fontSize: '14px',
    transition: 'transform 0.15s',
  },
  headerText: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#24292e',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '20px',
    height: '20px',
    padding: '0 6px',
    backgroundColor: '#ddf4ff',
    color: '#0969da',
    borderRadius: '10px',
    fontSize: '11px',
    fontWeight: 600,
  },
  badgeEmpty: {
    backgroundColor: '#f6f8fa',
    color: '#8b949e',
  },
  list: {
    borderLeft: '2px solid #d8dee4',
    marginLeft: '6px',
    paddingLeft: '16px',
  },
  issueItem: {
    padding: '10px 0',
    borderBottom: '1px solid #f0f2f4',
  },
  issueItemLast: {
    borderBottom: 'none',
  },
  issueTitle: {
    fontSize: '13px',
    fontWeight: 500,
    color: '#24292e',
    textDecoration: 'none',
    lineHeight: 1.4,
  },
  issueTitleLink: {
    color: '#0969da',
    textDecoration: 'none',
  },
  issueMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginTop: '4px',
    fontSize: '12px',
    color: '#8b949e',
  },
  stateOpen: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '3px',
    color: '#1a7f37',
    fontWeight: 500,
  },
  stateClosed: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '3px',
    color: '#8250df',
    fontWeight: 500,
  },
  dot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    display: 'inline-block',
  },
  dotOpen: {
    backgroundColor: '#1a7f37',
  },
  dotClosed: {
    backgroundColor: '#8250df',
  },
  priorityTag: {
    display: 'inline-block',
    padding: '1px 6px',
    borderRadius: '8px',
    fontSize: '11px',
    fontWeight: 500,
  },
  priorityLow: {
    backgroundColor: '#dafbe1',
    color: '#1a7f37',
  },
  priorityMedium: {
    backgroundColor: '#fff8c5',
    color: '#9a6700',
  },
  priorityHigh: {
    backgroundColor: '#ffebe9',
    color: '#cf222e',
  },
  loading: {
    fontSize: '12px',
    color: '#8b949e',
    padding: '8px 0',
    fontStyle: 'italic',
  },
  error: {
    fontSize: '12px',
    color: '#cf222e',
    padding: '8px 0',
  },
  emptyText: {
    fontSize: '12px',
    color: '#8b949e',
    padding: '4px 0',
    fontStyle: 'italic',
  },
  filterGroup: {
    display: 'flex',
    gap: '4px',
    marginBottom: '8px',
  },
  filterBtn: {
    padding: '2px 8px',
    fontSize: '11px',
    fontWeight: 500,
    border: '1px solid #d0d7de',
    borderRadius: '12px',
    backgroundColor: '#fff',
    cursor: 'pointer',
    color: '#586069',
    transition: 'all 0.15s',
  },
  filterBtnActive: {
    backgroundColor: '#ddf4ff',
    borderColor: '#0969da',
    color: '#0969da',
  },
};

function timeAgo(dateStr) {
  const seconds = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function getPriorityFromLabels(labels) {
  for (const label of labels) {
    const name = label.name || label;
    if (name === 'priority:high') return 'high';
    if (name === 'priority:medium') return 'medium';
    if (name === 'priority:low') return 'low';
  }
  // Also check body for priority since labels may not be applied yet
  return null;
}

function getPriorityFromBody(body) {
  const match = body?.match(/\*\*Priority:\*\*\s*(low|medium|high)/i);
  return match ? match[1].toLowerCase() : null;
}

export default function IssuesList({ tableName, columnName, refreshKey }) {
  const { accessToken } = useAuth();
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [stateFilter, setStateFilter] = useState('all');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const items = await fetchIssues(accessToken, tableName, columnName, 'all');
        if (!cancelled) setIssues(items);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [accessToken, tableName, columnName, refreshKey]);

  const filteredIssues = stateFilter === 'all'
    ? issues
    : issues.filter((i) => i.state === stateFilter);

  const openCount = issues.filter((i) => i.state === 'open').length;
  const closedCount = issues.filter((i) => i.state === 'closed').length;

  return (
    <div style={styles.container}>
      <div style={styles.header} onClick={() => setExpanded(!expanded)}>
        <span style={{ ...styles.headerIcon, transform: expanded ? 'rotate(90deg)' : 'none' }}>
          ▶
        </span>
        <span style={styles.headerText}>
          Feedback
        </span>
        {loading ? (
          <span style={styles.loading}>loading…</span>
        ) : (
          <span style={{ ...styles.badge, ...(issues.length === 0 ? styles.badgeEmpty : {}) }}>
            {issues.length}
          </span>
        )}
      </div>

      {expanded && (
        <div style={styles.list}>
          {loading ? (
            <div style={styles.loading}>Loading feedback…</div>
          ) : error ? (
            <div style={styles.error}>{error}</div>
          ) : issues.length === 0 ? (
            <div style={styles.emptyText}>No feedback yet for this {columnName ? 'column' : 'table'}.</div>
          ) : (
            <>
              {/* Filter tabs */}
              <div style={styles.filterGroup}>
                <button
                  style={{ ...styles.filterBtn, ...(stateFilter === 'all' ? styles.filterBtnActive : {}) }}
                  onClick={() => setStateFilter('all')}
                >
                  All ({issues.length})
                </button>
                <button
                  style={{ ...styles.filterBtn, ...(stateFilter === 'open' ? styles.filterBtnActive : {}) }}
                  onClick={() => setStateFilter('open')}
                >
                  Open ({openCount})
                </button>
                <button
                  style={{ ...styles.filterBtn, ...(stateFilter === 'closed' ? styles.filterBtnActive : {}) }}
                  onClick={() => setStateFilter('closed')}
                >
                  Closed ({closedCount})
                </button>
              </div>

              {filteredIssues.map((issue, idx) => {
                const { cleanTitle } = parseIssueTitle(issue.title);
                const priority = getPriorityFromLabels(issue.labels) || getPriorityFromBody(issue.body);
                const isOpen = issue.state === 'open';

                return (
                  <div
                    key={issue.id}
                    style={{
                      ...styles.issueItem,
                      ...(idx === filteredIssues.length - 1 ? styles.issueItemLast : {}),
                    }}
                  >
                    <a
                      href={issue.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={styles.issueTitleLink}
                    >
                      {cleanTitle}
                    </a>
                    <div style={styles.issueMeta}>
                      <span style={isOpen ? styles.stateOpen : styles.stateClosed}>
                        <span style={{ ...styles.dot, ...(isOpen ? styles.dotOpen : styles.dotClosed) }} />
                        {isOpen ? 'Open' : 'Closed'}
                      </span>
                      {priority && (
                        <span
                          style={{
                            ...styles.priorityTag,
                            ...(priority === 'low' ? styles.priorityLow : {}),
                            ...(priority === 'medium' ? styles.priorityMedium : {}),
                            ...(priority === 'high' ? styles.priorityHigh : {}),
                          }}
                        >
                          {priority}
                        </span>
                      )}
                      <span>#{issue.number}</span>
                      <span>by {issue.user?.login}</span>
                      <span>{timeAgo(issue.created_at)}</span>
                      {issue.comments > 0 && <span>💬 {issue.comments}</span>}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
