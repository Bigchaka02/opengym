/* Coach/client fork (PROJECT.md): the fixed client profiles. The server creates them on boot,
   lists them, signs a browser in as one with no credential, and serves that client's own data.
   Real server.js in a child, with PROFILES set (npm test turns it off for every other suite). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { boundPort } from './helpers.mjs';

const API = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

async function startServer(t, PROFILES, seed = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gym-profiles-'));
  for (const [uid, state] of Object.entries(seed)) fs.writeFileSync(path.join(dataDir, `state-${uid}.json`), JSON.stringify(state));
  const child = spawn(process.execPath, ['server.js'], {
    cwd: API, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: '0', DATA_DIR: dataDir, ORIGIN: 'http://localhost:8080', RP_ID: 'localhost', PROFILES }
  });
  const h = { log: '', dataDir };
  child.stdout.on('data', d => h.log += d);
  child.stderr.on('data', d => h.log += d);
  t.after(() => { child.kill('SIGKILL'); fs.rmSync(dataDir, { recursive: true, force: true }); });
  h.api = `http://127.0.0.1:${await boundPort(child, () => h.log)}`;
  return h;
}
const login = (h, uid) => fetch(`${h.api}/api/profiles/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uid }) });
const cookieOf = r => (r.headers.getSetCookie?.() || [r.headers.get('set-cookie')]).find(c => c?.startsWith('gymsid='))?.split(';')[0];

test('the profiles are created on boot and listed in order', async t => {
  const h = await startServer(t, 'client1:Client 1,client2:Client 2');
  assert.deepEqual((await (await fetch(`${h.api}/api/profiles`)).json()).profiles,
    [{ id: 'client1', name: 'Client 1' }, { id: 'client2', name: 'Client 2' }]);
  const db = JSON.parse(fs.readFileSync(path.join(h.dataDir, 'db.json'), 'utf8'));
  assert.deepEqual(db.users.map(u => u.id), ['client1', 'client2']);
});

test('signing in as a profile is a session for that client, and only for a listed one', async t => {
  const h = await startServer(t, 'client1:Client 1,client2:Client 2', { client2: { workouts: [{ id: 'w1', d: '2026-10-20', name: 'Leg Day' }], routines: [] } });
  const r = await login(h, 'client2');
  assert.equal(r.status, 200);
  assert.equal((await r.json()).user.id, 'client2');
  const Cookie = cookieOf(r);
  assert.ok(Cookie, 'a session cookie');
  assert.equal((await (await fetch(`${h.api}/api/me`, { headers: { Cookie } })).json()).user.name, 'Client 2');
  const data = await (await fetch(`${h.api}/api/data`, { headers: { Cookie } })).json();
  assert.equal(data.state.workouts[0].name, 'Leg Day', "the client's own data file");
  assert.equal((await login(h, 'someone-else')).status, 404);
  assert.equal((await login(h, '')).status, 404);
});

test('PROFILES=off: no profiles, and no way in through the route', async t => {
  const h = await startServer(t, 'off');
  assert.deepEqual((await (await fetch(`${h.api}/api/profiles`)).json()).profiles, []);
  assert.equal((await login(h, 'client1')).status, 404);
});
