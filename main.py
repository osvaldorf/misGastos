# ============================================================
#  MIS FINANZAS — Backend FastAPI completo
#  Versión corregida — sin palabras reservadas Oracle
#  Palabras evitadas: desc, date, level, comment, int, user
# ============================================================

from fastapi import FastAPI, HTTPException, Depends, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import date, datetime, timedelta
from contextlib import asynccontextmanager
import oracledb
import os
import httpx
import jwt
import bcrypt
from dotenv import load_dotenv

load_dotenv()

# ────────────────────────────────────────
#  CONFIGURACIÓN
# ────────────────────────────────────────
DB_USER      = os.getenv("DB_USER",     "ADMIN")
DB_PASSWORD  = os.getenv("DB_PASSWORD", "")
DB_DSN       = os.getenv("DB_DSN",      "")
JWT_SECRET   = os.getenv("JWT_SECRET",  "cambia_esto_en_produccion")
JWT_ALG      = "HS256"
JWT_EXP_H    = 720
ADMIN_ID         = 1
SESSION_UPDATE_MIN = 5
EXCHANGE_KEY = os.getenv("EXCHANGE_API_KEY", "")

# ────────────────────────────────────────
#  POOL DE CONEXIONES
# ────────────────────────────────────────
pool: oracledb.ConnectionPool = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global pool
    oracledb.init_oracle_client()
    pool = oracledb.create_pool(
        user      = DB_USER,
        password  = DB_PASSWORD,
        dsn       = DB_DSN,
        min       = 2,
        max       = 10,
        increment = 1
    )
    print("✅ Pool Oracle conectado")
    yield
    pool.close()
    print("🔌 Pool Oracle cerrado")

def get_conn():
    conn = pool.acquire()
    try:
        yield conn
    finally:
        pool.release(conn)

# ────────────────────────────────────────
#  APP
# ────────────────────────────────────────
app = FastAPI(
    title       = "Mis Finanzas API",
    description = "Backend para app de control de gastos e ingresos personales",
    version     = "1.0.0",
    lifespan    = lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins  = ["*"],
    allow_methods  = ["*"],
    allow_headers  = ["*"],
)

security = HTTPBearer()

# ────────────────────────────────────────
#  JWT HELPERS
# ────────────────────────────────────────
def crear_token(uid: int, email: str) -> str:
    payload = {
        "sub"  : str(uid),
        "email": email,
        "exp"  : datetime.utcnow() + timedelta(hours=JWT_EXP_H)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)

def verificar_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    try:
        return jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")

def get_usuario_id(token: dict = Depends(verificar_token)) -> int:
    return int(token["sub"])

# ────────────────────────────────────────
#  HELPERS
# ────────────────────────────────────────
def rows_to_dict(cursor) -> List[dict]:
    cols = [c[0].lower() for c in cursor.description]
    return [dict(zip(cols, row)) for row in cursor.fetchall()]

async def get_tasa_cambio(moneda: str, conn) -> float:
    if moneda == "MXN":
        return 1.0
    cur = conn.cursor()
    cur.execute("""
        SELECT TASA FROM TIPOS_CAMBIO
        WHERE MONEDA_ORIGEN=:moneda_orig AND MONEDA_DESTINO='MXN'
        AND TRUNC(FECHA_CONSULTA)=TRUNC(SYSDATE)
        FETCH FIRST 1 ROWS ONLY
    """, moneda_orig=moneda)
    row = cur.fetchone()
    if row:
        return float(row[0])
    try:
        url = f"https://v6.exchangerate-api.com/v6/{EXCHANGE_KEY}/pair/{moneda}/MXN"
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(url)
            tasa = float(resp.json()["conversion_rate"])
    except Exception:
        tasa = 1.0
    try:
        cur.execute("""
            INSERT INTO TIPOS_CAMBIO(MONEDA_ORIGEN,MONEDA_DESTINO,TASA)
            VALUES(:moneda_orig,'MXN',:tasa_val)
        """, moneda_orig=moneda, tasa_val=tasa)
        conn.commit()
    except Exception:
        pass
    return tasa

# ────────────────────────────────────────
#  MODELOS PYDANTIC
# ────────────────────────────────────────
class LoginRequest(BaseModel):
    email   : EmailStr
    password: str

class CategoriaIn(BaseModel):
    nombre : str = Field(..., max_length=100)
    emoji  : Optional[str] = "📦"
    color  : Optional[str] = "#888780"

class CuentaIn(BaseModel):
    nombre    : str = Field(..., max_length=100)
    banco     : Optional[str] = ""
    tipo_pago : str
    moneda    : str = "MXN"
    color     : Optional[str] = "#888780"

class DestinatarioIn(BaseModel):
    nombre : str = Field(..., max_length=100)
    emoji  : Optional[str] = "👤"
    color  : Optional[str] = "#888780"

class FuenteIngresoIn(BaseModel):
    nombre     : str = Field(..., max_length=100)
    tipo       : str
    frecuencia : str = "Variable"
    moneda     : str = "MXN"
    color      : Optional[str] = "#1D9E75"

class PrestatarioIn(BaseModel):
    nombre            : str = Field(..., max_length=150)
    capital_original  : float = 0
    tasa_interes      : float = 0
    fecha_prestamo    : Optional[date] = None
    fecha_vencimiento : Optional[date] = None
    notas             : Optional[str] = ""

class GastoIn(BaseModel):
    descripcion     : str = Field(..., max_length=200)
    monto           : float = Field(..., gt=0)
    moneda          : str = "MXN"
    fecha           : date
    categoria_id    : int
    cuenta_id       : int
    destinatario_id : Optional[int] = None
    notas           : Optional[str] = ""
    device          : Optional[str] = "web"

class IngresoIn(BaseModel):
    descripcion    : str = Field(..., max_length=200)
    tipo           : str
    fuente_id      : int
    monto          : float = Field(..., gt=0)
    moneda         : str = "MXN"
    fecha          : date
    cuenta_id      : int
    notas          : Optional[str] = ""
    device         : Optional[str] = "web"
    prestatario_id : Optional[int] = None
    capital        : Optional[float] = 0
    intereses      : Optional[float] = 0

# ════════════════════════════════════════
#  ENDPOINTS BASE
# ════════════════════════════════════════
@app.get("/")
@app.get("/api/")
def root():
    return {"status": "ok", "app": "Mis Finanzas API", "version": "1.0.0"}

@app.get("/health")
@app.get("/api/health")
def health():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}

# ════════════════════════════════════════
#  AUTH
# ════════════════════════════════════════
@app.post("/api/auth/login")
def login(body: LoginRequest, request: Request, conn=Depends(get_conn)):
    cur = conn.cursor()
    cur.execute(
        "SELECT ID, NOMBRE, PASSWORD_HASH FROM USUARIOS WHERE EMAIL=:email_val AND ACTIVO=1",
        email_val=body.email
    )
    row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    uid, nombre, pw_hash = row
    if not bcrypt.checkpw(body.password.encode(), pw_hash.strip().encode()):
        raise HTTPException(status_code=401, detail="Credenciales inválidas")

    token = crear_token(uid, body.email)
    try:
        cur.execute("""
            UPDATE SESIONES SET ACTIVA=0, LOGOUT_AT=SYSTIMESTAMP
            WHERE USUARIO_ID=:uid_val AND ACTIVA=1
        """, uid_val=uid)
    except Exception:
        pass
    try:
        cur.execute("""
            INSERT INTO SESIONES (USUARIO_ID, EMAIL, NOMBRE, DEVICE, IP)
            VALUES (:uid_val, :email_val, :nombre_val, 'web', :ip_val)
        """, uid_val=uid, email_val=body.email.lower(),
             nombre_val=nombre,
             ip_val=request.headers.get("X-Forwarded-For", request.client.host).split(",")[0].strip())
        conn.commit()
    except Exception:
        pass

    return {"token": token, "usuario_id": uid, "nombre": nombre}

@app.post("/api/auth/register")
def register(body: LoginRequest, nombre: str, conn=Depends(get_conn)):
    pw_hash = bcrypt.hashpw(body.password.encode(), bcrypt.gensalt()).decode()
    cur = conn.cursor()
    try:
        cur.execute(
            "INSERT INTO USUARIOS(NOMBRE,EMAIL,PASSWORD_HASH) VALUES(:nombre_val,:email_val,:pw_val)",
            nombre_val=nombre, email_val=body.email, pw_val=pw_hash
        )
        conn.commit()
    except Exception:
        raise HTTPException(status_code=400, detail="El email ya está registrado")
    return {"ok": True}

