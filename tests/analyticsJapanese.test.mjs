import assert from 'node:assert/strict'
import { classifyAnalyticsQuery } from '../src/lib/analytics-query.js'

const cases = [
  ['年齢', 'age'],
  ['平均年齢', 'age'],
  ['最高年齢', 'oldest'],
  ['最年少', 'youngest'],
  ['講座別受講生', 'formation'],
  ['講座別の未払い残高', 'money'],
  ['受講生ステータス', 'status'],
  ['予定フォロー', 'followup'],
  ['新規登録', 'trend'],
  ['plus âgé', 'oldest'],
  ['balance by course', 'money']
]

for (const [query, expected] of cases) assert.equal(classifyAnalyticsQuery(query), expected, query)

console.log('Reconnaissance des analyses en français, anglais et japonais : OK')
