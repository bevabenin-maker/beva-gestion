import assert from 'node:assert/strict'
import { applyPreferences, formatMoney, receiptFileName } from '../src/lib/preferences.js'

applyPreferences({ language: 'fr', currency: 'XOF', rates: { XOF: 1 } })
assert.equal(formatMoney(90000), '90 000 FCFA')
assert.equal(receiptFileName('N° BEVA-2026-ABC123'), 'reçu-BEVA-2026-ABC123')

applyPreferences({ language: 'en', currency: 'USD', rates: { XOF: 1, USD: 0.0017 } })
assert.match(formatMoney(90000), /153/)
assert.equal(receiptFileName('BEVA-2026-ABC123'), 'receipt-BEVA-2026-ABC123')

console.log('Langue, conversion monétaire et nom de reçu vérifiés.')
