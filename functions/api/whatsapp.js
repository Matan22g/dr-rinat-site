export async function onRequest({ request, env }) {
  // 1. Handle GET request for Webhook Verification (Meta)
  if (request.method === "GET") {
    const url = new URL(request.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === env.VERIFY_TOKEN) {
      return new Response(challenge, { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  // 2. Handle POST request for Incoming Webhooks
  if (request.method === "POST") {
    try {
      const body = await request.json();

      // --- תרחיש א': הודעה נכנסת מוואטסאפ (לקוחה) ---
      if (body.object === "whatsapp_business_account" && body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
        const value = body.entry[0].changes[0].value;
        const msg = value.messages[0];
        const from = msg.from; // מספר הטלפון של הלקוחה
        const contactName = value.contacts?.[0]?.profile?.name || "לקוח/ה";
        
        // בדיקה האם זו לחיצה על כפתור או הודעת טקסט רגילה
        const isButtonReply = msg.type === "interactive";
        const customerText = isButtonReply ? msg.interactive.button_reply.title : (msg.text?.body || "הודעה ללא טקסט");

        // עדכון רינת בטלגרם
        const telegramText = `📩 *הודעה חדשה מהקליניקה!*\n👤 *מאת:* ${contactName}\n📱 *Phone:* ${from}\n💬 *הודעה:* ${customerText}`;
        await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: env.TELEGRAM_CHAT_ID,
            text: telegramText,
            parse_mode: "Markdown"
          }),
        });

        const metaUrl = `https://graph.facebook.com/v18.0/${env.PHONE_NUMBER_ID}/messages`;

        // אם זו הודעה חדשה (לא כפתור) - שלח את תפריט הכפתורים
        if (!isButtonReply) {
          await fetch(metaUrl, {
            method: "POST",
            headers: { "Authorization": `Bearer ${env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              to: from,
              type: "interactive",
              interactive: {
                type: "button",
                header: { type: "text", text: `שלום ${contactName}! ✨` },
                body: { text: "ברוכה הבאה לקליניקה של ד״ר רינת. במה נוכל לעזור לך היום?" },
                footer: { text: "בחרי אחת מהאפשרויות מטה:" },
                action: {
                  buttons: [
                    { type: "reply", reply: { id: "book", title: "תיאום תור 📅" } },
                    { type: "reply", reply: { id: "info", title: "טיפולים ומחירים 💉" } },
                    { type: "reply", reply: { id: "human", title: "שיחה עם נציג 🙋‍♀️" } }
                  ]
                }
              }
            }),
          });
        } 
        // אם זו לחיצה על כפתור - שלח תשובה ממוקדת
        else {
          let responseText = "";
          const buttonId = msg.interactive.button_reply.id;
          
          if (buttonId === "book") {
            responseText = "איזה כיף! תכתבי לנו כאן מהו המועד המועדף עלייך (בוקר/ערב) ואיזה טיפול את מעוניינת לבצע, ורינת תחזור אלייך לתיאום סופי. ✨";
          } else if (buttonId === "info") {
            responseText = "הקליניקה מציעה בוטוקס, חומצה היאלורונית ועוד. פירוט מלא ומחירים תוכלי למצוא כאן: https://drrinat.co.il/treatments";
          } else if (buttonId === "human") {
            responseText = "אין בעיה, רינת קיבלה עדכון שאת מחכה למענה והיא תחזור אלייך בהקדם האפשרי! ❤️";
          }

          await fetch(metaUrl, {
            method: "POST",
            headers: { "Authorization": `Bearer ${env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              to: from,
              text: { body: responseText }
            }),
          });
        }
      }

      // --- תרחיש ב': רינת עונה מהטלגרם (תשובה ללקוחה) ---
      else if (body.update_id && body.message) {
        const message = body.message;
        // בדיקה שמדובר ב-Reply להודעה קיימת
        if (message.reply_to_message && message.text) {
          const originalText = message.reply_to_message.text;
          const phoneMatch = originalText.match(/Phone:\s*(\d+)/);

          if (phoneMatch && phoneMatch[1]) {
            const customerPhone = phoneMatch[1];
            await fetch(`https://graph.facebook.com/v18.0/${env.PHONE_NUMBER_ID}/messages`, {
              method: "POST",
              headers: { "Authorization": `Bearer ${env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                messaging_product: "whatsapp",
                to: customerPhone,
                text: { body: message.text }
              }),
            });
          }
        }
      }

    } catch (err) {
      console.error("Critical Error:", err);
    }

    return new Response("OK", { status: 200 });
  }

  return new Response("Method Not Allowed", { status: 405 });
}