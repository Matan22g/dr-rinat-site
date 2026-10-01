function isOwnPrivateAdminChat(message, actor = message?.from) {
  return Boolean(message?.chat?.type === 'private' && actor?.id &&
    String(message.chat.id) === String(actor.id));
}

// Authenticate every supported POST envelope before database or network actions.
async function authenticateWebhook(request, body, rawBody, env) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false;
  const crm = Object.hasOwn(body, 'crm_nudge');
  const telegram = Object.hasOwn(body, 'update_id') || Object.hasOwn(body, 'callback_query') || Object.hasOwn(body, 'message');
  const meta = Object.hasOwn(body, 'entry') || Object.hasOwn(body, 'object');
  if ([crm, telegram, meta].filter(Boolean).length !== 1) return false;
  if (crm) return Boolean(env.CRM_WEBHOOK_SECRET) &&
    request.headers.get('Authorization') === 'Bearer ' + env.CRM_WEBHOOK_SECRET;
  if (telegram) {
    if (!env.TELEGRAM_WEBHOOK_SECRET ||
        request.headers.get('X-Telegram-Bot-Api-Secret-Token') !== env.TELEGRAM_WEBHOOK_SECRET) return false;
    if (body.callback_query && body.message) return false;
    const message = body.callback_query?.message || body.message;
    const actor = body.callback_query?.from || message?.from;
    const allowed = String(env.TELEGRAM_ALLOWED_USER_IDS || '').split(',').map(id => id.trim()).filter(Boolean);
    const isClinicChat = Boolean(env.TELEGRAM_CHAT_ID) &&
      String(message?.chat?.id) === String(env.TELEGRAM_CHAT_ID);
    return Boolean(actor?.id && !actor.is_bot && !message?.sender_chat &&
      (isClinicChat || isOwnPrivateAdminChat(message, actor)) && allowed.includes(String(actor.id)));
  }
  if (!env.META_APP_SECRET || !env.PHONE_NUMBER_ID || body.object !== 'whatsapp_business_account') return false;
  const signature = request.headers.get('X-Hub-Signature-256') || '';
  if (!/^sha256=[0-9a-f]{64}$/i.test(signature)) return false;
  const bytes = Uint8Array.from(signature.slice(7).match(/../g), pair => parseInt(pair, 16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.META_APP_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  if (!await crypto.subtle.verify('HMAC', key, bytes, rawBody)) return false;
  return Array.isArray(body.entry) && body.entry.length > 0 && body.entry.every(entry =>
    Array.isArray(entry.changes) && entry.changes.length > 0 && entry.changes.every(change =>
      String(change.value?.metadata?.phone_number_id) === String(env.PHONE_NUMBER_ID)));
}

async function matchesTelegramTopic(phone, threadId, env) {
  if (!phone || !threadId) return false;
  const session = await env.SESSIONS_KV.get(phone, { type: 'json' });
  return Boolean(session?.threadId && String(session.threadId) === String(threadId));
}
// --- Fallback Config (למקרה שה-KV ריק) ---
const DEFAULT_FLOW = {
  "start": {
    "text": "שלום! ✨\nברוכה הבאה לקליניקה. במה נוכל לעזור?",
    "buttons": [{ "id": "human", "title": "שיחה עם נציג 🙋‍♀️" }]
  }
};

// --- הגדרת Cache גלובלי בזיכרון ה-Worker (לשיפור ביצועים) ---
let cachedBotFlow = null;
const HUMAN_IDLE_MS = 3 * 60 * 60 * 1000;
// --- Helper Functions ---

async function forwardAudioToTelegram(mediaId, threadId, caption, disableNotification, env) {
  try {
    const mediaRes = await fetch(`https://graph.facebook.com/v18.0/${mediaId}`, {
      headers: { "Authorization": `Bearer ${env.WHATSAPP_TOKEN}` }
    });
    const mediaData = await mediaRes.json();
    if (mediaData.url) {
      const fileRes = await fetch(mediaData.url, { headers: { "Authorization": `Bearer ${env.WHATSAPP_TOKEN}` } });
      const fileBlob = await fileRes.blob();
      const formData = new FormData();
      formData.append("chat_id", env.TELEGRAM_CHAT_ID);
      formData.append("message_thread_id", threadId);
      formData.append("voice", fileBlob, "voice.ogg");
      formData.append("caption", caption);
      formData.append("disable_notification", disableNotification ? "true" : "false");
      await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendVoice`, { method: "POST", body: formData });
      return true;
    }
  } catch (e) { console.error("Audio forward error:", e); return false; }
}

async function forwardImageToTelegram(mediaId, threadId, caption, disableNotification, env) {
  try {
    const mediaRes = await fetch(`https://graph.facebook.com/v18.0/${mediaId}`, {
      headers: { "Authorization": `Bearer ${env.WHATSAPP_TOKEN}` }
    });
    const mediaData = await mediaRes.json();
    if (mediaData.url) {
      const fileRes = await fetch(mediaData.url, { headers: { "Authorization": `Bearer ${env.WHATSAPP_TOKEN}` } });
      const fileBlob = await fileRes.blob();
      const formData = new FormData();
      formData.append("chat_id", env.TELEGRAM_CHAT_ID);
      formData.append("message_thread_id", threadId);
      formData.append("photo", fileBlob, "photo.jpg");
      formData.append("caption", caption);
      formData.append("disable_notification", disableNotification ? "true" : "false");
      await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendPhoto`, { method: "POST", body: formData });
      return true;
    }
  } catch (e) { return false; }
}

async function getTelegramFile(fileId, env) {
  const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`);
  const { result } = await res.json();
  const fileRes = await fetch(`https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${result.file_path}`);
  const arrayBuffer = await fileRes.arrayBuffer();
  return new Blob([arrayBuffer], { type: "audio/ogg" });
}

async function uploadToWhatsApp(blob, env) {
  if (!blob) return null;
  const formData = new FormData();
  formData.append("file", blob, "voice.ogg");
  formData.append("messaging_product", "whatsapp");
  const res = await fetch(`https://graph.facebook.com/v18.0/${env.PHONE_NUMBER_ID}/media`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${env.WHATSAPP_TOKEN}` },
    body: formData
  });
  const data = await res.json();
  return data.id || null;
}

async function sendWhatsApp(to, payload, env) {
  const url = `https://graph.facebook.com/v18.0/${env.PHONE_NUMBER_ID}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Authorization": `Bearer ${env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, ...payload }),
  });
  return await res.json();
}

async function sendTelegram(method, payload, env) {
  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, ...payload }),
  });
  return await res.json();
}

