/**
 * AdminPanel
 *
 * Visible only to admins. Shows:
 * - Open issues with search, priority filter, and pagination
 * - Admin user management (add/remove)
 * - Recent edit history
 */
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from './GitHubAuthProvider.jsx';
import { fetchAllIssues, parseIssueTitle } from './github_issues.js';
import ApplyIssueModal from './ApplyIssueModal.jsx';
import DismissIssueModal from './DismissIssueModal.jsx';

const API_BASE = import.meta.env.VITE_API_URL || '/api';
const PAGE_SIZE_OPTIONS = [10, 25, 50];
const DEFAULT_PAGE_SIZE = 10;

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  card: {
    background: '#fff',
    borderRadius: '12px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
    overflow: 'hidden',
  },
  cardHeader: {
    padding: '16px 20px',
    borderBottom: '1px solid #e2e8f0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: '16px',
    fontWeight: 700,
    color: '#0f172a',
    margin: 0,
  },
  cardBody: {
    padding: '16px 20px',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 10px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: 600,
  },
  // Filter bar
  filterBar: {
    display: 'flex',
    gap: '10px',
    padding: '12px 20px',
    borderBottom: '1px solid #f1f5f9',
    background: '#f8fafc',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  searchWrapper: {
    position: 'relative',
    flex: 1,
    minWidth: '180px',
  },
  searchIcon: {
    position: 'absolute',
    left: '10px',
    top: '50%',
    transform: 'translateY(-50%)',
    color: '#94a3b8',
    pointerEvents: 'none',
    display: 'flex',
    alignItems: 'center',
  },
  searchInput: {
    width: '100%',
    padding: '6px 10px 6px 32px',
    fontSize: '13px',
    border: '1px solid #d0d7de',
    borderRadius: '6px',
    outline: 'none',
    fontFamily: 'inherit',
    background: '#fff',
    transition: 'border-color 0.15s',
    boxSizing: 'border-box',
  },
  filterChip: (active) => ({
    padding: '4px 12px',
    borderRadius: '20px',
    border: active ? '2px solid #3b82f6' : '1px solid #d0d7de',
    background: active ? '#eff6ff' : '#fff',
    color: active ? '#1e40af' : '#6e7781',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.15s',
    whiteSpace: 'nowrap',
  }),
  // Pagination
  paginationBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 20px',
    borderTop: '1px solid #f1f5f9',
    background: '#f8fafc',
    fontSize: '12px',
    color: '#64748b',
    flexWrap: 'wrap',
    gap: '8px',
  },
  paginationInfo: {
    fontSize: '12px',
    color: '#64748b',
  },
  paginationControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  pageBtn: (active) => ({
    padding: '4px 10px',
    borderRadius: '4px',
    border: active ? '1px solid #3b82f6' : '1px solid #d0d7de',
    background: active ? '#eff6ff' : '#fff',
    color: active ? '#1e40af' : '#24292e',
    fontSize: '12px',
    fontWeight: active ? 600 : 400,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.15s',
  }),
  pageArrow: (disabled) => ({
    padding: '4px 8px',
    borderRadius: '4px',
    border: '1px solid #d0d7de',
    background: '#fff',
    color: disabled ? '#d0d7de' : '#24292e',
    fontSize: '12px',
    cursor: disabled ? 'default' : 'pointer',
    fontFamily: 'inherit',
  }),
  pageSizeSelect: {
    padding: '3px 6px',
    fontSize: '12px',
    border: '1px solid #d0d7de',
    borderRadius: '4px',
    background: '#fff',
    color: '#24292e',
    fontFamily: 'inherit',
    cursor: 'pointer',
    outline: 'none',
  },
  // Issues section
  issueRow: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: '12px 0',
    borderBottom: '1px solid #f1f5f9',
    gap: '12px',
  },
  issueTitle: {
    fontSize: '14px',
    fontWeight: 500,
    color: '#24292e',
    flex: 1,
  },
  issueMeta: {
    fontSize: '12px',
    color: '#8b949e',
    marginTop: '4px',
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
  },
  issueTag: {
    display: 'inline-block',
    padding: '1px 6px',
    backgroundColor: '#ddf4ff',
    color: '#0969da',
    borderRadius: '4px',
    fontSize: '11px',
    fontFamily: 'monospace',
  },
  priorityBadge: (priority) => {
    const colors = {
      high: { bg: '#ffebe9', color: '#cf222e' },
      medium: { bg: '#fff8c5', color: '#9a6700' },
      low: { bg: '#dafbe1', color: '#1a7f37' },
    };
    const c = colors[priority] || colors.low;
    return {
      display: 'inline-block',
      padding: '1px 6px',
      backgroundColor: c.bg,
      color: c.color,
      borderRadius: '4px',
      fontSize: '11px',
      fontWeight: 600,
    };
  },
  applyBtn: {
    padding: '5px 12px',
    backgroundColor: '#2da44e',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'background 0.15s',
    flexShrink: 0,
  },
  dismissBtn: {
    padding: '5px 12px',
    backgroundColor: 'transparent',
    color: '#6e7781',
    border: '1px solid #d0d7de',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.15s',
    flexShrink: 0,
  },
  viewBtn: {
    padding: '5px 12px',
    backgroundColor: 'transparent',
    color: '#0969da',
    border: '1px solid #d0d7de',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    textDecoration: 'none',
  },
  // Admin users section
  adminRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 0',
    borderBottom: '1px solid #f1f5f9',
  },
  adminName: {
    fontSize: '14px',
    fontWeight: 500,
    color: '#24292e',
    fontFamily: "'IBM Plex Mono', monospace",
  },
  adminRole: {
    fontSize: '12px',
    color: '#8b949e',
    marginLeft: '8px',
  },
  removeBtn: {
    padding: '4px 10px',
    backgroundColor: 'transparent',
    color: '#cf222e',
    border: '1px solid #ffcecb',
    borderRadius: '4px',
    fontSize: '12px',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  addForm: {
    display: 'flex',
    gap: '8px',
    marginTop: '12px',
  },
  addInput: {
    flex: 1,
    padding: '6px 10px',
    fontSize: '13px',
    border: '1px solid #d0d7de',
    borderRadius: '6px',
    outline: 'none',
    fontFamily: "'IBM Plex Mono', monospace",
  },
  addBtn: {
    padding: '6px 14px',
    backgroundColor: '#0969da',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  // Edit history section
  historyRow: {
    display: 'flex',
    flexDirection: 'column',
    padding: '10px 0',
    borderBottom: '1px solid #f1f5f9',
    gap: '4px',
  },
  historyAction: {
    fontSize: '13px',
    color: '#24292e',
  },
  historyDetail: {
    fontSize: '12px',
    color: '#8b949e',
  },
  historyValues: {
    fontSize: '12px',
    fontFamily: "'IBM Plex Mono', monospace",
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  oldValue: {
    color: '#cf222e',
    textDecoration: 'line-through',
    maxWidth: '200px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  newValue: {
    color: '#1a7f37',
    maxWidth: '200px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  loading: {
    padding: '20px',
    textAlign: 'center',
    color: '#8b949e',
    fontSize: '13px',
  },
  empty: {
    padding: '20px',
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: '13px',
  },
  error: {
    padding: '8px 12px',
    backgroundColor: '#ffebe9',
    color: '#cf222e',
    borderRadius: '6px',
    fontSize: '13px',
  },
};

function parsePriorityFromBody(body) {
  const match = (body || '').match(/\*\*Priority:\*\*\s*(low|medium|high)/i);
  return match ? match[1].toLowerCase() : null;
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
    </svg>
  );
}

export default function AdminPanel({ dictId = 1 }) {
  const { accessToken, user } = useAuth();
  const isAdmin = user?.isAdmin || false;

  // Issues state
  const [issues, setIssues] = useState([]);
  const [issuesLoading, setIssuesLoading] = useState(true);
  const [issuesError, setIssuesError] = useState(null);
  const [applyingIssue, setApplyingIssue] = useState(null);
  const [dismissingIssue, setDismissingIssue] = useState(null);

  // Filter + pagination state
  const [issueSearch, setIssueSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  // Admin users state
  const [admins, setAdmins] = useState([]);
  const [adminsLoading, setAdminsLoading] = useState(true);
  const [newAdminUsername, setNewAdminUsername] = useState('');
  const [adminError, setAdminError] = useState(null);

  // Edit history state
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  if (!isAdmin) return null;

  // Load open issues
  useEffect(() => {
    async function loadIssues() {
      try {
        const items = await fetchAllIssues(accessToken, 'open', 100);
        setIssues(items);
      } catch (err) {
        setIssuesError(err.message);
      } finally {
        setIssuesLoading(false);
      }
    }
    loadIssues();
  }, [accessToken]);

  // Load admin users
  useEffect(() => {
    async function loadAdmins() {
      try {
        const resp = await fetch(`${API_BASE}/admin/users`, {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        if (resp.ok) {
          setAdmins(await resp.json());
        }
      } catch (err) {
        console.warn('Failed to load admins:', err);
      } finally {
        setAdminsLoading(false);
      }
    }
    loadAdmins();
  }, [accessToken]);

  // Load edit history
  useEffect(() => {
    async function loadHistory() {
      try {
        const resp = await fetch(`${API_BASE}/admin/history?dict_id=${dictId}&limit=20`, {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        if (resp.ok) {
          setHistory(await resp.json());
        }
      } catch (err) {
        console.warn('Failed to load history:', err);
      } finally {
        setHistoryLoading(false);
      }
    }
    loadHistory();
  }, [accessToken, dictId]);

  // Filtered + paginated issues
  const filteredIssues = useMemo(() => {
    let result = issues;

    // Text search: match against title, table name, column name, author
    if (issueSearch.trim()) {
      const q = issueSearch.toLowerCase();
      result = result.filter((issue) => {
        const parsed = parseIssueTitle(issue.title);
        return (
          (parsed.cleanTitle || '').toLowerCase().includes(q) ||
          (parsed.tableName || '').toLowerCase().includes(q) ||
          (parsed.columnName || '').toLowerCase().includes(q) ||
          (issue.user?.login || '').toLowerCase().includes(q) ||
          String(issue.number).includes(q)
        );
      });
    }

    // Priority filter
    if (priorityFilter !== 'all') {
      result = result.filter((issue) => {
        const priority = parsePriorityFromBody(issue.body);
        return priority === priorityFilter;
      });
    }

    return result;
  }, [issues, issueSearch, priorityFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredIssues.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);

  const paginatedIssues = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredIssues.slice(start, start + pageSize);
  }, [filteredIssues, safePage, pageSize]);

  // Priority counts for filter chips
  const priorityCounts = useMemo(() => {
    const counts = { all: issues.length, high: 0, medium: 0, low: 0, none: 0 };
    issues.forEach((issue) => {
      const p = parsePriorityFromBody(issue.body);
      if (p) counts[p]++;
      else counts.none++;
    });
    return counts;
  }, [issues]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [issueSearch, priorityFilter, pageSize]);

  // Add admin
  async function handleAddAdmin() {
    if (!newAdminUsername.trim()) return;
    setAdminError(null);
    try {
      const resp = await fetch(`${API_BASE}/admin/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ github_username: newAdminUsername.trim() }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to add admin');
      }
      const result = await resp.json();
      setAdmins((prev) => [...prev, { github_username: result.github_username, role: result.role, added_by: user.login }]);
      setNewAdminUsername('');
    } catch (err) {
      setAdminError(err.message);
    }
  }

  // Remove admin
  async function handleRemoveAdmin(username) {
    if (!confirm(`Remove ${username} as admin?`)) return;
    try {
      await fetch(`${API_BASE}/admin/users/${username}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      setAdmins((prev) => prev.filter((a) => a.github_username !== username));
    } catch (err) {
      console.warn('Failed to remove admin:', err);
    }
  }

  // Build page numbers (max ~7 visible with ellipsis)
  function getPageNumbers() {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages = [];
    if (safePage <= 3) {
      pages.push(1, 2, 3, 4, '...', totalPages);
    } else if (safePage >= totalPages - 2) {
      pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
    } else {
      pages.push(1, '...', safePage - 1, safePage, safePage + 1, '...', totalPages);
    }
    return pages;
  }

  return (
    <div style={styles.container}>
      {/* Open Issues for Review */}
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <h3 style={styles.cardTitle}>
            Open Issues
            {!issuesLoading && (
              <span style={{ ...styles.badge, background: '#ddf4ff', color: '#0969da', marginLeft: '8px' }}>
                {issues.length}
              </span>
            )}
          </h3>
          <a
            href="https://github.com/StarLiu1/data-dictionary/issues"
            target="_blank"
            rel="noopener noreferrer"
            style={styles.viewBtn}
          >
            View all on GitHub
          </a>
        </div>

        {/* Filter bar */}
        {!issuesLoading && issues.length > 0 && (
          <div style={styles.filterBar}>
            <div style={styles.searchWrapper}>
              <span style={styles.searchIcon}><SearchIcon /></span>
              <input
                style={styles.searchInput}
                placeholder="Search by title, table, column, or author…"
                value={issueSearch}
                onChange={(e) => setIssueSearch(e.target.value)}
              />
            </div>
            <button style={styles.filterChip(priorityFilter === 'all')} onClick={() => setPriorityFilter('all')}>
              All ({priorityCounts.all})
            </button>
            {priorityCounts.high > 0 && (
              <button style={styles.filterChip(priorityFilter === 'high')} onClick={() => setPriorityFilter(priorityFilter === 'high' ? 'all' : 'high')}>
                🔴 High ({priorityCounts.high})
              </button>
            )}
            {priorityCounts.medium > 0 && (
              <button style={styles.filterChip(priorityFilter === 'medium')} onClick={() => setPriorityFilter(priorityFilter === 'medium' ? 'all' : 'medium')}>
                🟡 Medium ({priorityCounts.medium})
              </button>
            )}
            {priorityCounts.low > 0 && (
              <button style={styles.filterChip(priorityFilter === 'low')} onClick={() => setPriorityFilter(priorityFilter === 'low' ? 'all' : 'low')}>
                🟢 Low ({priorityCounts.low})
              </button>
            )}
          </div>
        )}

        <div style={styles.cardBody}>
          {issuesLoading ? (
            <div style={styles.loading}>Loading issues…</div>
          ) : issuesError ? (
            <div style={styles.error}>{issuesError}</div>
          ) : issues.length === 0 ? (
            <div style={styles.empty}>No open issues</div>
          ) : filteredIssues.length === 0 ? (
            <div style={styles.empty}>
              No issues match your filters
              <div style={{ marginTop: '8px' }}>
                <button
                  style={{ ...styles.filterChip(false), fontSize: '13px' }}
                  onClick={() => { setIssueSearch(''); setPriorityFilter('all'); }}
                >
                  Clear filters
                </button>
              </div>
            </div>
          ) : (
            paginatedIssues.map((issue) => {
              const parsed = parseIssueTitle(issue.title);
              const priority = parsePriorityFromBody(issue.body);
              return (
                <div key={issue.id} style={styles.issueRow}>
                  <div style={{ flex: 1 }}>
                    <div style={styles.issueTitle}>{parsed.cleanTitle}</div>
                    <div style={styles.issueMeta}>
                      <span>#{issue.number}</span>
                      <span>by {issue.user?.login}</span>
                      <span>{new Date(issue.created_at).toLocaleDateString()}</span>
                    </div>
                    <div style={{ marginTop: '6px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {parsed.tableName && <span style={styles.issueTag}>{parsed.tableName}</span>}
                      {parsed.columnName && <span style={styles.issueTag}>{parsed.columnName}</span>}
                      {priority && <span style={styles.priorityBadge(priority)}>{priority}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                    <button
                      style={styles.applyBtn}
                      onClick={() => setApplyingIssue(issue)}
                    >
                      Apply
                    </button>
                    <button
                      style={styles.dismissBtn}
                      onClick={() => setDismissingIssue(issue)}
                    >
                      Dismiss
                    </button>
                    <a
                      href={issue.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={styles.viewBtn}
                    >
                      View
                    </a>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination bar */}
        {!issuesLoading && filteredIssues.length > 0 && (
          <div style={styles.paginationBar}>
            <div style={styles.paginationInfo}>
              Showing {((safePage - 1) * pageSize) + 1}–{Math.min(safePage * pageSize, filteredIssues.length)} of {filteredIssues.length}
              {filteredIssues.length !== issues.length && ` (${issues.length} total)`}
              {' · '}
              <select
                style={styles.pageSizeSelect}
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>{n} per page</option>
                ))}
              </select>
            </div>

            {totalPages > 1 && (
              <div style={styles.paginationControls}>
                <button
                  style={styles.pageArrow(safePage === 1)}
                  onClick={() => safePage > 1 && setCurrentPage(safePage - 1)}
                  disabled={safePage === 1}
                >
                  ‹
                </button>
                {getPageNumbers().map((p, i) =>
                  p === '...' ? (
                    <span key={`ellipsis-${i}`} style={{ padding: '4px 4px', fontSize: '12px', color: '#94a3b8' }}>…</span>
                  ) : (
                    <button
                      key={p}
                      style={styles.pageBtn(p === safePage)}
                      onClick={() => setCurrentPage(p)}
                    >
                      {p}
                    </button>
                  )
                )}
                <button
                  style={styles.pageArrow(safePage === totalPages)}
                  onClick={() => safePage < totalPages && setCurrentPage(safePage + 1)}
                  disabled={safePage === totalPages}
                >
                  ›
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Admin User Management */}
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <h3 style={styles.cardTitle}>Admin Users</h3>
        </div>
        <div style={styles.cardBody}>
          {adminsLoading ? (
            <div style={styles.loading}>Loading…</div>
          ) : (
            <>
              {admins.map((admin) => (
                <div key={admin.github_username} style={styles.adminRow}>
                  <div>
                    <span style={styles.adminName}>{admin.github_username}</span>
                    <span style={styles.adminRole}>({admin.role})</span>
                    {admin.added_by && (
                      <span style={{ fontSize: '11px', color: '#94a3b8', marginLeft: '8px' }}>
                        added by {admin.added_by}
                      </span>
                    )}
                  </div>
                  {admin.github_username !== user.login && (
                    <button
                      style={styles.removeBtn}
                      onClick={() => handleRemoveAdmin(admin.github_username)}
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
              {adminError && <div style={{ ...styles.error, marginTop: '8px' }}>{adminError}</div>}
              <div style={styles.addForm}>
                <input
                  style={styles.addInput}
                  placeholder="GitHub username"
                  value={newAdminUsername}
                  onChange={(e) => setNewAdminUsername(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddAdmin()}
                />
                <button style={styles.addBtn} onClick={handleAddAdmin}>
                  Add Admin
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Edit History */}
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <h3 style={styles.cardTitle}>Recent Edit History</h3>
        </div>
        <div style={styles.cardBody}>
          {historyLoading ? (
            <div style={styles.loading}>Loading…</div>
          ) : history.length === 0 ? (
            <div style={styles.empty}>No edits yet</div>
          ) : (
            history.map((edit) => (
              <div key={edit.id} style={styles.historyRow}>
                <div style={styles.historyAction}>
                  <strong>{edit.edited_by}</strong> updated{' '}
                  <code style={{ fontSize: '12px', background: '#f1f5f9', padding: '1px 4px', borderRadius: '3px' }}>
                    {edit.field_name}
                  </code>{' '}
                  on{' '}
                  <code style={{ fontSize: '12px', background: '#f1f5f9', padding: '1px 4px', borderRadius: '3px' }}>
                    {edit.table_name}
                    {edit.column_name ? `.${edit.column_name}` : ''}
                  </code>
                  {edit.github_issue_number && (
                    <span style={{ fontSize: '12px', color: '#8b949e' }}> (from issue #{edit.github_issue_number})</span>
                  )}
                </div>
                <div style={styles.historyValues}>
                  {edit.old_value && <span style={styles.oldValue} title={edit.old_value}>{edit.old_value}</span>}
                  {edit.old_value && <span style={{ color: '#94a3b8' }}>→</span>}
                  <span style={styles.newValue} title={edit.new_value}>{edit.new_value}</span>
                </div>
                <div style={styles.historyDetail}>
                  {new Date(edit.created_at).toLocaleString()}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Apply Issue Modal */}
      {applyingIssue && (
        <ApplyIssueModal
          issue={applyingIssue}
          dictId={dictId}
          onClose={() => setApplyingIssue(null)}
          onApplied={() => {
            setIssues((prev) => prev.filter((i) => i.id !== applyingIssue.id));
            setApplyingIssue(null);
          }}
        />
      )}

      {/* Dismiss Issue Modal */}
      {dismissingIssue && (
        <DismissIssueModal
          issue={dismissingIssue}
          onClose={() => setDismissingIssue(null)}
          onDismissed={() => {
            setIssues((prev) => prev.filter((i) => i.id !== dismissingIssue.id));
            setDismissingIssue(null);
          }}
        />
      )}
    </div>
  );
}
