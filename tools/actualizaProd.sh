#!/bin/bash
# ============================================================
#  MIS FINANZAS — Deploy a producción OCI
#  Uso: ./actualizaProd.sh [--frontend-only | --backend-only]
# ============================================================

set -e

SSH_KEY=/Users/osvaldorf/Documents/llaves-ssh/ssh-key-2026-06-26.key
SERVER=opc@129.146.45.165
FRONTEND_DIR=~/GitHub/misGastos/frontend
BACKEND_FILE=~/GitHub/misGastos/main.py
REMOTE_DIR=/opt/misgastos

DEPLOY_FRONTEND=true
DEPLOY_BACKEND=true

if [ "$1" == "--frontend-only" ]; then DEPLOY_BACKEND=false; fi
if [ "$1" == "--backend-only" ];  then DEPLOY_FRONTEND=false; fi

echo "════════════════════════════════════════"
echo "  MIS FINANZAS — Deploy a producción"
echo "════════════════════════════════════════"

if [ "$DEPLOY_FRONTEND" = true ]; then
    echo "\n▶ [1] Build del frontend..."
    cd $FRONTEND_DIR && npm run build
    echo "  ✅ Build completado"
    echo "\n▶ [2] Subiendo frontend..."
    rsync -avz --delete -e "ssh -i $SSH_KEY" $FRONTEND_DIR/dist/ $SERVER:$REMOTE_DIR/frontend/
    echo "  ✅ Frontend subido (archivos viejos eliminados)"
fi

if [ "$DEPLOY_BACKEND" = true ]; then
    echo "\n▶ [3] Subiendo backend..."
    scp -i $SSH_KEY $BACKEND_FILE $SERVER:$REMOTE_DIR/
    echo "  ✅ Backend subido"
fi

echo "\n▶ [4] Reiniciando servicio..."
ssh -i $SSH_KEY $SERVER "sudo systemctl restart misgastos"
sleep 3
ssh -i $SSH_KEY $SERVER "sudo systemctl is-active misgastos"

echo "\n════════════════════════════════════════"
echo "  ✅ Deploy completado"
echo "  🌐 https://mifinaapp.duckdns.org"
echo "════════════════════════════════════════"
