# ============================================================
#  MIS FINANZAS — Fase 1 Patrimonio/Tarjetas
#  Actualiza cuentas existentes + crea nuevas + tablas BD
#
#  Ejecutar EN EL SERVIDOR:
#    cd /opt/misgastos && source venv/bin/activate
#    TNS_ADMIN=/opt/misgastos/wallet python3 fase1_patrimonio.py
# ============================================================
import oracledb, os
from dotenv import load_dotenv

load_dotenv('/opt/misgastos/.env')
oracledb.init_oracle_client()
conn = oracledb.connect(user=os.getenv('DB_USER'),
                        password=os.getenv('DB_PASSWORD'),
                        dsn=os.getenv('DB_DSN'))
cur = conn.cursor()

def run(sql, desc, params=None):
    try:
        cur.execute(sql, params or {})
        print(f"  ✅ {desc}")
    except oracledb.DatabaseError as e:
        err, = e.args
        if err.code in (955, 1430):
            print(f"  ⏭️  {desc} (ya existía)")
        else:
            print(f"  ❌ {desc}: {err.message}")
            raise

# ── 1. ALTER tablas existentes ───────────────────────────────
print("\n▶ [1/6] Alterando CUENTAS y GASTOS...")
run("ALTER TABLE CUENTAS ADD (OPERA_GASTOS NUMBER(1) DEFAULT 1)", "CUENTAS.OPERA_GASTOS")
run("ALTER TABLE CUENTAS ADD (CATEGORIA_LIQ VARCHAR2(30))", "CUENTAS.CATEGORIA_LIQ")
run("ALTER TABLE GASTOS ADD (ADICIONAL_ID NUMBER)", "GASTOS.ADICIONAL_ID")

# ── 2. Crear tablas nuevas ───────────────────────────────────
print("\n▶ [2/6] Creando SALDOS_MES...")
run("""CREATE TABLE SALDOS_MES (
    ID            NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    USUARIO_ID    NUMBER NOT NULL,
    CUENTA_ID     NUMBER NOT NULL,
    ANIO          NUMBER(4) NOT NULL,
    MES           NUMBER(2) NOT NULL,
    SALDO         NUMBER(18,2) DEFAULT 0,
    MONEDA        VARCHAR2(3) DEFAULT 'MXN',
    TASA_CAMBIO   NUMBER(10,4) DEFAULT 1,
    SALDO_MXN     NUMBER(18,2),
    NOTAS         VARCHAR2(500),
    CREATED_AT    TIMESTAMP DEFAULT SYSTIMESTAMP,
    CONSTRAINT UK_SALDOMES UNIQUE (USUARIO_ID, CUENTA_ID, ANIO, MES)
)""", "Tabla SALDOS_MES")

print("\n▶ [3/6] Creando TARJETAS_CREDITO y TARJETAS_ADICIONALES...")
run("""CREATE TABLE TARJETAS_CREDITO (
    ID              NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    USUARIO_ID      NUMBER NOT NULL,
    CUENTA_ID       NUMBER NOT NULL,
    LIMITE_CREDITO  NUMBER(18,2) NOT NULL,
    DIA_CORTE       NUMBER(2),
    DIAS_PARA_PAGO  NUMBER(2) DEFAULT 20,
    TASA_ANUAL      NUMBER(6,2),
    ACTIVO          NUMBER(1) DEFAULT 1,
    CONSTRAINT UK_TARJETA_CUENTA UNIQUE (CUENTA_ID)
)""", "Tabla TARJETAS_CREDITO")

run("""CREATE TABLE TARJETAS_ADICIONALES (
    ID              NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    USUARIO_ID      NUMBER NOT NULL,
    TARJETA_ID      NUMBER NOT NULL,
    DESTINATARIO_ID NUMBER NOT NULL,
    TERMINACION     VARCHAR2(4),
    ACTIVO          NUMBER(1) DEFAULT 1
)""", "Tabla TARJETAS_ADICIONALES")

