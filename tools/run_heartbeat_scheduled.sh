#!/bin/bash
# ============================================================
#  Wrapper para correr tools/oracle_heartbeat.py desde una tarea
#  programada de launchd en macOS.
#  Escribe el log en ~/Library/Logs/misgastos/heartbeat.log y
#  manda una notificación de macOS solo si falla (para enterarte
#  si Oracle ya no responde de verdad, no cada corrida exitosa).
# ============================================================
set -uo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

LOG_DIR="$HOME/Library/Logs/misgastos"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/heartbeat.log"
TS="$(date '+%Y-%m-%d %H:%M:%S')"

notificar() {
    osascript -e "display notification \"$1\" with title \"Mis Finanzas — Heartbeat Oracle\"" >/dev/null 2>&1 || true
}

{
    echo "===== $TS ====="

    if ! docker info >/dev/null 2>&1; then
        echo "❌ Docker no está corriendo — se omite esta corrida."
        exit 0
    fi

    docker image inspect misgastos-sync >/dev/null 2>&1 \
        || docker build -f tools/Dockerfile.sync -t misgastos-sync . >/dev/null

    OUTPUT="$(docker run --rm --env-file .env \
        -v "$REPO_DIR/wallet:/app/wallet:ro" -e TNS_ADMIN=/app/wallet \
        -v "$REPO_DIR/tools/oracle_heartbeat.py:/app/oracle_heartbeat.py:ro" \
        misgastos-sync python3 oracle_heartbeat.py 2>&1)"
    EXIT_CODE=$?

    echo "$OUTPUT"

    if [ $EXIT_CODE -ne 0 ]; then
        notificar "Oracle no respondió — revisa $LOG_FILE"
    fi

} >> "$LOG_FILE" 2>&1
