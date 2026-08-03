#!/usr/bin/env python3
# ============================================================
#  MIS FINANZAS — Heartbeat para Oracle Autonomous DB
#  Ya no es la fuente de verdad (Postgres lo es desde el cutover),
#  pero se mantiene como respaldo de rollback por unas semanas.
#  Este script solo abre conexión y hace una lectura trivial para
#  evitar que Oracle la marque inactiva y la autodetenga/recicle
#  por falta de uso.
#
#  Uso: python3 tools/oracle_heartbeat.py
#  Requiere: DB_USER/DB_PASSWORD/DB_DSN en el entorno/.env
# ============================================================
import os
import sys
import oracledb
from dotenv import load_dotenv

load_dotenv()

DB_USER     = os.getenv("DB_USER", "ADMIN")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_DSN      = os.getenv("DB_DSN", "")


def main():
    if not DB_DSN:
        print("❌ Falta DB_DSN en el entorno")
        sys.exit(1)

    oracledb.init_oracle_client()
    conn = oracledb.connect(user=DB_USER, password=DB_PASSWORD, dsn=DB_DSN)
    cur = conn.cursor()
    cur.execute("SELECT 1 FROM DUAL")
    cur.fetchone()
    cur.close()
    conn.close()
    print("✅ Heartbeat OK — Oracle sigue vivo")


if __name__ == "__main__":
    main()
