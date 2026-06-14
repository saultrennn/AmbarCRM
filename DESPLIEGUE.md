# AmbarCRM — Despliegue

## A) Correr en local (para probar)

Requisitos: Docker Desktop **o** Node 22 + un Postgres local.

### Opción rápida con Docker (todo junto)
```bash
cd AmbarCRM
cp .env.example .env        # edita las claves
docker compose up -d --build
```
- App en http://localhost:3000
- La primera vez, Postgres crea las tablas desde `schema.sql` automáticamente.

### Crear el usuario admin (con contraseña real)
El `schema.sql` siembra un admin con un hash de ejemplo que **no** sirve para entrar.
Crea uno real ejecutando el seed dentro del contenedor de la app:
```bash
docker compose exec app node scripts/seed-admin.mjs "Tu Nombre" admin@tudominio.com "TuContraseña"
```
Entra en http://localhost:3000/login con ese correo y contraseña.

### Opción sin Docker (solo la app, BD aparte)
```bash
cd AmbarCRM/web
cp .env.example .env        # apunta DATABASE_URL a tu Postgres
npm install
npx prisma db push          # crea tablas desde schema.prisma
npm run seed:admin -- "Tu Nombre" admin@tudominio.com "TuContraseña"
npm run dev
```

---

## B) Desplegar en EasyPanel (VPS)

Mismo patrón que GestorLegal.

1. **Sube `AmbarCRM/` como repo** (o como Compose pegando el `docker-compose.yml`).
2. En EasyPanel crea un servicio tipo **Compose** apuntando a este proyecto.
3. En **Environment**, pon las variables del `.env.example` (genera `NEXTAUTH_SECRET` con
   `openssl rand -base64 32` y una `WA_API_KEY` larga).
4. **Deploy.** Postgres crea el esquema en el primer arranque.
5. Asigna un **dominio** al servicio `app` → puerto **3000** (EasyPanel pone el HTTPS).
6. Pon ese dominio en `NEXTAUTH_URL`.
7. Crea el admin real:
   ```bash
   docker compose exec app node scripts/seed-admin.mjs "Admin" admin@tudominio.com "ClaveFuerte"
   ```

> **Backups**: programa `pg_dump` del servicio `db` (igual que en GestorLegal).

---

## C) Conectar WhatsApp (n8n + Evolution)

Ver `INTEGRACION-N8N.md`. Resumen:
- **Recibir**: Evolution → n8n → `POST https://crm.tudominio.com/api/wa/webhook?canal=1`
  con header `x-api-key: <WA_API_KEY>`.
- **Enviar**: lo hace el CRM solo (variables `EVOLUTION_*`).
- En **Configuración → Canal WhatsApp** ajusta nombre/teléfono/instancia y el estado.

---

## Notas
- El chat en vivo usa **SSE** (`/api/stream`) sobre una conexión Postgres `LISTEN/NOTIFY`;
  funciona detrás del proxy de EasyPanel sin configuración extra.
- Para migrar a **coexistencia oficial de Meta**: cambia el canal a `proveedor=cloud_api`,
  llena `CLOUD_API_*` y apunta el webhook de Meta a `/api/wa/webhook?canal=<id>`. Nada más cambia.
