/**
 * WhatsApp Business API & Telegram Bot Integration
 * Engineered for Dr. Rinat's Clinic
 */

// פונקציית עזר לשליחה לוואטסאפ (Meta API)
async function sendWhatsApp(to, payload, env) {
  const url = `https://graph.facebook.com/v18.0/${env.PHONE_NUMBER_ID}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.WHATSAPP_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messaging_product: "whatsapp", to, ...payload }),
  });
  return await res.json();
}

// פונקציית עזר לשליחה לטלגרם (Telegram API)
async function sendTelegram(method, payload, env) {
  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, ...payload }),
  });
  return await res.json();
}

export async function onRequest({ request, env }) {
  // --- 1. אימות Webhook מול Meta (GET) ---
  if (request.method === "GET") {
    const { searchParams } = new URL(request.url);
    if (searchParams.get("hub.verify_token") === env.VERIFY_TOKEN) {
      return new Response(searchParams.get("hub.challenge"), { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  // --- 2. טיפול בהודעות נכנסות (POST) ---
  if (request.method === "POST") {
    try {
      const body = await request.json();
      const value = body.entry?.[0]?.changes?.[0]?.value;
      const msg = value?.messages?.[0];

      // תרחיש א': הודעה מהלקוחה בוואטסאפ
      if (msg) {
        const from = msg.from;
        const contactName = value.contacts?.[0]?.profile?.name || "לקוח/ה";
        
        // איתור או יצירת חדר (Topic) בטלגרם בעזרת הזיכרון (KV)
        let threadId = await env.SESSIONS_KV.get(from);
        if (!threadId) {
          const topic = await sendTelegram("createForumTopic", { name: `🆕 ${contactName} (${from})` }, env);
          if (topic.ok) {
            threadId = topic.result.message_thread_id;
            await env.SESSIONS_KV.put(from, threadId);
          }
        }

        const isButton = msg.type === "interactive";
        const customerText = isButton ? msg.interactive.button_reply.title : (msg.text?.body || "שלחה מדיה/אחר");
        const buttonId = isButton ? msg.interactive.button_reply.id : null;

        // מנגנון הודעה דחופה (מרעישה) או שקטה
        const isUrgent = buttonId === "human" || customerText.includes("דחוף");
        
        // שליחה לטלגרם
        await sendTelegram("sendMessage", {
          message_thread_id: threadId,
          text: `👤 *${contactName}*:\n${customerText}\n\n[Phone: ${from}]`,
          parse_mode: "Markdown",
          disable_notification: !isUrgent // שקט לכולן, רועש רק למה שדחוף
        }, env);

        // שינוי שם החדר אם זה דחוף
        if (isUrgent) {
          await sendTelegram("editForumTopic", {
            message_thread_id: threadId,
            name: `🔴 דרוש מענה: ${contactName}`
          }, env);
        }

        // ניתוב תשובות אוטומטיות בוואטסאפ
        if (isButton) {
          let reply = "מיד נענה לך.";
          if (buttonId === "book") reply = "איזה כיף! תכתבי לנו כאן מה המועד המועדף עלייך (בוקר/ערב) ואיזה טיפול את מעוניינת לבצע, ורינת תחזור אלייך לתיאום. ✨";
          if (buttonId === "info") reply = "הקליניקה מציעה מגוון טיפולים מתקדמים. פירוט מלא ומחירים תוכלי למצוא כאן: https://drrinat.co.il/treatments";
          if (buttonId === "human") reply = "הודעה הועברה לרינת, היא תענה לך בהקדם האפשרי! ❤️";
          
          await sendWhatsApp(from, { text: { body: reply } }, env);
        } else {
          // הצגת תפריט ראשוני רק למילות מפתח או הודעות קצרות
          const greetings = ["היי", "שלום", "תפריט", "hi", "start"];
          if (greetings.some(k => customerText.toLowerCase().includes(k)) || customerText.length < 5) {
            await sendWhatsApp(from, {
              type: "interactive",
              interactive: {
                type: "button",
                header: { type: "text", text: `שלום ${contactName}! ✨` },
                body: { text: "ברוכה הבאה לקליניקה של ד״ר רינת. במה נוכל לעזור לך היום?" },
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

      // תרחיש ב': רינת עונה מהטלגרם ללקוחה
      else if (body.message?.reply_to_message) {
        const threadId = body.message.message_thread_id;
        const replyText = body.message.text;
        const originalText = body.message.reply_to_message.text;
        const phoneMatch = originalText.match(/Phone:\s*(\d+)/);

        if (phoneMatch && replyText) {
          const customerPhone = phoneMatch[1];
          // שליחה לוואטסאפ
          await sendWhatsApp(customerPhone, { text: { body: replyText } }, env);
          
          // אופטימיזציה: החזרת שם החדר למצב "טופל" (שקט)
          const contactNameMatch = originalText.match(/\*([^*]+)\*/); // שולף את השם שבין הכוכביות
          const contactName = contactNameMatch ? contactNameMatch[1] : "לקוח/ה";
          
          await sendTelegram("editForumTopic", {
            message_thread_id: threadId,
            name: `✅ ${contactName}`
          }, env);
        }
      }

    } catch (err) {
      console.error("Critical Worker Error:", err);
    }
    return new Response("OK", { status: 200 });
  }

  return new Response("Method Not Allowed", { status: 405 });
}