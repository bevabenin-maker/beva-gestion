export const normalizeAnalyticsQuery = value => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase()
  .trim()

const includesAny = (text, words) => words.some(word => text.includes(word))

export function classifyAnalyticsQuery(query) {
  const text = normalizeAnalyticsQuery(query)

  if (includesAny(text, ['oldest', 'vieux', 'senior', '最高年齢', '最年長']) || (text.includes('plus') && text.includes('age'))) return 'oldest'
  if (includesAny(text, ['youngest', 'jeune', '最低年齢', '最年少']) || (text.includes('moins') && text.includes('age'))) return 'youngest'
  if (!text || includesAny(text, ['age', '年齢', '年代', '平均年齢'])) return 'age'
  if (includesAny(text, ['reste', 'raf', 'finance', 'paiement', 'balance', 'payment', '未払い', '残高', '支払い', '料金', '入金'])) return 'money'
  if (includesAny(text, ['formation', 'cours', 'course', '講座', 'コース', '研修'])) return 'formation'
  if (includesAny(text, ['statut', 'actif', 'disponible', 'suspend', 'status', 'active', 'ステータス', '状態', '在籍', '利用可能', '一時停止'])) return 'status'
  if (includesAny(text, ['relance', 'note', 'suivi', 'follow', 'フォロー', '記録', 'メモ', '連絡'])) return 'followup'
  if (includesAny(text, ['inscription', 'nouveau', 'registration', 'new student', '登録', '新規'])) return 'trend'
  return 'unknown'
}
