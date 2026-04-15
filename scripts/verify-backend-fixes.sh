#!/bin/bash
# verify-backend-fixes.sh — Verifica automatica fix backend B1-B6 + rate limit
set -e
PASS=0
FAIL=0

check() {
  local label="$1"
  local cmd="$2"
  if eval "$cmd" &>/dev/null; then
    echo "  ✅ $label"
    PASS=$((PASS+1))
  else
    echo "  ❌ $label"
    FAIL=$((FAIL+1))
  fi
}

echo ""
echo "🔍 Verifica fix backend Fabrar..."
echo "══════════════════════════════════"

# B1 — TELEGRAM_SECRET nella lista required
check "B1: TELEGRAM_SECRET in required[]" \
  "grep -q '\"TELEGRAM_SECRET\"' src/server.js"

# B2 — nessun console.error in api.js
check "B2: console.error rimosso da api.js" \
  "! grep -q 'console\.error' src/routes/api.js"

# B3 — nessun console.log in api.js
check "B3: console.log rimosso da api.js" \
  "! grep -q 'console\.log' src/routes/api.js"

# B4 — una sola definizione di PATCH /api/hr/reports/:id
check "B4: PATCH /api/hr/reports/:id non duplicato" \
  "[ \$(grep -c 'router\.patch.*\"/api/hr/reports/:id\"' src/routes/api.js) -eq 1 ]"

# B5 — una sola definizione di PATCH /api/hr/spese/:id  
check "B5: PATCH /api/hr/spese/:id non duplicato" \
  "[ \$(grep -c 'router\.patch.*\"/api/hr/spese/:id\"' src/routes/api.js) -eq 1 ]"

# B6 — /cron/reminders protetto
check "B6: /cron/reminders ha verifyTokenAndRole" \
  "grep -A2 'cron/reminders' src/routes/admin.js | grep -q 'verifyTokenAndRole'"

# Bonus — rate limit su path corretto
check "BONUS: rate limit su /api/login (non /api/auth/login)" \
  "grep -q '\"/api/login\".*rateLimit\|rateLimit.*\"/api/login\"' src/app.js"

# Nessun console.* rimasto in src/routes/
echo ""
echo "── Scan console.* in src/routes/ ──"
CONSOLE_HITS=$(grep -rn "console\." src/routes/ 2>/dev/null | grep -v "//.*console" || true)
if [ -z "$CONSOLE_HITS" ]; then
  echo "  ✅ Nessun console.* trovato in src/routes/"
  PASS=$((PASS+1))
else
  echo "  ⚠️  console.* ancora presenti:"
  echo "$CONSOLE_HITS" | sed 's/^/     /'
  FAIL=$((FAIL+1))
fi

echo ""
echo "══════════════════════════════════"
echo "  Risultato: $PASS passati, $FAIL falliti"
echo ""

if [ $FAIL -eq 0 ]; then
  echo "  🎉 Tutte le verifiche superate!"
  exit 0
else
  echo "  🚨 $FAIL verification(s) failed — correggere prima del deploy"
  exit 1
fi
