var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// ../.wrangler/tmp/bundle-KXDD1D/checked-fetch.js
var urls = /* @__PURE__ */ new Set();
function checkURL(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls.has(url.toString())) {
      urls.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
__name(checkURL, "checkURL");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    const [request, init] = argArray;
    checkURL(request, init);
    return Reflect.apply(target, thisArg, argArray);
  }
});

// api/whatsapp.js
var DEFAULT_FLOW = {
  "start": {
    "text": "\u05E9\u05DC\u05D5\u05DD! \u2728\n\u05D1\u05E8\u05D5\u05DB\u05D4 \u05D4\u05D1\u05D0\u05D4 \u05DC\u05E7\u05DC\u05D9\u05E0\u05D9\u05E7\u05D4. \u05D1\u05DE\u05D4 \u05E0\u05D5\u05DB\u05DC \u05DC\u05E2\u05D6\u05D5\u05E8?",
    "buttons": [{ "id": "human", "title": "\u05E9\u05D9\u05D7\u05D4 \u05E2\u05DD \u05E0\u05E6\u05D9\u05D2 \u{1F64B}\u200D\u2640\uFE0F" }]
  }
};
async function forwardAudioToTelegram(mediaId, threadId, caption, disableNotification, env) {
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
      formData.append("voice", fileBlob, "voice.ogg");
      formData.append("caption", caption);
      formData.append("disable_notification", disableNotification ? "true" : "false");
      await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendVoice`, { method: "POST", body: formData });
      return true;
    }
  } catch (e) {
    console.error("Audio forward error:", e);
    return false;
  }
}
__name(forwardAudioToTelegram, "forwardAudioToTelegram");
async function forwardImageToTelegram(mediaId, threadId, caption, disableNotification, env) {
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
      formData.append("disable_notification", disableNotification ? "true" : "false");
      await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendPhoto`, { method: "POST", body: formData });
      return true;
    }
  } catch (e) {
    return false;
  }
}
__name(forwardImageToTelegram, "forwardImageToTelegram");
async function getTelegramFile(fileId, env) {
  const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`);
  const { result } = await res.json();
  const fileRes = await fetch(`https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${result.file_path}`);
  const arrayBuffer = await fileRes.arrayBuffer();
  return new Blob([arrayBuffer], { type: "audio/ogg" });
}
__name(getTelegramFile, "getTelegramFile");
async function uploadToWhatsApp(blob, env) {
  if (!blob) return null;
  const formData = new FormData();
  formData.append("file", blob, "voice.ogg");
  formData.append("messaging_product", "whatsapp");
  const res = await fetch(`https://graph.facebook.com/v18.0/${env.PHONE_NUMBER_ID}/media`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${env.WHATSAPP_TOKEN}` },
    body: formData
  });
  const data = await res.json();
  return data.id || null;
}
__name(uploadToWhatsApp, "uploadToWhatsApp");
async function sendWhatsApp(to, payload, env) {
  const url = `https://graph.facebook.com/v18.0/${env.PHONE_NUMBER_ID}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Authorization": `Bearer ${env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, ...payload })
  });
  return await res.json();
}
__name(sendWhatsApp, "sendWhatsApp");
async function sendTelegram(method, payload, env) {
  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, ...payload })
  });
  return await res.json();
}
__name(sendTelegram, "sendTelegram");
async function onRequest({ request, env }) {
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
      const value = body.entry?.[0]?.changes?.[0]?.value;
      const statuses = value?.statuses;
      if (statuses && statuses.length > 0) {
        const statusObj = statuses[0];
        if (statusObj.status === "read") {
          const recipientId = statusObj.recipient_id;
          let session = await env.SESSIONS_KV.get(recipientId, { type: "json" });
          if (session?.threadId) {
            await sendTelegram("sendMessage", {
              message_thread_id: session.threadId,
              text: "\u{1F535} \u05D4\u05DE\u05D8\u05D5\u05E4\u05DC\u05EA \u05E7\u05E8\u05D0\u05D4 \u05D0\u05EA \u05D4\u05D4\u05D5\u05D3\u05E2\u05D4",
              disable_notification: true
            }, env);
          }
        }
        return new Response("OK", { status: 200 });
      }
      if (body.message?.forum_topic_edited) {
        const tid = body.message.message_thread_id;
        const newName = body.message.forum_topic_edited.name.replace(/[✅🔴🆕]\s*/g, "").split(" (")[0].trim();
        await env.SESSIONS_KV.put(`name_${tid}`, newName);
        return new Response("OK", { status: 200 });
      }
      const msg = value?.messages?.[0];
      if (msg) {
        const from = msg.from;
        const rawName = value.contacts?.[0]?.profile?.name || "\u05DC\u05E7\u05D5\u05D7\u05D4";
        let session = await env.SESSIONS_KV.get(from, { type: "json" }) || { threadId: null, humanMode: false, name: rawName };
        const createNewTopic = /* @__PURE__ */ __name(async () => {
          const topicRes = await sendTelegram("createForumTopic", { name: `\u{1F195} ${rawName} (${from.slice(-4)})` }, env);
          if (topicRes?.ok) {
            session.threadId = topicRes.result.message_thread_id;
            session.isFirstTime = true;
            await env.SESSIONS_KV.put(from, JSON.stringify(session));
            await env.SESSIONS_KV.put(`name_${session.threadId}`, rawName);
            return true;
          }
          return false;
        }, "createNewTopic");
        if (!session.threadId) await createNewTopic();
        if (session.threadId) {
          const isButton = msg.type === "interactive";
          const isImage = msg.type === "image";
          const isAudio = msg.type === "audio" || msg.type === "voice";
          const buttonId = isButton ? msg.interactive.button_reply.id : null;
          const customerText = isButton ? msg.interactive.button_reply.title : msg.text?.body || "";
          const requestedStart = ["\u05EA\u05E4\u05E8\u05D9\u05D8", "menu", "\u05D4\u05EA\u05D7\u05DC\u05D4"].some((k) => customerText.toLowerCase().includes(k));
          const nextStepId = buttonId || (session.isFirstTime || requestedStart ? "start" : null);
          if (requestedStart) {
            session.humanMode = false;
            await env.SESSIONS_KV.put(from, JSON.stringify(session));
          }
          const currentName = await env.SESSIONS_KV.get(`name_${session.threadId}`) || session.name || rawName;
          const isUrgent = customerText.includes("\u05D3\u05D7\u05D5\u05E3");
          const disableNotification = !(buttonId === "human" || buttonId === "main_booking" || isUrgent || session.humanMode);
          if (isAudio) {
            const audioId = msg.audio?.id || msg.voice?.id;
            await forwardAudioToTelegram(audioId, session.threadId, `\u{1F464} \u05D4\u05E7\u05DC\u05D8\u05D4 \u05DE\u05D0\u05EA: ${currentName}`, disableNotification, env);
          } else if (isImage) {
            await forwardImageToTelegram(msg.image.id, session.threadId, `\u{1F464} \u05DE\u05D0\u05EA: ${currentName}
\u{1F5BC}\uFE0F \u05EA\u05DE\u05D5\u05E0\u05D4

Phone: ${from}`, disableNotification, env);
          } else {
            await sendTelegram("sendMessage", {
              message_thread_id: session.threadId,
              text: `\u{1F464} \u05DE\u05D0\u05EA: ${currentName}
\u{1F4AC} \u05D4\u05D5\u05D3\u05E2\u05D4: ${customerText}

Phone: ${from}`,
              disable_notification: disableNotification
            }, env);
          }
          let BOT_FLOW;
          try {
            const kvConfig = await env.SESSIONS_KV.get("BOT_CONFIG", { type: "json" });
            BOT_FLOW = kvConfig || DEFAULT_FLOW;
          } catch (e) {
            BOT_FLOW = DEFAULT_FLOW;
          }
          if (buttonId === "human") {
            session.humanMode = true;
            await env.SESSIONS_KV.put(from, JSON.stringify(session));
            await sendTelegram("editForumTopic", { message_thread_id: session.threadId, name: `\u{1F534} ${currentName} (${from.slice(-4)})` }, env);
            await sendWhatsApp(from, { text: { body: "\u05D4\u05D4\u05D5\u05D3\u05E2\u05D4 \u05D4\u05D5\u05E2\u05D1\u05E8\u05D4 \u05DC\u05E8\u05D9\u05E0\u05EA, \u05D4\u05D9\u05D0 \u05EA\u05D7\u05D6\u05D5\u05E8 \u05D0\u05DC\u05D9\u05D9\u05DA \u05D1\u05D4\u05E7\u05D3\u05DD! \u2764\uFE0F" } }, env);
          } else if (buttonId === "main_booking") {
            await sendTelegram("editForumTopic", { message_thread_id: session.threadId, name: `\u{1F534} ${currentName} (${from.slice(-4)})` }, env);
          }
          if (!session.humanMode && nextStepId && BOT_FLOW[nextStepId]) {
            const step = BOT_FLOW[nextStepId];
            let buttons = [...step.buttons || []];
            if (nextStepId !== "start" && buttons.length < 3) {
              buttons.push({ id: "start", title: "\u05D7\u05D6\u05E8\u05D4 \u05DC\u05EA\u05E4\u05E8\u05D9\u05D8 \u2728" });
            }
            await sendWhatsApp(from, {
              type: "interactive",
              interactive: {
                type: "button",
                header: { type: "text", text: step.header || "\u05D3\u05F4\u05E8 \u05E8\u05D9\u05E0\u05EA - \u05D0\u05E1\u05EA\u05D8\u05D9\u05E7\u05D4" },
                body: { text: step.text },
                action: { buttons: buttons.slice(0, 3).map((b) => ({ type: "reply", reply: b })) }
              }
            }, env);
            if (session.isFirstTime) {
              session.isFirstTime = false;
              await env.SESSIONS_KV.put(from, JSON.stringify(session));
            }
          }
        }
      } else if (body.message?.reply_to_message) {
        const threadId = body.message.message_thread_id;
        const parentText = body.message.reply_to_message.text || body.message.reply_to_message.caption || "";
        const phoneMatch = parentText.match(/Phone:\s*(\d+)/);
        if (phoneMatch) {
          const customerPhone = phoneMatch[1];
          const isVoice = body.message.voice;
          const textContent = body.message.text ? body.message.text.trim() : "";
          let waRes;
          try {
            if (textContent === "/1") {
              waRes = await sendWhatsApp(customerPhone, {
                type: "template",
                template: { name: "ping_think", language: { code: "he" } }
              }, env);
            } else if (textContent === "/2") {
              waRes = await sendWhatsApp(customerPhone, {
                type: "template",
                template: { name: "ping_still_relevant", language: { code: "he" } }
              }, env);
            } else if (textContent === "/3") {
              waRes = await sendWhatsApp(customerPhone, {
                type: "template",
                template: { name: "ping_not_returned", language: { code: "he" } }
              }, env);
            } else if (textContent.startsWith("/4 ")) {
              const timeString = textContent.replace("/4 ", "").trim();
              waRes = await sendWhatsApp(customerPhone, {
                type: "template",
                template: {
                  name: "appointment_reminder",
                  language: { code: "he" },
                  components: [{ type: "body", parameters: [{ type: "text", text: timeString }] }]
                }
              }, env);
            } else if (isVoice) {
              const audioBlob = await getTelegramFile(body.message.voice.file_id, env);
              const mediaId = await uploadToWhatsApp(audioBlob, env);
              waRes = await sendWhatsApp(customerPhone, { type: "audio", audio: { id: mediaId } }, env);
            } else {
              waRes = await sendWhatsApp(customerPhone, { text: { body: textContent } }, env);
            }
            if (waRes?.messages) {
              await sendTelegram("sendMessage", {
                message_thread_id: threadId,
                text: "\u2705 \u05D4\u05D4\u05D5\u05D3\u05E2\u05D4 \u05E0\u05DE\u05E1\u05E8\u05D4 \u05DC\u05DE\u05D8\u05D5\u05E4\u05DC\u05EA",
                disable_notification: true
              }, env);
              let session = await env.SESSIONS_KV.get(customerPhone, { type: "json" }) || {};
              session.humanMode = true;
              await env.SESSIONS_KV.put(customerPhone, JSON.stringify(session));
              const currentName = await env.SESSIONS_KV.get(`name_${threadId}`) || "\u05DC\u05E7\u05D5\u05D7\u05D4";
              await sendTelegram("editForumTopic", { message_thread_id: threadId, name: `\u2705 ${currentName} (${customerPhone.slice(-4)})` }, env);
            } else {
              await sendTelegram("sendMessage", {
                message_thread_id: threadId,
                text: `\u274C \u05E9\u05D2\u05D9\u05D0\u05D4 \u05D1\u05E9\u05DC\u05D9\u05D7\u05D4: ${waRes?.error?.message || "\u05D1\u05E2\u05D9\u05D4 \u05DC\u05D0 \u05D9\u05D3\u05D5\u05E2\u05D4"}`,
                disable_notification: false
              }, env);
            }
          } catch (err) {
            await sendTelegram("sendMessage", { message_thread_id: threadId, text: `\u274C \u05EA\u05E7\u05DC\u05D4 \u05D8\u05DB\u05E0\u05D9\u05EA: ${err.message}`, disable_notification: false }, env);
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
    return new Response("OK", { status: 200 });
  }
}
__name(onRequest, "onRequest");

// ../.wrangler/tmp/pages-MYgHnS/functionsRoutes-0.8429041988865139.mjs
var routes = [
  {
    routePath: "/api/whatsapp",
    mountPath: "/api",
    method: "",
    middlewares: [],
    modules: [onRequest]
  }
];

// ../../../../AppData/Roaming/npm/node_modules/wrangler/node_modules/path-to-regexp/dist.es2015/index.js
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
function parse(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");

// ../../../../AppData/Roaming/npm/node_modules/wrangler/templates/pages-template-worker.ts
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: /* @__PURE__ */ __name(() => {
            isFailOpen = true;
          }, "passThroughOnException")
        };
        const response = await handler(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");

// ../../../../AppData/Roaming/npm/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../../../AppData/Roaming/npm/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// ../.wrangler/tmp/bundle-KXDD1D/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = pages_template_worker_default;

// ../../../../AppData/Roaming/npm/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// ../.wrangler/tmp/bundle-KXDD1D/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=functionsWorker-0.06251125515209577.mjs.map