# ════════════════════════════════════════
#  CATÁLOGOS — CATEGORÍAS
# ════════════════════════════════════════
@app.get("/api/catalogos/categorias")
def get_categorias(uid=Depends(get_usuario_id), conn=Depends(get_conn)):
    cur = conn.cursor()
    cur.execute("""
        SELECT ID,NOMBRE,EMOJI,COLOR,ES_SISTEMA,ACTIVO
        FROM CATEGORIAS WHERE USUARIO_ID=:uid_val AND ACTIVO=1
        ORDER BY NOMBRE
    """, uid_val=uid)
    return rows_to_dict(cur)

@app.post("/api/catalogos/categorias", status_code=201)
def create_categoria(body: CategoriaIn, uid=Depends(get_usuario_id), conn=Depends(get_conn)):
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO CATEGORIAS(USUARIO_ID,NOMBRE,EMOJI,COLOR,ES_SISTEMA)
        VALUES(:uid_val,:nombre_val,:emoji_val,:color_val,0)
    """, uid_val=uid, nombre_val=body.nombre, emoji_val=body.emoji, color_val=body.color)
    conn.commit()
    return {"ok": True}

@app.put("/api/catalogos/categorias/{cat_id}")
def update_categoria(cat_id: int, body: CategoriaIn, uid=Depends(get_usuario_id), conn=Depends(get_conn)):
    cur = conn.cursor()
    cur.execute("""
        UPDATE CATEGORIAS SET NOMBRE=:nombre_val,EMOJI=:emoji_val,COLOR=:color_val
        WHERE ID=:id_val AND USUARIO_ID=:uid_val
    """, nombre_val=body.nombre, emoji_val=body.emoji, color_val=body.color, id_val=cat_id, uid_val=uid)
    conn.commit()
    return {"ok": True}

@app.delete("/api/catalogos/categorias/{cat_id}")
def delete_categoria(cat_id: int, uid=Depends(get_usuario_id), conn=Depends(get_conn)):
    cur = conn.cursor()
    cur.execute("SELECT ES_SISTEMA FROM CATEGORIAS WHERE ID=:id_val AND USUARIO_ID=:uid_val", id_val=cat_id, uid_val=uid)
    row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    if row[0] == 1:
        raise HTTPException(status_code=400, detail="No se pueden eliminar categorías del sistema")
    cur.execute("UPDATE CATEGORIAS SET ACTIVO=0 WHERE ID=:id_val", id_val=cat_id)
    conn.commit()
    return {"ok": True}

# ════════════════════════════════════════
#  CATÁLOGOS — CUENTAS
# ════════════════════════════════════════
@app.get("/api/catalogos/cuentas")
def get_cuentas(uid=Depends(get_usuario_id), conn=Depends(get_conn)):
    cur = conn.cursor()
    cur.execute("""
        SELECT ID,NOMBRE,BANCO,TIPO_PAGO,MONEDA,COLOR,ACTIVO,
               NVL(OPERA_GASTOS,1) AS OPERA_GASTOS,
               CATEGORIA_LIQ
        FROM CUENTAS WHERE USUARIO_ID=:uid_val AND ACTIVO=1
        ORDER BY NOMBRE
    """, uid_val=uid)
    return rows_to_dict(cur)

@app.post("/api/catalogos/cuentas", status_code=201)
def create_cuenta(body: CuentaIn, uid=Depends(get_usuario_id), conn=Depends(get_conn)):
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO CUENTAS(USUARIO_ID,NOMBRE,BANCO,TIPO_PAGO,MONEDA,COLOR)
        VALUES(:uid_val,:nombre_val,:banco_val,:tipo_val,:moneda_val,:color_val)
    """, uid_val=uid, nombre_val=body.nombre, banco_val=body.banco,
         tipo_val=body.tipo_pago, moneda_val=body.moneda, color_val=body.color)
    conn.commit()
    return {"ok": True}

@app.put("/api/catalogos/cuentas/{cuenta_id}")
def update_cuenta(cuenta_id: int, body: CuentaIn, uid=Depends(get_usuario_id), conn=Depends(get_conn)):
    cur = conn.cursor()
    cur.execute("""
        UPDATE CUENTAS SET NOMBRE=:nombre_val,BANCO=:banco_val,TIPO_PAGO=:tipo_val,
               MONEDA=:moneda_val,COLOR=:color_val
        WHERE ID=:id_val AND USUARIO_ID=:uid_val
    """, nombre_val=body.nombre, banco_val=body.banco, tipo_val=body.tipo_pago,
         moneda_val=body.moneda, color_val=body.color, id_val=cuenta_id, uid_val=uid)
    conn.commit()
    return {"ok": True}

@app.delete("/api/catalogos/cuentas/{cuenta_id}")
def delete_cuenta(cuenta_id: int, uid=Depends(get_usuario_id), conn=Depends(get_conn)):
    cur = conn.cursor()
    cur.execute("UPDATE CUENTAS SET ACTIVO=0 WHERE ID=:id_val AND USUARIO_ID=:uid_val",
                id_val=cuenta_id, uid_val=uid)
    conn.commit()
    return {"ok": True}

# ════════════════════════════════════════
#  CATÁLOGOS — DESTINATARIOS
# ════════════════════════════════════════
@app.get("/api/catalogos/destinatarios")
def get_destinatarios(uid=Depends(get_usuario_id), conn=Depends(get_conn)):
    cur = conn.cursor()
    cur.execute("""
        SELECT ID,NOMBRE,EMOJI,COLOR,ACTIVO
        FROM DESTINATARIOS WHERE USUARIO_ID=:uid_val AND ACTIVO=1
        ORDER BY NOMBRE
    """, uid_val=uid)
    return rows_to_dict(cur)

@app.post("/api/catalogos/destinatarios", status_code=201)
def create_destinatario(body: DestinatarioIn, uid=Depends(get_usuario_id), conn=Depends(get_conn)):
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO DESTINATARIOS(USUARIO_ID,NOMBRE,EMOJI,COLOR)
        VALUES(:uid_val,:nombre_val,:emoji_val,:color_val)
    """, uid_val=uid, nombre_val=body.nombre, emoji_val=body.emoji, color_val=body.color)
    conn.commit()
    return {"ok": True}

@app.put("/api/catalogos/destinatarios/{dest_id}")
def update_destinatario(dest_id: int, body: DestinatarioIn, uid=Depends(get_usuario_id), conn=Depends(get_conn)):
    cur = conn.cursor()
    cur.execute("""
        UPDATE DESTINATARIOS SET NOMBRE=:nombre_val,EMOJI=:emoji_val,COLOR=:color_val
        WHERE ID=:id_val AND USUARIO_ID=:uid_val
    """, nombre_val=body.nombre, emoji_val=body.emoji, color_val=body.color,
         id_val=dest_id, uid_val=uid)
    conn.commit()
    return {"ok": True}

@app.delete("/api/catalogos/destinatarios/{dest_id}")
def delete_destinatario(dest_id: int, uid=Depends(get_usuario_id), conn=Depends(get_conn)):
    cur = conn.cursor()
    cur.execute("UPDATE DESTINATARIOS SET ACTIVO=0 WHERE ID=:id_val AND USUARIO_ID=:uid_val",
                id_val=dest_id, uid_val=uid)
    conn.commit()
    return {"ok": True}

# ════════════════════════════════════════
#  CATÁLOGOS — FUENTES DE INGRESO
# ════════════════════════════════════════
@app.get("/api/catalogos/fuentes")
def get_fuentes(uid=Depends(get_usuario_id), conn=Depends(get_conn)):
    cur = conn.cursor()
    cur.execute("""
        SELECT ID,NOMBRE,TIPO,FRECUENCIA,MONEDA,COLOR,ACTIVO
        FROM FUENTES_INGRESO WHERE USUARIO_ID=:uid_val AND ACTIVO=1
        ORDER BY TIPO,NOMBRE
    """, uid_val=uid)
    return rows_to_dict(cur)

@app.post("/api/catalogos/fuentes", status_code=201)
def create_fuente(body: FuenteIngresoIn, uid=Depends(get_usuario_id), conn=Depends(get_conn)):
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO FUENTES_INGRESO(USUARIO_ID,NOMBRE,TIPO,FRECUENCIA,MONEDA,COLOR)
        VALUES(:uid_val,:nombre_val,:tipo_val,:frec_val,:moneda_val,:color_val)
    """, uid_val=uid, nombre_val=body.nombre, tipo_val=body.tipo,
         frec_val=body.frecuencia, moneda_val=body.moneda, color_val=body.color)
    conn.commit()
    return {"ok": True}

@app.put("/api/catalogos/fuentes/{fuente_id}")
def update_fuente(fuente_id: int, body: FuenteIngresoIn, uid=Depends(get_usuario_id), conn=Depends(get_conn)):
    cur = conn.cursor()
    cur.execute("""
        UPDATE FUENTES_INGRESO SET NOMBRE=:nombre_val,TIPO=:tipo_val,FRECUENCIA=:frec_val,
               MONEDA=:moneda_val,COLOR=:color_val
        WHERE ID=:id_val AND USUARIO_ID=:uid_val
    """, nombre_val=body.nombre, tipo_val=body.tipo, frec_val=body.frecuencia,
         moneda_val=body.moneda, color_val=body.color, id_val=fuente_id, uid_val=uid)
    conn.commit()
    return {"ok": True}

