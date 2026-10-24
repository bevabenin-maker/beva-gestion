import { JAPANESE_TRANSLATIONS } from './translations-ja.js'

export const LANGUAGES = [
  { value: 'fr', label: 'Français', nativeLabel: 'Français' },
  { value: 'en', label: 'English', nativeLabel: 'English' },
  { value: 'ja', label: 'Japonais', nativeLabel: '日本語' }
]

export const CURRENCIES = [
  { value: 'XOF', label: 'Franc CFA', symbol: 'FCFA' },
  { value: 'EUR', label: 'Euro', symbol: '€' },
  { value: 'USD', label: 'Dollar américain', symbol: '$' },
  { value: 'JPY', label: 'Yen japonais', symbol: '¥' }
]

let activePreferences = { language: 'fr', currency: 'XOF', rates: { XOF: 1 }, ratesUpdatedAt: null }

export function applyPreferences(preferences = {}) {
  activePreferences = {
    language: LANGUAGES.some(item => item.value === preferences.language) ? preferences.language : 'fr',
    currency: CURRENCIES.some(item => item.value === preferences.currency) ? preferences.currency : 'XOF',
    rates: { XOF: 1, ...(preferences.rates || {}) },
    ratesUpdatedAt: preferences.ratesUpdatedAt || null
  }
}

export const currentLanguage = () => activePreferences.language
export const currentCurrency = () => activePreferences.currency
export const currentRate = () => Number(activePreferences.rates[activePreferences.currency] || (activePreferences.currency === 'XOF' ? 1 : 0))
export const ratesUpdatedAt = () => activePreferences.ratesUpdatedAt
export const localeCode = () => ({ en: 'en-GB', ja: 'ja-JP' })[activePreferences.language] || 'fr-FR'
export const tr = (french, english, japanese) => {
  if (activePreferences.language === 'en') return english
  if (activePreferences.language === 'ja') return japanese || JAPANESE_TRANSLATIONS[french] || english
  return french
}

export function formatNumber(value, options = {}) {
  return new Intl.NumberFormat(localeCode(), options).format(Number(value || 0))
}

export function formatMoney(value, { compact = false } = {}) {
  const amount = Number(value || 0)
  const currency = activePreferences.currency
  if (currency === 'XOF') {
    const number = new Intl.NumberFormat(localeCode(), compact
      ? { notation: 'compact', maximumFractionDigits: 1 }
      : { maximumFractionDigits: 0 }
    ).format(amount)
    return `${number} FCFA`
  }
  const rate = currentRate()
  const converted = rate ? amount * rate : amount
  return new Intl.NumberFormat(localeCode(), {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    notation: compact ? 'compact' : 'standard',
    maximumFractionDigits: currency === 'JPY' ? 0 : 2
  }).format(converted)
}

export function receiptFileName(number) {
  return `reçu-${String(number || '').replace(/^N[°ºo]?\s*/i, '')}`
}
