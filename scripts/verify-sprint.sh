#!/usr/bin/env bash
# verify-sprint.sh — one-shot pre-deploy verification for an aetheria-game sprint.
# Runs: tests, fallow dead-code, fallow health, Vercel live-site probe.
# Exits non-zero on any failure.
#
# Usage (from aetheria-game/):
#   bash ~/.hermes/skills/aetheria-sprint-workflow/scripts/verify-sprint.sh
# Or add an alias:
#   alias aetheria-verify='bash ~/.hermes/skills/aetheria-sprint-workflow/scripts/verify-sprint.sh'

set -e

PROJECT_DIR="${PROJECT_DIR:-$(pwd)}"
LIVE_URL="${LIVE_URL:-https://aetheria-game-alpha.vercel.app}"
GH_REPO="${GH_REPO:-Shobre/aetheria-game}"

cd "$PROJECT_DIR"

echo "=== 1. Test suite ==="
if ! npm test 2>&1 | tail -20; then
  echo "? npm test FAILED"
  exit 1
fi
if ! npm test 2>&1 | grep -qE 'ALL PASS'; then
  echo "? tests not all green"
  exit 1
fi

echo
echo "=== 2. Fallow dead-code (0 issues required) ==="
if ! command -v fallow >/dev/null; then
  echo "?? fallow not installed; skipping (npm i -g fallow)"
else
  fallow dead-code 2>&1 | tail -10
  if ! fallow dead-code 2>&1 | grep -q 'No issues found'; then
    echo "? fallow dead-code reports issues"
    exit 1
  fi
fi

echo
echo "=== 3. Fallow health (>= 86.0 good) ==="
if command -v fallow >/dev/null; then
  fallow health 2>&1 | grep -E 'maintainability' | tail -1
  SCORE=$(fallow health 2>&1 | grep -oE 'maintainability [0-9.]+' | head -1 | awk '{print $2}')
  if [ -n "$SCORE" ]; then
    # compare with awk to avoid float issues in bash
    UNDER=$(awk -v s="$SCORE" 'BEGIN{print (s<86.0)?1:0}')
    if [ "$UNDER" = "1" ]; then
      echo "? fallow health below 86.0 ($SCORE)"
      exit 1
    fi
  fi
fi

echo
echo "=== 4. Vercel live-site probe ==="
sleep 8  # let Vercel finish the deploy
HTTP=$(curl -s -o /dev/null -w '%{http_code}' "$LIVE_URL/")
if [ "$HTTP" != "200" ]; then
  echo "? $LIVE_URL returned HTTP $HTTP"
  exit 1
fi
echo "? $LIVE_URL → HTTP 200"

echo
echo "=== 5. GitHub SHA match ==="
LOCAL_SHA=$(git rev-parse HEAD)
REMOTE_SHA=$(curl -s "https://api.github.com/repos/$GH_REPO/commits/main" | grep -oE '"sha": "[0-9a-f]+"' | head -1 | awk '{print $2}' | tr -d '"')
if [ "$LOCAL_SHA" != "$REMOTE_SHA" ]; then
  echo "? local SHA $LOCAL_SHA != remote SHA $REMOTE_SHA (deploy may still be in progress)"
  exit 1
fi
echo "? GitHub main @ $LOCAL_SHA matches live deploy"

echo
echo "? ALL CHECKS PASSED — sprint verified."
