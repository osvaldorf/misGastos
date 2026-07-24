#!/bin/bash
# ============================================================
#  Wrapper para correr tools/sync_oracle_to_postgres.py desde
#  una tarea programada de launchd en macOS.
#  Escribe el log completo en ~/Library/Logs/misgastos/sync.log
#  y manda una notificación de macOS con el resumen de cada corrida.
# ============================================================
set -uo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

LOG_DIR="$HOME/Library/Logs/misgastos"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/sync.log"
TS="$(date '+%Y-%m-%d %H:%M:%S')"

notificar() {
    osascript -e "display notification \"$1\" with title \"Mis Finanzas — Sync Oracle→Postgres\"" >/dev/null 2>&1 || true
}

{
    echo "===== $TS ====="

    if ! docker info >/dev/null 2>&1; then
        echo "❌ Docker no está corriendo — se omite esta corrida."
        notificar "Docker no está corriendo, sync omitido"
        exit 0
    fi

    if ! docker ps --format '{{.Names}}' | grep -q '^misgastos-postgres$'; then
        echo "❌ El contenedor misgastos-postgres no está corriendo — levanta 'docker compose up -d postgres' primero."
        notificar "Postgres local no está corriendo, sync omitido"
        exit 0
    fi

    docker image inspect misgastos-sync >/dev/null 2>&1 \
        || docker build -f tools/Dockerfile.sync -t misgastos-sync . >/dev/null

    OUTPUT="$(docker run --rm --network misgastos_default --env-file .env \
        -v "$REPO_DIR/wallet:/app/wallet:ro" -e TNS_ADMIN=/app/wallet \
        misgastos-sync 2>&1)"
    EXIT_CODE=$?

    echo "$OUTPUT"
    echo ""

    RESUMEN="$(echo "$OUTPUT" | grep -E 'Sync completo|⚠️.*Sync completo' | tail -1)"
    if [ -z "$RESUMEN" ]; then
        RESUMEN="Error al correr el sync (código $EXIT_CODE) — revisa $LOG_FILE"
    fi
    notificar "$RESUMEN"

} >> "$LOG_FILE" 2>&1
