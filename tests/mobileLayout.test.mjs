import assert from 'node:assert/strict'
import fs from 'node:fs'

const css = fs.readFileSync(new URL('../src/style.css', import.meta.url), 'utf8')
const main = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
const mobileBlock = css.match(/@media \(max-width: 720px\) \{([\s\S]*?)\n\}/)?.[1] || ''
const mobileSidebar = mobileBlock.match(/\.sidebar \{([^}]*)\}/)?.[1] || ''

assert.match(mobileSidebar, /position:\s*fixed/)
assert.match(mobileSidebar, /top:\s*auto/)
assert.match(mobileSidebar, /bottom:\s*0/)
assert.match(mobileSidebar, /height:\s*auto/)
assert.match(mobileBlock, /\.main \{[^}]*padding:[^}]*(?:96px|env\(safe-area-inset-bottom\))/)
assert.match(css, /\.mobile-formation-list \{ display: grid/)
assert.match(css, /\.payments-layout \.financial-panel \{ order: 1/)
assert.match(css, /\.student-mobile-detail\.open, \.payment-mobile-detail\.open \{ display: block/)
assert.match(main, /data-mobile-detail="student-mobile-/)
assert.match(main, /data-mobile-detail="payment-mobile-/)
assert.match(main, /Sans formation \/ à classer/)

console.log('Test mise en page mobile : OK')
