/**
 * GitHub Issues Service
 * 
 * Creates and fetches issues in starliu1/data-dictionary repo.
 * Issues are auto-tagged in their title with [table:xxx] and [column:xxx] patterns.
 * A GitHub Action (auto-label-issues.yml) parses these and applies labels.
 */

const REPO_OWNER = 'StarLiu1';
const REPO_NAME = 'data-dictionary';
const API_BASE = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}`;

/**
 * Create headers with optional auth token
 */
function headers(accessToken) {
  const h = {
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (accessToken) {
    h['Authorization'] = `Bearer ${accessToken}`;
  }
  return h;
}

/**
 * Build the issue title with structured tags for auto-labeling.
 * Format: "[table:lab_results] [column:result_value] User's title"
 *   or:   "[table:lab_results] User's title" (table-level)
 */
function buildIssueTitle(userTitle, tableName, columnName) {
  let prefix = '';
  if (tableName) {
    prefix += `[table:${tableName}]`;
  }
  if (columnName) {
    prefix += ` [column:${columnName}]`;
  }
  return prefix ? `${prefix} ${userTitle}` : userTitle;
}

/**
 * Build issue body with context metadata
 */
function buildIssueBody(userBody, tableName, columnName, priority) {
  const lines = [];
  
  lines.push('### Context');
  lines.push('');
  if (tableName) lines.push(`- **Table:** \`deid.derived.${tableName}\``);
  if (columnName) lines.push(`- **Column:** \`${columnName}\``);
  if (priority) lines.push(`- **Priority:** ${priority}`);
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('### Feedback');
  lines.push('');
  lines.push(userBody);
  lines.push('');
  lines.push('---');
  lines.push('*Submitted via the Data Dictionary UI*');

  return lines.join('\n');
}

/**
 * Create a new issue
 * 
 * @param {string} accessToken - GitHub access token
 * @param {object} params
 * @param {string} params.title - Issue title (user input)
 * @param {string} params.body - Issue body (user input)
 * @param {string} [params.tableName] - Table name for context
 * @param {string} [params.columnName] - Column name for context
 * @param {string} [params.priority] - 'low' | 'medium' | 'high'
 * @returns {object} Created issue data from GitHub API
 */
export async function createIssue(accessToken, { title, body, tableName, columnName, priority }) {
  const issueTitle = buildIssueTitle(title, tableName, columnName);
  const issueBody = buildIssueBody(body, tableName, columnName, priority);

  const response = await fetch(`${API_BASE}/issues`, {
    method: 'POST',
    headers: headers(accessToken),
    body: JSON.stringify({
      title: issueTitle,
      body: issueBody,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Failed to create issue: ${response.status} — ${err.message || 'Unknown error'}`);
  }

  return response.json();
}

/**
 * Fetch issues for a specific table (and optionally column).
 * Uses GitHub search API to find issues by title tags.
 * 
 * @param {string} [accessToken] - Optional (public repo readable without auth, but auth avoids rate limits)
 * @param {string} tableName - Table name to filter by
 * @param {string} [columnName] - Optional column name to filter by
 * @param {string} [state] - 'open' | 'closed' | 'all' (default: 'all')
 * @returns {object[]} Array of issues
 */
export async function fetchIssues(accessToken, tableName, columnName, state = 'all') {
  // Build search query
  let query = `repo:${REPO_OWNER}/${REPO_NAME} is:issue`;
  
  if (state === 'open' || state === 'closed') {
    query += ` is:${state}`;
  }

  if (tableName) {
    query += ` "[table:${tableName}]" in:title`;
  }

  if (columnName) {
    query += ` "[column:${columnName}]" in:title`;
  }

  const url = `https://api.github.com/search/issues?q=${encodeURIComponent(query)}&sort=created&order=desc&per_page=50`;

  const response = await fetch(url, {
    headers: headers(accessToken),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Failed to fetch issues: ${response.status} — ${err.message || 'Unknown error'}`);
  }

  const data = await response.json();
  return data.items || [];
}

/**
 * Fetch all issues for the repo (for the issues overview panel)
 * 
 * @param {string} [accessToken]
 * @param {string} [state] - 'open' | 'closed' | 'all'
 * @param {number} [perPage] - Results per page (max 100)
 * @returns {object[]} Array of issues
 */
export async function fetchAllIssues(accessToken, state = 'open', perPage = 30) {
  const params = new URLSearchParams({
    state,
    per_page: perPage.toString(),
    sort: 'created',
    direction: 'desc',
  });

  const response = await fetch(`${API_BASE}/issues?${params}`, {
    headers: headers(accessToken),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch issues: ${response.status}`);
  }

  return response.json();
}

/**
 * Fetch comments on a specific issue
 * 
 * @param {string} [accessToken]
 * @param {number} issueNumber
 * @returns {object[]} Array of comments
 */
export async function fetchIssueComments(accessToken, issueNumber) {
  const response = await fetch(`${API_BASE}/issues/${issueNumber}/comments`, {
    headers: headers(accessToken),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch comments: ${response.status}`);
  }

  return response.json();
}

/**
 * Add a comment to an existing issue
 * 
 * @param {string} accessToken
 * @param {number} issueNumber
 * @param {string} body
 * @returns {object} Created comment data
 */
export async function addComment(accessToken, issueNumber, body) {
  const response = await fetch(`${API_BASE}/issues/${issueNumber}/comments`, {
    method: 'POST',
    headers: headers(accessToken),
    body: JSON.stringify({ body }),
  });

  if (!response.ok) {
    throw new Error(`Failed to add comment: ${response.status}`);
  }

  return response.json();
}

/**
 * Parse table and column names from an issue title
 * @param {string} title
 * @returns {{ tableName: string|null, columnName: string|null, cleanTitle: string }}
 */
export function parseIssueTitle(title) {
  let tableName = null;
  let columnName = null;
  let cleanTitle = title;

  const tableMatch = title.match(/\[table:([^\]]+)\]/);
  if (tableMatch) {
    tableName = tableMatch[1];
    cleanTitle = cleanTitle.replace(tableMatch[0], '').trim();
  }

  const columnMatch = title.match(/\[column:([^\]]+)\]/);
  if (columnMatch) {
    columnName = columnMatch[1];
    cleanTitle = cleanTitle.replace(columnMatch[0], '').trim();
  }

  return { tableName, columnName, cleanTitle };
}
