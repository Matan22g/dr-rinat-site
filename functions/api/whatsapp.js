// --- Helper functions with Detailed Logging ---
async function sendWhatsApp(to, payload, env) {
  const url = `https://graph.facebook.com/v18.0/${env.PHONE_NUMBER_ID}/messages`;
  console.log(`[WA-OUT] Sending to ${to}...`);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Authorization": `Bearer ${env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to, ...payload }),
    });
    const data = await res.json();
    console.log(`[WA-OUT] Status: ${res.status} | Response:`, JSON.stringify(data));
    return data;
  } catch (e) {
    console.error("[WA-OUT] CRITICAL FETCH ERROR:", e);
    return null;
  }
}

async function sendTelegram(method, payload, env) {
  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`;
  console.log(`[TG-OUT] Calling ${method}...`);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, ...payload }),
    });
    const data = await res.json();
    console.log(`[TG-OUT] Result:`, JSON.stringify(data));
    return data;
  } catch (e) {
    console.error("[TG-OUT] CRITICAL FETCH ERROR:", e);
    return null;
  }
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
      console.log("[INCOMING] Webhook received:", JSON.stringify(body));

      // 1. Topic Edited (Rinat renamed the chat)
      if (body.message?.forum_topic_edited) {
        const tid = body.message.message_thread_id;
        const newName = body.message.forum_topic_edited.name.replace(/[✅🔴🆕]\s*/g, '').split(' (')[0];
        console.log(`[KV-SET] Renaming thread ${tid} to ${newName}`);
        await env.SESSIONS_KV.put(`name_${tid}`, newName);
        return new Response("OK", { status: 200 });
      }

      const value = body.entry?.[0]?.changes?.[0]?.value;
      const msg = value?.messages?.[0];

      // 2. Incoming from WhatsApp (Customer)
      if (msg) {
        const from = msg.from;
        const rawName = value.contacts?.[0]?.profile?.name || "לקוחה";
        console.log(`[WA-IN] Message from ${from} (${rawName})`);
        
        // Retrieval & Legacy Check
        let session = await env.SESSIONS_KV.get(from, { type: "json" });
        console.log(`[KV-GET] Session for ${from}:`, JSON.stringify(session));

        if (!session) {
          console.log(`[SESSION] New customer detected. Creating session...`);
          session = { threadId: null, humanMode: false, name: rawName };
        }

        // Create Thread if missing
        if (!session.threadId) {
          const topicRes = await sendTelegram("createForumTopic", { name: `🆕 ${rawName} (${from.slice(-4)})` }, env);
          if (topicRes?.ok) {
            session.threadId = topicRes.result.message_thread_id;
            console.log(`[SESSION] New Topic ID: ${session.threadId}`);
            await env.SESSIONS_KV.put(from, JSON.stringify(session));
            await env.SESSIONS_KV.put(`name_${session.threadId}`, rawName);
          } else {
            console.error("[SESSION] Failed to create TG Topic!");
          }
        }

        if (session.threadId) {
          const isButton = msg.type === "interactive";
          const customerText = isButton ? msg.interactive.button_reply.title : (msg.text?.body || "מדיה");
          const buttonId = isButton ? msg.interactive.button_reply.id : null;

          // Reset Logic
          if (["תפריט", "menu", "התחלה"].some(k => customerText.toLowerCase().includes(k))) {
            console.log(`[SESSION] Resetting humanMode for ${from}`);
            session.humanMode = false;
            await env.SESSIONS_KV.put(from, JSON.stringify(session));
          }

          const currentName = (await env.SESSIONS_KV.get(`name_${session.threadId}`)) || session.name || rawName;

          // Forward message to Telegram
          await sendTelegram("sendMessage", {
            message_thread_id: session.threadId,
            text: `👤 מאת: ${currentName}\n💬 הודעה: ${customerText}\n\nPhone: ${from}`,
          }, env);

          // WhatsApp Response Flow
          if (buttonId === "human") {
            session.humanMode = true;
            await env.SESSIONS_KV.put(from, JSON.stringify(session));
            await sendTelegram("editForumTopic", { message_thread_id: session.threadId, name: `🔴 מענה: ${currentName}` }, env);
            await sendWhatsApp(from, { text: { body: "הודעה הועברה לרינת, היא תחזור אלייך בקרוב! ❤️" } }, env);
          } else if (!session.humanMode) {
             console.log(`[BOT-FLOW] Sending Menu to ${from}`);
             await sendWhatsApp(from, {
                type: "interactive",
                interactive: {
                  type: "button",
                  header: { type: "text", text: "שלום! ✨" },
                  body: { text: "במה נוכל לעזור היום?" },
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

      // 3. Reply from Telegram (Rinat)
      else if (body.message?.reply_to_message) {
        console.log(`[TG-IN] Rinat is replying to a message...`);
        const threadId = body.message.message_thread_id;
        const parentText = body.message.reply_to_message.text || "";
        const phoneMatch = parentText.match(/Phone:\s*(\d+)/);

        if (phoneMatch) {
          const customerPhone = phoneMatch[1];
          console.log(`[TG-IN] Found phone ${customerPhone}. Sending WA...`);
          const result = await sendWhatsApp(customerPhone, { text: { body: body.message.text } }, env);
          
          if (result?.messages) {
             const currentName = (await env.SESSIONS_KV.get(`name_${threadId}`)) || "לקוחה";
             await sendTelegram("editForumTopic", { message_thread_id: threadId, name: `✅ ${currentName}` }, env);
          }
        } else {
          console.warn(`[TG-IN] Could not find phone number in original message!`);
        }
      }
    } catch (e) {
      console.error("[GLOBAL CATCH] Worker Error:", e.stack);
    }
    return new Response("OK", { status: 200 });
  }
}