async function bumpAiGeneration(conversationId, env) {
  const row = await env.DB.prepare(`
    UPDATE conversations
    SET ai_generation = ai_generation + 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
    RETURNING ai_generation
  `).bind(conversationId).first();

  return Number(row?.ai_generation ?? 0);
}

async function activateHumanMode(phone, env) {
  const session =
    await env.SESSIONS_KV.get(
      phone,
      { type: "json" }
    ) || {};

  const now =
    Date.now();

  const humanUntilMs =
    now + HUMAN_IDLE_MS;

  // KV נשאר mirror ל-UI בלבד.
  session.humanMode = true;
  session.humanLastActivityAt = now;

  await Promise.all([
    env.SESSIONS_KV.put(
      phone,
      JSON.stringify(session)
    ),

    env.DB.prepare(`
      UPDATE conversations
      SET human_until_ms = ?,
          ai_generation = ai_generation + 1,
          updated_at = CURRENT_TIMESTAMP
      WHERE channel = 'WHATSAPP'
        AND phone = ?
    `)
      .bind(
        humanUntilMs,
        phone
      )
      .run(),

    // אם רינת לקחה שליטה,
    // שום Draft ישן של מאי כבר לא רלוונטי.
    env.DB.prepare(`
      UPDATE ai_drafts
      SET status = 'INVALIDATED',
          decided_at = CURRENT_TIMESTAMP
      WHERE conversation_id IN (
        SELECT id
        FROM conversations
        WHERE channel = 'WHATSAPP'
          AND phone = ?
      )
        AND status = 'PENDING'
    `)
      .bind(phone)
      .run()
  ]);

  return session;
}
async function saveHumanOutbound(phone, waMessageId, messageType, content, env) {
  if (!waMessageId) return;

  await env.DB.prepare(`
    INSERT OR IGNORE INTO messages (
      id,
      conversation_id,
      channel,
      external_message_id,
      direction,
      sender_type,
      message_type,
      content,
      processed_at
    )
    SELECT ?, id, 'WHATSAPP', ?, 'OUTBOUND', 'HUMAN', ?, ?, CURRENT_TIMESTAMP
    FROM conversations
    WHERE channel = 'WHATSAPP' AND phone = ?
    LIMIT 1
  `).bind(
    crypto.randomUUID(),
    waMessageId,
    messageType,
    content || null,
    phone
  ).run();
}

async function saveAiOutbound(conversationId, waMessageId, content, env) {
  if (!waMessageId) return;

  await env.DB.prepare(`
    INSERT OR IGNORE INTO messages (
      id,
      conversation_id,
      channel,
      external_message_id,
      direction,
      sender_type,
      message_type,
      content,
      processed_at
    )
    VALUES (?, ?, 'WHATSAPP', ?, 'OUTBOUND', 'BOT', 'text', ?, CURRENT_TIMESTAMP)
  `).bind(
    crypto.randomUUID(),
    conversationId,
    waMessageId,
    content
  ).run();
}

function normalizeAutomatedContextValue(value, fallback, maxLength = 160) {
  const normalized = String(value || '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[\[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);

  return normalized || fallback;
}

function buildAutomatedTemplateHistory({
  template,
  params,
  months,
  treatmentName,
  refreshMessage
}) {
  if (template === 'appointment_reminder') {
    const time = normalizeAutomatedContextValue(params?.[0], 'שעה שלא צוינה', 24);

    return {
      content: `[הודעה אוטומטית מהקליניקה: תזכורת לתור מחר בשעה ${time}]`,
      metadata: {
        automated: true,
        source: 'crm',
        template: 'appointment_reminder',
        parameters: { time }
      }
    };
  }

  const normalizedMonths = normalizeAutomatedContextValue(months, 'זמן מה', 60);
  const normalizedTreatment = normalizeAutomatedContextValue(treatmentName, 'טיפול', 100);
  const normalizedMessage = normalizeAutomatedContextValue(
    refreshMessage,
    'נשמח לראות אותך שוב לריענון או ייעוץ.',
    240
  );

  return {
    content: `[הודעה אוטומטית מהקליניקה לגבי ${normalizedTreatment}, לאחר ${normalizedMonths}: ${normalizedMessage}]`,
    metadata: {
      automated: true,
      source: 'crm',
      template: 'm_remind',
      parameters: {
        months: normalizedMonths,
        treatment: normalizedTreatment
      }
    }
  };
}

async function saveAutomatedOutbound(phone, waMessageId, historyRecord, env) {
  if (!phone || !waMessageId || !historyRecord?.content) return;

  const clientRecord = await env.DB.prepare(
    `SELECT id FROM Clients WHERE phone = ? LIMIT 1`
  ).bind(phone).first();

  const newConversationId = crypto.randomUUID();

  await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO conversations (id, phone, client_id, channel)
      VALUES (?, ?, ?, 'WHATSAPP')
      ON CONFLICT(channel, phone) DO UPDATE SET
        client_id = COALESCE(excluded.client_id, client_id),
        updated_at = CURRENT_TIMESTAMP
    `).bind(newConversationId, phone, clientRecord?.id || null),

    env.DB.prepare(`
      INSERT OR IGNORE INTO messages (
        id,
        conversation_id,
        channel,
        external_message_id,
        direction,
        sender_type,
        message_type,
        content,
        metadata,
        processed_at
      )
      SELECT ?, id, 'WHATSAPP', ?, 'OUTBOUND', 'SYSTEM', 'template', ?, ?, CURRENT_TIMESTAMP
      FROM conversations
      WHERE channel = 'WHATSAPP' AND phone = ?
      LIMIT 1
    `).bind(
      crypto.randomUUID(),
      waMessageId,
      historyRecord.content,
      JSON.stringify(historyRecord.metadata || {}),
      phone
    )
  ]);
}

async function answerTelegramCallback(
  callbackQueryId,
  text,
  env,
  showAlert = false
) {
  const res = await fetch(
    `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text,
        show_alert: showAlert
      })
    }
  );

  return await res.json();
}

async function clearPilotButtons(messageId, env) {
  return sendTelegram(
    "editMessageReplyMarkup",
    {
      message_id: messageId,
      reply_markup: {
        inline_keyboard: []
      }
    },
    env
  );
}

// --- Main Engine ---

