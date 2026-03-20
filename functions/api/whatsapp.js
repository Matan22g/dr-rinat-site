// --- פונקציות עזר (Helpers) ---
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

      // 1. עדכון שם לקוחה (רק לצורך התצוגה של רינת בטלגרם)
      if (body.message?.forum_topic_edited) {
        const tid = body.message.message_thread_id;
        const newRawName = body.message.forum_topic_edited.name
          .replace(/[✅🔴🆕]\s*/g, '')
          .split(' (')[0].trim();
        await env.SESSIONS_KV.put(`name_${tid}`, newRawName);
        return new Response("OK", { status: 200 });
      }

      const value = body.entry?.[0]?.changes?.[0]?.value;
      const msg = value?.messages?.[0];

      if (msg) {
        const from = msg.from;
        const rawName = value.contacts?.[0]?.profile?.name || "לקוחה";
        
        let session = await env.SESSIONS_KV.get(from, { type: "json" }) || { threadId: null, humanMode: false, name: rawName };

        const createNewTopic = async () => {
          const topicRes = await sendTelegram("createForumTopic", { name: `🆕 ${rawName} (${from.slice(-4)})` }, env);
          if (topicRes?.ok) {
            session.threadId = topicRes.result.message_thread_id;
            session.isFirstTime = true; // מסמן לשלוח תפריט ראשוני
            await env.SESSIONS_KV.put(from, JSON.stringify(session));
            await env.SESSIONS_KV.put(`name_${session.threadId}`, rawName);
            return true;
          }
          return false;
        };

        if (!session.threadId) await createNewTopic();

        if (session.threadId) {
          const isButton = msg.type === "interactive";
          const customerText = isButton ? msg.interactive.button_reply.title : (msg.text?.body || "");
          const buttonId = isButton ? msg.interactive.button_reply.id : null;

          if (["תפריט", "menu", "התחלה"].some(k => customerText.toLowerCase().includes(k))) {
            session.humanMode = false;
            await env.SESSIONS_KV.put(from, JSON.stringify(session));
          }

          const currentNameForRinat = (await env.SESSIONS_KV.get(`name_${session.threadId}`)) || session.name || rawName;

          // עדכון טלגרם (כאן היא כן רואה את השם)
          await sendTelegram("sendMessage", {
            message_thread_id: session.threadId,
            text: `👤 מאת: ${currentNameForRinat}\n💬 הודעה: ${customerText}\n\nPhone: ${from}`
          }, env);

          // תגובות וואטסאפ (כאן הורדנו את השם האישי)
          if (buttonId === "human") {
            session.humanMode = true;
            await env.SESSIONS_KV.put(from, JSON.stringify(session));
            await sendTelegram("editForumTopic", { message_thread_id: session.threadId, name: `🔴 ${currentNameForRinat} (${from.slice(-4)})` }, env);
            await sendWhatsApp(from, { text: { body: "ההודעה הועברה לרינת, היא תחזור אלייך בהקדם! ❤️" } }, env);
          } 
          else if (session.isFirstTime || customerText.toLowerCase().includes("תפריט")) {
            // מאפסים את ה-Flag כדי שלא ישלח תפריט כל פעם
            if (session.isFirstTime) {
                session.isFirstTime = false;
                await env.SESSIONS_KV.put(from, JSON.stringify(session));
            }

            await sendWhatsApp(from, {
              type: "interactive",
              interactive: {
                type: "button",
                header: { type: "text", text: "שלום! ✨" }, // פנייה גנרית ונקייה
                body: { text: "ברוכה הבאה לקליניקה של ד״ר רינת. במה נוכל לעזור היום?" },
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

      else if (body.message?.reply_to_message) {
        const threadId = body.message.message_thread_id;
        const phoneMatch = body.message.reply_to_message.text.match(/Phone:\s*(\d+)/);

        if (phoneMatch) {
          const customerPhone = phoneMatch[1];
          await sendWhatsApp(customerPhone, { text: { body: body.message.text } }, env);
          
          let session = await env.SESSIONS_KV.get(customerPhone, { type: "json" }) || {};
          session.humanMode = true;
          await env.SESSIONS_KV.put(customerPhone, JSON.stringify(session));

          const currentNameForRinat = (await env.SESSIONS_KV.get(`name_${threadId}`)) || "לקוחה";
          await sendTelegram("editForumTopic", { message_thread_id: threadId, name: `✅ ${currentNameForRinat} (${customerPhone.slice(-4)})` }, env);
        }
      }
    } catch (e) { console.error(e); }
    return new Response("OK", { status: 200 });
  }
}