import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8')
const migration = read('../supabase/migrations/20261104143641_add_attendance_tracking.sql')
const edge = read('../supabase/functions/beva-attendance/index.ts')
const portal = read('../src/components/teacher-portal.jsx')
const configuration = read('../src/screens/configuration.jsx')
const app = read('../src/App.jsx')
const chrome = read('../src/components/app-chrome.jsx')
const css = read('../src/app.css')

// Un seul compte par formation, secrets inaccessibles aux rôles du navigateur.
assert.match(migration, /formation_id uuid not null unique references public\.formations/)
assert.match(migration, /revoke all on public\.teacher_account_credentials from anon, authenticated/)
assert.match(migration, /revoke all on public\.teacher_access_sessions from anon, authenticated/)
assert.match(migration, /alter table public\.attendance_records enable row level security/)

// 3 séances obligatoires pour l'anglais, 2 pour chaque autre formation.
assert.equal((migration.match(/\('anglais',/g) || []).length, 3)
for (const key of ['japonais', 'montage', 'graph', 'intelligence']) {
  assert.equal((migration.match(new RegExp(`\\('${key}',`, 'g')) || []).length, 2)
}
assert.doesNotMatch(migration, /Classe B/)

// Le professeur coche les présents; le serveur déduit les absents actifs.
assert.match(edge, /presentEnrollmentIds/)
assert.match(edge, /status: present \? \(lateIds\.has\(enrollment\.id\) \? "late" : "present"\) : "absent"/)
assert.match(edge, /status: "cancelled"/)
assert.match(edge, /delete\(\)\.eq\("session_id", attendanceSession\.id\)/)
assert.match(portal, /Les .* autres seront marqués absents, non prévenus et sans motif/)
assert.match(portal, /Cours non tenu/)
assert.match(portal, /Rattrapage effectué aujourd’hui/)
assert.match(portal, /Ces séances ne sont pas comptées comme des absences/)
assert.match(portal, /function toggleAllPresent\(\)/)
assert.match(portal, /allPresent\?'Tout désélectionner':'Tout le monde est présent'/)
assert.match(portal, /if\(allPresent\)\{setPresentIds\(new Set\(\)\);setLateIds\(new Set\(\)\)/)

// Deux portes d'entrée séparées, et la présence reste utilisable sur téléphone.
assert.match(app, /Personnel BEVA/)
assert.match(app, /Professeur/)
assert.match(chrome, /attendance: \{ label: tr\('Présences'/)
assert.match(css, /grid-template-columns:repeat\(6,minmax\(0,1fr\)\)/)

// La configuration professeur expose l'état global et des contrôles accessibles.
assert.match(configuration, /readyCount/)
assert.match(configuration, /Piloter les accès professeurs/)
assert.match(configuration, /Afficher le mot de passe/)
assert.match(configuration, /type=\{isVisible\?'text':'password'\}/)
assert.match(configuration, /Finaliser cet accès/)
assert.match(css, /\.teacher-access-overview/)
assert.match(css, /@media\(max-width:720px\).*\.teacher-access-row\{grid-template-columns:1fr\}/s)

console.log('Test suivi des présences : OK')