@app.delete("/api/catalogos/fuentes/{fuente_id}")
def delete_fuente(fuente_id: int, uid=Depends(get_usuario_id), conn=Depends(get_conn)):
    cur = conn.cursor()
    cur.execute("UPDATE FUENTES_INGRESO SET ACTIVO=0 WHERE ID=:id_val AND USUARIO_ID=:uid_val",
                id_val=fuente_id, uid_val=uid)
    conn.commit()
    return {"ok": True}

# ════════════════════════════════════════
#  CATÁLOGOS — PRESTATARIOS
# ════════════════════════════════════════
@app.get("/api/catalogos/prestatarios")
def get_prestatarios(
    incluir_inactivos: bool = False,
    uid=Depends(get_usuario_id), conn=Depends(get_conn)
):
    cur = conn.cursor()
    where = "USUARIO_ID=:uid_val"
    if not incluir_inactivos:
        where += " AND ACTIVO=1"
    cur.execute(f"""
        SELECT ID,NOMBRE,CAPITAL_ORIGINAL,CAPITAL_RECUPERADO,
               CAPITAL_ORIGINAL-CAPITAL_RECUPERADO AS SALDO_CAPITAL,
               TASA_INTERES,FECHA_PRESTAMO,FECHA_VENCIMIENTO,ESTATUS,NOTAS,ACTIVO
        FROM PRESTATARIOS WHERE {where}
        ORDER BY ESTATUS,NOMBRE
    """, uid_val=uid)
    return rows_to_dict(cur)

@app.post("/api/catalogos/prestatarios", status_code=201)
def create_prestatario(body: PrestatarioIn, uid=Depends(get_usuario_id), conn=Depends(get_conn)):
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO PRESTATARIOS(USUARIO_ID,NOMBRE,CAPITAL_ORIGINAL,TASA_INTERES,
                                 FECHA_PRESTAMO,FECHA_VENCIMIENTO,NOTAS)
        VALUES(:uid_val,:nombre_val,:capital_val,:tasa_val,:fp_val,:fv_val,:notas_val)
    """, uid_val=uid, nombre_val=body.nombre, capital_val=body.capital_original,
         tasa_val=body.tasa_interes, fp_val=body.fecha_prestamo,
         fv_val=body.fecha_vencimiento, notas_val=body.notas)
    conn.commit()
    return {"ok": True}

@app.get("/api/catalogos/fuentes-prestamo")
def get_fuentes_prestamo(uid=Depends(get_usuario_id), conn=Depends(get_conn)):
    """Retorna prestatarios activos como fuentes virtuales de ingreso tipo Préstamo"""
    cur = conn.cursor()
    cur.execute("""
        SELECT ID, NOMBRE,
               CAPITAL_ORIGINAL - CAPITAL_RECUPERADO AS SALDO_PENDIENTE,
               TASA_INTERES, ESTATUS
        FROM PRESTATARIOS
        WHERE USUARIO_ID=:uid_val AND ACTIVO=1 AND ESTATUS='Activo'
        ORDER BY NOMBRE
    """, uid_val=uid)
    return rows_to_dict(cur)

@app.put("/api/catalogos/prestatarios/{prest_id}")
def update_prestatario(prest_id: int, body: PrestatarioIn, uid=Depends(get_usuario_id), conn=Depends(get_conn)):
    cur = conn.cursor()
    cur.execute("""
        UPDATE PRESTATARIOS SET NOMBRE=:nombre_val,CAPITAL_ORIGINAL=:capital_val,
               TASA_INTERES=:tasa_val,FECHA_PRESTAMO=:fp_val,
               FECHA_VENCIMIENTO=:fv_val,NOTAS=:notas_val
        WHERE ID=:id_val AND USUARIO_ID=:uid_val
    """, nombre_val=body.nombre, capital_val=body.capital_original,
         tasa_val=body.tasa_interes, fp_val=body.fecha_prestamo,
         fv_val=body.fecha_vencimiento, notas_val=body.notas,
         id_val=prest_id, uid_val=uid)
    conn.commit()
    return {"ok": True}

@app.delete("/api/catalogos/prestatarios/{prest_id}")
def delete_prestatario(prest_id: int, uid=Depends(get_usuario_id), conn=Depends(get_conn)):
    cur = conn.cursor()
    cur.execute("""
        UPDATE PRESTATARIOS SET ACTIVO=0
        WHERE ID=:id_val AND USUARIO_ID=:uid_val
    """, id_val=prest_id, uid_val=uid)
    conn.commit()
    return {"ok": True}

@app.get("/api/catalogos/tipos-cambio")
def get_tipos_cambio(conn=Depends(get_conn)):
    cur = conn.cursor()
    cur.execute("""
        SELECT MONEDA_ORIGEN,MONEDA_DESTINO,TASA,FECHA_CONSULTA
        FROM TIPOS_CAMBIO
        WHERE TRUNC(FECHA_CONSULTA)=TRUNC(SYSDATE)
        ORDER BY MONEDA_ORIGEN
    """)
    return rows_to_dict(cur)

# ════════════════════════════════════════
#  GASTOS
# ════════════════════════════════════════
@app.get("/api/gastos")
def get_gastos(
    fecha_ini   : Optional[date] = None,
    fecha_fin   : Optional[date] = None,
    categoria_id: Optional[int]  = None,
    cuenta_id   : Optional[int]  = None,
    dest_id     : Optional[int]  = None,
    limit       : int = Query(100, le=500),
    offset      : int = 0,
    uid=Depends(get_usuario_id), conn=Depends(get_conn)
):
    where  = ["G.USUARIO_ID=:uid_val"]
    params = {"uid_val": uid}
    if fecha_ini:    where.append("G.FECHA>=TO_DATE(:fi_val,'YYYY-MM-DD')");  params["fi_val"]  = str(fecha_ini)
    if fecha_fin:    where.append("G.FECHA<=TO_DATE(:ff_val,'YYYY-MM-DD')");  params["ff_val"]  = str(fecha_fin)
    if categoria_id: where.append("G.CATEGORIA_ID=:cat_val"); params["cat_val"] = categoria_id
    if cuenta_id:    where.append("G.CUENTA_ID=:cta_val");    params["cta_val"] = cuenta_id
    if dest_id:      where.append("G.DESTINATARIO_ID=:dest_val"); params["dest_val"] = dest_id
    params["offset_val"] = offset
    params["limit_val"]  = limit
    cur = conn.cursor()
    cur.execute(f"""
        SELECT G.ID,G.DESCRIPCION,G.MONTO,G.MONEDA,G.MONTO_MXN,G.TASA_CAMBIO,
               G.FECHA,G.NOTAS,G.DEVICE,G.CREATED_AT,
               C.NOMBRE AS CATEGORIA,C.EMOJI AS CAT_EMOJI,C.COLOR AS CAT_COLOR,
               CTA.NOMBRE AS CUENTA,CTA.COLOR AS CUENTA_COLOR,
               D.NOMBRE AS DESTINATARIO,D.EMOJI AS DEST_EMOJI
        FROM GASTOS G
        JOIN CATEGORIAS C ON C.ID=G.CATEGORIA_ID
        JOIN CUENTAS CTA  ON CTA.ID=G.CUENTA_ID
        LEFT JOIN DESTINATARIOS D ON D.ID=G.DESTINATARIO_ID
        WHERE {' AND '.join(where)}
        ORDER BY G.FECHA DESC,G.CREATED_AT DESC
        OFFSET :offset_val ROWS FETCH NEXT :limit_val ROWS ONLY
    """, **params)
    return rows_to_dict(cur)

@app.get("/api/gastos/resumen")
def resumen_gastos(
    fecha_ini   : Optional[date] = None,
    fecha_fin   : Optional[date] = None,
    categoria_id: Optional[int]  = None,
    cuenta_id   : Optional[int]  = None,
    dest_id     : Optional[int]  = None,
    uid=Depends(get_usuario_id), conn=Depends(get_conn)
):
    where  = ["G.USUARIO_ID=:uid_val"]
    params = {"uid_val": uid}
    if fecha_ini:    where.append("G.FECHA>=TO_DATE(:fi_val,'YYYY-MM-DD')");  params["fi_val"]  = str(fecha_ini)
    if fecha_fin:    where.append("G.FECHA<=TO_DATE(:ff_val,'YYYY-MM-DD')"); params["ff_val"]  = str(fecha_fin)
    if categoria_id: where.append("G.CATEGORIA_ID=:cat_val"); params["cat_val"] = categoria_id
    if cuenta_id:    where.append("G.CUENTA_ID=:cta_val"); params["cta_val"] = cuenta_id
    if dest_id:      where.append("G.DESTINATARIO_ID=:dest_val"); params["dest_val"] = dest_id
    cur = conn.cursor()
    cur.execute(f"""
        SELECT NVL(COUNT(*),0) AS TOTAL_REGISTROS,
               NVL(SUM(NVL(G.MONTO_MXN,G.MONTO)),0) AS TOTAL_MXN
        FROM GASTOS G
        WHERE {' AND '.join(where)}
    """, **params)
    row = cur.fetchone()
    return {
        "total_registros": int(row[0]),
        "total_mxn": float(row[1])
    }

@app.post("/api/gastos", status_code=201)
async def create_gasto(body: GastoIn, uid=Depends(get_usuario_id), conn=Depends(get_conn)):
    tasa      = await get_tasa_cambio(body.moneda, conn)
    monto_mxn = round(body.monto * tasa, 2)
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO GASTOS(USUARIO_ID,DESCRIPCION,MONTO,MONEDA,MONTO_MXN,TASA_CAMBIO,
                           FECHA,CATEGORIA_ID,CUENTA_ID,DESTINATARIO_ID,NOTAS,DEVICE)
        VALUES(:uid_val,:descripcion_val,:monto_val,:moneda_val,:mxn_val,:tasa_val,
               TO_DATE(:fecha_val,'YYYY-MM-DD'),:cat_val,:cta_val,:dest_val,:notas_val,:dev_val)
    """, uid_val=uid, descripcion_val=body.descripcion, monto_val=body.monto,
         moneda_val=body.moneda, mxn_val=monto_mxn, tasa_val=tasa,
         fecha_val=str(body.fecha), cat_val=body.categoria_id,
         cta_val=body.cuenta_id, dest_val=body.destinatario_id,
         notas_val=body.notas, dev_val=body.device)
    conn.commit()
    return {"ok": True, "monto_mxn": monto_mxn, "tasa_cambio": tasa}

