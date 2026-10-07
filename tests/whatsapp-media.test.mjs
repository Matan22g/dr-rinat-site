import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync(process.env.WEBHOOK_TEST_FILE || new URL('../functions/api/whatsapp.js', import.meta.url), 'utf8');
const { onRequest } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const phone = '972500000001';
const admin = { from: { id: 7 }, chat: { id: -100 }, message_thread_id: 10, reply_to_message: { caption: `תמונה\nPhone: ${phone}` } };

function fixture({ uploadFail = false, downloadFail = false, topic = 10 } = {}) {
  const calls = [], sqls = [], queue = [];
  const env = {
    TELEGRAM_WEBHOOK_SECRET: 'fake-secret', TELEGRAM_CHAT_ID: '-100', TELEGRAM_ALLOWED_USER_IDS: '7',
    TELEGRAM_BOT_TOKEN: 'fake-token', WHATSAPP_TOKEN: 'fake-wa', PHONE_NUMBER_ID: 'fake-phone', META_APP_SECRET: 'fake-meta',
    SESSIONS_KV: { get: async (key) => key.startsWith('name_') ? 'Test' : key === 'BOT_CONFIG' ? null : ({ threadId: topic, name: 'Test', isFirstTime: false }), put: async () => {} },
    AI_QUEUE: { send: async (body) => queue.push(body) },
    DB: { prepare(sql) {
      let args;
      const stmt = { bind(...values) { args = values; return stmt; },
        first: async () => sql.includes('RETURNING id') ? { id: 'conversation-test' } : null,
        run: async () => { sqls.push({ sql, args }); return { success: true, meta: { changes: 1 } }; } };
      return stmt;
    } },
  };
  const fetch = async (url, options = {}) => {
    calls.push({ url: String(url), body: options.body });
    if (url.includes('/getFile?')) return Response.json(downloadFail ? { ok: false } : { ok: true, result: { file_path: 'photo.jpg' } });
    if (url.includes('/file/bot')) return new Response(new Uint8Array([255, 216, 255]), { headers: { 'Content-Type': 'image/jpeg' } });
    if (url.endsWith('/media')) return Response.json(uploadFail ? { error: { message: 'fake upload error' } } : { id: 'uploaded-media' });
    if (url.endsWith('/messages')) return Response.json({ messages: [{ id: 'sent-wa' }] });
    if (url.endsWith('/incoming-media')) return Response.json({ url: 'https://media.invalid/download' });
    if (url === 'https://media.invalid/download') return new Response(new Uint8Array([255, 216, 255]));
    if (url.startsWith('https://api.telegram.org/')) return Response.json({ ok: true, result: { message_id: 44 } });
    throw new Error(`Unmocked request: ${url}`);
  };
  return { env, calls, sqls, queue, fetch };
}

async function telegram(f, changes) {
  const old = globalThis.fetch;
  globalThis.fetch = f.fetch;
  try { return await onRequest({ env: f.env, request: new Request('https://example.invalid/api/whatsapp', {
    method: 'POST', headers: { 'X-Telegram-Bot-Api-Secret-Token': 'fake-secret' },
    body: JSON.stringify({ update_id: 1, message: { ...admin, ...changes } }),
  }) }); } finally { globalThis.fetch = old; }
}

for (const caption of [undefined, 'הנה התמונה 🌸\nשורה שנייה']) {
  test(`Telegram photo with ${caption ? 'caption' : 'no caption'} uses largest photo, uploads JPEG and records human image`, async () => {
    const f = fixture();
    assert.equal((await telegram(f, { caption, photo: [
      { file_id: 'large', width: 1200, height: 900 }, { file_id: 'small', width: 90, height: 90 },
    ] })).status, 200);
    assert.ok(f.calls.some(c => c.url.includes('file_id=large')));
    const file = f.calls.find(c => c.url.endsWith('/media')).body.get('file');
    assert.equal(file.type, 'image/jpeg'); assert.equal(file.name, 'photo.jpg');
    const sent = JSON.parse(f.calls.find(c => c.url.endsWith('/messages')).body);
    assert.equal(sent.to, phone); assert.equal(sent.type, 'image'); assert.equal(sent.image.id, 'uploaded-media');
    assert.equal(sent.image.caption, caption);
    assert.ok(f.sqls.some(s => s.sql.includes('human_until_ms = ?')));
    assert.ok(f.sqls.some(s => s.sql.includes('INSERT OR IGNORE INTO messages') && s.args[2] === 'image' && s.args[3] === (caption || null)));
  });
}

