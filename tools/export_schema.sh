#!/bin/bash
# ============================================================
#  MIS FINANZAS — Exportar esquema de base de datos
#  Genera db/schema.sql a partir de la Oracle Autonomous DB real,
#  usando DBMS_METADATA. Correr después de cualquier ALTER TABLE
#  para mantener el esquema versionado al día.
#
#  Uso: ./tools/export_schema.sh
#  Requiere: el contenedor misgastos-api corriendo (docker compose up)
# ============================================================
set -e

CONTAINER=misgastos-api
OUT_FILE="$(cd "$(dirname "$0")/.." && pwd)/db/schema.sql"

echo "▶ Exportando esquema desde $CONTAINER a $OUT_FILE ..."

docker exec "$CONTAINER" python3 -c "
import oracledb, os

oracledb.init_oracle_client()
conn = oracledb.connect(user=os.getenv('DB_USER'), password=os.getenv('DB_PASSWORD'), dsn=os.getenv('DB_DSN'))
cur = conn.cursor()

# Orden topológico manual (padres antes que hijos, según FKs reales de la app)
TABLAS = [
    'USUARIOS',
    'CATEGORIAS', 'CUENTAS', 'DESTINATARIOS', 'ESTADOS_TARJETA', 'FUENTES_INGRESO',
    'PRESTATARIOS', 'SALDOS_MES', 'SESIONES', 'TARJETAS_CREDITO', 'TIPOS_CAMBIO', 'COMPRAS_MSI',
    'TARJETAS_ADICIONALES',
    'GASTOS', 'INGRESOS',
    'PAGOS_PRESTAMO',
]

# Excluir clausulas dependientes del entorno (tablespace/storage) y FKs (se agregan después,
# ya con todas las tablas creadas, para no depender del orden)
cur.execute(\"BEGIN DBMS_METADATA.SET_TRANSFORM_PARAM(DBMS_METADATA.SESSION_TRANSFORM,'SEGMENT_ATTRIBUTES',false); END;\")
cur.execute(\"BEGIN DBMS_METADATA.SET_TRANSFORM_PARAM(DBMS_METADATA.SESSION_TRANSFORM,'STORAGE',false); END;\")
cur.execute(\"BEGIN DBMS_METADATA.SET_TRANSFORM_PARAM(DBMS_METADATA.SESSION_TRANSFORM,'REF_CONSTRAINTS',false); END;\")
cur.execute(\"BEGIN DBMS_METADATA.SET_TRANSFORM_PARAM(DBMS_METADATA.SESSION_TRANSFORM,'SQLTERMINATOR',true); END;\")

print('-- ============================================================')
print('--  MIS FINANZAS — Esquema de base de datos (Oracle)')
print('--  Generado automáticamente con tools/export_schema.sh')
print('--  NO editar a mano — volver a correr el script tras cada cambio')
print('-- ============================================================')
print()
print('-- ── TABLAS ──────────────────────────────────────────────────')
print()

for t in TABLAS:
    cur.execute('SELECT DBMS_METADATA.GET_DDL(:otype, :oname) FROM dual', otype='TABLE', oname=t)
    (lob,) = cur.fetchone()
    ddl = lob.read() if hasattr(lob, 'read') else lob
    print(f'-- {t}')
    print(ddl.strip())
    print()

print('-- ── LLAVES FORÁNEAS ─────────────────────────────────────────')
print()

for t in TABLAS:
    try:
        cur.execute(\"SELECT DBMS_METADATA.GET_DEPENDENT_DDL('REF_CONSTRAINT', :oname) FROM dual\", oname=t)
        (lob,) = cur.fetchone()
        ddl = lob.read() if hasattr(lob, 'read') else lob
        print(f'-- FKs de {t}')
        print(ddl.strip())
        print()
    except oracledb.DatabaseError as e:
        # ORA-31608: la tabla no tiene FKs, se omite
        if 'ORA-31608' not in str(e):
            raise

conn.close()
" > "$OUT_FILE"

echo "✅ Esquema exportado a db/schema.sql ($(wc -l < "$OUT_FILE") líneas)"