@app.put("/api/gastos/{gasto_id}")
async def update_gasto(gasto_id: int, body: GastoIn, uid=Depends(get_usuario_id), conn=Depends(get_conn)):
    tasa      = await get_tasa_cambio(body.moneda, conn)
    monto_mxn = round(body.monto * tasa, 2)
    cur = conn.cursor()
    cur.execute("""
        UPDATE GASTOS SET DESCRIPCION=:descripcion_val,MONTO=:monto_val,MONEDA=:moneda_val,
               MONTO_MXN=:mxn_val,TASA_CAMBIO=:tasa_val,
               FECHA=TO_DATE(:fecha_val,'YYYY-MM-DD'),
               CATEGORIA_ID=:cat_val,CUENTA_ID=:cta_val,
               DESTINATARIO_ID=:dest_val,NOTAS=:notas_val
        WHERE ID=:id_val AND USUARIO_ID=:uid_val
    """, descripcion_val=body.descripcion, monto_val=body.monto, moneda_val=body.moneda,
         mxn_val=monto_mxn, tasa_val=tasa, fecha_val=str(body.fecha),
         cat_val=body.categoria_id, cta_val=body.cuenta_id,
         dest_val=body.destinatario_id, notas_val=body.notas,
         id_val=gasto_id, uid_val=uid)
    conn.commit()
    return {"ok": True}

@app.delete("/api/gastos/{gasto_id}")
def delete_gasto(gasto_id: int, uid=Depends(get_usuario_id), conn=Depends(get_conn)):
    cur = conn.cursor()
    cur.execute("DELETE FROM GASTOS WHERE ID=:id_val AND USUARIO_ID=:uid_val",
                id_val=gasto_id, uid_val=uid)
    conn.commit()
    return {"ok": True}

# ════════════════════════════════════════
#  INGRESOS
# ════════════════════════════════════════
@app.get("/api/ingresos")
def get_ingresos(
    fecha_ini : Optional[date] = None,
    fecha_fin : Optional[date] = None,
    tipo      : Optional[str]  = None,
    fuente_id : Optional[int]  = None,
    cuenta_id : Optional[int]  = None,
    limit     : int = Query(100, le=500),
    offset    : int = 0,
    uid=Depends(get_usuario_id), conn=Depends(get_conn)
):
    where  = ["I.USUARIO_ID=:uid_val"]
    params = {"uid_val": uid}
    if fecha_ini: where.append("I.FECHA>=TO_DATE(:fi_val,'YYYY-MM-DD')"); params["fi_val"]   = str(fecha_ini)
    if fecha_fin: where.append("I.FECHA<=TO_DATE(:ff_val,'YYYY-MM-DD')"); params["ff_val"]   = str(fecha_fin)
    if tipo:      where.append("I.TIPO=:tipo_val");      params["tipo_val"]  = tipo
    if fuente_id: where.append("I.FUENTE_ID=:fid_val"); params["fid_val"]   = fuente_id
    if cuenta_id: where.append("I.CUENTA_ID=:cid_val"); params["cid_val"]   = cuenta_id
    params["offset_val"] = offset
    params["limit_val"]  = limit
    cur = conn.cursor()
    cur.execute(f"""
        SELECT I.ID,I.DESCRIPCION,I.TIPO,I.MONTO,I.MONEDA,I.MONTO_MXN,
               I.TASA_CAMBIO,I.FECHA,I.NOTAS,I.DEVICE,I.CREATED_AT,
               F.NOMBRE AS FUENTE,F.COLOR AS FUENTE_COLOR,
               C.NOMBRE AS CUENTA,C.COLOR AS CUENTA_COLOR,
               PP.CAPITAL,PP.INTERESES,PP.PRESTATARIO_ID,
               P.NOMBRE AS PRESTATARIO
        FROM INGRESOS I
        JOIN FUENTES_INGRESO F ON F.ID=I.FUENTE_ID
        JOIN CUENTAS C         ON C.ID=I.CUENTA_ID
        LEFT JOIN PAGOS_PRESTAMO PP ON PP.INGRESO_ID=I.ID
        LEFT JOIN PRESTATARIOS P    ON P.ID=PP.PRESTATARIO_ID
        WHERE {' AND '.join(where)}
        ORDER BY I.FECHA DESC,I.CREATED_AT DESC
        OFFSET :offset_val ROWS FETCH NEXT :limit_val ROWS ONLY
    """, **params)
    return rows_to_dict(cur)

@app.post("/api/ingresos", status_code=201)
async def create_ingreso(body: IngresoIn, uid=Depends(get_usuario_id), conn=Depends(get_conn)):
    # Validar desglose de préstamo
    if body.tipo == "Préstamo" and body.prestatario_id:
        capital   = body.capital or 0
        intereses = body.intereses or 0
        if round(capital + intereses, 2) != round(body.monto, 2):
            raise HTTPException(
                status_code=400,
                detail=f"Capital ({capital}) + Intereses ({intereses}) debe ser igual al Monto ({body.monto})"
            )
    tasa      = await get_tasa_cambio(body.moneda, conn)
    monto_mxn = round(body.monto * tasa, 2)
    cur = conn.cursor()
    ingreso_id_var = cur.var(int)
    cur.execute("""
        INSERT INTO INGRESOS(USUARIO_ID,DESCRIPCION,TIPO,FUENTE_ID,MONTO,MONEDA,
                             MONTO_MXN,TASA_CAMBIO,FECHA,CUENTA_ID,NOTAS,DEVICE)
        VALUES(:uid_val,:descripcion_val,:tipo_val,:fid_val,:monto_val,:moneda_val,
               :mxn_val,:tasa_val,TO_DATE(:fecha_val,'YYYY-MM-DD'),:cta_val,:notas_val,:dev_val)
        RETURNING ID INTO :rid_val
    """, uid_val=uid, descripcion_val=body.descripcion, tipo_val=body.tipo,
         fid_val=body.fuente_id, monto_val=body.monto, moneda_val=body.moneda,
         mxn_val=monto_mxn, tasa_val=tasa, fecha_val=str(body.fecha),
         cta_val=body.cuenta_id, notas_val=body.notas, dev_val=body.device,
         rid_val=ingreso_id_var)
    ingreso_id = ingreso_id_var.getvalue()[0]
    if body.tipo == "Préstamo" and body.prestatario_id:
        cur.execute("""
            INSERT INTO PAGOS_PRESTAMO(INGRESO_ID,PRESTATARIO_ID,CAPITAL,INTERESES,FECHA)
            VALUES(:iid_val,:pid_val,:capital_val,:intereses_val,TO_DATE(:fecha_val,'YYYY-MM-DD'))
        """, iid_val=ingreso_id, pid_val=body.prestatario_id,
             capital_val=body.capital or 0, intereses_val=body.intereses or 0,
             fecha_val=str(body.fecha))
    conn.commit()
    return {"ok": True, "ingreso_id": ingreso_id, "monto_mxn": monto_mxn}

