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
  return await (await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, ...payload }),
  })).json();
}

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

      // 1. Handling Topic Name Edits by Rinat
      if (body.message?.forum_topic_edited) {
        const threadId = body.message.message_thread_id;
        const newRawName = body.message.forum_topic_edited.name.replace(/[✅🔴🆕]\s*/g, '').split(' (')[0];
        await env.SESSIONS_KV.put(`name_${threadId}`, newRawName);
        return new Response("OK", { status: 200 });
      }

      const value = body.entry?.[0]?.changes?.[0]?.value;
      const msg = value?.messages?.[0];

      // 2. Incoming Message from WhatsApp
      if (msg) {
        const from = msg.from;
        const rawName = value.contacts?.[0]?.profile?.name || "לקוחה";
        
        // Robust retrieval of session data
        let sessionRaw = await env.SESSIONS_KV.get(from);
        let session = {};
        try {
          session = JSON.parse(sessionRaw) || {};
        } catch (e) {
          // If legacy data was a string (just the threadId), migrate it
          if (sessionRaw) session = { threadId: sessionRaw, humanMode: false };
        }
        
        // Create new topic if needed
        if (!session.threadId) {
          const topic = await sendTelegram("createForumTopic", { name: `🆕 ${rawName} (${from.slice(-4)})` }, env);
          if (topic.ok) {
            session = { threadId: topic.result.message_thread_id, name: rawName, humanMode: false };
            await env.SESSIONS_KV.put(from, JSON.stringify(session));
            await env.SESSIONS_KV.put(`name_${session.threadId}`, rawName);
          }
        }

        const isButton = msg.type === "interactive";
        const customerText = isButton ? msg.interactive.button_reply.title : (msg.text?.body || "");
        const buttonId = isButton ? msg.interactive.button_reply.id : null;

        // Reset Human Mode if user requests it
        if (["תפריט", "menu", "התחלה"].some(k => customerText.toLowerCase().includes(k))) {
          session.humanMode = false;
          await env.SESSIONS_KV.put(from, JSON.stringify(session));
        }

        const currentName = await env.SESSIONS_KV.get(`name_${session.threadId}`) || session.name || rawName;
        const isUrgent = buttonId === "human" || customerText.includes("דחוף");

        // Update Telegram
        await sendTelegram("sendMessage", {
          message_thread_id: session.threadId,
          text: `👤 *${currentName}*:\n${customerText}\n\nPhone: ${from}`, // Removed brackets for cleaner regex
          parse_mode: "Markdown",
          disable_notification: !isUrgent
        }, env);

        // Logic - Routing
        if (buttonId === "human") {
          session.humanMode = true;
          await env.SESSIONS_KV.put(from, JSON.stringify(session));
          await sendTelegram("editForumTopic", { message_thread_id: session.threadId, name: `🔴 מענה: ${currentName}` }, env);
          await sendWhatsApp(from, { text: { body: "הודעה הועברה לרינת, היא תענה לך בהקדם! ❤️" } }, env);
        } else if (isButton) {
          let reply = (buttonId === "book") ? "איזה כיף! תכתבי לנו מתי נוח לך ואיזה טיפול תרצי. ✨" : "תוכלי למצוא מחירים כאן: https://drrinat.co.il/treatments";
          await sendWhatsApp(from, { text: { body: reply } }, env);
        } else if (!session.humanMode) {
          // Show menu only if NOT in human mode
          if (customerText.length < 10 || ["היי", "שלום"].some(k => customerText.includes(k))) {
            await sendWhatsApp(from, {
              type: "interactive",
              interactive: {
                type: "button",
                header: { type: "text", text: `שלום ${currentName}! ✨` },
                body: { text: "ברוכה הבאה. במה נוכל לעזור?" },
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

      // 3. Rinat replying from Telegram
      else if (body.message?.reply_to_message) {
        const threadId = body.message.message_thread_id;
        const text = body.message.reply_to_message.text || "";
        const phoneMatch = text.match(/Phone:\s*(\d+)/);

        if (phoneMatch) {
          const customerPhone = phoneMatch[1];
          await sendWhatsApp(customerPhone, { text: { body: body.message.text } }, env);
          const currentName = await env.SESSIONS_KV.get(`name_${threadId}`) || "לקוחה";
          await sendTelegram("editForumTopic", { message_thread_id: threadId, name: `✅ ${currentName}` }, env);
        }
      }
    } catch (e) { console.error(e); }
    return new Response("OK", { status: 200 });
  }
}