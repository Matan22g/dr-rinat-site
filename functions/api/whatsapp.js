// --- Helper functions ---
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

      // 1. Handle Topic Edits
      if (body.message?.forum_topic_edited) {
        const threadId = body.message.message_thread_id;
        const newName = body.message.forum_topic_edited.name.replace(/[✅🔴🆕]\s*/g, '');
        await env.SESSIONS_KV.put(`name_${threadId}`, newName);
        return new Response("OK", { status: 200 });
      }

      const value = body.entry?.[0]?.changes?.[0]?.value;
      const msg = value?.messages?.[0];

      // 2. Incoming from WhatsApp
      if (msg) {
        const from = msg.from;
        const rawName = value.contacts?.[0]?.profile?.name || "לקוחה חדשה";
        
        // Retrieval & Legacy Fix
        let session = await env.SESSIONS_KV.get(from, { type: "json" });
        if (!session || typeof session !== 'object') {
          session = { threadId: null, humanMode: false };
        }

        // Create Topic if missing
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
        
        // Reset Logic
        if (["תפריט", "menu", "התחלה"].some(k => customerText.toLowerCase().includes(k))) {
          session.humanMode = false;
          await env.SESSIONS_KV.put(from, JSON.stringify(session));
        }

        const currentName = await env.SESSIONS_KV.get(`name_${session.threadId}`) || session.name || rawName;

        // Message to Telegram (MUST include "Phone: number" for reply to work)
        await sendTelegram("sendMessage", {
          message_thread_id: session.threadId,
          text: `👤 *${currentName}*:\n${customerText}\n\nPhone: ${from}`,
          parse_mode: "Markdown",
          disable_notification: (customerText.length > 3 && !customerText.includes("דחוף"))
        });

        // Response Logic
        if (isButton && msg.interactive.button_reply.id === "human") {
          session.humanMode = true;
          await env.SESSIONS_KV.put(from, JSON.stringify(session));
          await sendTelegram("editForumTopic", { message_thread_id: session.threadId, name: `🔴 מענה: ${currentName}` }, env);
          await sendWhatsApp(from, { text: { body: "הודעה הועברה לרינת, היא תחזור אלייך בקרוב! ❤️" } }, env);
        } else if (!session.humanMode && (customerText.length < 10 || ["היי", "שלום"].some(k => customerText.includes(k)))) {
          // Show Menu
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

      // 3. Reply from Telegram to WhatsApp
      else if (body.message?.reply_to_message) {
        const threadId = body.message.message_thread_id;
        const parentMessageText = body.message.reply_to_message.text || "";
        const phoneMatch = parentMessageText.match(/Phone:\s*(\d+)/);

        if (phoneMatch) {
          const customerPhone = phoneMatch[1];
          const result = await sendWhatsApp(customerPhone, { text: { body: body.message.text } }, env);
          
          if (result.messages) {
             const currentName = await env.SESSIONS_KV.get(`name_${threadId}`) || "לקוחה";
             await sendTelegram("editForumTopic", { message_thread_id: threadId, name: `✅ ${currentName}` }, env);
          }
        }
      }
    } catch (e) { console.error("Critical Error:", e); }
    return new Response("OK", { status: 200 });
  }
}