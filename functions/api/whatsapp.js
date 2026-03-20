export async function onRequest({ request, env }) {
  // 1. GET - אימות מול מטא
  if (request.method === "GET") {
    const { searchParams } = new URL(request.url);
    if (searchParams.get("hub.verify_token") === env.VERIFY_TOKEN) {
      return new Response(searchParams.get("hub.challenge"), { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  // 2. POST - טיפול בהודעות
  if (request.method === "POST") {
    try {
      const body = await request.json();
      const value = body.entry?.[0]?.changes?.[0]?.value;
      const msg = value?.messages?.[0];

      // --- תרחיש א': הודעה מהוואטסאפ (לקוחה) ---
      if (msg) {
        const from = msg.from;
        const contactName = value.contacts?.[0]?.profile?.name || "לקוח/ה";
        
        // בדיקה בזיכרון (KV) - האם כבר יש חדר ללקוחה הזו?
        let threadId = await env.SESSIONS_KV.get(from);

        // אם אין חדר - יוצרים אחד חדש בטלגרם
        if (!threadId) {
          const createTopicRes = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/createForumTopic`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: env.TELEGRAM_CHAT_ID,
              name: `${contactName} (${from})`
            }),
          });
          const topicData = await createTopicRes.json();
          if (topicData.ok) {
            threadId = topicData.result.message_thread_id;
            // שומרים בזיכרון לשימוש עתידי
            await env.SESSIONS_KV.put(from, threadId);
          }
        }

        const isButton = msg.type === "interactive";
        const customerText = isButton ? msg.interactive.button_reply.title : (msg.text?.body || "שלחה הודעה");

        // שליחה לחדר הספציפי בטלגרם
        await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: env.TELEGRAM_CHAT_ID,
            message_thread_id: threadId, // כאן הקסם קורה!
            text: `👤 *${contactName}*:\n${customerText}\n\n[Phone: ${from}]`,
            parse_mode: "Markdown"
          }),
        });

        // לוגיקת כפתורים (כמו מקודם)
        if (!isButton && customerText.length < 10) {
           await sendMenu(from, contactName, env);
        }
      }

      // --- תרחיש ב': מענה מטלגרם ---
      else if (body.message?.reply_to_message) {
        // שולפים את המספר מההודעה המקורית (Regex)
        const phoneMatch = body.message.reply_to_message.text.match(/Phone:\s*(\d+)/);
        if (phoneMatch) {
          await fetch(`https://graph.facebook.com/v18.0/${env.PHONE_NUMBER_ID}/messages`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              to: phoneMatch[1],
              text: { body: body.message.text }
            }),
          });
        }
      }
    } catch (e) { console.error(e); }
    return new Response("OK", { status: 200 });
  }
}

// פונקציית עזר לשליחת תפריט
async function sendMenu(to, name, env) {
  await fetch(`https://graph.facebook.com/v18.0/${env.PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: to,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: `שלום ${name}, במה אפשר לעזור?` },
        action: {
          buttons: [
            { type: "reply", reply: { id: "book", title: "תיאום תור 📅" } },
            { type: "reply", reply: { id: "info", title: "טיפולים ומחירים 💉" } }
          ]
        }
      }
    }),
  });
}