@app.delete("/api/ingresos/{ingreso_id}")
def delete_ingreso(ingreso_id: int, uid=Depends(get_usuario_id), conn=Depends(get_conn)):
    cur = conn.cursor()
    cur.execute("DELETE FROM PAGOS_PRESTAMO WHERE INGRESO_ID=:id_val", id_val=ingreso_id)
    cur.execute("DELETE FROM INGRESOS WHERE ID=:id_val AND USUARIO_ID=:uid_val",
                id_val=ingreso_id, uid_val=uid)
    conn.commit()
    return {"ok": True}

# ════════════════════════════════════════
#  BALANCE
# ════════════════════════════════════════
@app.get("/api/balance/resumen")
def resumen_general(uid=Depends(get_usuario_id), conn=Depends(get_conn)):
    cur = conn.cursor()
    cur.execute("""
        SELECT NVL(SUM(NVL(MONTO_MXN,MONTO)),0)
        FROM GASTOS WHERE USUARIO_ID=:uid_val
        AND TO_CHAR(FECHA,'YYYY-MM')=TO_CHAR(SYSDATE,'YYYY-MM')
    """, uid_val=uid)
    gastos_mes = cur.fetchone()[0]
    cur.execute("""
        SELECT NVL(SUM(NVL(MONTO_MXN,MONTO)),0)
        FROM INGRESOS WHERE USUARIO_ID=:uid_val
        AND TO_CHAR(FECHA,'YYYY-MM')=TO_CHAR(SYSDATE,'YYYY-MM')
    """, uid_val=uid)
    ingresos_mes = cur.fetchone()[0]
    cur.execute("""
        SELECT COUNT(*),NVL(SUM(CAPITAL_ORIGINAL-CAPITAL_RECUPERADO),0)
        FROM PRESTATARIOS WHERE USUARIO_ID=:uid_val AND ESTATUS='Activo'
    """, uid_val=uid)
    pr = cur.fetchone()
    return {
        "gastos_mes_mxn"     : float(gastos_mes),
        "ingresos_mes_mxn"   : float(ingresos_mes),
        "flujo_neto_mxn"     : float(ingresos_mes - gastos_mes),
        "prestamos_activos"  : int(pr[0]),
        "saldo_prestamos_mxn": float(pr[1])
    }

@app.get("/api/balance/flujo-mensual")
def flujo_mensual(anio: Optional[int] = None, uid=Depends(get_usuario_id), conn=Depends(get_conn)):
    params = {"uid_val": uid}
    where_extra = ""
    if anio:
        where_extra = " AND EXTRACT(YEAR FROM FECHA)=:anio_val"
        params["anio_val"] = anio
    cur = conn.cursor()
    cur.execute(f"""
        SELECT MES,
               SUM(CASE WHEN TIPO='Ingreso' THEN TOTAL ELSE 0 END) AS INGRESOS_MXN,
               SUM(CASE WHEN TIPO='Gasto'   THEN TOTAL ELSE 0 END) AS GASTOS_MXN,
               SUM(CASE WHEN TIPO='Ingreso' THEN TOTAL ELSE -TOTAL END) AS FLUJO_NETO
        FROM (
            SELECT TO_CHAR(FECHA,'YYYY-MM') AS MES,'Ingreso' AS TIPO,
                   SUM(NVL(MONTO_MXN,MONTO)) AS TOTAL
            FROM INGRESOS WHERE USUARIO_ID=:uid_val{where_extra}
            GROUP BY TO_CHAR(FECHA,'YYYY-MM')
            UNION ALL
            SELECT TO_CHAR(FECHA,'YYYY-MM') AS MES,'Gasto' AS TIPO,
                   SUM(NVL(MONTO_MXN,MONTO)) AS TOTAL
            FROM GASTOS WHERE USUARIO_ID=:uid_val{where_extra}
            GROUP BY TO_CHAR(FECHA,'YYYY-MM')
        ) GROUP BY MES ORDER BY MES
    """, **params)
    return rows_to_dict(cur)

@app.get("/api/balance/por-categoria")
def balance_por_categoria(
    fecha_ini: Optional[date] = None,
    fecha_fin: Optional[date] = None,
    uid=Depends(get_usuario_id), conn=Depends(get_conn)
):
    where  = ["G.USUARIO_ID=:uid_val"]
    params = {"uid_val": uid}
    if fecha_ini: where.append("G.FECHA>=TO_DATE(:fi_val,'YYYY-MM-DD')"); params["fi_val"] = str(fecha_ini)
    if fecha_fin: where.append("G.FECHA<=TO_DATE(:ff_val,'YYYY-MM-DD')"); params["ff_val"] = str(fecha_fin)
    cur = conn.cursor()
    cur.execute(f"""
        SELECT C.NOMBRE,C.EMOJI,C.COLOR,
               SUM(NVL(G.MONTO_MXN,G.MONTO)) AS TOTAL_MXN,COUNT(*) AS REGISTROS
        FROM GASTOS G JOIN CATEGORIAS C ON C.ID=G.CATEGORIA_ID
        WHERE {' AND '.join(where)}
        GROUP BY C.NOMBRE,C.EMOJI,C.COLOR
        ORDER BY TOTAL_MXN DESC
    """, **params)
    return rows_to_dict(cur)

@app.get("/api/balance/por-fuente")
def balance_por_fuente(
    fecha_ini: Optional[date] = None,
    fecha_fin: Optional[date] = None,
    uid=Depends(get_usuario_id), conn=Depends(get_conn)
):
    where  = ["I.USUARIO_ID=:uid_val"]
    params = {"uid_val": uid}
    if fecha_ini: where.append("I.FECHA>=TO_DATE(:fi_val,'YYYY-MM-DD')"); params["fi_val"] = str(fecha_ini)
    if fecha_fin: where.append("I.FECHA<=TO_DATE(:ff_val,'YYYY-MM-DD')"); params["ff_val"] = str(fecha_fin)
    cur = conn.cursor()
    cur.execute(f"""
        SELECT F.NOMBRE,F.TIPO,F.MONEDA,F.COLOR,
               SUM(I.MONTO) AS TOTAL_MONEDA,
               SUM(NVL(I.MONTO_MXN,I.MONTO)) AS TOTAL_MXN,
               COUNT(*) AS REGISTROS
        FROM INGRESOS I JOIN FUENTES_INGRESO F ON F.ID=I.FUENTE_ID
        WHERE {' AND '.join(where)}
        GROUP BY F.NOMBRE,F.TIPO,F.MONEDA,F.COLOR
        ORDER BY TOTAL_MXN DESC
    """, **params)
    return rows_to_dict(cur)

@app.get("/api/balance/prestamos")
def balance_prestamos(uid=Depends(get_usuario_id), conn=Depends(get_conn)):
    cur = conn.cursor()
    cur.execute("""
        SELECT P.ID,P.NOMBRE,P.CAPITAL_ORIGINAL,P.CAPITAL_RECUPERADO,
               P.CAPITAL_ORIGINAL-P.CAPITAL_RECUPERADO AS SALDO_PENDIENTE,
               NVL(SUM(PP.INTERESES),0) AS INTERESES_COBRADOS,
               P.TASA_INTERES,P.FECHA_PRESTAMO,P.FECHA_VENCIMIENTO,P.ESTATUS
        FROM PRESTATARIOS P
        LEFT JOIN PAGOS_PRESTAMO PP ON PP.PRESTATARIO_ID=P.ID
        WHERE P.USUARIO_ID=:uid_val
        GROUP BY P.ID,P.NOMBRE,P.CAPITAL_ORIGINAL,P.CAPITAL_RECUPERADO,
                 P.TASA_INTERES,P.FECHA_PRESTAMO,P.FECHA_VENCIMIENTO,P.ESTATUS
        ORDER BY P.ESTATUS,SALDO_PENDIENTE DESC
    """, uid_val=uid)
    return rows_to_dict(cur)

@app.get("/api/balance/posicion-moneda")
def posicion_moneda(uid=Depends(get_usuario_id), conn=Depends(get_conn)):
    cur = conn.cursor()
    cur.execute("""
        SELECT MONEDA,
               SUM(CASE WHEN TIPO='Ingreso' THEN MONTO ELSE 0 END) AS INGRESOS,
               SUM(CASE WHEN TIPO='Gasto'   THEN MONTO ELSE 0 END) AS GASTOS,
               SUM(CASE WHEN TIPO='Ingreso' THEN MONTO ELSE -MONTO END) AS POSICION_NETA
        FROM (
            SELECT MONEDA,MONTO,'Ingreso' AS TIPO FROM INGRESOS WHERE USUARIO_ID=:uid_val
            UNION ALL
            SELECT MONEDA,MONTO,'Gasto' AS TIPO FROM GASTOS WHERE USUARIO_ID=:uid_val
        ) GROUP BY MONEDA ORDER BY POSICION_NETA DESC
    """, uid_val=uid)
    return rows_to_dict(cur)
