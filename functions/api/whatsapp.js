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
  if (request.method === "GET") { /* אימות מטא כרגיל */ }

  if (request.method === "POST") {
    try {
      const body = await request.json();
      const value = body.entry?.[0]?.changes?.[0]?.value;
      const msg = value?.messages?.[0];

      // --- תרחיש א': הודעה מהלקוחה ---
      if (msg) {
        const from = msg.from;
        const contactName = value.contacts?.[0]?.profile?.name || "לקוח/ה";
        
        // שליפת נתוני הלקוחה מהזיכרון (KV)
        let session = await env.SESSIONS_KV.get(from, { type: "json" });

        // אם לקוחה חדשה - יוצרים חדר ושומרים "תעודת זהות"
        if (!session) {
          const topicName = `${contactName} (${from.slice(-4)})`; // שם + 4 ספרות אחרונות למניעת כפילות
          const topic = await sendTelegram("createForumTopic", { name: `🆕 ${topicName}` }, env);
          if (topic.ok) {
            session = { threadId: topic.result.message_thread_id, name: contactName };
            await env.SESSIONS_KV.put(from, JSON.stringify(session));
          }
        }

        const isButton = msg.type === "interactive";
        const customerText = isButton ? msg.interactive.button_reply.title : (msg.text?.body || "שלחה מדיה");
        const buttonId = isButton ? msg.interactive.button_reply.id : null;
        const isUrgent = buttonId === "human" || customerText.includes("דחוף");

        // עדכון בטלגרם עם תיוג טלפון חזק לדיבאג
        await sendTelegram("sendMessage", {
          message_thread_id: session.threadId,
          text: `👤 *${session.name}*:\n${customerText}\n\n[Phone: ${from}]`,
          parse_mode: "Markdown",
          disable_notification: !isUrgent
        }, env);

        if (isUrgent) {
          await sendTelegram("editForumTopic", {
            message_thread_id: session.threadId,
            name: `🔴 דרוש מענה: ${session.name} (${from.slice(-4)})`
          }, env);
        }

        // לוגיקת תשובות אוטומטיות (כמו מקודם...)
        if (isButton) {
            let reply = "מיד נענה לך.";
            if (buttonId === "book") reply = "איזה כיף! תכתבי לנו כאן מה המועד המועדף עלייך (בוקר/ערב) ואיזה טיפול את מעוניינת לבצע. ✨";
            if (buttonId === "info") reply = "פירוט מלא ומחירים תוכלי למצוא כאן: https://drrinat.co.il/treatments";
            if (buttonId === "human") reply = "הודעה הועברה לרינת, היא תענה לך בהקדם! ❤️";
            await sendWhatsApp(from, { text: { body: reply } }, env);
        } else if (customerText.length < 5) {
            await sendWhatsApp(from, {
                type: "interactive",
                interactive: {
                  type: "button",
                  header: { type: "text", text: `שלום ${session.name}! ✨` },
                  body: { text: "ברוכה הבאה לקליניקה. במה נוכל לעזור?" },
                  action: { buttons: [
                    { type: "reply", reply: { id: "book", title: "תיאום תור 📅" } },
                    { type: "reply", reply: { id: "info", title: "טיפולים ומחירים 💉" } },
                    { type: "reply", reply: { id: "human", title: "שיחה עם נציג 🙋‍♀️" } }
                  ]}
                }
            }, env);
        }
      }

      // --- תרחיש ב': רינת עונה מהטלגרם ---
      else if (body.message?.reply_to_message) {
        const originalText = body.message.reply_to_message.text;
        const phoneMatch = originalText.match(/Phone:\s*(\d+)/);

        if (phoneMatch) {
          const customerPhone = phoneMatch[1];
          // שליפה מהזיכרון כדי לוודא שיש לנו את השם הנכון
          const session = await env.SESSIONS_KV.get(customerPhone, { type: "json" });
          const currentName = session ? session.name : "לקוח/ה";

          await sendWhatsApp(customerPhone, { text: { body: body.message.text } }, env);
          
          // החזרת שם החדר למצב "טופל" עם השם המקורי והסיומת
          await sendTelegram("editForumTopic", {
            message_thread_id: body.message.message_thread_id,
            name: `✅ ${currentName} (${customerPhone.slice(-4)})`
          }, env);
        }
      }
    } catch (err) { console.error(err); }
    return new Response("OK", { status: 200 });
  }
}