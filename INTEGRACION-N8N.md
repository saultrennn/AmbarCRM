# AmbarCRM — Integración con n8n + Evolution API

n8n es el puente entre WhatsApp (Evolution) y el CRM. El CRM **no** habla directo con Evolution
para recibir: Evolution → webhook → n8n → CRM. Para **enviar**, el CRM sí llama a Evolution
directo (capa de canal). Esto te deja meter lógica/IA en medio cuando quieras.

```
RECIBIR:  WhatsApp → Evolution (webhook) → n8n → POST /api/wa/webhook  (x-api-key)
ENVIAR:   Agente escribe en el CRM → POST /api/mensajes/enviar → Evolution → WhatsApp
```

## 1. Recibir mensajes (entrantes)

**Workflow n8n mínimo:**
1. **Webhook** node (POST) — pega esta URL en la config de webhooks de tu instancia Evolution
   (evento `messages.upsert`).
2. **HTTP Request** node:
   - Método: `POST`
   - URL: `https://<dominio-crm>/api/wa/webhook?canal=1`
   - Headers: `x-api-key: <WA_API_KEY>` (el de tu `.env`)
   - Body: `={{ $json }}` (reenvía el payload tal cual; el CRM lo normaliza con `EvolutionProvider`)

> El CRM es **idempotente** (campo `wa_message_id`): si n8n reintenta, no se duplica el mensaje.
> El `?canal=1` indica qué canal/instancia atendió el mensaje (id de la tabla `canales_whatsapp`).

### Alternativa sin n8n
Si no quieres lógica intermedia, apunta el webhook de Evolution **directo** a
`/api/wa/webhook?canal=1` con el header `x-api-key`. Funciona igual.

## 1.b Vincular el número (conexión por QR)

El CRM ya crea la instancia de Evolution y muestra el QR; **no hace falta entrar al panel de
Evolution**. En el CRM: **Configuración → Canal WhatsApp → Conexión → "Conectar WhatsApp"**.

- Crea la instancia si no existe (`POST /instance/create`, idempotente).
- Muestra el QR (y un código de emparejamiento por si no hay cámara). Escanéalo desde
  WhatsApp → *Dispositivos vinculados*.
- El estado se verifica solo cada 3 s contra Evolution (`/instance/connectionState`) y se
  guarda en `canales_whatsapp.estado`. Ya no se pone a mano.

Si el canal no tenía nombre de instancia, el CRM usa `EVOLUTION_INSTANCE` del `.env` y lo
persiste. Esa misma instancia es la que usan los envíos.

## 2. Enviar mensajes (salientes)

Lo hace el CRM solo cuando un agente escribe en la bandeja. Configura en el `.env`:
```
EVOLUTION_API_URL=https://evolution.tudominio.com
EVOLUTION_API_KEY=<apikey global de Evolution>
EVOLUTION_INSTANCE=<nombre de la instancia>
```

## 3. Migrar a coexistencia oficial de Meta (fase posterior)

Cuando toque, NO se reescribe nada de arriba:
1. Crear un registro en `canales_whatsapp` con `proveedor='cloud_api'`.
2. Llenar `CLOUD_API_TOKEN`, `CLOUD_API_PHONE_NUMBER_ID` en el `.env`.
3. Apuntar el webhook de Meta a `/api/wa/webhook?canal=<id del canal cloud_api>`.
El CRM usará automáticamente `CloudApiProvider` para normalizar y enviar.

## Variables relevantes
| Variable | Para qué |
|----------|----------|
| `WA_API_KEY` | Clave que n8n manda en `x-api-key` al llamar `/api/wa/webhook` |
| `EVOLUTION_API_URL/KEY/INSTANCE` | Envío de mensajes vía Evolution |
| `CLOUD_API_*` | Fase Meta (coexistencia oficial) |