# ════════════════════════════════════════
#  AUTH — CAMBIAR PASSWORD
# ════════════════════════════════════════
class CambiarPasswordIn(BaseModel):
    password_actual : str
    password_nuevo  : str = Field(..., min_length=8)

@app.put("/api/auth/cambiar-password")
def cambiar_password(body: CambiarPasswordIn, uid=Depends(get_usuario_id), conn=Depends(get_conn)):
    cur = conn.cursor()
    cur.execute("SELECT PASSWORD_HASH FROM USUARIOS WHERE ID=:uid_val", uid_val=uid)
    row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if not bcrypt.checkpw(body.password_actual.encode(), row[0].strip().encode()):
        raise HTTPException(status_code=400, detail="La contraseña actual es incorrecta")
    nuevo_hash = bcrypt.hashpw(body.password_nuevo.encode(), bcrypt.gensalt()).decode()
    cur.execute(
        "UPDATE USUARIOS SET PASSWORD_HASH=:hash_val WHERE ID=:uid_val",
        hash_val=nuevo_hash, uid_val=uid
    )
    conn.commit()
    return {"ok": True}

# ════════════════════════════════════════
#  ONBOARDING
# ════════════════════════════════════════
@app.get("/api/onboarding/status")
def onboarding_status(uid=Depends(get_usuario_id), conn=Depends(get_conn)):
    cur = conn.cursor()
    cur.execute(
        "SELECT ONBOARDING_COMPLETADO FROM USUARIOS WHERE ID=:uid_val",
        uid_val=uid
    )
    row = cur.fetchone()
    return {"completado": bool(row[0]) if row else False}

@app.post("/api/onboarding/completar")
def onboarding_completar(uid=Depends(get_usuario_id), conn=Depends(get_conn)):
    cur = conn.cursor()
    cur.execute(
        "UPDATE USUARIOS SET ONBOARDING_COMPLETADO=1 WHERE ID=:uid_val",
        uid_val=uid
    )
    conn.commit()
    return {"ok": True}

# ════════════════════════════════════════
#  TARJETAS DE CRÉDITO
# ════════════════════════════════════════
class TarjetaIn(BaseModel):
    cuenta_id      : int
    limite_credito : float
    dia_corte      : Optional[int]   = None
    dias_para_pago : int             = 20
    tasa_anual     : Optional[float] = None

class EstadoTarjetaIn(BaseModel):
    anio             : int
    mes              : int
    fecha_corte      : Optional[date]  = None
    fecha_limite     : Optional[date]  = None
    adeudo_anterior  : float           = 0
    cargos_regulares : float           = 0
    cargos_meses     : float           = 0
    intereses        : float           = 0
    comisiones       : float           = 0
    iva              : float           = 0
    pago_minimo      : float           = 0
    pago_pngi        : float           = 0
    pago_real        : Optional[float] = None
    tasa             : Optional[float] = None
    saldo_regular    : Optional[float] = None
    saldo_meses      : Optional[float] = None
    deudor_total     : Optional[float] = None
    notas            : str             = ""

@app.get("/api/tarjetas/resumen")
def tarjetas_resumen(uid=Depends(get_usuario_id), conn=Depends(get_conn)):
    cur = conn.cursor()
    cur.execute("""
        SELECT
            NVL(SUM(NVL(E.DEUDOR_TOTAL, 0)), 0)   AS DEUDA_TOTAL,
            NVL(SUM(T.LIMITE_CREDITO), 0)          AS LIMITE_TOTAL,
            CASE WHEN NVL(SUM(T.LIMITE_CREDITO),0) > 0
                 THEN ROUND(SUM(NVL(E.DEUDOR_TOTAL,0)) /
                            SUM(T.LIMITE_CREDITO) * 100, 1)
                 ELSE 0 END                        AS UTILIZACION_PCT,
            MIN(CASE WHEN E.FECHA_LIMITE >= TRUNC(SYSDATE)
                     THEN E.FECHA_LIMITE END)      AS PROX_VCTO,
            COUNT(T.ID)                            AS TOTAL_TARJETAS
        FROM TARJETAS_CREDITO T
        LEFT JOIN (
            SELECT E1.*,
                   ROW_NUMBER() OVER (PARTITION BY E1.TARJETA_ID
                       ORDER BY E1.ANIO DESC, E1.MES DESC) AS RN
            FROM ESTADOS_TARJETA E1
        ) E ON E.TARJETA_ID = T.ID AND E.RN = 1
        WHERE T.USUARIO_ID = :uid_val AND T.ACTIVO = 1
    """, uid_val=uid)
    row = cur.fetchone()
    return {
        "deuda_total"    : float(row[0] or 0),
        "limite_total"   : float(row[1] or 0),
        "utilizacion_pct": float(row[2] or 0),
        "prox_vcto"      : row[3].strftime("%Y-%m-%d") if row[3] else None,
        "total_tarjetas" : int(row[4] or 0),
    }

@app.get("/api/tarjetas")
def get_tarjetas(uid=Depends(get_usuario_id), conn=Depends(get_conn)):
    cur = conn.cursor()
    cur.execute("""
        SELECT
            T.ID, T.CUENTA_ID, T.LIMITE_CREDITO, T.DIA_CORTE,
            T.DIAS_PARA_PAGO, T.TASA_ANUAL, T.ACTIVO,
            C.NOMBRE AS CUENTA_NOMBRE, C.BANCO, C.COLOR, C.MONEDA,
            NVL(E.DEUDOR_TOTAL,  0) AS DEUDOR_TOTAL,
            NVL(E.SALDO_REGULAR, 0) AS SALDO_REGULAR,
            NVL(E.SALDO_MESES,   0) AS SALDO_MESES,
            NVL(E.PAGO_PNGI,     0) AS PAGO_PNGI,
            NVL(E.PAGO_MINIMO,   0) AS PAGO_MINIMO,
            E.FECHA_LIMITE,
            E.FECHA_CORTE,
            E.ANIO AS ULTIMO_ANIO,
            E.MES  AS ULTIMO_MES
        FROM TARJETAS_CREDITO T
        JOIN CUENTAS C ON C.ID = T.CUENTA_ID
        LEFT JOIN (
            SELECT E1.*,
                   ROW_NUMBER() OVER (PARTITION BY E1.TARJETA_ID
                       ORDER BY E1.ANIO DESC, E1.MES DESC) AS RN
            FROM ESTADOS_TARJETA E1
        ) E ON E.TARJETA_ID = T.ID AND E.RN = 1
        WHERE T.USUARIO_ID = :uid_val AND T.ACTIVO = 1
        ORDER BY C.NOMBRE
    """, uid_val=uid)
    return rows_to_dict(cur)

@app.post("/api/tarjetas", status_code=201)
def create_tarjeta(body: TarjetaIn, uid=Depends(get_usuario_id), conn=Depends(get_conn)):
    cur = conn.cursor()
    cur.execute("""
        MERGE INTO TARJETAS_CREDITO t
        USING DUAL ON (t.USUARIO_ID=:uid_val AND t.CUENTA_ID=:cta_val)
        WHEN MATCHED THEN
            UPDATE SET LIMITE_CREDITO=:lim_val, DIA_CORTE=:dc_val,
                       DIAS_PARA_PAGO=:dp_val, TASA_ANUAL=:tasa_val, ACTIVO=1
        WHEN NOT MATCHED THEN
            INSERT (USUARIO_ID,CUENTA_ID,LIMITE_CREDITO,DIA_CORTE,DIAS_PARA_PAGO,TASA_ANUAL)
            VALUES (:uid_val,:cta_val,:lim_val,:dc_val,:dp_val,:tasa_val)
    """, uid_val=uid, cta_val=body.cuenta_id, lim_val=body.limite_credito,
         dc_val=body.dia_corte, dp_val=body.dias_para_pago, tasa_val=body.tasa_anual)
    conn.commit()
    return {"ok": True}

@app.put("/api/tarjetas/{tarjeta_id}")
def update_tarjeta(tarjeta_id: int, body: TarjetaIn,
                   uid=Depends(get_usuario_id), conn=Depends(get_conn)):
    cur = conn.cursor()
    cur.execute("""
        UPDATE TARJETAS_CREDITO
        SET LIMITE_CREDITO=:lim_val, DIA_CORTE=:dc_val,
            DIAS_PARA_PAGO=:dp_val, TASA_ANUAL=:tasa_val
        WHERE ID=:id_val AND USUARIO_ID=:uid_val
    """, lim_val=body.limite_credito, dc_val=body.dia_corte,
         dp_val=body.dias_para_pago, tasa_val=body.tasa_anual,
         id_val=tarjeta_id, uid_val=uid)
    conn.commit()
    return {"ok": True}

