import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { transformWithEsbuild } from 'vite'

// Small hook harness exercises the component's real async/event handlers.
let cursor = 0
const slots = []
let effects = []
const react = {
  useState(initial) {
    const index = cursor++
    slots[index] ??= { value: initial }
    return [slots[index].value, value => { slots[index].value = typeof value === 'function' ? value(slots[index].value) : value }]
  },
  useRef(initial) { const index = cursor++; slots[index] ??= { current: initial }; return slots[index] },
  useEffect(effect, deps) {
    const index = cursor++
    const old = slots[index]
    if (!old || deps.some((value, i) => value !== old.deps[i])) {
      effects.push(() => { old?.cleanup?.(); slots[index] = { deps, cleanup: effect() } })
    }
  }
}
const listeners = {}
const timers = new Map()
let timerId = 0
const windowMock = {
  addEventListener: (name, handler) => { listeners[name] = handler },
  removeEventListener: name => { delete listeners[name] },
  setTimeout: (handler, milliseconds) => { assert.equal(milliseconds, 30000); timers.set(++timerId, handler); return timerId },
  clearTimeout: id => timers.delete(id),
}
let nextResult = async () => ({ password: 'synthetic-saved-password' })
const jsx = (type, props) => ({ type, props })
const source = fs.readFileSync(new URL('../src/components/saved-teacher-password.jsx', import.meta.url), 'utf8')
const compiled = await transformWithEsbuild(source, 'saved-teacher-password.jsx', { loader: 'jsx', format: 'cjs', jsx: 'automatic', jsxImportSource: 'react' })
const module = { exports: {} }
vm.runInNewContext(compiled.code, { module, exports: module.exports, window: windowMock,
  document: { hidden: false, addEventListener: windowMock.addEventListener, removeEventListener: windowMock.removeEventListener },
  require: name => {
    if (name === 'react') return react
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx }
    if (name === '@/lib/attendance') return { attendanceAdminApi: { revealTeacherPassword: () => nextResult() } }
    if (name === '@/lib/preferences') return { tr: value => value }
    if (name === '@/components/ui/button') return { Button: 'button' }
    if (name === '@/components/ui/field') return { Input: 'input' }
    if (name === 'lucide-react') return { Eye: 'eye', EyeOff: 'eye-off' }
    throw new Error(name)
  },
})
let props = { account: { id: 'account-1', password_configured: true } }
function render() {
  cursor = 0; effects = []
  const tree = module.exports.SavedTeacherPassword(props)
  effects.forEach(effect => effect())
  return tree
}
function find(tree, type) {
  if (!tree || typeof tree !== 'object') return null
  if (tree.type === type) return tree
  const children = tree.props?.children || []
  for (const child of Array.isArray(children) ? children.flat(Infinity) : [children]) { const result = find(child, type); if (result) return result }
  return null
}
let tree = render()
assert.equal(find(tree, 'input').props.type, 'password')
await find(tree, 'button').props.onClick()
tree = render()
assert.equal(find(tree, 'input').props.value, 'synthetic-saved-password')
assert.equal(find(tree, 'button').props['aria-pressed'], true)
listeners.blur()
tree = render()
assert.equal(find(tree, 'input').props.type, 'password', 'Blur clears the revealed password')
let resolve
nextResult = () => new Promise(done => { resolve = done })
const pending = find(tree, 'button').props.onClick()
render()
listeners.blur()
resolve({ password: 'late-response-password' })
await pending
tree = render()
assert.equal(find(tree, 'input').props.type, 'password', 'Late responses cannot reveal after hiding')
nextResult = async () => ({ password: 'synthetic-saved-password' })
await find(tree, 'button').props.onClick()
tree = render()
assert.equal(find(tree, 'input').props.type, 'text')
for (const handler of [...timers.values()]) handler()
tree = render()
assert.equal(find(tree, 'input').props.type, 'password', 'Thirty-second timer clears the secret')
nextResult = async () => ({ password: null })
await find(tree, 'button').props.onClick()
tree = render()
assert.equal(find(tree, 'input').props.type, 'password', 'Legacy password remains hidden')
assert.match(JSON.stringify(tree), /redéfinir une fois/)
for (const slot of slots) slot?.cleanup?.()
console.log('Affichage mots de passe : masquage initial, perte de focus, réponse tardive et expiration OK')
