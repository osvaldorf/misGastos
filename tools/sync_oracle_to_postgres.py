#!/usr/bin/env python3
# ============================================================
#  MIS FINANZAS — Sincronización incremental Oracle -> PostgreSQL
#  Puente mientras se decide el cutover final de producción:
#  Oracle sigue siendo la fuente de verdad, Postgres se mantiene
#  como espejo. Seguro de correr repetidas veces (idempotente):
#  cada corrida deja Postgres exactamente igual a Oracle —
#  agrega lo nuevo, actualiza lo existente, borra lo que ya no
#  está en Oracle. No duplica nada.
#
#  Uso: python3 tools/sync_oracle_to_postgres.py
#  Requiere: DB_USER/DB_PASSWORD/DB_DSN (Oracle, origen) y
#            DATABASE_URL (Postgres, destino) en el entorno/.env
# ============================================================
import os
import sys
import time
import oracledb
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_USER      = os.getenv("DB_USER", "ADMIN")
DB_PASSWORD  = os.getenv("DB_PASSWORD", "")
DB_DSN       = os.getenv("DB_DSN", "")
DATABASE_URL = os.getenv("DATABASE_URL", "")

# Orden de dependencias (padres antes que hijos) — mismo que db/schema_postgres.sql
TABLAS = [
    "USUARIOS",
    "CATEGORIAS", "CUENTAS", "DESTINATARIOS", "ESTADOS_TARJETA", "FUENTES_INGRESO",
    "PRESTATARIOS", "SALDOS_MES", "SESIONES", "TARJETAS_CREDITO", "TIPOS_CAMBIO",
    "COMPRAS_MSI", "TARJETAS_ADICIONALES",
    "GASTOS", "INGRESOS",
    "PAGOS_PRESTAMO",
]

# Columnas generadas en Postgres que no existen como valor a copiar desde Oracle
COLUMNAS_EXCLUIDAS = {
    "TIPOS_CAMBIO": {"FECHA_DIA"},
}


def sincronizar_tabla(cur_ora, cur_pg, tabla):
    cur_ora.execute(f"SELECT * FROM {tabla}")
    columnas_ora = [d[0] for d in cur_ora.description]
    excluir = COLUMNAS_EXCLUIDAS.get(tabla, set())
    columnas = [c for c in columnas_ora if c not in excluir]
    idx_incluidos = [i for i, c in enumerate(columnas_ora) if c not in excluir]
    id_pos = columnas.index("ID")

    filas_ora = cur_ora.fetchall()
    ids_ora = {fila[idx_incluidos[id_pos]] for fila in filas_ora}

    cur_pg.execute(f"SELECT id FROM {tabla}")
    ids_pg_antes = {r[0] for r in cur_pg.fetchall()}

    nuevos = ids_ora - ids_pg_antes
    a_borrar = ids_pg_antes - ids_ora

    if filas_ora:
        col_list = ",".join(columnas)
        placeholders = ",".join(["%s"] * len(columnas))
        set_clause = ",".join(f"{c}=EXCLUDED.{c}" for c in columnas if c != "ID")
        upsert_sql = f"""
            INSERT INTO {tabla} ({col_list}) OVERRIDING SYSTEM VALUE
            VALUES ({placeholders})
            ON CONFLICT (ID) DO UPDATE SET {set_clause}
        """
        for fila in filas_ora:
            valores = [fila[i] for i in idx_incluidos]
            cur_pg.execute(upsert_sql, valores)

    if a_borrar:
        cur_pg.execute(f"DELETE FROM {tabla} WHERE id = ANY(%s)", (list(a_borrar),))

    if filas_ora:
        cur_pg.execute(f"""
            SELECT setval(
                pg_get_serial_sequence('{tabla}', 'id'),
                COALESCE((SELECT MAX(id) FROM {tabla}), 1),
                (SELECT MAX(id) FROM {tabla}) IS NOT NULL
            )
        """)

    if nuevos or a_borrar:
        print(f"  ✅ {tabla}: {len(filas_ora)} sincronizadas · {len(nuevos)} nuevas · {len(a_borrar)} eliminadas")
    else:
        print(f"  ⏸️  {tabla}: sin cambios ({len(filas_ora)} filas)")

    return len(nuevos), len(a_borrar)


def verificar_conteos(cur_ora, cur_pg):
    print("\n── Verificación de conteos ──")
    todo_ok = True
    for tabla in TABLAS:
        cur_ora.execute(f"SELECT COUNT(*) FROM {tabla}")
        n_ora = cur_ora.fetchone()[0]
        cur_pg.execute(f"SELECT COUNT(*) FROM {tabla}")
        n_pg = cur_pg.fetchone()[0]
        marca = "✅" if n_ora == n_pg else "❌"
        if n_ora != n_pg:
            todo_ok = False
        print(f"  {marca} {tabla}: Oracle={n_ora} Postgres={n_pg}")
    return todo_ok


def correr_sync():
    if not DB_DSN or not DATABASE_URL:
        print("❌ Faltan DB_DSN (Oracle) o DATABASE_URL (Postgres) en el entorno")
        sys.exit(1)

    conn_ora = oracledb.connect(user=DB_USER, password=DB_PASSWORD, dsn=DB_DSN)
    cur_ora = conn_ora.cursor()

    conn_pg = psycopg2.connect(DATABASE_URL, options="-c search_path=misgastos")
    cur_pg = conn_pg.cursor()

    total_nuevos = total_borrados = 0
    for tabla in TABLAS:
        n, b = sincronizar_tabla(cur_ora, cur_pg, tabla)
        total_nuevos += n
        total_borrados += b

    conn_pg.commit()
    ok = verificar_conteos(cur_ora, cur_pg)

    cur_ora.close()
    conn_ora.close()
    cur_pg.close()
    conn_pg.close()

    print(f"\n{'✅' if ok else '⚠️ '} Sync completo — {total_nuevos} filas nuevas, {total_borrados} eliminadas en total.")
    return ok


def main():
    oracledb.init_oracle_client()
    intervalo = int(os.getenv("SYNC_INTERVALO_SEGUNDOS", "0"))
    if intervalo <= 0:
        correr_sync()
        return

    print(f"▶ Modo continuo: sincronizando cada {intervalo}s (Ctrl+C para detener)")
    while True:
        ts = time.strftime("%Y-%m-%d %H:%M:%S")
        print(f"\n[{ts}] Corriendo sync...")
        try:
            correr_sync()
        except Exception as e:
            print(f"❌ Error en esta corrida: {e}")
        time.sleep(intervalo)


if __name__ == "__main__":
    main()
