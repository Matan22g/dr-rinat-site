// --- פונקציות עזר (Helper Functions) ---

async function sendWhatsApp(to, payload, env) {
  const url = `https://graph.facebook.com/v18.0/${env.PHONE_NUMBER_ID}/messages`;
  await fetch(url, {
    method: "POST",
    headers: { "Authorization": `Bearer ${env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, ...payload }),
  });
}

async function sendTelegram(method, payload, env) {
  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`;
  return await (await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, ...payload }),
  })).json();
}

// --- המנוע הראשי ---

export async function onRequest({ request, env }) {
  if (request.method === "GET") { /* אימות מטא - ללא שינוי */ }

  if (request.method === "POST") {
    try {
      const body = await request.json();
      
      // א. עדכון שם לקוחה בזיכרון אם רינת ערכה את שם ה-Topic בטלגרם
      if (body.message?.forum_topic_edited) {
        const newName = body.message.forum_topic_edited.name.replace(/[✅🔴🆕]\s*/g, ''); // ניקוי אימוג'ים מהשם
        const threadId = body.message.message_thread_id;
        // חיפוש הטלפון לפי ה-threadId ב-KV (דורש סריקה או שמירה הפוכה, לכן נשמור פשוט לפי threadId)
        await env.SESSIONS_KV.put(`thread_${threadId}`, newName);
        return new Response("OK", { status: 200 });
      }

      const value = body.entry?.[0]?.changes?.[0]?.value;
      const msg = value?.messages?.[0];

      // ב. הודעה נכנסת מוואטסאפ
      if (msg) {
        const from = msg.from;
        const rawName = value.contacts?.[0]?.profile?.name || "לקוחה חדשה";
        
        let session = await env.SESSIONS_KV.get(from, { type: "json" }) || {};
        
        // יצירת חדר חדש אם לא קיים
        if (!session.threadId) {
          const topicName = `${rawName} (${from.slice(-4)})`;
          const topic = await sendTelegram("createForumTopic", { name: `🆕 ${topicName}` }, env);
          if (topic.ok) {
            session = { threadId: topic.result.message_thread_id, name: rawName };
            await env.SESSIONS_KV.put(from, JSON.stringify(session));
            await env.SESSIONS_KV.put(`thread_${session.threadId}`, rawName); // לשימוש בעריכות שם
          }
        }

        // שליפת השם המעודכן ביותר (למקרה שרינת ערכה אותו)
        const currentName = await env.SESSIONS_KV.get(`thread_${session.threadId}`) || session.name;

        const isButton = msg.type === "interactive";
        const customerText = isButton ? msg.interactive.button_reply.title : (msg.text?.body || "שלחה הודעה");
        const isUrgent = (isButton && msg.interactive.button_reply.id === "human") || customerText.includes("דחוף");

        await sendTelegram("sendMessage", {
          message_thread_id: session.threadId,
          text: `👤 *${currentName}*:\n${customerText}\n\n[Phone: ${from}]`,
          parse_mode: "Markdown",
          disable_notification: !isUrgent
        }, env);

        if (isUrgent) {
          await sendTelegram("editForumTopic", {
            message_thread_id: session.threadId,
            name: `🔴 דרוש מענה: ${currentName} (${from.slice(-4)})`
          }, env);
        }
        
        // שליחת תפריט אוטומטי (קוד קיים...)
        if (isButton) { /* ... תשובות כפתורים ... */ }
        else if (customerText.length < 5) { /* ... שליחת תפריט ... */ }
      }

      // ג. רינת עונה מהטלגרם
      else if (body.message?.reply_to_message) {
        const threadId = body.message.message_thread_id;
        const originalText = body.message.reply_to_message.text;
        const phoneMatch = originalText.match(/Phone:\s*(\d+)/);

        if (phoneMatch) {
          const customerPhone = phoneMatch[1];
          const currentName = await env.SESSIONS_KV.get(`thread_${threadId}`) || "לקוחה";

          // שליחה לוואטסאפ
          await sendWhatsApp(customerPhone, { text: { body: body.message.text } }, env);
          
          // עדכון סטטוס ל-"טופל" תוך שמירה על השם שרינת בחרה
          await sendTelegram("editForumTopic", {
            message_thread_id: threadId,
            name: `✅ ${currentName} (${customerPhone.slice(-4)})`
          }, env);
        }
      }
    } catch (err) { console.error(err); }
    return new Response("OK", { status: 200 });
  }
}