// --- Fallback Config (למקרה שה-KV ריק) ---
const DEFAULT_FLOW = {
  "start": {
    "text": "שלום! ✨\nברוכה הבאה לקליניקה. במה נוכל לעזור?",
    "buttons": [{ "id": "human", "title": "שיחה עם נציג 🙋‍♀️" }]
  }
};

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

// --- Main Engine ---

export async function onRequest({ request, env }) {
  if (request.method === "GET") {
    const { searchParams } = new URL(request.url);
    if (searchParams.get("hub.verify_token") === env.VERIFY_TOKEN) {
      return new Response(searchParams.get("hub.challenge"), { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  if (request.method === "POST") {
    try {
      const body = await request.json();
      const value = body.entry?.[0]?.changes?.[0]?.value;

      // 1. מנגנון Read Receipts (וי כחול)
      const statuses = value?.statuses;
      if (statuses && statuses.length > 0) {
        const statusObj = statuses[0];
        if (statusObj.status === "read") {
          const recipientId = statusObj.recipient_id;
          let session = await env.SESSIONS_KV.get(recipientId, { type: "json" });
          if (session?.threadId) {
            await sendTelegram("sendMessage", {
              message_thread_id: session.threadId,
              text: "🔵 המטופלת קראה את ההודעה",
              disable_notification: true
            }, env);
          }
        }
        return new Response("OK", { status: 200 });
      }

      // 2. עדכון שם טופיק בטלגרם ע"י רינת
      if (body.message?.forum_topic_edited) {
        const tid = body.message.message_thread_id;
        const newName = body.message.forum_topic_edited.name.replace(/[✅🔴🆕]\s*/g, '').split(' (')[0].trim();
        await env.SESSIONS_KV.put(`name_${tid}`, newName);
        return new Response("OK", { status: 200 });
      }

      const msg = value?.messages?.[0];
      if (msg) {
        const from = msg.from;
        const rawName = value.contacts?.[0]?.profile?.name || "לקוחה";
        let session = await env.SESSIONS_KV.get(from, { type: "json" }) || { threadId: null, humanMode: false, name: rawName };

        const createNewTopic = async () => {
          const topicRes = await sendTelegram("createForumTopic", { name: `🆕 ${rawName} (${from.slice(-4)})` }, env);
          if (topicRes?.ok) {
            session.threadId = topicRes.result.message_thread_id;
            session.isFirstTime = true;
            await env.SESSIONS_KV.put(from, JSON.stringify(session));
            await env.SESSIONS_KV.put(`name_${session.threadId}`, rawName);
            return true;
          }
          return false;
        };

        if (!session.threadId) await createNewTopic();

        if (session.threadId) {
          const isButton = msg.type === "interactive";
          const isImage = msg.type === "image";
          const isAudio = msg.type === "audio" || msg.type === "voice";
          const buttonId = isButton ? msg.interactive.button_reply.id : null;
          const customerText = isButton ? msg.interactive.button_reply.title : (msg.text?.body || "");

          const requestedStart = ["תפריט", "menu", "התחלה"].some(k => customerText.toLowerCase().includes(k));
          const nextStepId = buttonId || ((session.isFirstTime || requestedStart) ? "start" : null);

          if (requestedStart) {
            session.humanMode = false;
            await env.SESSIONS_KV.put(from, JSON.stringify(session));
          }

          const currentName = (await env.SESSIONS_KV.get(`name_${session.threadId}`)) || session.name || rawName;

          const isUrgent = customerText.includes("דחוף");
          const disableNotification = !(buttonId === "human" || buttonId === "main_booking" || isUrgent || session.humanMode);

          // שליחה לטלגרם
          if (isAudio) {
            const audioId = msg.audio?.id || msg.voice?.id;
            await forwardAudioToTelegram(audioId, session.threadId, `👤 הקלטה מאת: ${currentName}`, disableNotification, env);
          } else if (isImage) {
            await forwardImageToTelegram(msg.image.id, session.threadId, `👤 מאת: ${currentName}\n🖼️ תמונה\n\nPhone: ${from}`, disableNotification, env);
          } else {
            // שולח טקסט רק אם זה לא אודיו או תמונה
            await sendTelegram("sendMessage", {
              message_thread_id: session.threadId,
              text: `👤 מאת: ${currentName}\n💬 הודעה: ${customerText}\n\nPhone: ${from}`,
              disable_notification: disableNotification
            }, env);
          }

          // תגובה אוטומטית (Decision Tree)
          let BOT_FLOW;
          try {
            const kvConfig = await env.SESSIONS_KV.get("BOT_CONFIG", { type: "json" });
            BOT_FLOW = kvConfig || DEFAULT_FLOW;
          } catch (e) { BOT_FLOW = DEFAULT_FLOW; }

          if (buttonId === "human") {
            session.humanMode = true;
            await env.SESSIONS_KV.put(from, JSON.stringify(session));
            await sendTelegram("editForumTopic", { message_thread_id: session.threadId, name: `🔴 ${currentName} (${from.slice(-4)})` }, env);
            await sendWhatsApp(from, { text: { body: "ההודעה הועברה לרינת, היא תחזור אלייך בהקדם! ❤️" } }, env);
          } else if (buttonId === "main_booking") {
            await sendTelegram("editForumTopic", { message_thread_id: session.threadId, name: `🔴 ${currentName} (${from.slice(-4)})` }, env);
          }

          if (!session.humanMode && nextStepId && BOT_FLOW[nextStepId]) {
            const step = BOT_FLOW[nextStepId];
            let buttons = [...(step.buttons || [])];
            if (nextStepId !== "start" && buttons.length < 3) {
              buttons.push({ id: "start", title: "חזרה לתפריט ✨" });
            }
            await sendWhatsApp(from, {
              type: "interactive",
              interactive: {
                type: "button",
                header: { type: "text", text: step.header || "ד״ר רינת - אסתטיקה" },
                body: { text: step.text },
                action: { buttons: buttons.slice(0, 3).map(b => ({ type: "reply", reply: b })) }
              }
            }, env);
            if (session.isFirstTime) {
              session.isFirstTime = false;
              await env.SESSIONS_KV.put(from, JSON.stringify(session));
            }
          }
        }
      }

      // 3. רינת עונה מטלגרם
      else if (body.message?.reply_to_message) {
        const threadId = body.message.message_thread_id;
        const parentText = body.message.reply_to_message.text || body.message.reply_to_message.caption || "";
        const phoneMatch = parentText.match(/Phone:\s*(\d+)/);

        if (phoneMatch) {
          const customerPhone = phoneMatch[1];
          const isVoice = body.message.voice;
          const textContent = body.message.text ? body.message.text.trim() : "";
          let waRes;

          try {
            if (textContent === "/1") {
              waRes = await sendWhatsApp(customerPhone, {
                type: "template", template: { name: "ping_think", language: { code: "he" } }
              }, env);
            }
            else if (textContent === "/2") {
              waRes = await sendWhatsApp(customerPhone, {
                type: "template", template: { name: "ping_still_relevant", language: { code: "he" } }
              }, env);
            }
            else if (textContent === "/3") {
              waRes = await sendWhatsApp(customerPhone, {
                type: "template", template: { name: "ping_not_returned", language: { code: "he" } }
              }, env);
            }
            else if (textContent.startsWith("/4 ")) {
              // חילוץ השעה מהפקודה (למשל "/4 10:30")
              const timeString = textContent.replace("/4 ", "").trim();
              waRes = await sendWhatsApp(customerPhone, {
                type: "template",
                template: {
                  name: "appointment_reminder",
                  language: { code: "he" },
                  components: [{ type: "body", parameters: [{ type: "text", text: timeString }] }]
                }
              }, env);
            }
            else if (isVoice) {
              const audioBlob = await getTelegramFile(body.message.voice.file_id, env);
              const mediaId = await uploadToWhatsApp(audioBlob, env);
              waRes = await sendWhatsApp(customerPhone, { type: "audio", audio: { id: mediaId } }, env);
            } else {
              waRes = await sendWhatsApp(customerPhone, { text: { body: textContent } }, env);
            }

            if (waRes?.messages) {
              await sendTelegram("sendMessage", {
                message_thread_id: threadId,
                text: "✅ ההודעה נמסרה למטופלת",
                disable_notification: true
              }, env);

              let session = await env.SESSIONS_KV.get(customerPhone, { type: "json" }) || {};
              session.humanMode = true;
              await env.SESSIONS_KV.put(customerPhone, JSON.stringify(session));
              const currentName = (await env.SESSIONS_KV.get(`name_${threadId}`)) || "לקוחה";
              await sendTelegram("editForumTopic", { message_thread_id: threadId, name: `✅ ${currentName} (${customerPhone.slice(-4)})` }, env);
            } else {
              await sendTelegram("sendMessage", {
                message_thread_id: threadId,
                text: `❌ שגיאה בשליחה: ${waRes?.error?.message || "בעיה לא ידועה"}`,
                disable_notification: false
              }, env);
            }
          } catch (err) {
            await sendTelegram("sendMessage", { message_thread_id: threadId, text: `❌ תקלה טכנית: ${err.message}`, disable_notification: false }, env);
          }
        }
      }
    } catch (e) { console.error(e); }
    return new Response("OK", { status: 200 });
  }
}