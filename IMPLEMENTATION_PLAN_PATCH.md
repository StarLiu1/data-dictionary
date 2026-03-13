# Patch for IMPLEMENTATION_PLAN.md
#
# Replace the Post-Deployment Checklist section (around line 873) with:

## Post-Deployment Checklist

- [x] PostgreSQL provisioned on VM and accessible
- [x] `metadata.json` imported into `dictionaries` table
- [x] `StarLiu1` added to `admin_users` table as superadmin
- [x] FastAPI running on port 8000 (via systemd)
- [x] Nginx proxying `/api/` to FastAPI, serving React build for everything else
- [x] HTTPS via Let's Encrypt (certbot, auto-renewing)
- [x] Domain: `data-dictionary.eastus.cloudapp.azure.com`
- [x] GitHub OAuth callback updated to HTTPS domain
- [x] Sign in via GitHub → see "Admin" badge → can edit fields inline
- [x] Non-admin users see the same read-only experience as before
- [x] Edits persist across page reloads (stored in PostgreSQL)
- [x] Edit history shows in admin panel
- [x] Issue review workflow: Apply (update metadata) and Dismiss (close as not planned)
- [x] Admin panel: search, priority filter, pagination for issues
- [x] Scoped refresh: feedback submission only re-fetches relevant table/column

# Replace the Future Enhancements section (around line 888) with:

## Future Enhancements

- **~~HTTPS:~~** ~~Add Let's Encrypt via certbot~~ ✅ Done
- **Deprecate GitHub Pages:** Old site at starliu1.github.io/data-dictionary/ has stale data
- **Excel export from API:** Regenerate the Excel workbook on-demand from the database
- **AI-assisted descriptions:** Use Claude API to generate draft descriptions for columns with no comments
- **Multiple dictionaries:** Upload additional metadata.json files for other schemas
- **Hopkins SSO:** Add Microsoft Entra ID as a second auth provider
- **Organization repo:** Move to a Hopkins GitHub org, restrict feedback to org members
- **Webhook rebuild:** When metadata changes in PostgreSQL, auto-deploy updated React build
