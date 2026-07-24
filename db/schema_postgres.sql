-- ============================================================
--  MIS FINANZAS — Esquema de base de datos (PostgreSQL)
--  Traducido a mano desde db/schema.sql (Oracle), mismas 16 tablas
--  y mismo orden de dependencias (padres antes que hijos).
-- ============================================================

CREATE SCHEMA IF NOT EXISTS misgastos;
SET search_path TO misgastos;

-- ── TABLAS ──────────────────────────────────────────────────

-- USUARIOS
CREATE TABLE usuarios (
    id                     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre                 VARCHAR(100) NOT NULL,
    email                  VARCHAR(200) NOT NULL UNIQUE,
    password_hash          VARCHAR(256) NOT NULL,
    activo                 SMALLINT NOT NULL DEFAULT 1 CHECK (activo IN (0,1)),
    created_at             TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMP NOT NULL DEFAULT NOW(),
    onboarding_completado  SMALLINT NOT NULL DEFAULT 0
);

-- CATEGORIAS
CREATE TABLE categorias (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id   BIGINT NOT NULL,
    nombre       VARCHAR(100) NOT NULL,
    emoji        VARCHAR(40),
    color        VARCHAR(7) DEFAULT '#888780' CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
    es_sistema   SMALLINT NOT NULL DEFAULT 0 CHECK (es_sistema IN (0,1)),
    activo       SMALLINT NOT NULL DEFAULT 1 CHECK (activo IN (0,1)),
    created_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

-- CUENTAS
CREATE TABLE cuentas (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id      BIGINT NOT NULL,
    nombre          VARCHAR(100) NOT NULL,
    banco           VARCHAR(100),
    tipo_pago       VARCHAR(50) NOT NULL CHECK (tipo_pago IN (
                        'Efectivo','Tarjeta débito','Tarjeta crédito',
                        'Transferencia','CoDi','Casa de bolsa',
                        'Crypto','Ahorro','Plan de pensión','Otros'
                    )),
    moneda          VARCHAR(10) NOT NULL DEFAULT 'MXN',
    color           VARCHAR(7) DEFAULT '#888780' CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
    activo          SMALLINT NOT NULL DEFAULT 1 CHECK (activo IN (0,1)),
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    opera_gastos    SMALLINT DEFAULT 1,
    categoria_liq   VARCHAR(30)
);

-- DESTINATARIOS
CREATE TABLE destinatarios (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id   BIGINT NOT NULL,
    nombre       VARCHAR(100) NOT NULL,
    emoji        VARCHAR(40),
    color        VARCHAR(7) DEFAULT '#888780',
    activo       SMALLINT NOT NULL DEFAULT 1 CHECK (activo IN (0,1)),
    created_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ESTADOS_TARJETA
CREATE TABLE estados_tarjeta (
    id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id         BIGINT NOT NULL,
    tarjeta_id         BIGINT NOT NULL,
    anio               SMALLINT NOT NULL,
    mes                SMALLINT NOT NULL,
    fecha_corte        DATE,
    fecha_limite       DATE,
    adeudo_anterior    NUMERIC(18,2) DEFAULT 0,
    cargos_regulares   NUMERIC(18,2) DEFAULT 0,
    cargos_meses       NUMERIC(18,2) DEFAULT 0,
    intereses          NUMERIC(18,2) DEFAULT 0,
    comisiones         NUMERIC(18,2) DEFAULT 0,
    iva                NUMERIC(18,2) DEFAULT 0,
    pago_minimo        NUMERIC(18,2) DEFAULT 0,
    pago_pngi          NUMERIC(18,2) DEFAULT 0,
    pago_real          NUMERIC(18,2),
    tasa               NUMERIC(6,2),
    saldo_regular      NUMERIC(18,2) DEFAULT 0,
    saldo_meses        NUMERIC(18,2) DEFAULT 0,
    deudor_total       NUMERIC(18,2) DEFAULT 0,
    notas              VARCHAR(500),
    created_at         TIMESTAMP DEFAULT NOW(),
    UNIQUE (tarjeta_id, anio, mes)
);

-- FUENTES_INGRESO
CREATE TABLE fuentes_ingreso (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id   BIGINT NOT NULL,
    nombre       VARCHAR(100) NOT NULL,
    tipo         VARCHAR(50) NOT NULL CHECK (tipo IN (
                     'Salario','Renta','Inversión','Préstamo','Otro'
                 )),
    frecuencia   VARCHAR(20) NOT NULL DEFAULT 'Variable' CHECK (frecuencia IN (
                     'Mensual','Quincenal','Semanal','Variable','Único'
                 )),
    moneda       VARCHAR(10) NOT NULL DEFAULT 'MXN',
    color        VARCHAR(7) DEFAULT '#1D9E75',
    activo       SMALLINT NOT NULL DEFAULT 1 CHECK (activo IN (0,1)),
    created_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

-- PRESTATARIOS
CREATE TABLE prestatarios (
    id                   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id           BIGINT NOT NULL,
    nombre               VARCHAR(150) NOT NULL,
    capital_original     NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (capital_original >= 0),
    capital_recuperado   NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (capital_recuperado >= 0),
    tasa_interes         NUMERIC(6,2) DEFAULT 0,
    fecha_prestamo       DATE,
    fecha_vencimiento    DATE,
    estatus              VARCHAR(20) NOT NULL DEFAULT 'Activo' CHECK (estatus IN (
                             'Activo','Liquidado','Vencido','Incobrable'
                         )),
    notas                VARCHAR(500),
    created_at           TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMP NOT NULL DEFAULT NOW(),
    activo               SMALLINT NOT NULL DEFAULT 1 CHECK (activo IN (0,1)),
    pagos_por_anio       INTEGER NOT NULL DEFAULT 12,
    numero_pagos         INTEGER
);

-- SALDOS_MES
CREATE TABLE saldos_mes (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id    BIGINT NOT NULL,
    cuenta_id     BIGINT NOT NULL,
    anio          SMALLINT NOT NULL,
    mes           SMALLINT NOT NULL,
    saldo         NUMERIC(18,2) DEFAULT 0,
    moneda        VARCHAR(3) DEFAULT 'MXN',
    tasa_cambio   NUMERIC(10,4) DEFAULT 1,
    saldo_mxn     NUMERIC(18,2),
    notas         VARCHAR(500),
    created_at    TIMESTAMP DEFAULT NOW(),
    UNIQUE (usuario_id, cuenta_id, anio, mes)
);

-- SESIONES
CREATE TABLE sesiones (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id     BIGINT NOT NULL,
    email          VARCHAR(150),
    nombre         VARCHAR(200),
    device         VARCHAR(100),
    ip             VARCHAR(45),
    login_at       TIMESTAMP DEFAULT NOW(),
    last_seen_at   TIMESTAMP DEFAULT NOW(),
    logout_at      TIMESTAMP,
    activa         SMALLINT DEFAULT 1
);

-- TARJETAS_CREDITO
CREATE TABLE tarjetas_credito (
    id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id       BIGINT NOT NULL,
    cuenta_id        BIGINT NOT NULL UNIQUE,
    limite_credito   NUMERIC(18,2) NOT NULL,
    dia_corte        SMALLINT,
    dias_para_pago   SMALLINT DEFAULT 20,
    tasa_anual       NUMERIC(6,2),
    activo           SMALLINT DEFAULT 1
);

-- TIPOS_CAMBIO
CREATE TABLE tipos_cambio (
    id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    moneda_origen    VARCHAR(10) NOT NULL,
    moneda_destino   VARCHAR(10) NOT NULL DEFAULT 'MXN',
    tasa             NUMERIC(18,6) NOT NULL,
    fuente           VARCHAR(50) NOT NULL DEFAULT 'exchangerate-api',
    fecha_consulta   TIMESTAMP NOT NULL DEFAULT NOW(),
    fecha_dia        DATE GENERATED ALWAYS AS (fecha_consulta::date) STORED
);

-- COMPRAS_MSI
CREATE TABLE compras_msi (
    id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id        BIGINT NOT NULL,
    tarjeta_id        BIGINT NOT NULL,
    adicional_id      BIGINT,
    descripcion       VARCHAR(200) NOT NULL,
    destinatario_id   BIGINT,
    monto_total       NUMERIC(18,2) NOT NULL,
    num_meses         SMALLINT NOT NULL,
    mensualidad       NUMERIC(18,2) NOT NULL,
    fecha_compra      DATE,
    primer_anio       SMALLINT NOT NULL,
    primer_mes        SMALLINT NOT NULL,
    genera_gasto      SMALLINT DEFAULT 1,
    activo            SMALLINT DEFAULT 1,
    notas             VARCHAR(300),
    created_at        TIMESTAMP DEFAULT NOW()
);

-- TARJETAS_ADICIONALES
CREATE TABLE tarjetas_adicionales (
    id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id        BIGINT NOT NULL,
    tarjeta_id        BIGINT NOT NULL,
    destinatario_id   BIGINT NOT NULL,
    terminacion       VARCHAR(4),
    activo            SMALLINT DEFAULT 1
);

-- GASTOS
CREATE TABLE gastos (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id     BIGINT NOT NULL,
    descripcion    VARCHAR(200) NOT NULL,
    monto          NUMERIC(18,2) NOT NULL CHECK (monto > 0),
    moneda         VARCHAR(10) NOT NULL DEFAULT 'MXN',
    monto_mxn      NUMERIC(18,2),
    tasa_cambio    NUMERIC(18,6) DEFAULT 1,
    fecha          DATE NOT NULL,
    categoria_id   BIGINT NOT NULL,
    cuenta_id      BIGINT NOT NULL,
    destinatario_id BIGINT,
    notas          VARCHAR(500),
    device         VARCHAR(20) DEFAULT 'web',
    created_at     TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMP NOT NULL DEFAULT NOW(),
    adicional_id   BIGINT
);

-- INGRESOS
CREATE TABLE ingresos (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id    BIGINT NOT NULL,
    descripcion   VARCHAR(200) NOT NULL,
    tipo          VARCHAR(50) NOT NULL CHECK (tipo IN (
                      'Salario','Renta','Inversión','Préstamo','Otro'
                  )),
    fuente_id     BIGINT NOT NULL,
    monto         NUMERIC(18,2) NOT NULL CHECK (monto > 0),
    moneda        VARCHAR(10) NOT NULL DEFAULT 'MXN',
    monto_mxn     NUMERIC(18,2),
    tasa_cambio   NUMERIC(18,6) DEFAULT 1,
    fecha         DATE NOT NULL,
    cuenta_id     BIGINT NOT NULL,
    notas         VARCHAR(500),
    device        VARCHAR(20) DEFAULT 'web',
    created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

-- PAGOS_PRESTAMO
CREATE TABLE pagos_prestamo (
    id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ingreso_id       BIGINT NOT NULL,
    prestatario_id   BIGINT NOT NULL,
    capital          NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (capital >= 0),
    intereses        NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (intereses >= 0),
    fecha            DATE NOT NULL,
    notas            VARCHAR(300),
    created_at       TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── LLAVES FORÁNEAS ─────────────────────────────────────────

ALTER TABLE categorias      ADD CONSTRAINT fk_cat_usuario    FOREIGN KEY (usuario_id) REFERENCES usuarios(id);
ALTER TABLE cuentas         ADD CONSTRAINT fk_cuenta_usuario  FOREIGN KEY (usuario_id) REFERENCES usuarios(id);
ALTER TABLE destinatarios   ADD CONSTRAINT fk_dest_usuario    FOREIGN KEY (usuario_id) REFERENCES usuarios(id);
ALTER TABLE fuentes_ingreso ADD CONSTRAINT fk_fuente_usuario  FOREIGN KEY (usuario_id) REFERENCES usuarios(id);
ALTER TABLE prestatarios    ADD CONSTRAINT fk_prest_usuario   FOREIGN KEY (usuario_id) REFERENCES usuarios(id);

ALTER TABLE gastos ADD CONSTRAINT fk_gasto_usuario FOREIGN KEY (usuario_id)     REFERENCES usuarios(id);
ALTER TABLE gastos ADD CONSTRAINT fk_gasto_cat      FOREIGN KEY (categoria_id)   REFERENCES categorias(id);
ALTER TABLE gastos ADD CONSTRAINT fk_gasto_cuenta    FOREIGN KEY (cuenta_id)     REFERENCES cuentas(id);
ALTER TABLE gastos ADD CONSTRAINT fk_gasto_dest      FOREIGN KEY (destinatario_id) REFERENCES destinatarios(id);

ALTER TABLE ingresos ADD CONSTRAINT fk_ing_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id);
ALTER TABLE ingresos ADD CONSTRAINT fk_ing_fuente   FOREIGN KEY (fuente_id)  REFERENCES fuentes_ingreso(id);
ALTER TABLE ingresos ADD CONSTRAINT fk_ing_cuenta   FOREIGN KEY (cuenta_id)  REFERENCES cuentas(id);

ALTER TABLE pagos_prestamo ADD CONSTRAINT fk_pago_ingreso     FOREIGN KEY (ingreso_id)     REFERENCES ingresos(id);
ALTER TABLE pagos_prestamo ADD CONSTRAINT fk_pago_prestatario FOREIGN KEY (prestatario_id) REFERENCES prestatarios(id);
