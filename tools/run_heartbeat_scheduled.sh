#!/bin/bash
# ============================================================
#  Wrapper para correr tools/oracle_heartbeat.py desde una tarea
#  programada de launchd en macOS.
#  Escribe el log en ~/Library/Logs/misgastos/heartbeat.log y
#  manda una notificación de macOS solo si falla (para enterarte
#  si Oracle ya no responde de verdad, no cada corrida exitosa).
#  Si Docker Desktop no está corriendo lo abre en segundo plano,
#  hace el heartbeat y lo vuelve a cerrar, para que Oracle no se
#  autodetenga por inactividad aunque Docker no se use a diario.
# ============================================================
set -uo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

LOG_DIR="$HOME/Library/Logs/misgastos"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/heartbeat.log"
TS="$(date '+%Y-%m-%d %H:%M:%S')"

DOCKER_TIMEOUT=300   # segundos máximos esperando a que Docker arranque
INTENTOS=3           # Oracle puede tardar en responder justo tras reanudarse

notificar() {
    osascript -e "display notification \"$1\" with title \"Mis Finanzas — Heartbeat Oracle\"" >/dev/null 2>&1 || true
}

correr_heartbeat() {
    docker run --rm --env-file .env \
        -v "$REPO_DIR/wallet:/app/wallet:ro" -e TNS_ADMIN=/app/wallet \
        -v "$REPO_DIR/tools/oracle_heartbeat.py:/app/oracle_heartbeat.py:ro" \
        misgastos-sync python3 oracle_heartbeat.py 2>&1
}

{
    echo "===== $TS ====="

    DOCKER_ABIERTO_POR_NOSOTROS=0
    if ! docker info >/dev/null 2>&1; then
        echo "Docker no está corriendo — abriendo Docker Desktop..."
        open -g -a Docker
        DOCKER_ABIERTO_POR_NOSOTROS=1
        ESPERA=0
        until docker info >/dev/null 2>&1; do
            if [ $ESPERA -ge $DOCKER_TIMEOUT ]; then
                echo "❌ Docker no arrancó en ${DOCKER_TIMEOUT}s — se omite esta corrida."
                notificar "Docker no arrancó; Oracle no recibió heartbeat — revisa $LOG_FILE"
                exit 1
            fi
            sleep 5
            ESPERA=$((ESPERA + 5))
        done
        echo "Docker listo tras ${ESPERA}s."
    fi

    docker image inspect misgastos-sync >/dev/null 2>&1 \
        || docker build -f tools/Dockerfile.sync -t misgastos-sync . >/dev/null

    EXIT_CODE=1
    for i in $(seq 1 $INTENTOS); do
        OUTPUT="$(correr_heartbeat)"
        EXIT_CODE=$?
        echo "$OUTPUT"
        [ $EXIT_CODE -eq 0 ] && break
        echo "Intento $i/$INTENTOS falló."
        [ $i -lt $INTENTOS ] && sleep 30
    done

    if [ $EXIT_CODE -ne 0 ]; then
        notificar "Oracle no respondió — revisa $LOG_FILE"
    fi

    if [ $DOCKER_ABIERTO_POR_NOSOTROS -eq 1 ]; then
        echo "Cerrando Docker Desktop (lo abrió este script)."
        osascript -e 'quit app "Docker"' >/dev/null 2>&1 || true
    fi

    exit $EXIT_CODE

} >> "$LOG_FILE" 2>&1
