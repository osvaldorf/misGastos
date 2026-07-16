# Esquema de base de datos

`schema.sql` es el DDL real de la Oracle Autonomous DB de producción (esquema `MISGASTOS`),
exportado con `DBMS_METADATA` — no se escribe a mano.

## Regenerarlo

Después de cualquier `ALTER TABLE` / `CREATE TABLE` en producción:

```
./tools/export_schema.sh
```

Requiere el contenedor `misgastos-api` corriendo (usa la misma conexión que la app).
Sobrescribe `db/schema.sql` con el estado actual — revísalo con `git diff` antes de commitear.

## Recrear la base en otro ambiente

Correr `schema.sql` completo en una Oracle DB vacía (mismo usuario/esquema `MISGASTOS`).
Las tablas están en orden de dependencias y las llaves foráneas se agregan al final,
así que un solo `sqlplus ... @db/schema.sql` (o pegarlo en SQL Developer Web) basta.

## Qué se excluyó a propósito

Solo se exportan las 16 tablas propias de la app. Se excluyen las tablas que Oracle Cloud
crea automáticamente en cualquier Autonomous DB al usar Database Actions / APEX
(`ALEMBIC_VERSION`, `ANNOTATIONS_*`, `DBTOOLS$*`, `JM_*`, `VELOIQ_*`) — no son parte del
esquema de la aplicación.
