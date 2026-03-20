export async function onRequest({ request, env }) {
  // Handle GET request for Webhook Verification
  if (request.method === "GET") {
    const url = new URL(request.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === env.VERIFY_TOKEN) {
      return new Response(challenge, { status: 200 });
    } else {
      return new Response("Forbidden", { status: 403 });
    }
  }

  // Handle POST request for Incoming Messages
  if (request.method === "POST") {
    try {
      const body = await request.json();

      // Ensure it's a WhatsApp business account webhook
      // 1. Handle incoming WhatsApp Messages
      if (body.object === "whatsapp_business_account" && body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
        const msg = body.entry[0].changes[0].value.messages[0];
        const from = msg.from; // Customer's phone
        const userName = body.entry[0].changes[0].value.contacts?.[0]?.profile?.name || "לקוח/ה";

        // Check if it's a button reply or a new message
        const isButtonReply = msg.type === "interactive";
        const messageText = isButtonReply ? msg.interactive.button_reply.title : (msg.text?.body || "הודעה ללא טקסט");

        // Send to Telegram (so Rinat knows what happened)
        const telegramText = `📩 *הודעה חדשה מהקליניקה!*\n👤 *מאת:* ${userName}\n📱 *Phone:* ${from}\n💬 *הודעה:* ${messageText}`;
        await fetch(`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: telegramText, parse_mode: "Markdown" }),
        });

        // If it's a new conversation (not a button click), send the Menu
        if (!isButtonReply) {
          const metaApiUrl = `https://graph.facebook.com/v18.0/${env.PHONE_NUMBER_ID}/messages`;
          await fetch(metaApiUrl, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${env.WHATSAPP_TOKEN}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              to: from,
              type: "interactive",
              interactive: {
                type: "button",
                header: { type: "text", text: `שלום ${userName}! ✨` },
                body: { text: "ברוכה הבאה לקליניקה לאסתטיקה של ד״ר רינת. במה נוכל לעזור לך היום?" },
                footer: { text: "בחרי אחת מהאפשרויות מטה:" },
                action: {
                  buttons: [
                    { shadow_index: 1, type: "reply", reply: { id: "book_appointment", title: "תיאום תור 📅" } },
                    { shadow_index: 2, type: "reply", reply: { id: "treatments_info", title: "טיפולים ומחירים 💉" } },
                    { shadow_index: 3, type: "reply", reply: { id: "talk_to_human", title: "שיחה עם נציג 🙋‍♀️" } }
                  ]
                }
              }
            }),
          });
        } else {
          // Logic for button clicks
          let replyMessage = "";
          if (msg.interactive.button_reply.id === "book_appointment") {
            replyMessage = "איזה כיף! כדי לתאם תור, כתבי לנו כאן מהו המועד המועדף עלייך (בוקר/ערב) ואיזה טיפול את מעוניינת לבצע, ורינת תחזור אלייך לתיאום סופי. ✨";
          } else if (msg.interactive.button_reply.id === "treatments_info") {
            replyMessage = "הקליניקה מציעה מגוון טיפולים: בוטוקס, חומצה היאלורונית, מזותרפיה ועוד. תוכלי לראות את הפירוט המלא באתר שלנו: https://drrinat.co.il/treatments";
          } else if (msg.interactive.button_reply.id === "talk_to_human") {
            replyMessage = "אין בעיה, מעבירה אותך למענה אנושי. רינת תענה לך בהקדם האפשרי! ❤️";
          }

          // Send the follow-up message based on the button clicked
          const metaApiUrl = `https://graph.facebook.com/v18.0/${env.PHONE_NUMBER_ID}/messages`;
          await fetch(metaApiUrl, {
            method: "POST",
            headers: { "Authorization": `Bearer ${env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              to: from,
              text: { body: replyMessage }
            }),
          });
        }
      }
// Handle incoming Telegram Webhook payloads
      else if (body.update_id && body.message) {
        console.log(">>> TELEGRAM WEBHOOK RECEIVED <<<");
        const message = body.message;

        // Process only if it's a reply to an existing message and contains text
        if (message.reply_to_message && message.text && message.reply_to_message.text) {
          const originalText = message.reply_to_message.text;
          const phoneMatch = originalText.match(/Phone:\s*(\d+)/);

          if (phoneMatch && phoneMatch[1]) {
            const extractedPhoneNumber = phoneMatch[1];
            console.log("Extracted Phone:", extractedPhoneNumber);
            
            const replyText = message.text;
            const metaApiUrl = `https://graph.facebook.com/v18.0/${env.PHONE_NUMBER_ID}/messages`;

            // Send reply to Meta Graph API
            try {
              console.log("Sending to Meta API...");
              const metaRes = await fetch(metaApiUrl, {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${env.WHATSAPP_TOKEN}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  messaging_product: "whatsapp",
                  to: extractedPhoneNumber,
                  text: { body: replyText },
                }),
              });
              
              const responseData = await metaRes.json();
              console.log("META API STATUS:", metaRes.status);
              console.log("META API RESPONSE:", JSON.stringify(responseData));
              
            } catch (metaErr) {
              console.error("Fetch network error:", metaErr);
            }
          } else {
            console.log("Regex failed to find phone number in:", originalText);
          }
        } else {
          console.log("Not a reply or missing text.");
        }
      }
    } catch (err) {
      console.error("Webhook processing error:", err);
    }

    // ALWAYS return 200 OK to Meta, regardless of internal success
    // ALWAYS return 200 OK to Meta and Telegram, regardless of internal success
    return new Response("OK", { status: 200 });
  }

  return new Response("Method Not Allowed", { status: 405 });
}
