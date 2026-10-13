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

# `docker info` puede quedarse colgado mientras el motor arranca, así que
# se corta a los 10s (macOS no trae `timeout`).
docker_listo() {
    docker info >/dev/null 2>&1 &
    local pid=$!
    for _ in $(seq 1 10); do
        kill -0 $pid 2>/dev/null || { wait $pid; return $?; }
        sleep 1
    done
    kill $pid 2>/dev/null
    return 1
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
    if ! docker_listo; then
        # Docker Desktop a medio cerrar (o colgado) no arranca bien si se
        # abre encima; se fuerza el apagado antes de iniciarlo de nuevo.
        if pgrep -q -f com.docker.backend; then
            echo "Docker Desktop no responde — forzando su cierre..."
            docker desktop stop --force --timeout 120 >/dev/null 2>&1
        fi
        echo "Docker no está corriendo — iniciando Docker Desktop..."
        DOCKER_ABIERTO_POR_NOSOTROS=1
        INICIO=$SECONDS
        docker desktop start --timeout $DOCKER_TIMEOUT >/dev/null 2>&1
        if ! docker_listo; then
            echo "❌ Docker no arrancó en ${DOCKER_TIMEOUT}s — se omite esta corrida."
            notificar "Docker no arrancó; Oracle no recibió heartbeat — revisa $LOG_FILE"
            docker desktop stop --force --timeout 120 >/dev/null 2>&1
            exit 1
        fi
        echo "Docker listo tras $((SECONDS - INICIO))s."
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
        docker desktop stop --timeout 120 >/dev/null 2>&1 || true
    fi

    exit $EXIT_CODE

} >> "$LOG_FILE" 2>&1
