// --- Fallback Config (למקרה שה-KV ריק) ---
const DEFAULT_FLOW = {
  "start": {
    "text": "שלום! ✨\nברוכה הבאה לקליניקה. במה נוכל לעזור?",
    "buttons": [{ "id": "human", "title": "שיחה עם נציג 🙋‍♀️" }]
  }
};

// --- Helper Functions ---

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

async function forwardImageToTelegram(mediaId, threadId, caption, env) {
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
      await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendPhoto`, { method: "POST", body: formData });
      return true;
    }
  } catch (e) { return false; }
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

      // שליפת קונפיגורציה מה-KV
      let BOT_FLOW;
      try {
        const kvConfig = await env.SESSIONS_KV.get("BOT_CONFIG", { type: "json" });
        BOT_FLOW = kvConfig || DEFAULT_FLOW;
      } catch (e) { BOT_FLOW = DEFAULT_FLOW; }

      // עדכון שם טופיק בטלגרם
      if (body.message?.forum_topic_edited) {
        const tid = body.message.message_thread_id;
        const newName = body.message.forum_topic_edited.name.replace(/[✅🔴🆕]\s*/g, '').split(' (')[0].trim();
        await env.SESSIONS_KV.put(`name_${tid}`, newName);
        return new Response("OK", { status: 200 });
      }

      const value = body.entry?.[0]?.changes?.[0]?.value;
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
          const buttonId = isButton ? msg.interactive.button_reply.id : null;
          const customerText = isButton ? msg.interactive.button_reply.title : (msg.text?.body || "");

          const requestedStart = ["תפריט", "menu", "התחלה"].some(k => customerText.toLowerCase().includes(k));
          const nextStepId = buttonId || ( (session.isFirstTime || requestedStart) ? "start" : null );

          if (requestedStart) {
            session.humanMode = false;
            await env.SESSIONS_KV.put(from, JSON.stringify(session));
          }

          const currentName = (await env.SESSIONS_KV.get(`name_${session.threadId}`)) || session.name || rawName;

          // עדכון טלגרם
// --- בדיקה אם צריך להתריע לרינת ---
          const isBookingClick = (buttonId === "main_booking");
          const isHumanClick = (buttonId === "human");
          const isUrgent = customerText.includes("דחוף");

          // אם לחצו על קביעת תור, נשנה את הסטטוס לאדום כבר עכשיו, אבל הבוט ימשיך לפעול בינתיים
          if (isBookingClick) {
            await sendTelegram("editForumTopic", { message_thread_id: session.threadId, name: `🔴 ${currentName} (${from.slice(-4)})` }, env);
          }

          // עדכון טלגרם
          if (isImage) {
            await forwardImageToTelegram(msg.image.id, session.threadId, `👤 מאת: ${currentName}\n🖼️ תמונה\n\nPhone: ${from}`, env);
          } else {
            await sendTelegram("sendMessage", {
              message_thread_id: session.threadId,
              text: `👤 מאת: ${currentName}\n💬 הודעה: ${customerText}\n\nPhone: ${from}`,
              // רינת תקבל התראה (צפצוף) גם על לחיצת נציג וגם על כפתור קביעת תור הראשי!
              disable_notification: !(isHumanClick || isBookingClick || isUrgent)
            }, env);
          }

          // תגובה אוטומטית (Decision Tree)
          if (isHumanClick) {
            session.humanMode = true;
            await env.SESSIONS_KV.put(from, JSON.stringify(session));
            await sendTelegram("editForumTopic", { message_thread_id: session.threadId, name: `🔴 ${currentName} (${from.slice(-4)})` }, env);
            await sendWhatsApp(from, { text: { body: "ההודעה הועברה לרינת, היא תחזור אלייך בהקדם! ❤️" } }, env);
          } 
          else if (!session.humanMode && nextStepId && BOT_FLOW[nextStepId]) {
            const step = BOT_FLOW[nextStepId];
            let buttons = step.buttons ? [...step.buttons] : [];

            // הזרקת "חזרה לתפריט" אוטומטית אם יש פחות מ-3 כפתורים
            if (nextStepId !== "start" && buttons.length < 3) {
              buttons.push({ id: "start", title: "חזרה לתפריט ✨" });
            }
// שולף את הכותרת מה-JSON, ואם אין - משתמש בברירת מחדל
            const headerText = step.header || "ד״ר רינת - אסתטיקה";

            await sendWhatsApp(from, {
              type: "interactive",
              interactive: {
                type: "button",
                header: { type: "text", text: headerText },
                body: { text: step.text },
                action: { buttons: buttons.slice(0, 3).map(b => ({ type: "reply", reply: b })) }
              }
            }, env);

            if (session.isFirstTime) {
                session.isFirstTime = false;
                await env.SESSIONS_KV.put(from, JSON.stringify(session));
            }

            // אם הלקוחה סיימה את תהליך בחירת הטיפול (לחצה על בוטוקס, שפתיים וכו' תחת קביעת תור)
            // נעביר את השיחה למצב נציג כדי שהבוט יפסיק לענות, ורינת תוכל להשתלט
            if (nextStepId.startsWith("book_action_")) {
                session.humanMode = true;
                await env.SESSIONS_KV.put(from, JSON.stringify(session));
            }
          }
        }
      }

      // רינת עונה מטלגרם
      else if (body.message?.reply_to_message) {
        const threadId = body.message.message_thread_id;
        const parentText = body.message.reply_to_message.text || body.message.reply_to_message.caption || "";
        const phoneMatch = parentText.match(/Phone:\s*(\d+)/);

        if (phoneMatch) {
          const customerPhone = phoneMatch[1];
          const waRes = await sendWhatsApp(customerPhone, { text: { body: body.message.text } }, env);
          if (waRes?.messages) {
            let session = await env.SESSIONS_KV.get(customerPhone, { type: "json" }) || {};
            session.humanMode = true;
            await env.SESSIONS_KV.put(customerPhone, JSON.stringify(session));
            const currentName = (await env.SESSIONS_KV.get(`name_${threadId}`)) || "לקוחה";
            await sendTelegram("editForumTopic", { message_thread_id: threadId, name: `✅ ${currentName} (${customerPhone.slice(-4)})` }, env);
          }
        }
      }
    } catch (e) { console.error(e); }
    return new Response("OK", { status: 200 });
  }
}