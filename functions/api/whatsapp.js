// --- פונקציות עזר (Helper Functions) ---

async function sendWhatsApp(to, payload, env) {
  const url = `https://graph.facebook.com/v18.0/${env.PHONE_NUMBER_ID}/messages`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messaging_product: "whatsapp", to, ...payload }),
    });
    const data = await res.json();
    console.log(`[WA-OUT] Status: ${res.status} | Response:`, JSON.stringify(data));
    return data;
  } catch (e) {
    console.error("[WA-OUT] Critical Error:", e);
    return null;
  }
}

async function sendTelegram(method, payload, env) {
  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, ...payload }),
    });
    const data = await res.json();
    return data;
  } catch (e) {
    console.error(`[TG-OUT] Error calling ${method}:`, e);
    return null;
  }
}

// --- המנוע הראשי ---

export async function onRequest({ request, env }) {
  // 1. אימות Webhook מול מטא (GET)
  if (request.method === "GET") {
    const { searchParams } = new URL(request.url);
    if (searchParams.get("hub.verify_token") === env.VERIFY_TOKEN) {
      return new Response(searchParams.get("hub.challenge"), { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  // 2. טיפול בהודעות (POST)
  if (request.method === "POST") {
    try {
      const body = await request.json();

      // א. עדכון שם לקוחה אם רינת ערכה את ה-Topic בטלגרם
      if (body.message?.forum_topic_edited) {
        const tid = body.message.message_thread_id;
        const newRawName = body.message.forum_topic_edited.name.replace(/[✅🔴🆕]\s*/g, '').split(' (')[0];
        console.log(`[KV-SET] Renaming thread ${tid} to: ${newRawName}`);
        await env.SESSIONS_KV.put(`name_${tid}`, newRawName);
        return new Response("OK", { status: 200 });
      }

      const value = body.entry?.[0]?.changes?.[0]?.value;
      const msg = value?.messages?.[0];

      // ב. הודעה נכנסת מוואטסאפ (לקוחה)
      if (msg) {
        const from = msg.from;
        const rawName = value.contacts?.[0]?.profile?.name || "לקוחה";
        
        // שליפת נתוני סשן מה-KV
        let session = await env.SESSIONS_KV.get(from, { type: "json" });
        let isFirstTime = false;

        // יצירת חדר חדש אם לא קיים
        if (!session || !session.threadId) {
          console.log(`[SESSION] Creating new topic for ${from}`);
          const topicRes = await sendTelegram("createForumTopic", { name: `🆕 ${rawName} (${from.slice(-4)})` }, env);
          if (topicRes?.ok) {
            session = { threadId: topicRes.result.message_thread_id, name: rawName, humanMode: false };
            isFirstTime = true;
            await env.SESSIONS_KV.put(from, JSON.stringify(session));
            await env.SESSIONS_KV.put(`name_${session.threadId}`, rawName);
          }
        }

        if (session && session.threadId) {
          const isButton = msg.type === "interactive";
          const customerText = isButton ? msg.interactive.button_reply.title : (msg.text?.body || "שלחה הודעה");
          const buttonId = isButton ? msg.interactive.button_reply.id : null;

          // בדיקה אם הלקוחה ביקשה "תפריט" במפורש
          const menuCommands = ["תפריט", "menu", "התחלה", "start"];
          const requestedMenu = menuCommands.some(k => customerText.toLowerCase().includes(k));

          if (requestedMenu) {
            session.humanMode = false;
            await env.SESSIONS_KV.put(from, JSON.stringify(session));
          }

          // הבאת השם המעודכן ביותר (למקרה שרינת ערכה אותו בטלגרם)
          const currentName = (await env.SESSIONS_KV.get(`name_${session.threadId}`)) || session.name || rawName;

          // עדכון רינת בטלגרם
          const isUrgent = buttonId === "human" || customerText.includes("דחוף");
          await sendTelegram("sendMessage", {
            message_thread_id: session.threadId,
            text: `👤 מאת: ${currentName}\n💬 הודעה: ${customerText}\n\nPhone: ${from}`,
            disable_notification: !isUrgent
          }, env);

          // לוגיקת תגובות
          if (buttonId === "human") {
            session.humanMode = true;
            await env.SESSIONS_KV.put(from, JSON.stringify(session));
            await sendTelegram("editForumTopic", { message_thread_id: session.threadId, name: `🔴 מענה: ${currentName} (${from.slice(-4)})` }, env);
            await sendWhatsApp(from, { text: { body: "הודעה הועברה לרינת, היא תחזור אלייך בקרוב! ❤️" } }, env);
          } 
          else if (isFirstTime || requestedMenu) {
            // שליחת תפריט רק בפעם הראשונה או כשביקשו במפורש
            await sendWhatsApp(from, {
              type: "interactive",
              interactive: {
                type: "button",
                header: { type: "text", text: `שלום ${currentName}! ✨` },
                body: { text: "ברוכה הבאה לקליניקה של ד״ר רינת. במה נוכל לעזור היום?" },
                action: {
                  buttons: [
                    { type: "reply", reply: { id: "book", title: "תיאום תור 📅" } },
                    { type: "reply", reply: { id: "info", title: "טיפולים ומחירים 💉" } },
                    { type: "reply", reply: { id: "human", title: "שיחה עם נציג 🙋‍♀️" } }
                  ]
                }
              }
            }, env);
          }
        }
      }

      // ג. רינת עונה מהטלגרם (Reply)
      else if (body.message?.reply_to_message) {
        const threadId = body.message.message_thread_id;
        const parentText = body.message.reply_to_message.text || "";
        const phoneMatch = parentText.match(/Phone:\s*(\d+)/);

        if (phoneMatch) {
          const customerPhone = phoneMatch[1];
          const waRes = await sendWhatsApp(customerPhone, { text: { body: body.message.text } }, env);
          
          if (waRes && waRes.messages) {
            // ברגע שרינת ענתה - מעבירים ל-Human Mode (משתיקים בוט)
            let session = await env.SESSIONS_KV.get(customerPhone, { type: "json" }) || {};
            session.humanMode = true;
            await env.SESSIONS_KV.put(customerPhone, JSON.stringify(session));

            // החזרת שם החדר לסטטוס "טופל" (✅)
            const currentName = (await env.SESSIONS_KV.get(`name_${threadId}`)) || "לקוחה";
            await sendTelegram("editForumTopic", { 
              message_thread_id: threadId, 
              name: `✅ ${currentName} (${customerPhone.slice(-4)})` 
            }, env);
          }
        }
      }

    } catch (e) {
      console.error("[GLOBAL ERROR]", e.stack);
    }
    return new Response("OK", { status: 200 });
  }

  return new Response("Method Not Allowed", { status: 405 });
}