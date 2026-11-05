import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { transformWithEsbuild } from 'vite'
import { webcrypto } from 'node:crypto'

// Execute the actual Edge Function handler with controlled auth/database clients.
const source = fs.readFileSync(new URL('../supabase/functions/beva-attendance/index.ts', import.meta.url), 'utf8').replace(/^import .*\n/gm, '')
let handler
let currentUser
let rpcCalls = []
const accountId = '11111111-1111-4111-8111-111111111111'
const client = {
  auth: { async getUser(token) {
    currentUser = ['admin','direction','agent','inactive'].includes(token) ? token : null
    return { data: { user: currentUser ? { id: currentUser } : null }, error: !currentUser }
  } },
  from(table) {
    const query = { select() { return this }, eq() { return this },
      async maybeSingle() { return { data: table === 'staff_members' && currentUser !== 'inactive' ? { user_id: currentUser, role: currentUser, active: true } : null } }
    }
    return query
  },
  async rpc(name, args) { rpcCalls.push({ name, args }); return { data: 'synthetic-teacher-password', error: null } }
}
const compiled = await transformWithEsbuild(source, 'attendance.ts', { loader: 'ts', format: 'cjs', target: 'es2022' })
vm.runInNewContext(compiled.code, {
  createClient: () => client,
  Deno: { env: { get: name => name }, serve: fn => { handler = fn } },
  crypto: webcrypto, TextEncoder, Request, Response, btoa, Uint8Array, Date, Set, Map,
})
async function call(token, action = 'reveal_teacher_password', body = {}) {
  const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
  const response = await handler(new Request('https://example.test', { method: 'POST', headers, body: JSON.stringify({ action, accountId, ...body }) }))
  return { response, payload: await response.json() }
}
for (const token of [null, 'teacher-token', 'invalid-jwt']) {
  rpcCalls = []
  const { response } = await call(token)
  assert.equal(response.status, 401)
  assert.equal(rpcCalls.length, 0, 'No secret lookup before staff authentication')
}
assert.equal((await call('inactive')).response.status, 403)
for (const role of ['admin','direction','agent']) {
  rpcCalls = []
  const { response, payload } = await call(role)
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('Cache-Control'), 'no-store')
  assert.equal(payload.password, 'synthetic-teacher-password')
  assert.equal(rpcCalls[0].args.p_staff_id, role, 'Staff ID must come from verified identity')
  assert.equal(rpcCalls[0].args.p_account_id, accountId)
}
rpcCalls = []
assert.equal((await call('agent', 'save_teacher_account')).response.status, 403, 'Agents cannot change passwords')
assert.equal(rpcCalls.length, 0)
assert.equal((await call('admin', 'reveal_teacher_password', { accountId: 'bad' })).response.status, 400)
client.rpc = async () => ({ data: null, error: null })
assert.equal((await call('admin')).payload.password, null, 'Legacy hashes must not be represented as readable passwords')
client.rpc = async () => ({ data: null, error: new Error('sensitive internal detail') })
const failed = await call('admin')
assert.equal(failed.payload.error, 'PASSWORD_READ_FAILED', 'Database errors must not leak secret details')
console.log('Accès mots de passe : authentification, rôles, absence de cache et anciens mots de passe OK')
