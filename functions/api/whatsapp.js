// --- פונקציות עזר (Helpers) ---

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

      // א. אם רינת שינתה את שם ה-Topic בטלגרם - נעדכן בזיכרון
      if (body.message?.forum_topic_edited) {
        const threadId = body.message.message_thread_id;
        const newRawName = body.message.forum_topic_edited.name.replace(/[✅🔴🆕]\s*/g, '').split(' (')[0];
        await env.SESSIONS_KV.put(`name_${threadId}`, newRawName);
        return new Response("OK", { status: 200 });
      }

      const value = body.entry?.[0]?.changes?.[0]?.value;
      const msg = value?.messages?.[0];

      // ב. הודעה נכנסת מהלקוחה בוואטסאפ
      if (msg) {
        const from = msg.from;
        const rawName = value.contacts?.[0]?.profile?.name || "לקוחה חדשה";
        
        let session = await env.SESSIONS_KV.get(from, { type: "json" }) || {};
        
        // יצירת חדר חדש אם אין
        if (!session.threadId) {
          const topicName = `${rawName} (${from.slice(-4)})`;
          const topic = await sendTelegram("createForumTopic", { name: `🆕 ${topicName}` }, env);
          if (topic.ok) {
            session = { threadId: topic.result.message_thread_id, name: rawName, humanMode: false };
            await env.SESSIONS_KV.put(from, JSON.stringify(session));
            await env.SESSIONS_KV.put(`name_${session.threadId}`, rawName);
          }
        }

        const isButton = msg.type === "interactive";
        const customerText = isButton ? msg.interactive.button_reply.title : (msg.text?.body || "");
        const buttonId = isButton ? msg.interactive.button_reply.id : null;

        // מנגנון "הפשרה": אם הלקוחה מבקשת תפריט, הבוט חוזר לתפקד
        const resetKeywords = ["תפריט", "menu", "התחלה", "start"];
        if (resetKeywords.some(k => customerText.toLowerCase().includes(k))) {
          session.humanMode = false;
          await env.SESSIONS_KV.put(from, JSON.stringify(session));
        }

        const currentName = await env.SESSIONS_KV.get(`name_${session.threadId}`) || session.name || "לקוחה";
        const isUrgent = buttonId === "human" || customerText.includes("דחוף");

        // עדכון רינת בטלגרם (תמיד שולח כדי שתראה את השיחה)
        await sendTelegram("sendMessage", {
          message_thread_id: session.threadId,
          text: `👤 *${currentName}*:\n${customerText}\n\n[Phone: ${from}]`,
          parse_mode: "Markdown",
          disable_notification: !isUrgent
        }, env);

        // לוגיקת כפתורים ותפריטים
        if (buttonId === "human") {
          session.humanMode = true;
          await env.SESSIONS_KV.put(from, JSON.stringify(session));
          await sendTelegram("editForumTopic", {
            message_thread_id: session.threadId,
            name: `🔴 דרוש מענה: ${currentName} (${from.slice(-4)})`
          }, env);
          await sendWhatsApp(from, { text: { body: "הודעה הועברה לרינת, היא תענה לך בהקדם! ❤️" } }, env);
        } 
        else if (isButton) {
          let reply = (buttonId === "book") ? "איזה כיף! תכתבי לנו כאן מה המועד המועדף עלייך ואיזה טיפול את מעוניינת לבצע. ✨" : "הקליניקה מציעה מגוון טיפולים מתקדמים. פירוט מלא ומחירים תוכלי למצוא כאן: https://drrinat.co.il/treatments";
          await sendWhatsApp(from, { text: { body: reply } }, env);
        }
        // הצגת תפריט רק אם היא לא במצב אנושי
        else if (!session.humanMode) {
          const greetings = ["היי", "שלום", "הלו", "hi"];
          if (greetings.some(k => customerText.toLowerCase().includes(k)) || customerText.length < 5) {
            await sendWhatsApp(from, {
              type: "interactive",
              interactive: {
                type: "button",
                header: { type: "text", text: `שלום ${currentName}! ✨` },
                body: { text: "ברוכה הבאה לקליניקה. במה נוכל לעזור היום?" },
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

      // ג. רינת עונה מהטלגרם
      else if (body.message?.reply_to_message) {
        const threadId = body.message.message_thread_id;
        const phoneMatch = body.message.reply_to_message.text.match(/Phone:\s*(\d+)/);

        if (phoneMatch) {
          const customerPhone = phoneMatch[1];
          const currentName = await env.SESSIONS_KV.get(`name_${threadId}`) || "לקוחה";
          
          await sendWhatsApp(customerPhone, { text: { body: body.message.text } }, env);
          
          // החזרת החדר למצב "טופל" (✅)
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