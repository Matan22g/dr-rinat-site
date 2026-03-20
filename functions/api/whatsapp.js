// --- פונקציות עזר (Helpers) ---

async function sendWhatsApp(to, payload, env) {
  const url = `https://graph.facebook.com/v18.0/${env.PHONE_NUMBER_ID}/messages`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Authorization": `Bearer ${env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to, ...payload }),
    });
    return await res.json();
  } catch (e) { return null; }
}

async function sendTelegram(method, payload, env) {
  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, ...payload }),
    });
    return await res.json();
  } catch (e) { return null; }
}

// --- פונקציה מיוחדת לטיפול במדיה (תמונות) ---
async function forwardImageToTelegram(mediaId, threadId, caption, env) {
  try {
    // 1. קבלת כתובת הקובץ ממטא
    const mediaRes = await fetch(`https://graph.facebook.com/v18.0/${mediaId}`, {
      headers: { "Authorization": `Bearer ${env.WHATSAPP_TOKEN}` }
    });
    const mediaData = await mediaRes.json();
    
    if (mediaData.url) {
      // 2. הורדת הקובץ הבינארי
      const fileRes = await fetch(mediaData.url, {
        headers: { "Authorization": `Bearer ${env.WHATSAPP_TOKEN}` }
      });
      const fileBlob = await fileRes.blob();

      // 3. שליחה לטלגרם כ-Multipart FormData
      const formData = new FormData();
      formData.append("chat_id", env.TELEGRAM_CHAT_ID);
      formData.append("message_thread_id", threadId);
      formData.append("photo", fileBlob, "photo.jpg");
      formData.append("caption", caption);

      await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendPhoto`, {
        method: "POST",
        body: formData
      });
      return true;
    }
  } catch (e) {
    console.error("Error forwarding image:", e);
  }
  return false;
}

// --- המנוע הראשי ---

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

      // א. עדכון שם (עבור רינת)
      if (body.message?.forum_topic_edited) {
        const tid = body.message.message_thread_id;
        const newRawName = body.message.forum_topic_edited.name.replace(/[✅🔴🆕]\s*/g, '').split(' (')[0].trim();
        await env.SESSIONS_KV.put(`name_${tid}`, newRawName);
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
          const customerText = isButton ? msg.interactive.button_reply.title : (msg.text?.body || "");
          const buttonId = isButton ? msg.interactive.button_reply.id : null;

          if (["תפריט", "menu", "התחלה"].some(k => customerText.toLowerCase().includes(k))) {
            session.humanMode = false;
            await env.SESSIONS_KV.put(from, JSON.stringify(session));
          }

          const currentName = (await env.SESSIONS_KV.get(`name_${session.threadId}`)) || session.name || rawName;

          // טיפול בתמונה
          if (isImage) {
            const mediaId = msg.image.id;
            const caption = `👤 מאת: ${currentName}\n🖼️ תמונה: ${msg.image.caption || ""}\n\nPhone: ${from}`;
            await forwardImageToTelegram(mediaId, session.threadId, caption, env);
          } 
          // טיפול בטקסט
          else {
            const isUrgent = buttonId === "human" || customerText.includes("דחוף");
            await sendTelegram("sendMessage", {
              message_thread_id: session.threadId,
              text: `👤 מאת: ${currentName}\n💬 הודעה: ${customerText}\n\nPhone: ${from}`,
              disable_notification: !isUrgent
            }, env);
          }

          // תגובות אוטומטיות (בוואטסאפ - ללא שם אישי)
          if (buttonId === "human") {
            session.humanMode = true;
            await env.SESSIONS_KV.put(from, JSON.stringify(session));
            await sendTelegram("editForumTopic", { message_thread_id: session.threadId, name: `🔴 ${currentName} (${from.slice(-4)})` }, env);
            await sendWhatsApp(from, { text: { body: "ההודעה הועברה לרינת, היא תחזור אלייך בהקדם! ❤️" } }, env);
          } 
          else if (session.isFirstTime || customerText.toLowerCase().includes("תפריט")) {
            if (session.isFirstTime) { session.isFirstTime = false; await env.SESSIONS_KV.put(from, JSON.stringify(session)); }
            await sendWhatsApp(from, {
              type: "interactive",
              interactive: {
                type: "button",
                header: { type: "text", text: "שלום! ✨" },
                body: { text: "ברוכה הבאה לקליניקה של ד״ר רינת. במה נוכל לעזור היום?" },
                action: { buttons: [
                  { type: "reply", reply: { id: "book", title: "תיאום תור 📅" } },
                  { type: "reply", reply: { id: "info", title: "טיפולים ומחירים 💉" } },
                  { type: "reply", reply: { id: "human", title: "שיחה עם נציג 🙋‍♀️" } }
                ]}
              }
            }, env);
          }
        }
      }

      // רינת עונה מהטלגרם
      else if (body.message?.reply_to_message) {
        const threadId = body.message.message_thread_id;
        const parentText = body.message.reply_to_message.text || body.message.reply_to_message.caption || "";
        const phoneMatch = parentText.match(/Phone:\s*(\d+)/);

        if (phoneMatch) {
          const customerPhone = phoneMatch[1];
          await sendWhatsApp(customerPhone, { text: { body: body.message.text } }, env);
          
          let session = await env.SESSIONS_KV.get(customerPhone, { type: "json" }) || {};
          session.humanMode = true;
          await env.SESSIONS_KV.put(customerPhone, JSON.stringify(session));

          const currentName = (await env.SESSIONS_KV.get(`name_${threadId}`)) || "לקוחה";
          await sendTelegram("editForumTopic", { message_thread_id: threadId, name: `✅ ${currentName} (${customerPhone.slice(-4)})` }, env);
        }
      }
    } catch (e) { console.error(e); }
    return new Response("OK", { status: 200 });
  }
}