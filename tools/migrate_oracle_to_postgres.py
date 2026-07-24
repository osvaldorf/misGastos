#!/usr/bin/env python3
# ============================================================
#  MIS FINANZAS — Migración de datos Oracle -> PostgreSQL
#  Se corre UNA sola vez, cuando Oracle vuelva a responder.
#
#  Uso: python3 tools/migrate_oracle_to_postgres.py
#  Requiere: DB_USER/DB_PASSWORD/DB_DSN (Oracle, origen) y
#            DATABASE_URL (Postgres, destino) en el entorno/.env
# ============================================================
import os
import sys
import oracledb
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_USER      = os.getenv("DB_USER", "ADMIN")
DB_PASSWORD  = os.getenv("DB_PASSWORD", "")
DB_DSN       = os.getenv("DB_DSN", "")
DATABASE_URL = os.getenv("DATABASE_URL", "")

# Mismo orden que db/schema_postgres.sql — padres antes que hijos
TABLAS = [
    "USUARIOS",
    "CATEGORIAS", "CUENTAS", "DESTINATARIOS", "ESTADOS_TARJETA", "FUENTES_INGRESO",
    "PRESTATARIOS", "SALDOS_MES", "SESIONES", "TARJETAS_CREDITO", "TIPOS_CAMBIO",
    "COMPRAS_MSI", "TARJETAS_ADICIONALES",
    "GASTOS", "INGRESOS",
    "PAGOS_PRESTAMO",
]

# Columnas generadas en Postgres que NO se copian de Oracle (calculadas por el motor)
COLUMNAS_EXCLUIDAS = {
    "TIPOS_CAMBIO": {"FECHA_DIA"},
}


def migrar_tabla(cur_ora, cur_pg, tabla):
    cur_ora.execute(f"SELECT * FROM {tabla}")
    columnas_ora = [d[0] for d in cur_ora.description]
    excluir = COLUMNAS_EXCLUIDAS.get(tabla, set())
    columnas = [c for c in columnas_ora if c not in excluir]
    idx_incluidos = [i for i, c in enumerate(columnas_ora) if c not in excluir]

    filas = cur_ora.fetchall()
    if not filas:
        print(f"  ⏭️  {tabla}: sin filas en Oracle")
        return 0

    col_list = ",".join(columnas)
    placeholders = ",".join(["%s"] * len(columnas))
    insert_sql = f"INSERT INTO {tabla} ({col_list}) OVERRIDING SYSTEM VALUE VALUES ({placeholders})"

    for fila in filas:
        valores = [fila[i] for i in idx_incluidos]
        cur_pg.execute(insert_sql, valores)

    # Reiniciar el identity de la tabla para que los próximos inserts sigan la secuencia
    cur_pg.execute(f"""
        SELECT setval(
            pg_get_serial_sequence('{tabla}', 'id'),
            COALESCE((SELECT MAX(id) FROM {tabla}), 1),
            (SELECT MAX(id) FROM {tabla}) IS NOT NULL
        )
    """)

    print(f"  ✅ {tabla}: {len(filas)} filas migradas")
    return len(filas)


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


def main():
    if not DB_DSN or not DATABASE_URL:
        print("❌ Faltan DB_DSN (Oracle) o DATABASE_URL (Postgres) en el entorno")
        sys.exit(1)

    print("▶ Conectando a Oracle (origen)...")
    oracledb.init_oracle_client()
    conn_ora = oracledb.connect(user=DB_USER, password=DB_PASSWORD, dsn=DB_DSN)
    cur_ora = conn_ora.cursor()

    print("▶ Conectando a Postgres (destino)...")
    conn_pg = psycopg2.connect(DATABASE_URL, options="-c search_path=misgastos")
    cur_pg = conn_pg.cursor()

    cur_pg.execute("SELECT COUNT(*) FROM usuarios")
    if cur_pg.fetchone()[0] > 0:
        respuesta = input(
            "⚠️  La base Postgres ya tiene datos en 'usuarios'. "
            "¿Continuar de todos modos y agregar/duplicar? (escribe 'si' para continuar): "
        )
        if respuesta.strip().lower() != "si":
            print("Cancelado.")
            sys.exit(0)

    print("\n▶ Migrando tablas...")
    for tabla in TABLAS:
        migrar_tabla(cur_ora, cur_pg, tabla)

    conn_pg.commit()

    ok = verificar_conteos(cur_ora, cur_pg)

    cur_ora.close()
    conn_ora.close()
    cur_pg.close()
    conn_pg.close()

    if ok:
        print("\n✅ Migración completa, todos los conteos coinciden.")
    else:
        print("\n⚠️  Migración completa, pero algunos conteos no coinciden — revisar arriba.")
        sys.exit(1)


if __name__ == "__main__":
    main()