@app.delete("/api/tarjetas/{tarjeta_id}")
def delete_tarjeta(tarjeta_id: int, uid=Depends(get_usuario_id), conn=Depends(get_conn)):
    cur = conn.cursor()
    cur.execute(
        "UPDATE TARJETAS_CREDITO SET ACTIVO=0 WHERE ID=:id_val AND USUARIO_ID=:uid_val",
        id_val=tarjeta_id, uid_val=uid
    )
    conn.commit()
    return {"ok": True}

@app.get("/api/tarjetas/{tarjeta_id}/estados")
def get_estados(tarjeta_id: int, uid=Depends(get_usuario_id), conn=Depends(get_conn)):
    cur = conn.cursor()
    cur.execute("""
        SELECT E.ID, E.TARJETA_ID, E.ANIO, E.MES,
               E.FECHA_CORTE, E.FECHA_LIMITE,
               E.ADEUDO_ANTERIOR, E.CARGOS_REGULARES, E.CARGOS_MESES,
               E.INTERESES, E.COMISIONES, E.IVA,
               E.PAGO_MINIMO, E.PAGO_PNGI, E.PAGO_REAL,
               E.SALDO_REGULAR, E.SALDO_MESES, E.DEUDOR_TOTAL, E.NOTAS
        FROM ESTADOS_TARJETA E
        JOIN TARJETAS_CREDITO T ON T.ID = E.TARJETA_ID
        WHERE E.TARJETA_ID=:tid_val AND T.USUARIO_ID=:uid_val
        ORDER BY E.ANIO DESC, E.MES DESC
        FETCH FIRST 24 ROWS ONLY
    """, tid_val=tarjeta_id, uid_val=uid)
    return rows_to_dict(cur)

@app.post("/api/tarjetas/{tarjeta_id}/estados", status_code=201)
def upsert_estado(tarjeta_id: int, body: EstadoTarjetaIn,
                  uid=Depends(get_usuario_id), conn=Depends(get_conn)):
    cur = conn.cursor()
    cur.execute(
        "SELECT ID FROM TARJETAS_CREDITO WHERE ID=:id_val AND USUARIO_ID=:uid_val AND ACTIVO=1",
        id_val=tarjeta_id, uid_val=uid
    )
    if not cur.fetchone():
        raise HTTPException(status_code=404, detail="Tarjeta no encontrada")

    saldo_reg = body.saldo_regular if body.saldo_regular is not None else round(
        body.adeudo_anterior + body.cargos_regulares + body.intereses +
        body.comisiones + body.iva - (body.pago_real or 0), 2
    )
    saldo_msi = body.saldo_meses if body.saldo_meses is not None else body.cargos_meses
    deudor    = body.deudor_total if body.deudor_total is not None else round(saldo_reg + saldo_msi, 2)
    fc_val    = str(body.fecha_corte)  if body.fecha_corte  else None
    fl_val    = str(body.fecha_limite) if body.fecha_limite else None

    cur.execute("""
        MERGE INTO ESTADOS_TARJETA e
        USING DUAL ON (e.TARJETA_ID=:tid_val AND e.ANIO=:anio_val AND e.MES=:mes_val)
        WHEN MATCHED THEN UPDATE SET
            FECHA_CORTE=TO_DATE(:fc_val,'YYYY-MM-DD'),
            FECHA_LIMITE=TO_DATE(:fl_val,'YYYY-MM-DD'),
            ADEUDO_ANTERIOR=:aa_val, CARGOS_REGULARES=:cr_val,
            CARGOS_MESES=:cm_val,   INTERESES=:int_val,
            COMISIONES=:com_val,    IVA=:iva_val,
            PAGO_MINIMO=:pm_val,    PAGO_PNGI=:pp_val,
            PAGO_REAL=:pr_val,      TASA=:tasa_val,
            SALDO_REGULAR=:sr_val,  SALDO_MESES=:sm_val,
            DEUDOR_TOTAL=:dt_val,   NOTAS=:notas_val
        WHEN NOT MATCHED THEN INSERT
            (USUARIO_ID,TARJETA_ID,ANIO,MES,
             FECHA_CORTE,FECHA_LIMITE,
             ADEUDO_ANTERIOR,CARGOS_REGULARES,CARGOS_MESES,
             INTERESES,COMISIONES,IVA,
             PAGO_MINIMO,PAGO_PNGI,PAGO_REAL,
             TASA,SALDO_REGULAR,SALDO_MESES,DEUDOR_TOTAL,NOTAS)
        VALUES
            (:uid_val,:tid_val,:anio_val,:mes_val,
             TO_DATE(:fc_val,'YYYY-MM-DD'),TO_DATE(:fl_val,'YYYY-MM-DD'),
             :aa_val,:cr_val,:cm_val,:int_val,:com_val,:iva_val,
             :pm_val,:pp_val,:pr_val,:tasa_val,:sr_val,:sm_val,:dt_val,:notas_val)
    """,
    uid_val=uid, tid_val=tarjeta_id, anio_val=body.anio, mes_val=body.mes,
    fc_val=fc_val, fl_val=fl_val,
    aa_val=body.adeudo_anterior,  cr_val=body.cargos_regulares,
    cm_val=body.cargos_meses,     int_val=body.intereses,
    com_val=body.comisiones,      iva_val=body.iva,
    pm_val=body.pago_minimo,      pp_val=body.pago_pngi,
    pr_val=body.pago_real,        tasa_val=body.tasa,
    sr_val=saldo_reg,             sm_val=saldo_msi,
    dt_val=deudor,                notas_val=body.notas)
    conn.commit()
    return {"ok": True, "deudor_total": deudor}

# ════════════════════════════════════════
#  ADMIN
# ════════════════════════════════════════
@app.get("/api/admin/sesiones")
def get_sesiones(uid=Depends(get_usuario_id), conn=Depends(get_conn)):
    if uid != ADMIN_ID:
        raise HTTPException(status_code=403, detail="Acceso denegado")
    cur = conn.cursor()
    cur.execute("""
        SELECT S.ID, S.USUARIO_ID, S.EMAIL, S.NOMBRE, S.DEVICE, S.IP,
               S.LOGIN_AT, S.LAST_SEEN_AT, S.LOGOUT_AT, S.ACTIVA
        FROM SESIONES S
        ORDER BY S.LOGIN_AT DESC
        FETCH FIRST 200 ROWS ONLY
    """)
    return rows_to_dict(cur)

@app.get("/api/admin/usuarios")
def get_usuarios_admin(uid=Depends(get_usuario_id), conn=Depends(get_conn)):
    if uid != ADMIN_ID:
        raise HTTPException(status_code=403, detail="Acceso denegado")
    cur = conn.cursor()
    cur.execute("""
        SELECT U.ID, U.NOMBRE, U.EMAIL, U.ACTIVO,
               MAX(S.LOGIN_AT)     AS ULTIMO_LOGIN,
               MAX(S.LAST_SEEN_AT) AS ULTIMO_SEEN,
               COUNT(S.ID)         AS TOTAL_SESIONES
        FROM USUARIOS U
        LEFT JOIN SESIONES S ON S.USUARIO_ID = U.ID
        GROUP BY U.ID, U.NOMBRE, U.EMAIL, U.ACTIVO
        ORDER BY ULTIMO_LOGIN DESC NULLS LAST
    """)
    return rows_to_dict(cur)

@app.post("/api/admin/sesiones/ping")
def session_ping(request: Request, uid=Depends(get_usuario_id), conn=Depends(get_conn)):
    cur = conn.cursor()
    cur.execute("""
        UPDATE SESIONES SET LAST_SEEN_AT = SYSTIMESTAMP
        WHERE USUARIO_ID = :uid_val AND ACTIVA = 1
        AND LOGIN_AT = (
            SELECT MAX(LOGIN_AT) FROM SESIONES WHERE USUARIO_ID = :uid_val2
        )
    """, uid_val=uid, uid_val2=uid)
    conn.commit()
    return {"ok": True}

# ════════════════════════════════════════
#  PATRIMONIO
# ════════════════════════════════════════
class SaldoItem(BaseModel):
    cuenta_id   : int
    saldo       : float
    moneda      : str = "MXN"
    tasa_cambio : float = 1.0
    notas       : str = ""

class SaldosMesIn(BaseModel):
    anio   : int
    mes    : int
    saldos : List[SaldoItem]

class PatrimonioCuentaIn(BaseModel):
    categoria_liq : Optional[str] = None
    opera_gastos  : int           = 1

