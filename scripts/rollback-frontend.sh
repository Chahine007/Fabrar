#!/bin/bash
# rollback-frontend.sh — Ripristina il frontend Vanilla JS legacy
# Usare SOLO in caso di problemi post-deploy con il build React
set -e

TIMESTAMP=$(date +%F-%H%M)
BACKUP_DIR="public-react-backup-${TIMESTAMP}"

echo "🔄 Rollback frontend a Vanilla JS legacy..."

# 1. Backup del build React corrente
if [ -d "public" ]; then
  mv public "${BACKUP_DIR}"
  echo "📦 Build React salvato in: ${BACKUP_DIR}"
fi

# 2. Ripristino legacy da git
git checkout HEAD -- public/ 2>/dev/null || {
  echo "⚠️  Nessun public/ in git HEAD — usando ultimo commit disponibile"
  git checkout $(git log --oneline public/ | awk 'NR==1{print $1}') -- public/
}

# 3. Riavvio servizio (Docker)
if command -v docker &>/dev/null && docker compose ps 2>/dev/null | grep -q "Up"; then
  docker compose restart app
  echo "🐳 Container riavviato"
fi

echo ""
echo "✅ Rollback completato. Frontend legacy attivo."
echo ""
echo "📋 Prossimi passi:"
echo "   1. Verificare: curl https://gestionale.myfabdar.com/health"
echo "   2. Per ripristinare React: mv ${BACKUP_DIR} public && docker compose restart app"
echo "   3. Per rimuovere backup: rm -rf ${BACKUP_DIR}"
