# Agente de n8n para AmbarCRM

Template base: `agente-ambarcrm.template.json`. Es la versión "general" del agente, adaptada del
**Agente principal de Belisario** (que estaba hecho para Chatwoot). Como AmbarCRM habla el mismo
dialecto que Chatwoot, migrar es básicamente cambiar el nodo de configuración y la URL del webhook.

## Flujo del template

```
Entrada AmbarCRM (webhook)
  └─ Solo entrantes (IF message_type = incoming)
       └─ Datos (extrae texto, conversacionId, urls del payload)
            └─ ⚙️ Configuración (pega el TOKEN del bot)
                 └─ AI Agent  (modelo + memoria + tools)
                      ├─ tool escalar_a_humano  → POST handoff_url (label escalado_humano)
                      ├─ tool actualizar_funnel → POST funnel_url  (mueve el lead)
                      └─ Respuesta → POST responder_url (manda el mensaje al cliente)
```

El CRM ya manda en cada mensaje un bloque `ambarcrm` con las URLs listas:
`responder_url`, `handoff_url`, `funnel_url`, además de `conversacionId`, `telefono`, `nombre`.
Por eso el template no necesita armar URLs a mano.

## Pasos

1. **Crear el bot en el CRM**: Configuración → Bots → + Crear bot. Copia el **token**.
2. **Importar** `agente-ambarcrm.template.json` en n8n (Workflows → Import from File).
3. **Webhook**: abre el nodo `Entrada AmbarCRM`, copia su **Production URL** y pégala en el campo
   *Webhook URL* del bot en el CRM. Activa el workflow.
4. **⚙️ Configuración**: pega el **token del bot** en `apiToken`.
5. **OpenAI Chat Model**: conecta tu credencial de OpenAI (y ajusta el modelo si quieres).
6. **AI Agent → System Message**: personaliza rol, servicios, precios y reglas del negocio.
7. (Opcional) Ajusta las etapas en la descripción de `actualizar_funnel` para que coincidan con
   las de tu embudo.

## Cómo responde / actúa (endpoints del CRM)

| Acción | Endpoint | Lo usa |
|--------|----------|--------|
| Responder al cliente | `POST responder_url` body `{ content, message_type: "outgoing" }` | nodo `Respuesta` |
| Ceder a humano (handoff) | `POST handoff_url` body `{ labels: ["escalado_humano"] }` | tool `escalar_a_humano` |
| Mover el lead de etapa | `POST funnel_url` body `{ etapa: "Contactado" }` | tool `actualizar_funnel` |

Todos con header `api_access_token: <token del bot>`. El CRM **solo** manda el mensaje al bot si el
bot está activo en esa conversación (el toggle 🤖 del chat / handoff lo apaga), así que el agente no
contesta cuando un humano tomó el chat.

## Migrar el Agente de Belisario (Chatwoot → AmbarCRM)

No reescribes la lógica; solo cambias los puntos de entrada/salida:

| En Belisario (Chatwoot) | En AmbarCRM |
|--------------------------|-------------|
| `EntradaChatwoot` (webhook en Chatwoot) | Webhook normal; su URL va en el campo Webhook del bot del CRM |
| `⚙️ Configuración`: `cfg_serverUrl`, `cfg_accountId`, `cfg_apiToken` | `serverUrl` = URL del CRM, `accountId` = 1, `apiToken` = token del bot |
| `Respuesta` → `/api/v1/accounts/{id}/conversations/{cid}/messages` | **mismo formato** (usa `responder_url` del payload) |
| `escalar_a_humano` (label `escalado_humano`) | **mismo** (usa `handoff_url`) |
| `actualizar_funnel` | `funnel_url` con `{ etapa }` |
| Descargar adjuntos con `api_access_token` | `data_url` del payload + header `api_access_token` |

Lo demás (Redis para debounce/lock, Whisper para audios, sub-workflows de citas, etc.) se conecta
igual; son nodos internos que no dependen del CRM.

> Nota: este template es la versión **general/mínima** (sin Redis ni tools de citas). Para un cliente
> con agenda, agrega esos nodos como en Belisario.