@app.put("/api/patrimonio/cuentas/{cuenta_id}")
def update_cuenta_patrimonio(cuenta_id: int, body: PatrimonioCuentaIn,
                              uid=Depends(get_usuario_id), conn=Depends(get_conn)):
    cur = conn.cursor()
    cur.execute("""
        UPDATE CUENTAS
        SET CATEGORIA_LIQ=:cat_val, OPERA_GASTOS=:opera_val
        WHERE ID=:id_val AND USUARIO_ID=:uid_val
    """, cat_val=body.categoria_liq or None,
         opera_val=body.opera_gastos,
         id_val=cuenta_id, uid_val=uid)
    conn.commit()
    return {"ok": True}

@app.get("/api/patrimonio/cuentas")
def patrimonio_cuentas(uid=Depends(get_usuario_id), conn=Depends(get_conn)):
    cur = conn.cursor()
    cur.execute("""
        SELECT ID, NOMBRE, BANCO, MONEDA, CATEGORIA_LIQ
        FROM CUENTAS
        WHERE USUARIO_ID=:uid_val AND ACTIVO=1
          AND CATEGORIA_LIQ IS NOT NULL
        ORDER BY CATEGORIA_LIQ, NOMBRE
    """, uid_val=uid)
    return rows_to_dict(cur)

@app.get("/api/patrimonio/saldos")
def patrimonio_saldos_periodo(
    anio: int, mes: int,
    uid=Depends(get_usuario_id), conn=Depends(get_conn)
):
    cur = conn.cursor()
    cur.execute("""
        SELECT SM.CUENTA_ID, SM.SALDO, SM.MONEDA, SM.TASA_CAMBIO,
               NVL(SM.SALDO_MXN, SM.SALDO) AS SALDO_MXN, SM.NOTAS,
               C.NOMBRE AS CUENTA_NOMBRE, C.CATEGORIA_LIQ
        FROM SALDOS_MES SM
        JOIN CUENTAS C ON C.ID = SM.CUENTA_ID
        WHERE SM.USUARIO_ID=:uid_val AND SM.ANIO=:anio_val AND SM.MES=:mes_val
        ORDER BY C.CATEGORIA_LIQ, C.NOMBRE
    """, uid_val=uid, anio_val=anio, mes_val=mes)
    return rows_to_dict(cur)

@app.get("/api/patrimonio/saldos/ultimo-mes")
def patrimonio_ultimo_mes(uid=Depends(get_usuario_id), conn=Depends(get_conn)):
    cur = conn.cursor()
    cur.execute("""
        SELECT SM.CUENTA_ID, SM.SALDO, SM.MONEDA, SM.TASA_CAMBIO
        FROM SALDOS_MES SM
        WHERE SM.USUARIO_ID = :uid_val
          AND (SM.ANIO, SM.MES) = (
              SELECT ANIO, MES FROM SALDOS_MES
              WHERE USUARIO_ID = :uid_val2
              ORDER BY ANIO DESC, MES DESC
              FETCH FIRST 1 ROWS ONLY
          )
    """, uid_val=uid, uid_val2=uid)
    saldos = [{"cuenta_id": r[0], "saldo": float(r[1] or 0),
               "moneda": r[2], "tasa_cambio": float(r[3] or 1)} for r in cur.fetchall()]
    return {"saldos": saldos}

@app.post("/api/patrimonio/saldos/mes", status_code=201)
def patrimonio_guardar_mes(body: SaldosMesIn, uid=Depends(get_usuario_id), conn=Depends(get_conn)):
    cur = conn.cursor()
    for item in body.saldos:
        saldo_mxn = round(item.saldo * item.tasa_cambio, 2)
        cur.execute("""
            MERGE INTO SALDOS_MES sm
            USING DUAL ON (sm.USUARIO_ID=:uid_val AND sm.CUENTA_ID=:cta_val
                           AND sm.ANIO=:anio_val AND sm.MES=:mes_val)
            WHEN MATCHED THEN
                UPDATE SET SALDO=:saldo_val, MONEDA=:mon_val,
                           TASA_CAMBIO=:tasa_val, SALDO_MXN=:mxn_val,
                           NOTAS=:notas_val
            WHEN NOT MATCHED THEN
                INSERT (USUARIO_ID, CUENTA_ID, ANIO, MES, SALDO, MONEDA,
                        TASA_CAMBIO, SALDO_MXN, NOTAS)
                VALUES (:uid_val, :cta_val, :anio_val, :mes_val, :saldo_val,
                        :mon_val, :tasa_val, :mxn_val, :notas_val)
        """, uid_val=uid, cta_val=item.cuenta_id, anio_val=body.anio, mes_val=body.mes,
             saldo_val=item.saldo, mon_val=item.moneda, tasa_val=item.tasa_cambio,
             mxn_val=saldo_mxn, notas_val=item.notas)
    conn.commit()
    return {"ok": True}

@app.get("/api/patrimonio/resumen")
def patrimonio_resumen(uid=Depends(get_usuario_id), conn=Depends(get_conn)):
    cur = conn.cursor()
    # Último período capturado
    cur.execute("""
        SELECT ANIO, MES FROM SALDOS_MES WHERE USUARIO_ID=:uid_val
        ORDER BY ANIO DESC, MES DESC FETCH FIRST 1 ROWS ONLY
    """, uid_val=uid)
    ultimo = cur.fetchone()
    if not ultimo:
        return {"sin_datos": True}

    anio, mes = ultimo

    # Totales por categoría del último período
    cur.execute("""
        SELECT C.CATEGORIA_LIQ, SUM(NVL(SM.SALDO_MXN, SM.SALDO)) AS TOTAL_MXN
        FROM SALDOS_MES SM
        JOIN CUENTAS C ON C.ID = SM.CUENTA_ID
        WHERE SM.USUARIO_ID=:uid_val AND SM.ANIO=:anio_val AND SM.MES=:mes_val
          AND C.CATEGORIA_LIQ IS NOT NULL
        GROUP BY C.CATEGORIA_LIQ
    """, uid_val=uid, anio_val=anio, mes_val=mes)
    por_cat = {r[0]: float(r[1] or 0) for r in cur.fetchall()}
    patrimonio_bruto = sum(por_cat.values())

    # Período anterior para calcular variación
    mes_ant = mes - 1 if mes > 1 else 12
    anio_ant = anio if mes > 1 else anio - 1
    cur.execute("""
        SELECT NVL(SUM(NVL(SM.SALDO_MXN, SM.SALDO)), 0)
        FROM SALDOS_MES SM
        WHERE SM.USUARIO_ID=:uid_val AND SM.ANIO=:anio_val AND SM.MES=:mes_val
    """, uid_val=uid, anio_val=anio_ant, mes_val=mes_ant)
    row = cur.fetchone()
    total_anterior = float(row[0]) if row else 0
    variacion_pct = None
    if total_anterior > 0:
        variacion_pct = round(((patrimonio_bruto - total_anterior) / total_anterior) * 100, 2)

    # Préstamos otorgados pendientes
    cur.execute("""
        SELECT NVL(SUM(CAPITAL_ORIGINAL - CAPITAL_RECUPERADO), 0)
        FROM PRESTATARIOS
        WHERE USUARIO_ID=:uid_val AND ESTATUS='Activo'
    """, uid_val=uid)
    row = cur.fetchone()
    prestamos_otorgados = float(row[0]) if row else 0

    return {
        "sin_datos"           : False,
        "anio"                : anio,
        "mes"                 : mes,
        "patrimonio_bruto"    : patrimonio_bruto,
        "variacion_pct"       : variacion_pct,
        "por_categoria"       : por_cat,
        "prestamos_otorgados" : prestamos_otorgados,
    }

@app.get("/api/patrimonio/evolucion")
def patrimonio_evolucion(uid=Depends(get_usuario_id), conn=Depends(get_conn)):
    cur = conn.cursor()
    cur.execute("""
        SELECT TO_CHAR(SM.ANIO) || '-' ||
               LPAD(TO_CHAR(SM.MES), 2, '0') AS PERIODO,
               C.CATEGORIA_LIQ,
               SUM(NVL(SM.SALDO_MXN, SM.SALDO)) AS TOTAL_MXN
        FROM SALDOS_MES SM
        JOIN CUENTAS C ON C.ID = SM.CUENTA_ID
        WHERE SM.USUARIO_ID=:uid_val AND C.CATEGORIA_LIQ IS NOT NULL
        GROUP BY SM.ANIO, SM.MES, C.CATEGORIA_LIQ
        ORDER BY SM.ANIO, SM.MES, C.CATEGORIA_LIQ
    """, uid_val=uid)
    return [{"periodo": r[0], "categoria_liq": r[1], "total_mxn": float(r[2] or 0)}
            for r in cur.fetchall()]