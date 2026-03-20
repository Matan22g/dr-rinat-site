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
      if (body.object === "whatsapp_business_account") {
        const entry = body.entry?.[0];
        const changes = entry?.changes?.[0];
        const value = changes?.value;
        const message = value?.messages?.[0];
        const contact = value?.contacts?.[0];

        // Process only if it's a valid text message
        if (message && message.type === "text") {
          const text = message.text.body;
          const phone = message.from;
          const name = contact?.profile?.name || "Unknown";

          const telegramText = `New WhatsApp Message\nFrom: ${name}\nPhone: ${phone}\nMessage: ${text}`;
          const telegramUrl = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;

          // Send to Telegram Bot API
          try {
            await fetch(telegramUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: env.TELEGRAM_CHAT_ID,
                text: telegramText,
              }),
            });
          } catch (telegramErr) {
            console.error("Telegram API error:", telegramErr);
          }
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
