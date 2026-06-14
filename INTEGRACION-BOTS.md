# AmbarCRM — Bots de n8n (compatible con Chatwoot)

El CRM implementa el mismo modelo de **Agent Bot de Chatwoot**: cada bot tiene un **webhook
saliente** (el CRM le manda los mensajes entrantes) y un **token** con el que el bot responde
llamando a una API con el mismo formato que Chatwoot.

> Resultado: un workflow de n8n hecho para Chatwoot (como el "Agente principal de Belisario")
> se migra a AmbarCRM **cambiando solo el nodo `⚙️ Configuración`** y la URL del webhook.

```
ENTRANTE:  WhatsApp → Evolution → n8n → /api/wa/webhook → CRM
                                                           └─→ POST webhook del bot (message_created)
RESPUESTA: bot (n8n) → POST /api/v1/accounts/1/conversations/{id}/messages → Evolution → WhatsApp
HANDOFF:   bot (n8n) → POST /api/v1/accounts/1/conversations/{id}/labels (escalado_humano) → bot OFF
```

## 1. Crear el bot en el CRM

**Configuración → Bots → + Crear bot:**
- **Nombre**: identificador interno.
- **Canal**: a qué canal aplica (o "Todos").
- **Webhook URL**: la *Production URL* del nodo Webhook de tu workflow en n8n.

Al guardarlo, el CRM muestra el **token** (`api_access_token`) y los endpoints para responder.

## 2. Qué recibe el bot (CRM → n8n)

En cada mensaje entrante, si el bot está activo y la conversación no está en handoff, el CRM
hace `POST` al webhook con un payload estilo Chatwoot `message_created`:

```json
{
  "event": "message_created",
  "message_type": "incoming",
  "content": "hola, quiero una cita",
  "conversation": {
    "id": 12,
    "status": "open",
    "labels": [],
    "meta": { "sender": { "identifier": "5219611234567", "name": "Juan", "phone_number": "+5219611234567" } }
  },
  "sender": { "identifier": "5219611234567", "name": "Juan", "phone_number": "+5219611234567" },
  "attachments": [{ "file_type": "imagen", "data_url": "https://crm.tudominio.com/api/media/...jpg" }],
  "account": { "id": 1 },
  "ambarcrm": {
    "conversacionId": "12",
    "telefono": "5219611234567",
    "responder_url": "https://crm.tudominio.com/api/v1/accounts/1/conversations/12/messages",
    "handoff_url":   "https://crm.tudominio.com/api/v1/accounts/1/conversations/12/labels"
  }
}
```

> Los adjuntos (`data_url`) se descargan con el header `api_access_token` (igual que en Chatwoot).
> El bloque `ambarcrm` es un atajo opcional con las URLs ya listas para responder.

## 3. Cómo responde el bot (n8n → CRM)

`POST {CRM}/api/v1/accounts/1/conversations/{conversationId}/messages`
- Header: `api_access_token: <token del bot>`
- Body: `{ "content": "¡Hola! claro, ¿para qué día?", "message_type": "outgoing" }`
- Nota interna (no se manda a WhatsApp): agrega `"private": true`.

El CRM lo envía por el canal (Evolution) y lo registra como saliente del bot.

## 3.b Mover el lead en el embudo (tool `actualizar_funnel`)

Cada contacto nuevo entra **automáticamente como lead** en la primera etapa del embudo
(se puede apagar en Configuración → Automatizaciones). El bot lo mueve de etapa así:

`POST {CRM}/api/v1/accounts/1/conversations/{conversationId}/funnel`
- Header: `api_access_token: <token>`
- Body: `{ "etapa": "Contactado" }`

Busca la etapa por nombre en el embudo principal. Si la etapa es de tipo `ganado`/`perdido`,
marca la oportunidad como cerrada. Si el contacto aún no tiene oportunidad, la crea.

## 3.c Releer si el bot está ON/OFF

`GET {CRM}/api/v1/accounts/1/conversations/{conversationId}` (header `api_access_token`)
devuelve `{ status, bot_activo, labels }`. El workflow puede checar `labels` (igual que el
`If Bot On` de Chatwoot: si trae `bot_off` no responde).

## 4. Handoff (ceder a humano)

`POST {CRM}/api/v1/accounts/1/conversations/{conversationId}/labels`
- Header: `api_access_token: <token>`
- Body: `{ "labels": ["escalado_humano"] }`

Eso **apaga el bot** en esa conversación (`bot_activo = false`) y la deja `pendiente` para que
un agente la tome. El mismo efecto tiene el toggle **🤖 Bot** del panel del chat. Para reactivarlo,
manda `{ "labels": [] }` o vuelve a prender el toggle.

## 5. Migrar un bot existente de Chatwoot

En el nodo `⚙️ Configuración` del workflow:
| Campo | Antes (Chatwoot) | Ahora (AmbarCRM) |
|-------|------------------|------------------|
| `cfg_serverUrl` | `https://chat.cliente.com` | URL del CRM |
| `cfg_accountId` | id de cuenta | `1` |
| `cfg_apiToken` | token de Chatwoot | **token del bot** (Configuración → Bots) |

Y registra el webhook al revés: en lugar de configurarlo en Chatwoot, pega la URL del nodo
Webhook de n8n en el campo **Webhook URL** del bot en el CRM. El resto del workflow (Redis,
AI Agent, tools, `escalar_a_humano`) funciona igual.

## Endpoints (resumen)

| Método | Ruta | Auth | Para qué |
|--------|------|------|----------|
| POST | `/api/v1/accounts/1/conversations/{id}/messages` | `api_access_token` | El bot responde |
| POST | `/api/v1/accounts/1/conversations/{id}/funnel` | `api_access_token` | Mover el lead de etapa |
| POST | `/api/v1/accounts/1/conversations/{id}/labels` | `api_access_token` | Handoff a humano |
| GET | `/api/v1/accounts/1/conversations/{id}` | `api_access_token` | Releer estado/labels (on-off) |
| GET | `/api/media/{archivo}` | `api_access_token` o sesión | Descargar adjuntos |
| POST | `/api/cron/auto-resolver` | `x-api-key` (WA_API_KEY) | Cerrar chats inactivos (n8n Schedule) |

## Auto-resolver inactivos (cron desde n8n)

Si activas "Auto-resolver chats inactivos" en Configuración → Automatizaciones, programa en n8n un
**Schedule Trigger** (p. ej. cada hora) → **HTTP Request**:
- `POST {CRM}/api/cron/auto-resolver`
- Header: `x-api-key: <WA_API_KEY>`

Cierra las conversaciones sin actividad según las horas configuradas.

## Variables de entorno nuevas

| Variable | Para qué |
|----------|----------|
| `ANTHROPIC_API_KEY` | Sugerencias de respuesta con IA (botón ✨ del chat) |
| `ANTHROPIC_MODEL` | Opcional. Default `claude-haiku-4-5-20251001` |
