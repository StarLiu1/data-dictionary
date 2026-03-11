#!/bin/bash
# Pre-create priority labels in the data-dictionary repo.
# Run once: ./create_labels.sh <GITHUB_PERSONAL_ACCESS_TOKEN>
#
# Table and column labels are created automatically by the auto-label GitHub Action
# when the first issue is submitted for that table/column.

REPO="StarLiu1/data-dictionary"
TOKEN=$1

if [ -z "$TOKEN" ]; then
  echo "Usage: ./create_labels.sh <GITHUB_PERSONAL_ACCESS_TOKEN>"
  echo ""
  echo "You can create a PAT at: https://github.com/settings/tokens"
  echo "It needs the 'repo' scope."
  exit 1
fi

API="https://api.github.com/repos/$REPO/labels"

create_label() {
  local name=$1
  local color=$2
  local description=$3

  echo -n "Creating label '$name'... "

  response=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "$API" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    -d "{\"name\":\"$name\",\"color\":\"$color\",\"description\":\"$description\"}")

  if [ "$response" = "201" ]; then
    echo "✓ created"
  elif [ "$response" = "422" ]; then
    echo "– already exists"
  else
    echo "✗ failed (HTTP $response)"
  fi
}

echo "Creating labels in $REPO..."
echo ""

# Priority labels
create_label "priority:low" "2da44e" "Low priority feedback"
create_label "priority:medium" "bf8700" "Medium priority feedback"
create_label "priority:high" "cf222e" "High priority feedback"

echo ""
echo "Done! Table and column labels will be created automatically"
echo "by the auto-label GitHub Action when issues are submitted."
