# AmbarCRM — Modelo de datos

Single-tenant (instancia por cliente). Sin `org_id`. Postgres 16.

## Mapa de entidades

```
usuarios ──< oportunidades >── etapas >── embudos
   │              │   │
   │              │   └──< eventos (timeline)
   │              │   └──< notas
   │              │   └──< tareas
   │              └── contactos ──< conversaciones ──< mensajes
   │                      │
   │                      └──< contacto_etiquetas >── etiquetas
   └── (responsable de contactos / oportunidades / conversaciones)

canales_whatsapp ──< conversaciones   (qué número/proveedor atiende el chat)
plantillas_mensaje                     (respuestas rápidas / templates)
```

## Entidades

### `usuarios` — agentes/vendedores
Login del CRM. Roles: `admin` (ve y configura todo) y `agente` (ve lo asignado).
Campos: `id, nombre, email (unique), password_hash, rol, avatar_url, activo, created_at`.

### `embudos` — pipelines
Un cliente puede tener varios embudos (Ventas, Postventa, Soporte…).
`id, nombre, descripcion, color, orden, activo, created_at`.

### `etapas` — columnas del kanban
Pertenecen a un embudo, ordenadas. `tipo` marca las columnas terminales.
`id, embudo_id FK, nombre, color, orden, tipo (normal|ganado|perdido), created_at`.

### `contactos` — leads / personas
La persona. `telefono` es la llave natural de WhatsApp (normalizado E.164).
`id, nombre, telefono (unique), email, empresa, avatar_url, fuente (whatsapp|manual|meta_ads|web|otro),
notas, responsable_id FK usuarios, created_at, updated_at`.

### `etiquetas` + `contacto_etiquetas`
Tags de colores reutilizables (m2m con contactos).
`etiquetas: id, nombre (unique), color`. `contacto_etiquetas: contacto_id, etiqueta_id`.

### `oportunidades` — las TARJETAS del kanban
El "deal". Liga un contacto a una etapa de un embudo, con valor y posición.
`id, contacto_id FK, embudo_id FK, etapa_id FK, titulo, valor (numeric), moneda,
responsable_id FK, orden (posición dentro de la etapa), estado (abierto|ganado|perdido),
motivo_perdida, fecha_cierre_estimada, created_at, updated_at, closed_at`.
> El **drag&drop** del kanban cambia `etapa_id` + `orden` y, si la etapa es ganado/perdido, `estado`+`closed_at`.

### `conversaciones` — hilos de chat
Una por contacto y canal. Lleva el contador de no leídos y la marca del último mensaje (para ordenar la bandeja).
`id, contacto_id FK, canal_id FK canales_whatsapp, estado (abierta|pendiente|cerrada),
responsable_id FK, no_leidos, ultimo_mensaje_at, created_at`.

### `mensajes`
`wa_message_id` da **idempotencia** (n8n puede reintentar el webhook sin duplicar).
`id, conversacion_id FK, direccion (entrante|saliente), tipo (texto|imagen|audio|video|documento|ubicacion|plantilla),
contenido, media_url, media_mime, status (pendiente|enviado|entregado|leido|fallido),
wa_message_id (unique), enviado_por FK usuarios (null = cliente/bot), timestamp, created_at`.

### `canales_whatsapp` — la abstracción de proveedor
Permite migrar Evolution → Cloud API sin tocar el resto.
`id, nombre, proveedor (evolution|cloud_api), telefono, instancia (instancia Evolution / phone_number_id Meta),
estado (conectado|desconectado), config (jsonb: urls, tokens no secretos), activo, created_at`.

### `plantillas_mensaje` — respuestas rápidas
`id, nombre, contenido, categoria, created_at`. (En la fase Meta se mapean a templates aprobados.)

### `notas`, `tareas`, `eventos` — actividad sobre la oportunidad
- `notas`: `id, oportunidad_id FK, usuario_id FK, contenido, created_at`.
- `tareas`: `id, oportunidad_id FK, responsable_id FK, titulo, descripcion, vence_at, completada, completada_at, created_at`.
- `eventos`: timeline/auditoría. `id, oportunidad_id FK, tipo, descripcion, usuario_id FK, payload (jsonb), created_at`.

## Decisiones

- **Oportunidad = tarjeta** (modelo Kommo), no el contacto. Un contacto puede tener varias oportunidades
  en distintos embudos. Más flexible que el modelo "contacto = tarjeta" de Leadsales.
- **`orden` entero por etapa** para el drag&drop. Reordenamientos espaciados (10,20,30…) para insertar sin renumerar todo.
- **`wa_message_id` único** para idempotencia de webhooks.
- **`canales_whatsapp` separado** = el corazón de la migración Evolution→Meta.
- **Realtime por `LISTEN/NOTIFY`**: al insertar un mensaje se hace `NOTIFY nuevo_mensaje` con el `conversacion_id`.
