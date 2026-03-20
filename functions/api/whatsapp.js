// --- Fallback Config (למקרה שה-KV ריק) ---
const DEFAULT_FLOW = {
  "start": {
    "text": "שלום! ✨\nברוכה הבאה לקליניקה. במה נוכל לעזור?",
    "buttons": [{ "id": "human", "title": "שיחה עם נציג 🙋‍♀️" }]
  }
};

// --- Helper Functions ---
async function forwardAudioToTelegram(mediaId, threadId, caption, env) {
  try {
    const mediaRes = await fetch(`https://graph.facebook.com/v18.0/${mediaId}`, {
      headers: { "Authorization": `Bearer ${env.WHATSAPP_TOKEN}` }
    });
    const mediaData = await mediaRes.json();
    if (mediaData.url) {
      const fileRes = await fetch(mediaData.url, { headers: { "Authorization": `Bearer ${env.WHATSAPP_TOKEN}` } });
      const fileBlob = await fileRes.blob();
      
      const formData = new FormData();
      formData.append("chat_id", env.TELEGRAM_CHAT_ID);
      formData.append("message_thread_id", threadId);
      formData.append("voice", fileBlob, "voice.ogg"); // טלגרם הכי אוהב ogg להקלטות
      formData.append("caption", caption);
      
      await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendVoice`, {
        method: "POST",
        body: formData
      });
      return true;
    }
  } catch (e) { console.error("Audio forward error:", e); return false; }
}

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
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, ...payload }),
  });
  return await res.json();
}

async function forwardImageToTelegram(mediaId, threadId, caption, env) {
  try {
    const mediaRes = await fetch(`https://graph.facebook.com/v18.0/${mediaId}`, {
      headers: { "Authorization": `Bearer ${env.WHATSAPP_TOKEN}` }
    });
    const mediaData = await mediaRes.json();
    if (mediaData.url) {
      const fileRes = await fetch(mediaData.url, { headers: { "Authorization": `Bearer ${env.WHATSAPP_TOKEN}` } });
      const fileBlob = await fileRes.blob();
      const formData = new FormData();
      formData.append("chat_id", env.TELEGRAM_CHAT_ID);
      formData.append("message_thread_id", threadId);
      formData.append("photo", fileBlob, "photo.jpg");
      formData.append("caption", caption);
      await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendPhoto`, { method: "POST", body: formData });
      return true;
    }
  } catch (e) { return false; }
}
// --- Main Engine ---

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
      console.log("=== 📥 NEW INCOMING WEBHOOK ===");
      
      // שליפת קונפיגורציה מה-KV
      let BOT_FLOW;
      try {
        const kvConfig = await env.SESSIONS_KV.get("BOT_CONFIG", { type: "json" });
        BOT_FLOW = kvConfig || DEFAULT_FLOW;
      } catch (e) { BOT_FLOW = DEFAULT_FLOW; }

      // עדכון שם טופיק בטלגרם ע"י רינת
      if (body.message?.forum_topic_edited) {
        console.log("Topic edited by admin. Updating KV...");
        const tid = body.message.message_thread_id;
        const newName = body.message.forum_topic_edited.name.replace(/[✅🔴🆕]\s*/g, '').split(' (')[0].trim();
        await env.SESSIONS_KV.put(`name_${tid}`, newName);
        return new Response("OK", { status: 200 });
      }

      const value = body.entry?.[0]?.changes?.[0]?.value;
      const msg = value?.messages?.[0];

      if (msg) {
        const from = msg.from;
        const rawName = value.contacts?.[0]?.profile?.name || "לקוחה";
        
        console.log(`[WhatsApp] Message received from: ${from} (Name: ${rawName})`);
        
        let session = await env.SESSIONS_KV.get(from, { type: "json" });
        console.log(`[KV] Fetched session for ${from}:`, session);

        // אם אין סשן, ניצור אחד חדש ריק
        if (!session) {
            console.log(`[KV] No session found. Creating new empty session for ${from}`);
            session = { threadId: null, humanMode: false, name: rawName };
        }

        const createNewTopic = async () => {
          console.log(`[Telegram] Attempting to create new topic for ${rawName}...`);
          const topicRes = await sendTelegram("createForumTopic", { name: `🆕 ${rawName} (${from.slice(-4)})` }, env);
          
          console.log(`[Telegram] createForumTopic raw response:`, JSON.stringify(topicRes));

          if (topicRes?.ok) {
            console.log(`[Telegram] ✅ Topic created successfully! Thread ID: ${topicRes.result.message_thread_id}`);
            session.threadId = topicRes.result.message_thread_id;
            session.isFirstTime = true;
            await env.SESSIONS_KV.put(from, JSON.stringify(session));
            await env.SESSIONS_KV.put(`name_${session.threadId}`, rawName);
            return true;
          } else {
            console.error(`[Telegram] ❌ FAILED to create topic. Error details:`, topicRes);
            return false;
          }
        };

        // אם ללקוחה אין Thread ID, ננסה ליצור לה טופיק
        if (!session.threadId) {
            console.log(`[Logic] Session has no threadId. Triggering createNewTopic()...`);
            await createNewTopic();
        }

        // ממשיכים רק אם יש לנו טופיק תקין
        if (session.threadId) {
          console.log(`[Logic] Proceeding with valid Thread ID: ${session.threadId}`);
          const isButton = msg.type === "interactive";
          const isImage = msg.type === "image";
          const buttonId = isButton ? msg.interactive.button_reply.id : null;
          const customerText = isButton ? msg.interactive.button_reply.title : (msg.text?.body || "");
          const isAudio = msg.type === "audio" || msg.type === "voice";

          console.log(`[Message Details] Type: ${msg.type}, Text: "${customerText}", Button ID: ${buttonId}`);

          const requestedStart = ["תפריט", "menu", "התחלה"].some(k => customerText.toLowerCase().includes(k));
          const nextStepId = buttonId || ( (session.isFirstTime || requestedStart) ? "start" : null );

          if (requestedStart) {
            console.log(`[Logic] User requested start menu. Resetting humanMode.`);
            session.humanMode = false;
            await env.SESSIONS_KV.put(from, JSON.stringify(session));
          }

          const currentName = (await env.SESSIONS_KV.get(`name_${session.threadId}`)) || session.name || rawName;

          // --- בדיקה אם צריך להתריע לרינת ---
          const isBookingClick = (buttonId === "main_booking");
          const isHumanClick = (buttonId === "human");
          const isUrgent = customerText.includes("דחוף");

          if (isBookingClick) {
            console.log(`[Telegram] User clicked booking. Editing topic to 🔴`);
            await sendTelegram("editForumTopic", { message_thread_id: session.threadId, name: `🔴 ${currentName} (${from.slice(-4)})` }, env);
          }
          if (isAudio) {
              await forwardAudioToTelegram(msg.audio.id, session.threadId, `👤 הקלטה מאת: ${currentName}`, env);
          }
          // עדכון טלגרם (שליחת ההודעה)
// עדכון טלגרם (שליחת ההודעה)
          let sendRes;
          if (isImage) {
            console.log(`[Telegram] Forwarding image to thread ${session.threadId}...`);
            await forwardImageToTelegram(msg.image.id, session.threadId, `👤 מאת: ${currentName}\n🖼️ תמונה\n\nPhone: ${from}`, env);
          } else {
            console.log(`[Telegram] Forwarding text message to thread ${session.threadId}...`);
            sendRes = await sendTelegram("sendMessage", {
              message_thread_id: session.threadId,
              text: `👤 מאת: ${currentName}\n💬 הודעה: ${customerText}\n\nPhone: ${from}`,
              disable_notification: !(isHumanClick || isBookingClick || isUrgent)
            }, env);
            console.log(`[Telegram] sendMessage raw response:`, JSON.stringify(sendRes));
          }

          // ===== מנגנון התאוששות (Auto-Recovery) =====
          // אם רינת מחקה את הטופיק בטלגרם, נייצר אחד חדש אוטומטית!
          if (sendRes?.ok === false && sendRes?.description?.includes("thread not found")) {
            console.log(`[Recovery] ⚠️ Topic ${session.threadId} was deleted! Creating a new one...`);
            session.threadId = null; // מאפסים את הטופיק הישן
            const created = await createNewTopic(); // יוצרים חדש
            
            if (created) {
              console.log(`[Recovery] ✅ New topic created (${session.threadId}). Resending message...`);
              await sendTelegram("sendMessage", {
                  message_thread_id: session.threadId,
                  text: `👤 מאת: ${currentName}\n💬 הודעה: ${customerText} (שוחזר)\n\nPhone: ${from}`,
                  disable_notification: !(isHumanClick || isBookingClick || isUrgent)
              }, env);

              // נעדכן גם את הסטטוס לאדום אם זו הייתה לחיצה על קביעת תור
              if (isBookingClick || isHumanClick) {
                 await sendTelegram("editForumTopic", { message_thread_id: session.threadId, name: `🔴 ${currentName} (${from.slice(-4)})` }, env);
              }
            }
          }
          // ==========================================

          // תגובה אוטומטית לוואטסאפ (Decision Tree)
          if (isHumanClick) {
            console.log(`[Logic] User clicked human mode. Editing topic and notifying WhatsApp.`);
            session.humanMode = true;
            await env.SESSIONS_KV.put(from, JSON.stringify(session));
            await sendTelegram("editForumTopic", { message_thread_id: session.threadId, name: `🔴 ${currentName} (${from.slice(-4)})` }, env);
            await sendWhatsApp(from, { text: { body: "ההודעה הועברה לד'ר רינת, היא תחזור אלייך בהקדם! ❤️" } }, env);
          } 
          else if (!session.humanMode && nextStepId) {
            // ניקוי הסיומות כדי לנתב את כולם לאותה תשובה בספרייה (אופציה שהכנו מקודם)
            let targetStepId = nextStepId;
            if (targetStepId.startsWith("book_action")) targetStepId = "book_action";
            if (targetStepId.startsWith("gallery_results")) targetStepId = "gallery_results";
            
            // בגלל ששכפלנו את האובייקטים ב-JSON, נשתמש ישירות ב-nextStepId
            if (BOT_FLOW[nextStepId]) {
              console.log(`[WhatsApp] Sending auto-reply step: ${nextStepId}`);
              const step = BOT_FLOW[nextStepId];
              let buttons = step.buttons ? [...step.buttons] : [];

              if (nextStepId !== "start" && buttons.length < 3) {
                buttons.push({ id: "start", title: "חזרה לתפריט ✨" });
              }

              const headerText = step.header || "ד״ר רינת - אסתטיקה";

              const waRes = await sendWhatsApp(from, {
                type: "interactive",
                interactive: {
                  type: "button",
                  header: { type: "text", text: headerText },
                  body: { text: step.text },
                  action: { buttons: buttons.slice(0, 3).map(b => ({ type: "reply", reply: b })) }
                }
              }, env);
              console.log(`[WhatsApp] sendWhatsApp raw response:`, JSON.stringify(waRes));

              if (session.isFirstTime) {
                  session.isFirstTime = false;
                  await env.SESSIONS_KV.put(from, JSON.stringify(session));
              }

              if (nextStepId.startsWith("book_action_")) {
                  console.log(`[Logic] Booking step reached. Switching to humanMode.`);
                  session.humanMode = true;
                  await env.SESSIONS_KV.put(from, JSON.stringify(session));
              }
            } else {
              console.log(`[Logic] No matching step found in BOT_FLOW for ID: ${nextStepId}`);
            }
          } else {
            console.log(`[Logic] Conditions not met for auto-reply. humanMode: ${session.humanMode}, nextStepId: ${nextStepId}`);
          }
        } else {
          console.error(`[Logic] ❌ Aborting process for ${from} because session.threadId is STILL null after createNewTopic() attempt.`);
        }
      }

      // רינת עונה מטלגרם
      else if (body.message?.reply_to_message) {
        console.log("=== 📥 NEW TELEGRAM REPLY ===");
        const threadId = body.message.message_thread_id;
        const parentText = body.message.reply_to_message.text || body.message.reply_to_message.caption || "";
        const phoneMatch = parentText.match(/Phone:\s*(\d+)/);

        if (phoneMatch) {
          const customerPhone = phoneMatch[1];
          console.log(`[WhatsApp] Sending reply to customer phone: ${customerPhone}`);
          const waRes = await sendWhatsApp(customerPhone, { text: { body: body.message.text } }, env);
          console.log(`[WhatsApp] Reply response:`, JSON.stringify(waRes));

          if (waRes?.messages) {
            let session = await env.SESSIONS_KV.get(customerPhone, { type: "json" }) || {};
            session.humanMode = true;
            await env.SESSIONS_KV.put(customerPhone, JSON.stringify(session));
            const currentName = (await env.SESSIONS_KV.get(`name_${threadId}`)) || "לקוחה";
            await sendTelegram("editForumTopic", { message_thread_id: threadId, name: `✅ ${currentName} (${customerPhone.slice(-4)})` }, env);
            console.log(`[Telegram] Topic edited to ✅`);
          }
        } else {
          console.log(`[Logic] Could not extract phone number from replied message.`);
        }
      }
    } catch (e) { 
      console.error("=== 💥 FATAL ERROR IN WEBHOOK ===", e.message, e.stack); 
    }
    return new Response("OK", { status: 200 });
  }
}