print("\n▶ [4/6] Creando ESTADOS_TARJETA...")
run("""CREATE TABLE ESTADOS_TARJETA (
    ID               NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    USUARIO_ID       NUMBER NOT NULL,
    TARJETA_ID       NUMBER NOT NULL,
    ANIO             NUMBER(4) NOT NULL,
    MES              NUMBER(2) NOT NULL,
    FECHA_CORTE      DATE,
    FECHA_LIMITE     DATE,
    ADEUDO_ANTERIOR  NUMBER(18,2) DEFAULT 0,
    CARGOS_REGULARES NUMBER(18,2) DEFAULT 0,
    CARGOS_MESES     NUMBER(18,2) DEFAULT 0,
    INTERESES        NUMBER(18,2) DEFAULT 0,
    COMISIONES       NUMBER(18,2) DEFAULT 0,
    IVA              NUMBER(18,2) DEFAULT 0,
    PAGO_MINIMO      NUMBER(18,2) DEFAULT 0,
    PAGO_PNGI        NUMBER(18,2) DEFAULT 0,
    PAGO_REAL        NUMBER(18,2),
    TASA             NUMBER(6,2),
    SALDO_REGULAR    NUMBER(18,2) DEFAULT 0,
    SALDO_MESES      NUMBER(18,2) DEFAULT 0,
    DEUDOR_TOTAL     NUMBER(18,2) DEFAULT 0,
    NOTAS            VARCHAR2(500),
    CREATED_AT       TIMESTAMP DEFAULT SYSTIMESTAMP,
    CONSTRAINT UK_ESTADO_TARJETA UNIQUE (TARJETA_ID, ANIO, MES)
)""", "Tabla ESTADOS_TARJETA")

print("\n▶ [5/6] Creando COMPRAS_MSI...")
run("""CREATE TABLE COMPRAS_MSI (
    ID              NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    USUARIO_ID      NUMBER NOT NULL,
    TARJETA_ID      NUMBER NOT NULL,
    ADICIONAL_ID    NUMBER,
    DESCRIPCION     VARCHAR2(200) NOT NULL,
    DESTINATARIO_ID NUMBER,
    MONTO_TOTAL     NUMBER(18,2) NOT NULL,
    NUM_MESES       NUMBER(3) NOT NULL,
    MENSUALIDAD     NUMBER(18,2) NOT NULL,
    FECHA_COMPRA    DATE,
    PRIMER_ANIO     NUMBER(4) NOT NULL,
    PRIMER_MES      NUMBER(2) NOT NULL,
    GENERA_GASTO    NUMBER(1) DEFAULT 1,
    ACTIVO          NUMBER(1) DEFAULT 1,
    NOTAS           VARCHAR2(300),
    CREATED_AT      TIMESTAMP DEFAULT SYSTIMESTAMP
)""", "Tabla COMPRAS_MSI")

# ── 3. Actualizar cuentas existentes con CATEGORIA_LIQ ───────
print("\n▶ [6/6] Mapeando categorías de liquidez...")

# (id, categoria_liq, opera_gastos)
UPDATES = [
    (1,   'Liquido',  1),  # Efectivo
    (2,   'Liquido',  1),  # Priority (Banamex débito)
    (6,   'Liquido',  1),  # Banco Base
    (7,   'Liquido',  1),  # Klar
    (9,   'Liquido',  1),  # Dígital (Mifel)
    (13,  'Liquido',  1),  # Nu
    (14,  'InvCorta', 0),  # Cetes Directo (liquidez flexible)
    (15,  'Ahorro',   0),  # Finsus
    (16,  'Retiro',   0),  # PPR SURA
    (17,  'Retiro',   0),  # PPR Actinver
    (18,  'Liquido',  1),  # CoDi / Transferencia
    (19,  'InvLarga', 1),  # Actitrade (puede tener gastos admin)
    (20,  'InvLarga', 1),  # GBM → renombrar a GBM Trading MX
    (21,  'InvCorta', 0),  # BITSO
    (22,  'Ahorro',   0),  # ARQ (EUR)
    (261, 'Liquido',  1),  # Hey PF
    (221, 'Liquido',  1),  # Mercado Pago (crédito — se excluirá de saldos)
]

for id_val, cat, opera in UPDATES:
    cur.execute(
        "UPDATE CUENTAS SET CATEGORIA_LIQ=:c, OPERA_GASTOS=:o WHERE ID=:id_val AND USUARIO_ID=1",
        c=cat, o=opera, id_val=id_val
    )
    if cur.rowcount:
        print(f"  🔄 ID {id_val} → {cat}")

