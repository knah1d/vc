const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// Execute production TypeScript with a native SQLite adapter backed by real SQL.
// This avoids mocking the queries we specifically need to verify.
function load(file, mocks) {
  const source = readFileSync(path.join(__dirname, '../src/lib', file), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', output)((name) => {
    if (!(name in mocks)) throw new Error(`Unexpected dependency: ${name}`);
    return mocks[name];
  }, module, module.exports);
  return module.exports;
}

function databaseFixture(t) {
  const files = new Map();
  const lib = load('db.ts', { 'expo-sqlite': {
    async openDatabaseAsync(name) {
      if (!files.has(name)) files.set(name, new DatabaseSync(':memory:'));
      const native = files.get(name);
      return {
        execAsync: async (sql) => native.exec(sql),
        runAsync: async (sql, args) => native.prepare(sql).run(args),
        getAllAsync: async (sql, args) => args ? native.prepare(sql).all(args) : native.prepare(sql).all(),
      };
    },
  } });
  t.after(() => files.forEach((db) => db.close()));
  return lib;
}

const message = { client_id: 'client-uuid', server_id: null, conversation_id: 'chat', sender_id: 'alice', body: 'Hello', created_at: '2026-09-07T00:00:00Z', status: 'sending' };

test('account caches and pending outboxes are isolated, including late writes after switching', async (t) => {
  const { dbForUser } = databaseFixture(t);
  const alice = dbForUser('alice');
  const bob = dbForUser('bob');
  await alice.upsertMessages([message]);
  await alice.upsertConversations([{ id: 'chat', other_id: 'contact', other_name: 'Private contact', unread_count: 2, created_at: message.created_at }]);
  assert.deepEqual(await bob.listConversations(), []);
  assert.deepEqual(await bob.listMessages('chat'), []);
  assert.deepEqual(await bob.listPendingMessages(), []);
  await alice.setMessageStatus(message.client_id, 'sent', 'server-id');
  assert.deepEqual(await bob.listMessages('chat'), []);
  assert.equal((await dbForUser('alice').listMessages('chat')).length, 1);
  assert.throws(() => dbForUser(''));
});

test('history reconciliation preserves one message and the server timestamp after an ack or lost ack', async (t) => {
  const { dbForUser } = databaseFixture(t);
  const db = dbForUser('alice');
  await db.upsertMessages([message]);
  await db.setMessageStatus(message.client_id, 'sent', 'server-id');
  const remote = { ...message, server_id: 'server-id', status: 'sent', created_at: '2026-09-07T00:00:01Z' };
  await db.upsertMessages([remote, remote]);
  const rows = await db.listMessages('chat');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].created_at, remote.created_at);
  assert.deepEqual(await db.listPendingMessages(), []);
});

test('concurrent retries share one send, and stale accounts never send through a new login', async () => {
  let count = 0;
  let resolveAck;
  let account = 'alice';
  const states = [];
  const socket = { connected: true, timeout: () => ({ emitWithAck: () => { count++; return new Promise((resolve) => { resolveAck = resolve; }); } }) };
  const { sendMessage } = load('outbox.ts', {
    'expo-crypto': { randomUUID: () => 'uuid' },
    './db': { dbForUser: (userId) => ({ setMessageStatus: async (...args) => states.push([userId, ...args]) }) },
    './socket': { getSocket: () => socket, socketBelongsTo: (id) => id === account },
  });
  const first = sendMessage('alice', 'chat', 'uuid', 'hello');
  const second = sendMessage('alice', 'chat', 'uuid', 'hello');
  assert.equal(first, second);
  assert.equal(count, 1);
  account = 'bob';
  resolveAck({ message: { id: 'server' } });
  assert.equal(await first, 'sent');
  assert.equal(states[0][0], 'alice');
  assert.equal(await sendMessage('alice', 'chat', 'another', 'hello'), 'failed');
  assert.equal(count, 1);
});
