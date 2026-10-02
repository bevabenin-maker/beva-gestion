import assert from 'node:assert/strict'
import fs from 'node:fs'

const main = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
const css = fs.readFileSync(new URL('../src/style.css', import.meta.url), 'utf8')
const migration = fs.readFileSync(new URL('../supabase/migrations/20261003001500_whatsapp_follow_up_dashboard.sql', import.meta.url), 'utf8')

assert.match(main, /data-section="whatsapp"/)
assert.match(main, /function whatsappPanel\(\)/)
assert.match(main, /BEVA doit répondre/)
assert.match(main, /En attente du contact/)
assert.match(main, /wa_contact_overview/)
assert.match(main, /downloadWhatsAppContactsExcel/)
assert.match(main, /attention_reason === 'justificatif_paiement'/)
assert.match(css, /\.wa-mobile-detail\.open \{ display: block/)
assert.match(css, /\.wa-cards \{ display: grid/)
assert.match(migration, /security_invoker = true/)
assert.match(migration, /revoke all on public\.wa_contacts from anon/)
assert.match(migration, /private\.current_staff_role\(\)/)
assert.match(migration, /wa_contacts_staff_update/)

console.log('Test tableau de suivi WhatsApp : OK')
