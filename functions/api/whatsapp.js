// --- פונקציות עזר (Helper Functions) ---

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

      // 1. עדכון שם לקוחה (כדי שרינת תוכל לערוך שמות)
      if (body.message?.forum_topic_edited) {
        const tid = body.message.message_thread_id;
        const newRawName = body.message.forum_topic_edited.name.replace(/[✅🔴🆕]\s*/g, '').split(' (')[0].trim();
        await env.SESSIONS_KV.put(`name_${tid}`, newRawName);
        return new Response("OK", { status: 200 });
      }

      const value = body.entry?.[0]?.changes?.[0]?.value;
      const msg = value?.messages?.[0];

      // 2. הודעה נכנסת מוואטסאפ (לקוחה)
      if (msg) {
        const from = msg.from;
        const rawName = value.contacts?.[0]?.profile?.name || "לקוחה";
        
        let session = await env.SESSIONS_KV.get(from, { type: "json" }) || { threadId: null, humanMode: false, name: rawName };

        // פונקציית עזר ליצירת חדר (כדי שנוכל לקרוא לה גם בזמן תקלה)
        const createNewTopic = async () => {
          const topicRes = await sendTelegram("createForumTopic", { name: `🆕 ${rawName} (${from.slice(-4)})` }, env);
          if (topicRes?.ok) {
            session.threadId = topicRes.result.message_thread_id;
            await env.SESSIONS_KV.put(from, JSON.stringify(session));
            await env.SESSIONS_KV.put(`name_${session.threadId}`, rawName);
            return true;
          }
          return false;
        };

        // אם אין חדר - יוצרים
        if (!session.threadId) {
          await createNewTopic();
        }

        if (session.threadId) {
          const isButton = msg.type === "interactive";
          const customerText = isButton ? msg.interactive.button_reply.title : (msg.text?.body || "שלחה הודעה");
          const buttonId = isButton ? msg.interactive.button_reply.id : null;

          // איפוס מוד אנושי אם ביקשו תפריט
          if (["תפריט", "menu", "התחלה"].some(k => customerText.toLowerCase().includes(k))) {
            session.humanMode = false;
            await env.SESSIONS_KV.put(from, JSON.stringify(session));
          }

          const currentName = (await env.SESSIONS_KV.get(`name_${session.threadId}`)) || session.name || rawName;

          // ניסיון שליחה לטלגרם
          const isUrgent = buttonId === "human" || customerText.includes("דחוף");
          let tgRes = await sendTelegram("sendMessage", {
            message_thread_id: session.threadId,
            text: `👤 מאת: ${currentName}\n💬 הודעה: ${customerText}\n\nPhone: ${from}`,
            disable_notification: !isUrgent
          }, env);

          // --- מנגנון תיקון עצמי ---
          // אם השליחה נכשלה (למשל כי החדר נמחק), יוצרים חדר חדש ושולחים שוב
          if (!tgRes?.ok) {
            console.log("[FIX] Topic not found, creating new one...");
            const created = await createNewTopic();
            if (created) {
              await sendTelegram("sendMessage", {
                message_thread_id: session.threadId,
                text: `👤 מאת: ${currentName}\n💬 הודעה: ${customerText}\n\nPhone: ${from}`
              }, env);
            }
          }

          // לוגיקת תגובה לוואטסאפ
          if (buttonId === "human") {
            session.humanMode = true;
            await env.SESSIONS_KV.put(from, JSON.stringify(session));
            await sendTelegram("editForumTopic", { message_thread_id: session.threadId, name: `🔴 ${currentName} (${from.slice(-4)})` }, env);
            await sendWhatsApp(from, { text: { body: "הודעה הועברה לרינת, היא תחזור אלייך בקרוב! ❤️" } }, env);
          } 
          else if (!session.humanMode && (customerText.toLowerCase().includes("תפריט") || session.isFirstTime)) {
            await sendWhatsApp(from, {
              type: "interactive",
              interactive: {
                type: "button",
                header: { type: "text", text: `שלום ${currentName}! ✨` },
                body: { text: "ברוכה הבאה לקליניקה. במה נוכל לעזור היום?" },
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

      // 3. רינת עונה מטלגרם
      else if (body.message?.reply_to_message) {
        const threadId = body.message.message_thread_id;
        const phoneMatch = body.message.reply_to_message.text.match(/Phone:\s*(\d+)/);

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