export async function onRequest({ request, env, waitUntil }) {
  if (request.method === "GET") {
    const { searchParams } = new URL(request.url);
    if (env.VERIFY_TOKEN && searchParams.get("hub.mode") === "subscribe" && searchParams.get("hub.challenge") && searchParams.get("hub.verify_token") === env.VERIFY_TOKEN) {
      return new Response(searchParams.get("hub.challenge"), { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  if (request.method === "POST") {
    try {
      const rawBody = await request.arrayBuffer();
      let body;
      try { body = JSON.parse(new TextDecoder().decode(rawBody)); }
      catch { return new Response('Bad Request', { status: 400 }); }
      if (!await authenticateWebhook(request, body, rawBody, env)) {
        // Booleans only: never log header values, IDs, or message content.
        if (body && typeof body === 'object' &&
            (body.message || body.callback_query || Object.hasOwn(body, 'update_id'))) {
          const message = body.callback_query?.message || body.message;
          const actor = body.callback_query?.from || message?.from;
          const allowed = String(env.TELEGRAM_ALLOWED_USER_IDS || '').split(',').map(id => id.trim()).filter(Boolean);
          console.warn('TELEGRAM_AUTH_REJECTED', JSON.stringify({
            kind: body.callback_query ? 'callback' : body.message ? 'message' : 'other',
            secretConfigured: Boolean(env.TELEGRAM_WEBHOOK_SECRET),
            secretMatches: Boolean(env.TELEGRAM_WEBHOOK_SECRET) && request.headers.get('X-Telegram-Bot-Api-Secret-Token') === env.TELEGRAM_WEBHOOK_SECRET,
            actorPresent: Boolean(actor?.id),
            actorAllowed: Boolean(actor?.id) && allowed.includes(String(actor.id)),
            actorIsBot: Boolean(actor?.is_bot),
            forumTopicEdited: Boolean(message?.forum_topic_edited),
            sentAsChat: Boolean(message?.sender_chat),
            chatMatches: Boolean(env.TELEGRAM_CHAT_ID) && String(message?.chat?.id) === String(env.TELEGRAM_CHAT_ID),
            privateChatMatches: isOwnPrivateAdminChat(message, actor),
            mixedEnvelope: Boolean(body.callback_query && body.message) || Object.hasOwn(body, 'crm_nudge') || Object.hasOwn(body, 'entry') || Object.hasOwn(body, 'object')
          }));
        }
        // Confirm receipt of authentic but unsupported/unauthorized Telegram
        // updates without executing them. Non-2xx makes Telegram retry forever
        // until its retry budget expires, including bot-generated topic events.
        const authenticTelegram = body && typeof body === 'object' &&
          !Array.isArray(body) && Number.isSafeInteger(body.update_id) &&
          !Object.hasOwn(body, 'crm_nudge') && !Object.hasOwn(body, 'entry') &&
          !Object.hasOwn(body, 'object') && !(body.message && body.callback_query) &&
          Boolean(env.TELEGRAM_WEBHOOK_SECRET) &&
          request.headers.get('X-Telegram-Bot-Api-Secret-Token') === env.TELEGRAM_WEBHOOK_SECRET;
        return new Response(authenticTelegram ? 'Ignored' : 'Unauthorized', {
          status: authenticTelegram ? 200 : 401
        });
      }

      // Private admin chat is only an authenticated Queue producer.
      // D1 queries and summary delivery are owned by whatsapp-consumer.
      if (isOwnPrivateAdminChat(body.message)) {
        const chatId = String(body.message.chat.id);
        const text = body.message.text?.trim() || '';

        await env.AI_QUEUE.send({
          type: 'ADMIN_CHAT_MESSAGE',
          chatId,
          text
        }, { delaySeconds: 0 });

        return new Response('OK', { status: 200 });
      }

      // =======================================================
      // 🌟 CRM NUDGE BRIDGE LISTENER 🌟
      // =======================================================
      if (body.crm_nudge) {
        if (request.headers.get("Authorization") !== `Bearer ${env.CRM_WEBHOOK_SECRET}`) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { phone, clientName, treatmentNotes } = body;

        let cleanPhone = phone.replace(/\D/g, '');
        if (cleanPhone.startsWith('05')) {
          cleanPhone = '972' + cleanPhone.substring(1);
        }
        if (cleanPhone.startsWith('97205')) {
          cleanPhone = cleanPhone.replace('97205', '9725');
        }

        const { firstName, months, treatmentName, refreshMessage, template, params } = body;
        let templatePayload = {};

        const automatedHistory = buildAutomatedTemplateHistory({
          template,
          params,
          months,
          treatmentName,
          refreshMessage
        });

        if (template === 'appointment_reminder') {
          templatePayload = {
            name: "appointment_reminder",
            language: { code: "he" },
            components: [
              {
                type: "body",
                parameters: [
                  { type: "text", text: params[0] || "00:00" }
                ]
              }
            ]
          };
        } else {
          templatePayload = {
            name: "m_remind",
            language: { code: "he" },
            components: [
              {
                type: "body",
                parameters: [
                  { type: "text", parameter_name: "customer", text: firstName || "לקוחה" },
                  { type: "text", parameter_name: "time_frame", text: months || "זמן מה" },
                  { type: "text", parameter_name: "session_type", text: treatmentName || "טיפול" },
                  { type: "text", parameter_name: "refresh_message", text: refreshMessage || "נשמח לראות אותך שוב לריענון או ייעוץ." }
                ]
              }
            ]
          };
        }

        const waRes = await sendWhatsApp(cleanPhone, {
          type: "template",
          template: templatePayload
        }, env);

        if (waRes?.messages) {
          const waMessageId = waRes.messages[0]?.id;

          try {
            await saveAutomatedOutbound(
              cleanPhone,
              waMessageId,
              automatedHistory,
              env
            );
          } catch (error) {
            // WhatsApp already accepted the reminder. Never trigger a duplicate
            // customer message merely because its history record failed.
            console.error('CRM_AUTOMATED_HISTORY_PERSIST_FAILED', {
              template: automatedHistory.metadata.template,
              hasWhatsAppMessageId: Boolean(waMessageId),
              error: error instanceof Error ? error.message : String(error)
            });
          }

          let session = await env.SESSIONS_KV.get(cleanPhone, { type: "json" }) || { threadId: null, humanMode: false, name: clientName };

          const notifyTelegram = async () => {
            if (!session.threadId) {
              const topicRes = await sendTelegram("createForumTopic", { name: `🤖 ${clientName} (${cleanPhone.slice(-4)})` }, env);
              if (topicRes?.ok) {
                session.threadId = topicRes.result.message_thread_id;
                await Promise.all([
                  env.SESSIONS_KV.put(cleanPhone, JSON.stringify(session)),
                  env.SESSIONS_KV.put(`name_${session.threadId}`, clientName)
                ]);
              }
            }

            if (session.threadId) {
              await sendTelegram("sendMessage", {
                message_thread_id: session.threadId,
                text: `🤖 *[מערכת ה-CRM]*\nנשלח בהצלחה נדנוד אוטומטי ללקוחה: ${clientName}\nעבור: ${treatmentNotes}\n\nPhone: ${cleanPhone}`,
                disable_notification: true
              }, env);
            }
          };

          if (waitUntil) waitUntil(notifyTelegram()); else await notifyTelegram();
          return Response.json({ success: true });
        } else {
          return Response.json({ success: false, error: waRes }, { status: 500 });
        }
      }

      // =======================================================
      // 🧪 PILOT APPROVE / REJECT CALLBACKS
      // =======================================================
      if (body.callback_query) {
        const callback = body.callback_query;
        const data = String(callback.data || "");

        const match =
          data.match(/^pilot_(approve|reject):([0-9a-f-]{36})$/i);

        if (!match) {
          return new Response("OK", { status: 200 });
        }

        // Pending pilot buttons become inert if pilot mode is disabled.
        if (env.AI_PILOT_MODE !== "true") {
          await answerTelegramCallback(
            callback.id,
            "מצב הפיילוט כבוי",
            env,
            true
          );

          return new Response("OK", { status: 200 });
        }

        const action = match[1].toLowerCase();
        const draftId = match[2];

        const callbackMessageId =
          callback.message?.message_id;

        const threadId =
          callback.message?.message_thread_id;

        const draft = await env.DB.prepare(`
    SELECT
      d.id,
      d.conversation_id,
      d.ai_generation,
      d.message,
      d.attention,
      d.intent,
      d.reason,
      d.identity_mode,
      d.status,
      c.phone,
      c.ai_generation AS current_generation,
      c.human_until_ms
    FROM ai_drafts d
    JOIN conversations c
      ON c.id = d.conversation_id
    WHERE d.id = ?
    LIMIT 1
  `)
          .bind(draftId)
          .first();

        if (!draft) {
          await answerTelegramCallback(
            callback.id,
            "ההצעה לא נמצאה",
            env,
            true
          );

          return new Response("OK", { status: 200 });
        }

        // -------------------------------------------------------
        // REJECT
        // -------------------------------------------------------

        if (!await matchesTelegramTopic(draft.phone, threadId, env)) {
          return new Response('Forbidden', { status: 403 });
        }

        if (action === "reject") {
          const rejected = await env.DB.prepare(`
      UPDATE ai_drafts
      SET status = 'REJECTED',
          decided_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND status = 'PENDING'
      RETURNING id
    `)
            .bind(draftId)
            .first();

          if (rejected) {
            if (callbackMessageId) {
              await clearPilotButtons(
                callbackMessageId,
                env
              );
            }

            await answerTelegramCallback(
              callback.id,
              "ההצעה נדחתה",
              env
            );

            if (threadId) {
              await sendTelegram(
                "sendMessage",
                {
                  message_thread_id: threadId,
                  text: "❌ ההצעה של מאי נדחתה",
                  disable_notification: true
                },
                env
              );
            }

          } else {
            await answerTelegramCallback(
              callback.id,
              "ההצעה כבר טופלה",
              env,
              true
            );
          }

          return new Response("OK", { status: 200 });
        }

        // -------------------------------------------------------
        // APPROVE
        //
        // Atomic PENDING -> SENDING claim.
        // Only one callback can claim the draft, and only if:
        // 1. generation is still current
        // 2. Rinat has not taken over
        // -------------------------------------------------------

        const claimed = await env.DB.prepare(`
    UPDATE ai_drafts
    SET status = 'SENDING'
    WHERE id = ?
      AND status = 'PENDING'
      AND EXISTS (
        SELECT 1
        FROM conversations c
        WHERE c.id = ai_drafts.conversation_id
          AND c.ai_generation = ai_drafts.ai_generation
          AND COALESCE(c.human_until_ms, 0) <= ?
      )
    RETURNING
      id,
      conversation_id,
      ai_generation,
      message,
      attention,
      intent,
      reason,
      identity_mode
  `)
          .bind(
            draftId,
            Date.now()
          )
          .first();

        // Could not claim:
        // stale generation / human takeover / already handled.
        if (!claimed) {
          const currentDraft = await env.DB.prepare(`
    SELECT
      d.status,
      d.ai_generation,
      c.ai_generation AS current_generation,
      c.human_until_ms
    FROM ai_drafts d
    JOIN conversations c
      ON c.id = d.conversation_id
    WHERE d.id = ?
    LIMIT 1
  `)
            .bind(draftId)
            .first();

          const isPending =
            currentDraft?.status === "PENDING";

          const isStale =
            isPending &&
            (
              Number(currentDraft.current_generation ?? -1) !==
              Number(currentDraft.ai_generation) ||
              Number(currentDraft.human_until_ms || 0) >
              Date.now()
            );

          // עדיין PENDING אבל כבר לא תקף:
          // הגיעה הודעה חדשה או רינת לקחה שליטה.
          if (isStale) {
            const invalidated = await env.DB.prepare(`
      UPDATE ai_drafts
      SET status = 'INVALIDATED',
          decided_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND status = 'PENDING'
      RETURNING id
    `)
              .bind(draftId)
              .first();

            if (invalidated && callbackMessageId) {
              await clearPilotButtons(
                callbackMessageId,
                env
              );
            }

            await answerTelegramCallback(
              callback.id,
              "ההצעה כבר לא עדכנית",
              env,
              true
            );

            return new Response("OK", { status: 200 });
          }

          // Callback אחר כבר תפס את ה-draft ושולח אותו כרגע.
          // לא מוחקים את הכפתורים — אם השליחה תיכשל,
          // ה-draft יחזור ל-PENDING ויהיה אפשר לנסות שוב.
          if (currentDraft?.status === "SENDING") {
            await answerTelegramCallback(
              callback.id,
              "ההצעה כבר בתהליך שליחה",
              env
            );

            return new Response("OK", { status: 200 });
          }

          // יכול לקרות אם ניסיון שליחה מקביל נכשל
          // והחזיר את ה-draft ל-PENDING.
          if (currentDraft?.status === "PENDING") {
            await answerTelegramCallback(
              callback.id,
              "השליחה לא הושלמה, אפשר לנסות שוב",
              env,
              true
            );

            return new Response("OK", { status: 200 });
          }

          // APPROVED / REJECTED / INVALIDATED
          if (callbackMessageId) {
            await clearPilotButtons(
              callbackMessageId,
              env
            );
          }

          await answerTelegramCallback(
            callback.id,
            "ההצעה כבר טופלה",
            env,
            true
          );

          return new Response("OK", { status: 200 });
        }
        // Re-read D1 immediately before WhatsApp send.
        const freshControl = await env.DB.prepare(`
    SELECT
      phone,
      ai_generation,
      human_until_ms
    FROM conversations
    WHERE id = ?
    LIMIT 1
  `)
          .bind(claimed.conversation_id)
          .first();

        const stillCurrent =
          Number(freshControl?.ai_generation ?? -1) ===
          Number(claimed.ai_generation) &&
          Number(freshControl?.human_until_ms || 0) <=
          Date.now();

        if (
          !stillCurrent ||
          !freshControl?.phone
        ) {
          await env.DB.prepare(`
      UPDATE ai_drafts
      SET status = 'INVALIDATED',
          decided_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND status = 'SENDING'
    `)
            .bind(draftId)
            .run();

          if (callbackMessageId) {
            await clearPilotButtons(
              callbackMessageId,
              env
            );
          }

          await answerTelegramCallback(
            callback.id,
            "ההצעה כבר לא עדכנית",
            env,
            true
          );

          return new Response("OK", { status: 200 });
        }

        await answerTelegramCallback(
          callback.id,
          "שולחת למטופלת…",
          env
        );

        let waRes;

        try {
          waRes = await sendWhatsApp(
            freshControl.phone,
            {
              type: "text",
              text: {
                body: claimed.message
              }
            },
            env
          );

        } catch (error) {
          console.error(
            "Pilot approved WhatsApp send error:",
            error
          );
        }

        const waMessageId =
          waRes?.messages?.[0]?.id || null;

        // WhatsApp clearly failed:
        // return draft to PENDING so Rinat may retry.
        if (!waMessageId) {
          await env.DB.prepare(`
      UPDATE ai_drafts
      SET status = 'PENDING'
      WHERE id = ?
        AND status = 'SENDING'
    `)
            .bind(draftId)
            .run();

          if (threadId) {
            await sendTelegram(
              "sendMessage",
              {
                message_thread_id: threadId,

                text:
                  `❌ שליחת ההצעה נכשלה: ` +
                  `${waRes?.error?.message || "בעיה לא ידועה"}`,

                disable_notification: false
              },
              env
            );
          }

          return new Response("OK", { status: 200 });
        }

        // Save the bot answer only after WhatsApp confirmed it.
        try {
          await saveAiOutbound(
            claimed.conversation_id,
            waMessageId,
            claimed.message,
            env
          );

        } catch (error) {
          console.error(
            "Pilot approved outbound DB insert error:",
            error
          );
        }
        const identityWasDisclosed =
          claimed.identity_mode !==
            "none" ||
          claimed.intent ===
            "identity";
        
        if (identityWasDisclosed) {
          try {
            await env.DB.prepare(`
              UPDATE conversations
              SET ai_identity_disclosed_at =
                    CURRENT_TIMESTAMP,
                  updated_at =
                    CURRENT_TIMESTAMP
              WHERE id = ?
            `)
              .bind(
                claimed.conversation_id
              )
              .run();
        
          } catch (error) {
            console.error(
              "Pilot identity disclosure update error:",
              error
            );
          }
        }
        await env.DB.prepare(`
    UPDATE ai_drafts
    SET status = 'APPROVED',
        decided_at = CURRENT_TIMESTAMP
    WHERE id = ?
      AND status = 'SENDING'
  `)
          .bind(draftId)
          .run();

        if (callbackMessageId) {
          await clearPilotButtons(
            callbackMessageId,
            env
          );
        }

        if (threadId) {
          await sendTelegram(
            "sendMessage",
            {
              message_thread_id: threadId,
              text: "✅ אושר ונשלח למטופלת",
              disable_notification: true
            },
            env
          );
        }

        return new Response("OK", { status: 200 });
      }

      const value = body.entry?.[0]?.changes?.[0]?.value;

      // 1. מנגנון Read Receipts (וי כחול)
      const statuses = value?.statuses;
      if (statuses && statuses.length > 0) {
        const statusObj = statuses[0];

        if (statusObj.status === "read") {
          const recipientId = statusObj.recipient_id;
          let session = await env.SESSIONS_KV.get(recipientId, { type: "json" });

          if (session?.threadId) {
            const task = sendTelegram("sendMessage", {
              message_thread_id: session.threadId,
              text: "🔵 המטופלת קראה את ההודעה",
              disable_notification: true
            }, env);

            if (waitUntil) waitUntil(task); else await task;
          }
        }

        return new Response("OK", { status: 200 });
      }

      // 2. עדכון שם טופיק בטלגרם ע"י רינת
      if (body.message?.forum_topic_edited) {
        const tid = body.message.message_thread_id;
        const newName = body.message.forum_topic_edited.name
          .replace(/[✅🔴🆕🤖]\s*/g, '')
          .split(' (')[0]
          .trim();

        const task = env.SESSIONS_KV.put(`name_${tid}`, newName);

        if (waitUntil) waitUntil(task); else await task;

        return new Response("OK", { status: 200 });
      }

      const msg = value?.messages?.[0];

      if (msg) {
        const from = msg.from;
        const externalMessageId = msg.id;
        const rawName = value.contacts?.[0]?.profile?.name || "לקוחה";

        // =======================================================
        // 🌟 PHASE C & D: Persistence & Queue Publish 🌟
        // =======================================================

        let dbInsertSuccess = false;
        let conversationId = null;

        const internalMessageId = crypto.randomUUID();
        const messageType = msg.type;

        let content = "";
        let metadata = {};

        try {
          // 1. Early Idempotency Check
          const existingMsg = await env.DB.prepare(
            `SELECT id FROM messages WHERE channel = 'WHATSAPP' AND external_message_id = ?`
          ).bind(externalMessageId).first();

          if (existingMsg) {
            console.log(`[Idempotency] Blocked duplicate external message: ${externalMessageId}`);
            return new Response("OK", { status: 200 });
          }

          // 2. Client Resolution
          const clientRecord = await env.DB.prepare(
            `SELECT id FROM Clients WHERE phone = ?`
          ).bind(from).first();

          const clientId = clientRecord ? clientRecord.id : null;

          // 3. Get or Create Conversation
          const newConversationId = crypto.randomUUID();

          const convResult = await env.DB.prepare(`
            INSERT INTO conversations (id, phone, client_id, channel)
            VALUES (?, ?, ?, 'WHATSAPP')
            ON CONFLICT(channel, phone) DO UPDATE SET
              client_id = excluded.client_id,
              updated_at = CURRENT_TIMESTAMP
            RETURNING id
          `).bind(newConversationId, from, clientId).first();

          conversationId = convResult?.id || newConversationId;

          // 4. Content & Metadata Extraction
          if (messageType === "text") {
            content = msg.text?.body || "";

          } else if (messageType === "interactive") {
            content = msg.interactive?.button_reply?.title || "";
            metadata.button_id = msg.interactive?.button_reply?.id;

          } else if (messageType === "image") {
            metadata.media_id = msg.image?.id;

          } else if (messageType === "audio" || messageType === "voice") {
            metadata.media_id = msg.audio?.id || msg.voice?.id;
          }

          if (msg.referral) {
            metadata.referral = msg.referral;
          }

          // 5. Insert Message
          const insertResult = await env.DB.prepare(`
            INSERT INTO messages (
              id,
              conversation_id,
              channel,
              external_message_id,
              direction,
              sender_type,
              message_type,
              content,
              metadata
            )
            VALUES (?, ?, 'WHATSAPP', ?, 'INBOUND', 'CLIENT', ?, ?, ?)
            ON CONFLICT(channel, external_message_id) DO NOTHING
          `).bind(
            internalMessageId,
            conversationId,
            externalMessageId,
            messageType,
            content,
            JSON.stringify(metadata)
          ).run();

          if (insertResult.meta.changes === 0) {
            console.log(`[Idempotency] Duplicate blocked at INSERT: ${externalMessageId}`);
            return new Response("OK", { status: 200 });
          }

          dbInsertSuccess = true;

        } catch (dbError) {
          console.error("D1 Persistence Error:", dbError);
        }

        // 6. Queue publish + AI debounce generation
        if (dbInsertSuccess && env.USE_QUEUE === "true") {
          try {
            const aiTestNumbers = (
              env.AI_TEST_NUMBERS ||
              "972527958778"
            )
              .split(",")
              .map(value => value.trim())
              .filter(Boolean);

            const isAiTestNumber = aiTestNumbers.includes(from);

            const isPilotAll =
              env.AI_PILOT_MODE === "true" &&
              env.AI_PILOT_ALL === "true";

            const isAiEnabled =
              isPilotAll ||
              isAiTestNumber;

            const buttonId =
              messageType === "interactive"
                ? metadata.button_id
                : null;

            const requestedStart =
              messageType === "text" &&
              ["תפריט", "menu", "התחלה"].some(key =>
                content.toLowerCase().includes(key)
              );

            const isAiCandidate =
              isAiEnabled &&
              (
                (
                  messageType === "text" &&
                  content.trim().length > 1 &&
                  !requestedStart
                ) ||
                (
                  messageType === "interactive" &&
                  ["human", "consult"].includes(buttonId)
                )
              );

            // Menu interactions also invalidate an older in-flight AI answer.
            const shouldInvalidateAi =
              isAiEnabled &&
              (
                isAiCandidate ||
                requestedStart ||
                messageType === "interactive"
              );

            let aiGeneration = null;

            if (shouldInvalidateAi && conversationId) {
              aiGeneration = await bumpAiGeneration(
                conversationId,
                env
              );
            }

            const queueBody = {
              internalMessageId,
              rawName
            };

            if (aiGeneration != null) {
              queueBody.aiGeneration = aiGeneration;
            }

            await env.AI_QUEUE.send(
              queueBody,
              {
                delaySeconds:
                  isAiCandidate && messageType === "text"
                    ? 2
                    : 0
              }
            );

            console.log(
              `[Queue] Message ${internalMessageId} sent to AI_QUEUE` +
              `${aiGeneration != null ? ` generation=${aiGeneration}` : ""}` +
              `${isAiCandidate ? " delay=2s" : ""}.`
            );

            return new Response("OK", { status: 200 });

          } catch (queueError) {
            console.error("Queue Send Error:", queueError);
            // Queue failure falls through to the legacy flow so the clinic still receives the message.
          }
        }

        // =======================================================
        // 🌟 EXISTING FLOW: Telegram & SESSIONS_KV (Legacy Fallback) 🌟
        // =======================================================

        let session =
          await env.SESSIONS_KV.get(
            from,
            { type: "json" }
          ) || {
            threadId: null,
            humanMode: false,
            name: rawName
          };

        const createNewTopic = async () => {
          const topicRes = await sendTelegram(
            "createForumTopic",
            {
              name:
                `🆕 ${rawName} (${from.slice(-4)})`
            },
            env
          );

          if (topicRes?.ok) {
            session.threadId =
              topicRes.result.message_thread_id;

            session.isFirstTime = true;

            const tasks = Promise.all([
              env.SESSIONS_KV.put(
                from,
                JSON.stringify(session)
              ),

              env.SESSIONS_KV.put(
                `name_${session.threadId}`,
                rawName
              )
            ]);

            if (waitUntil) {
              waitUntil(tasks);
            } else {
              await tasks;
            }

            return true;
          }

          return false;
        };

        if (!session.threadId) {
          await createNewTopic();
        }

        if (session.threadId) {
          const isButton =
            msg.type === "interactive";

          const isImage =
            msg.type === "image";

          const isAudio =
            msg.type === "audio" ||
            msg.type === "voice";

          const buttonId =
            isButton
              ? msg.interactive.button_reply.id
              : null;

          const customerText =
            isButton
              ? msg.interactive.button_reply.title
              : (msg.text?.body || "");

          const requestedStart =
            ["תפריט", "menu", "התחלה"].some(
              key =>
                customerText
                  .toLowerCase()
                  .includes(key)
            );

          const nextStepId =
            buttonId ||
            (
              session.isFirstTime ||
                requestedStart
                ? "start"
                : null
            );

          if (requestedStart) {
            session.humanMode = false;
            delete session.humanLastActivityAt;
            await env.DB.prepare(`
              UPDATE conversations
              SET human_until_ms = NULL,
                  updated_at = CURRENT_TIMESTAMP
              WHERE channel = 'WHATSAPP' AND phone = ?
            `).bind(from).run();
            const task =
              env.SESSIONS_KV.put(
                from,
                JSON.stringify(session)
              );

            if (waitUntil) {
              waitUntil(task);
            } else {
              await task;
            }
          }

          const currentName =
            session.name ||
            rawName;

          const isUrgent =
            customerText.includes("דחוף");

          const disableNotification =
            !(
              buttonId === "human" ||
              buttonId === "main_booking" ||
              isUrgent ||
              session.humanMode
            );

          // --- זיהוי הגעה מקמפיין ממומן (Click-to-WhatsApp) ---
          let adInfo = "";

          if (msg.referral) {
            const adHeadline =
              msg.referral.headline
                ? `\n🏷️ כותרת: ${msg.referral.headline}`
                : "";

            const adSource =
              msg.referral.source_type
                ? ` (מקור: ${msg.referral.source_type})`
                : "";

            const adId =
              msg.referral.source_id
                ? `\n🆔 מזהה: ${msg.referral.source_id}`
                : "";

            adInfo =
              `\n\n📢 הגיעה מקמפיין ממומן!${adSource}${adHeadline}${adId}`;
          }

          const backgroundTasks = [];

          if (isAudio) {
            backgroundTasks.push(
              forwardAudioToTelegram(
                msg.audio?.id || msg.voice?.id,
                session.threadId,
                `👤 הקלטה מאת: ${currentName}${adInfo}`,
                disableNotification,
                env
              )
            );

          } else if (isImage) {
            backgroundTasks.push(
              forwardImageToTelegram(
                msg.image.id,
                session.threadId,
                `👤 מאת: ${currentName}\n🖼️ תמונה\n\nPhone: ${from}${adInfo}`,
                disableNotification,
                env
              )
            );

          } else {
            backgroundTasks.push(
              sendTelegram(
                "sendMessage",
                {
                  message_thread_id:
                    session.threadId,

                  text:
                    `👤 מאת: ${currentName}\n` +
                    `💬 הודעה: ${customerText}\n\n` +
                    `Phone: ${from}${adInfo}`,

                  disable_notification:
                    disableNotification
                },
                env
              )
            );
          }

          let BOT_FLOW;

          if (!cachedBotFlow) {
            try {
              const kvConfig =
                await env.SESSIONS_KV.get(
                  "BOT_CONFIG",
                  { type: "json" }
                );

              cachedBotFlow =
                kvConfig ||
                DEFAULT_FLOW;

            } catch (e) {
              cachedBotFlow =
                DEFAULT_FLOW;
            }
          }

          BOT_FLOW =
            cachedBotFlow;

          let justActivatedHuman =
            false;

          if (buttonId === "human") {
            session.humanMode =
              true;
            session.humanLastActivityAt = Date.now();
            await env.DB.prepare(`
  UPDATE conversations
  SET human_until_ms = ?,
      updated_at = CURRENT_TIMESTAMP
  WHERE channel = 'WHATSAPP' AND phone = ?
`).bind(
              Date.now() + HUMAN_IDLE_MS,
              from
            ).run();
            justActivatedHuman =
              true;

            backgroundTasks.push(
              env.SESSIONS_KV.put(
                from,
                JSON.stringify(session)
              ),

              sendTelegram(
                "editForumTopic",
                {
                  message_thread_id:
                    session.threadId,

                  name:
                    `🔴 ${currentName} (${from.slice(-4)})`
                },
                env
              )
            );

          } else if (
            buttonId === "main_booking"
          ) {
            backgroundTasks.push(
              sendTelegram(
                "editForumTopic",
                {
                  message_thread_id:
                    session.threadId,

                  name:
                    `🔴 ${currentName} (${from.slice(-4)})`
                },
                env
              )
            );
          }

          if (
            (
              !session.humanMode ||
              justActivatedHuman
            ) &&
            nextStepId &&
            BOT_FLOW[nextStepId]
          ) {
            const step =
              BOT_FLOW[nextStepId];

            let buttons = [
              ...(step.buttons || [])
            ];

            const hasStartButton =
              buttons.some(
                button =>
                  button.id === "start"
              );

            if (
              nextStepId !== "start" &&
              buttons.length < 3 &&
              !hasStartButton
            ) {
              buttons.push({
                id: "start",
                title: "חזרה לתפריט 🏠"
              });
            }

            await sendWhatsApp(
              from,
              {
                type: "interactive",

                interactive: {
                  type: "button",

                  header: {
                    type: "text",
                    text:
                      step.header ||
                      "ד״ר רינת - אסתטיקה"
                  },

                  body: {
                    text:
                      step.text
                  },

                  action: {
                    buttons:
                      buttons
                        .slice(0, 3)
                        .map(
                          button => ({
                            type: "reply",
                            reply: button
                          })
                        )
                  }
                }
              },
              env
            );

            if (session.isFirstTime) {
              session.isFirstTime =
                false;

              backgroundTasks.push(
                env.SESSIONS_KV.put(
                  from,
                  JSON.stringify(session)
                )
              );
            }
          }

          if (waitUntil) {
            waitUntil(
              Promise.all(
                backgroundTasks
              )
            );

          } else {
            await Promise.all(
              backgroundTasks
            );
          }
        }
      }

      // 3. רינת עונה מטלגרם
      else if (
        body.message?.reply_to_message
      ) {
        const threadId =
          body.message.message_thread_id;

        const parentText =
          body.message.reply_to_message.text ||
          body.message.reply_to_message.caption ||
          "";

        const phoneMatch =
          parentText.match(
            /Phone:\s*(\d+)/
          );

        if (phoneMatch) {
          const customerPhone =
            phoneMatch[1];

          if (!await matchesTelegramTopic(customerPhone, threadId, env)) {
            return new Response('Forbidden', { status: 403 });
          }

          const isVoice =
            Boolean(
              body.message.voice
            );

          const textContent =
            body.message.text?.trim() ||
            "";

          const isEnableAiCommand =
            /^\/ai(?:@\w+)?$/i.test(textContent);

          if (isEnableAiCommand) {
            const session =
              await env.SESSIONS_KV.get(
                customerPhone,
                { type: "json" }
              ) || {};
            const control =
              await env.DB.prepare(`
    SELECT human_until_ms
    FROM conversations
    WHERE channel = 'WHATSAPP' AND phone = ?
    LIMIT 1
  `)
                .bind(customerPhone)
                .first();

            const humanIsActive =
              Number(control?.human_until_ms || 0) > Date.now();
            const currentName =
              session.name ||
              "לקוחה";

            if (!humanIsActive) {
              await sendTelegram(
                "sendMessage",
                {
                  message_thread_id: threadId,
                  text: "🤖 מאי כבר פעילה",
                  disable_notification: true
                },
                env
              );

              return new Response("OK", { status: 200 });
            }

            session.humanMode = false;
            delete session.humanLastActivityAt;

            await Promise.all([
              env.SESSIONS_KV.put(
                customerPhone,
                JSON.stringify(session)
              ),

              // מבטל כל AI job ישן מתקופת השליטה האנושית.
              env.DB.prepare(`
UPDATE conversations
SET human_until_ms = NULL,
    ai_generation = ai_generation + 1,
    updated_at = CURRENT_TIMESTAMP
      WHERE channel = 'WHATSAPP' AND phone = ?
    `).bind(customerPhone).run(),

              // הודעות שרינת טיפלה בהן לא ייענו רטרואקטיבית ע"י מאי.
              env.DB.prepare(`
      UPDATE messages
      SET ai_consumed_at = CURRENT_TIMESTAMP
      WHERE conversation_id IN (
        SELECT id
        FROM conversations
        WHERE channel = 'WHATSAPP' AND phone = ?
      )
        AND LOWER(direction) = 'inbound'
        AND ai_consumed_at IS NULL
    `).bind(customerPhone).run(),

              sendTelegram(
                "sendMessage",
                {
                  message_thread_id: threadId,
                  text: "🤖 מאי חזרה לפעילות",
                  disable_notification: true
                },
                env
              ),

              sendTelegram(
                "editForumTopic",
                {
                  message_thread_id: threadId,
                  name: `🤖 ${currentName} (${customerPhone.slice(-4)})`
                },
                env
              )
            ]);

            return new Response("OK", { status: 200 });
          }

          // תשובה רגילה של ד"ר רינת = takeover אנושי.
          const session =
            await activateHumanMode(
              customerPhone,
              env
            );

          const currentName =
            session.name ||
            "לקוחה";

          let waRes;
          let outboundType = "text";
          let outboundContent =
            textContent ||
            null;

          try {
            if (
              textContent === "/1"
            ) {
              outboundType =
                "template";

              outboundContent =
                null;

              waRes =
                await sendWhatsApp(
                  customerPhone,
                  {
                    type: "template",

                    template: {
                      name:
                        "ping_think",

                      language: {
                        code: "he"
                      }
                    }
                  },
                  env
                );
            }

            else if (
              textContent === "/2"
            ) {
              outboundType =
                "template";

              outboundContent =
                null;

              waRes =
                await sendWhatsApp(
                  customerPhone,
                  {
                    type: "template",

                    template: {
                      name:
                        "ping_still_relevant",

                      language: {
                        code: "he"
                      }
                    }
                  },
                  env
                );
            }

            else if (
              textContent === "/3"
            ) {
              outboundType =
                "template";

              outboundContent =
                null;

              waRes =
                await sendWhatsApp(
                  customerPhone,
                  {
                    type: "template",

                    template: {
                      name:
                        "ping_not_returned",

                      language: {
                        code: "he"
                      }
                    }
                  },
                  env
                );
            }

            else if (
              textContent.startsWith(
                "/4 "
              )
            ) {
              const timeString =
                textContent
                  .slice(3)
                  .trim();

              outboundType =
                "template";

              outboundContent =
                buildAutomatedTemplateHistory({
                  template: "appointment_reminder",
                  params: [timeString]
                }).content;

              waRes =
                await sendWhatsApp(
                  customerPhone,
                  {
                    type: "template",

                    template: {
                      name:
                        "appointment_reminder",

                      language: {
                        code: "he"
                      },

                      components: [
                        {
                          type:
                            "body",

                          parameters: [
                            {
                              type:
                                "text",

                              text:
                                timeString
                            }
                          ]
                        }
                      ]
                    }
                  },
                  env
                );
            }

            else if (isVoice) {
              outboundType =
                "audio";

              outboundContent =
                null;

              const audioBlob =
                await getTelegramFile(
                  body.message.voice.file_id,
                  env
                );

              const mediaId =
                await uploadToWhatsApp(
                  audioBlob,
                  env
                );

              waRes =
                await sendWhatsApp(
                  customerPhone,
                  {
                    type: "audio",

                    audio: {
                      id:
                        mediaId
                    }
                  },
                  env
                );
            }

            else if (textContent) {
              waRes =
                await sendWhatsApp(
                  customerPhone,
                  {
                    type: "text",

                    text: {
                      body:
                        textContent
                    }
                  },
                  env
                );
            }

            else {
              return new Response(
                "OK",
                { status: 200 }
              );
            }

            if (waRes?.messages) {
              const waMessageId =
                waRes.messages[0]?.id;

              const tasks =
                Promise.all([
                  saveHumanOutbound(
                    customerPhone,
                    waMessageId,
                    outboundType,
                    outboundContent,
                    env
                  ),

                  sendTelegram(
                    "sendMessage",
                    {
                      message_thread_id:
                        threadId,

                      text:
                        "✅ ההודעה נמסרה למטופלת",

                      disable_notification:
                        true
                    },
                    env
                  ),

                  sendTelegram(
                    "editForumTopic",
                    {
                      message_thread_id:
                        threadId,

                      name:
                        `✅ ${currentName} (${customerPhone.slice(-4)})`
                    },
                    env
                  )
                ]);

              if (waitUntil) {
                waitUntil(tasks);
              } else {
                await tasks;
              }

            } else {
              const tasks =
                Promise.all([
                  sendTelegram(
                    "sendMessage",
                    {
                      message_thread_id:
                        threadId,

                      text:
                        `❌ שגיאה בשליחה: ${waRes?.error?.message || "בעיה לא ידועה"}`,

                      disable_notification:
                        false
                    },
                    env
                  ),

                  sendTelegram(
                    "editForumTopic",
                    {
                      message_thread_id:
                        threadId,

                      name:
                        `🔴 ${currentName} (${customerPhone.slice(-4)})`
                    },
                    env
                  )
                ]);

              if (waitUntil) {
                waitUntil(tasks);
              } else {
                await tasks;
              }
            }

          } catch (err) {
            const tasks =
              Promise.all([
                sendTelegram(
                  "sendMessage",
                  {
                    message_thread_id:
                      threadId,

                    text:
                      `❌ תקלה טכנית: ${err.message}`,

                    disable_notification:
                      false
                  },
                  env
                ),

                sendTelegram(
                  "editForumTopic",
                  {
                    message_thread_id:
                      threadId,

                    name:
                      `🔴 ${currentName} (${customerPhone.slice(-4)})`
                  },
                  env
                )
              ]);

            if (waitUntil) {
              waitUntil(tasks);
            } else {
              await tasks;
            }
          }
        }
      }

    } catch (e) {
      console.error(e);
    }

    return new Response(
      "OK",
      { status: 200 }
    );
  }
}