# Renombrar GBM (ID 20) a GBM Trading MX
cur.execute("UPDATE CUENTAS SET NOMBRE='GBM Trading MX' WHERE ID=20 AND USUARIO_ID=1")
print("  ✏️  GBM (ID 20) renombrado a 'GBM Trading MX'")

# ── 4. Insertar cuentas nuevas ───────────────────────────────
# (nombre, banco, tipo_pago, moneda, color, categoria_liq, opera_gastos)
NUEVAS = [
    ("GBM Fibras",        "GBM",          "Casa de bolsa",  "MXN", "#9B59B6", "InvLarga", 0),
    ("GBM Dana",          "GBM",          "Casa de bolsa",  "MXN", "#8E44AD", "InvCorta", 0),
    ("YoTePresto",        "YoTePresto",   "Otros",          "MXN", "#1ABC9C", "InvLarga", 0),
    ("100 Ladrillos",     "100 Ladrillos","Otros",          "MXN", "#E67E22", "InvLarga", 0),
    ("Mercado Pago Débito","Meli",        "Tarjeta débito", "MXN", "#F39C12", "Liquido",  1),
    ("Revolut",           "Revolut",      "Tarjeta débito", "USD", "#2980B9", "Liquido",  1),
    ("Dólares Efectivo",  "",             "Efectivo",       "USD", "#27AE60", "Liquido",  0),
]

nuevas_ids = {}
for nombre, banco, tipo, moneda, color, cat, opera in NUEVAS:
    cur.execute("SELECT ID FROM CUENTAS WHERE USUARIO_ID=1 AND LOWER(NOMBRE)=:n AND ACTIVO=1",
                n=nombre.lower())
    row = cur.fetchone()
    if row:
        cur.execute("UPDATE CUENTAS SET CATEGORIA_LIQ=:c, OPERA_GASTOS=:o WHERE ID=:id_val",
                    c=cat, o=opera, id_val=row[0])
        print(f"  ⏭️  '{nombre}' ya existe (ID {row[0]}), categoría asignada")
        nuevas_ids[nombre] = row[0]
    else:
        id_var = cur.var(int)
        cur.execute("""INSERT INTO CUENTAS(USUARIO_ID,NOMBRE,BANCO,TIPO_PAGO,MONEDA,COLOR,
                                           OPERA_GASTOS,CATEGORIA_LIQ)
                       VALUES(1,:n,:b,:t,:m,:col,:o,:c)
                       RETURNING ID INTO :rid""",
                    n=nombre, b=banco, t=tipo, m=moneda,
                    col=color, o=opera, c=cat, rid=id_var)
        new_id = id_var.getvalue()[0]
        print(f"  ➕ '{nombre}' creada (ID {new_id})")
        nuevas_ids[nombre] = new_id

conn.commit()

# ── 5. Verificación final ────────────────────────────────────
print("\n════════════════════════════════════════")
print("  ✅ Fase 1 BD completada")
print("════════════════════════════════════════")
print("\nCuentas de Osvaldo por categoría de liquidez:")
cur.execute("""
    SELECT CATEGORIA_LIQ, COUNT(*), LISTAGG(NOMBRE, ', ') WITHIN GROUP (ORDER BY NOMBRE)
    FROM CUENTAS WHERE USUARIO_ID=1 AND ACTIVO=1 AND CATEGORIA_LIQ IS NOT NULL
    GROUP BY CATEGORIA_LIQ ORDER BY CATEGORIA_LIQ
""")
for cat, n, nombres in cur.fetchall():
    print(f"\n  {cat} ({n}):")
    for nombre in nombres.split(', '):
        print(f"    · {nombre}")

print("\nCuentas SIN categoría asignada:")
cur.execute("""SELECT ID, NOMBRE FROM CUENTAS
               WHERE USUARIO_ID=1 AND ACTIVO=1 AND CATEGORIA_LIQ IS NULL
               ORDER BY NOMBRE""")
for row in cur.fetchall():
    print(f"  ⚠️  ID {row[0]}: {row[1]}")