test('Voice still uploads OGG and sends audio', async () => {
  const f = fixture(); await telegram(f, { voice: { file_id: 'voice' } });
  const file = f.calls.find(c => c.url.endsWith('/media')).body.get('file');
  assert.equal(file.type, 'audio/ogg'); assert.equal(file.name, 'voice.ogg');
  assert.equal(JSON.parse(f.calls.find(c => c.url.endsWith('/messages')).body).type, 'audio');
});

for (const option of ['uploadFail', 'downloadFail']) {
  test(`${option} reports error without sending or recording a WhatsApp image`, async () => {
    const f = fixture({ [option]: true });
    await telegram(f, { photo: [{ file_id: 'photo', width: 10, height: 10 }] });
    assert.ok(!f.calls.some(c => c.url.endsWith('/messages')));
    assert.ok(!f.sqls.some(s => s.sql.includes('INSERT OR IGNORE INTO messages')));
    assert.ok(f.calls.some(c => c.url.endsWith('/sendMessage') && JSON.parse(c.body).text.startsWith('❌')));
  });
}

test('Wrong topic or unapproved admin cannot send a photo', async () => {
  for (const changes of [{ message_thread_id: 11 }, { from: { id: 8 } }]) {
    const f = fixture(); await telegram(f, { ...changes, photo: [{ file_id: 'photo', width: 10, height: 10 }] });
    assert.equal(f.calls.length, 0); assert.equal(f.sqls.length, 0);
  }
});

async function inbound(f, caption, useQueue) {
  const body = JSON.stringify({ object: 'whatsapp_business_account', entry: [{ changes: [{ value: {
    metadata: { phone_number_id: 'fake-phone' }, contacts: [{ profile: { name: 'Test' } }],
    messages: [{ from: phone, id: 'incoming-id', type: 'image', image: { id: 'incoming-media', caption } }],
  } }] }] });
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode('fake-meta'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = Buffer.from(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))).toString('hex');
  const old = globalThis.fetch;
  globalThis.fetch = f.fetch;
  try { return await onRequest({ env: { ...f.env, USE_QUEUE: useQueue ? 'true' : 'false' }, request: new Request('https://example.invalid/api/whatsapp', {
    method: 'POST', headers: { 'X-Hub-Signature-256': 'sha256=' + signature }, body,
  }) }); } finally { globalThis.fetch = old; }
}

test('Queued inbound image preserves customer caption and media ID in the message row', async () => {
  const f = fixture(); await inbound(f, 'caption with emoji 🌸', true);
  const insert = f.sqls.find(s => s.sql.includes('INSERT INTO messages'));
  assert.equal(insert.args[4], 'caption with emoji 🌸');
  assert.equal(JSON.parse(insert.args[5]).media_id, 'incoming-media');
  assert.equal(f.queue.length, 1);
});

for (const caption of ['caption 🌸', 'א'.repeat(1024)]) {
  test(`Legacy inbound preserves ${caption.length > 1000 ? 'long' : 'short'} caption with its photo`, async () => {
    const f = fixture(); await inbound(f, caption, false);
    const form = f.calls.find(c => c.url.endsWith('/sendPhoto')).body;
    assert.ok(form.get('caption').includes(`Phone: ${phone}`));
    assert.ok(form.get('caption').length <= 1024);
    if (caption.length > 1000) {
      const text = JSON.parse(f.calls.find(c => c.url.endsWith('/sendMessage')).body);
      assert.ok(text.text.includes(caption)); assert.equal(text.reply_parameters.message_id, 44);
    } else assert.ok(form.get('caption').includes(caption));
  });
}

