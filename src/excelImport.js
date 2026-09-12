const NAVY = '#071A33'
const BLUE = '#0C417D'
const GOLD = '#D4AF37'
const LIGHT_BLUE = '#EAF0F8'
const BORDER = '#DCE5F0'
const TEXT = '#1B304B'
const MUTED = '#5F7188'

export const STUDENT_IMPORT_SHEET = 'Élèves à importer'

export const STUDENT_IMPORT_HEADERS = [
  'Nom *', 'Prénom(s) *', 'Téléphone', 'E-mail', 'Sexe', 'Date de naissance', 'Adresse', 'Statut élève',
  'Formation 1', 'Statut formation 1', 'Mode formation 1', 'Tarif formation 1',
  'Formation 2', 'Statut formation 2', 'Mode formation 2', 'Tarif formation 2',
  'Formation 3', 'Statut formation 3', 'Mode formation 3', 'Tarif formation 3',
  'Formation 4', 'Statut formation 4', 'Mode formation 4', 'Tarif formation 4',
  'Note initiale', 'Date de relance'
]

const normalizeLabel = value => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLowerCase()
  .replace(/[’']/g, '')
  .replace(/[_-]+/g, ' ')
  .replace(/\s+/g, ' ')

const cleanText = value => {
  const text = String(value ?? '').replace(/^\u2060/, '').trim()
  return text || null
}

const phoneKey = value => {
  const digits = String(value ?? '').replace(/\D/g, '')
  return digits.length >= 8 ? digits.slice(-8) : digits || null
}

const emailKey = value => cleanText(value)?.toLowerCase() || null
const nameKey = (lastName, firstName, birthDate) => birthDate
  ? `${normalizeLabel(lastName)}|${normalizeLabel(firstName)}|${birthDate}`
  : null

const dateParts = date => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function toIsoDate(value) {
  if (value === null || value === undefined || value === '') return null
  // Excel stores a date as a day number without a timezone. Some readers
  // return that day close to midnight with an offset, which can look like the
  // previous day in UTC. Rounding through midday preserves the calendar date.
  if (value instanceof Date && !Number.isNaN(value.getTime())) return new Date(value.getTime() + 12 * 60 * 60 * 1000).toISOString().slice(0, 10)
  if (typeof value === 'number' && Number.isFinite(value)) {
    const date = new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 86400000)
    return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10)
  }
  const text = String(value).trim()
  let match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) {
    const french = text.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/)
    if (french) match = [text, french[3], french[2].padStart(2, '0'), french[1].padStart(2, '0')]
  }
  if (!match) return null
  const iso = `${match[1]}-${match[2]}-${match[3]}`
  const date = new Date(`${iso}T12:00:00`)
  return Number.isNaN(date.getTime()) || dateParts(date) !== iso ? null : iso
}

const studentStatusMap = new Map([
  ['actif', 'actif'], ['suspendu', 'suspendu'], ['abandon', 'abandonne'], ['abandonne', 'abandonne']
])
const enrollmentStatusMap = new Map([
  ['disponible', 'disponible'], ['actif', 'inscrit'], ['inscrit', 'inscrit']
])
const learningModeMap = new Map([
  ['presentiel', 'presentiel'], ['en ligne', 'en_ligne'], ['online', 'en_ligne']
])
const scholarshipMap = new Map([
  ['boursier', true], ['bourse', true], ['oui', true],
  ['standard', false], ['non boursier', false], ['non', false]
])
const sexMap = new Map([
  ['femme', 'Femme'], ['f', 'Femme'], ['homme', 'Homme'], ['h', 'Homme'], ['m', 'Homme']
])

const templateTitleRow = width => [
  { value: 'BEVA — Modèle d’import des élèves', type: String, columnSpan: width, height: 32, fontSize: 16, fontWeight: 'bold', textColor: GOLD, backgroundColor: NAVY, alignVertical: 'center' },
  ...Array(width - 1).fill(null)
]

const templateInfoRow = (value, width) => [
  { value, type: String, columnSpan: width, height: 25, fontSize: 10, textColor: MUTED, backgroundColor: LIGHT_BLUE, alignVertical: 'center' },
  ...Array(width - 1).fill(null)
]

const headerCell = value => ({
  value,
  type: String,
  height: 42,
  fontWeight: 'bold',
  textColor: '#FFFFFF',
  backgroundColor: BLUE,
  alignVertical: 'center',
  wrap: true,
  bottomBorderColor: GOLD,
  bottomBorderStyle: 'medium'
})

const exampleCell = (value, format = undefined) => ({
  value,
  type: value instanceof Date ? Date : typeof value === 'number' ? Number : String,
  format,
  height: 27,
  textColor: TEXT,
  backgroundColor: '#FFFFFF',
  alignVertical: 'center',
  wrap: true,
  bottomBorderColor: BORDER,
  bottomBorderStyle: 'thin'
})

export function buildStudentImportTemplate(state, intakeId = state.intakeFilter) {
  const intake = state.intakes.find(item => item.id === intakeId)
  const formations = state.formations.filter(item => item.active).map(item => item.name)
  const widths = [18, 22, 17, 26, 11, 17, 25, 15, 27, 18, 18, 18, 27, 18, 18, 18, 27, 18, 18, 18, 27, 18, 18, 18, 40, 17]
  const example = [
    'AMOUZOU', 'Laure', '+229 01 97 00 00 00', 'laure@example.com', 'Femme', new Date(2001, 4, 12), 'Cotonou', 'Actif',
    formations[0] || 'Anglais', 'Actif', 'Présentiel', 'Boursier',
    formations[1] || '', formations[1] ? 'Disponible' : '', formations[1] ? 'En ligne' : '', formations[1] ? 'Standard' : '',
    '', '', '', '', '', '', '', '',
    'Prévoit de compléter son dossier la semaine prochaine.', new Date()
  ]
  const importSheet = {
    sheet: STUDENT_IMPORT_SHEET,
    data: [
      templateTitleRow(STUDENT_IMPORT_HEADERS.length),
      templateInfoRow(`Vague de destination : ${intake?.name || 'à sélectionner dans BEVA Gestion avant l’import'}`, STUDENT_IMPORT_HEADERS.length),
      templateInfoRow('Ne renommez pas les colonnes. Commencez à saisir les élèves sous la ligne d’en-tête. Une ligne correspond à un élève.', STUDENT_IMPORT_HEADERS.length),
      Array(STUDENT_IMPORT_HEADERS.length).fill(null),
      STUDENT_IMPORT_HEADERS.map(headerCell)
    ],
    columns: widths.map(width => ({ width })),
    stickyRowsCount: 5,
    showGridLines: false,
    orientation: 'landscape',
    zoomScale: 0.65
  }
  const exampleSheet = {
    sheet: 'Exemple',
    data: [
      templateTitleRow(STUDENT_IMPORT_HEADERS.length),
      templateInfoRow('Cette ligne est uniquement un exemple. Recopiez le principe dans la feuille « Élèves à importer » ; elle ne sera jamais importée.', STUDENT_IMPORT_HEADERS.length),
      Array(STUDENT_IMPORT_HEADERS.length).fill(null),
      STUDENT_IMPORT_HEADERS.map(headerCell),
      example.map((value, index) => exampleCell(value, index === 5 || index === 25 ? 'dd/mm/yyyy' : index === 2 ? '@' : undefined))
    ],
    columns: widths.map(width => ({ width })),
    stickyRowsCount: 4,
    showGridLines: false,
    orientation: 'landscape',
    zoomScale: 0.65
  }
  const instructions = [
    ['Règle', 'Valeurs acceptées / explication'],
    ['Nom et prénom(s)', 'Obligatoires.'],
    ['Téléphone', 'Saisissez-le comme texte, de préférence avec l’indicatif +229.'],
    ['Sexe', 'Femme ou Homme.'],
    ['Date', 'Format conseillé : JJ/MM/AAAA.'],
    ['Statut élève', 'Actif, Suspendu ou Abandon. Laisser vide signifie Actif.'],
    ['Formation', formations.join(', ') || 'Aucune formation active trouvée.'],
    ['Statut formation', 'Disponible ou Actif. Laisser vide signifie Disponible. Seuls les dossiers Actifs créent un montant attendu.'],
    ['Mode formation', 'Présentiel ou En ligne. Laisser vide signifie Présentiel.'],
    ['Tarif formation', 'Boursier ou Standard. Obligatoire dès qu’une formation est indiquée.'],
    ['Note / relance', 'La date de relance est facultative, mais exige une note.'],
    ['Doublons', 'Un téléphone, un e-mail ou le même nom + prénom + date de naissance déjà présent dans la vague sera refusé.'],
    ['Limite', 'Maximum 500 élèves par fichier. Les paiements ne sont jamais importés par ce modèle.']
  ]
  const instructionSheet = {
    sheet: 'Instructions',
    data: [
      templateTitleRow(2),
      templateInfoRow(`Modèle préparé pour ${intake?.name || 'la vague sélectionnée dans BEVA Gestion'}.`, 2),
      [null, null],
      ...instructions.map((row, rowIndex) => row.map(value => ({
        value,
        type: String,
        height: rowIndex === 0 ? 30 : 34,
        fontWeight: rowIndex === 0 ? 'bold' : undefined,
        textColor: rowIndex === 0 ? '#FFFFFF' : TEXT,
        backgroundColor: rowIndex === 0 ? BLUE : rowIndex % 2 ? '#FFFFFF' : '#F7FAFE',
        wrap: true,
        alignVertical: 'center',
        bottomBorderColor: BORDER,
        bottomBorderStyle: 'thin'
      })))
    ],
    columns: [{ width: 25 }, { width: 90 }],
    stickyRowsCount: 4,
    showGridLines: false,
    zoomScale: 0.9
  }
  const safeIntake = String(intake?.name || 'Vague').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '_')
  return { fileName: `BEVA_Modele_Import_Eleves_${safeIntake}.xlsx`, sheets: [importSheet, exampleSheet, instructionSheet] }
}

export async function downloadStudentImportTemplate(state, intakeId) {
  const { default: writeExcelFile } = await import('write-excel-file/browser')
  const workbook = buildStudentImportTemplate(state, intakeId)
  await writeExcelFile(workbook.sheets, { fontFamily: 'Arial', fontSize: 10 }).toFile(workbook.fileName)
  return workbook.fileName
}

function exactHeaderMatch(row) {
  return STUDENT_IMPORT_HEADERS.every((header, index) => cleanText(row[index]) === header) && row.length <= STUDENT_IMPORT_HEADERS.length
}

export async function parseStudentImportFile(file, state, intakeId = state.intakeFilter) {
  if (!file) throw new Error('Choisissez un fichier Excel.')
  if (!/\.xlsx$/i.test(file.name || '')) throw new Error('Le fichier doit être au format .xlsx.')
  const { readSheet } = await import('read-excel-file/browser')
  let rows
  try {
    rows = await readSheet(file, STUDENT_IMPORT_SHEET)
  } catch (error) {
    throw new Error(`Impossible de lire la feuille « ${STUDENT_IMPORT_SHEET} ». Utilisez le modèle téléchargé depuis BEVA Gestion.`)
  }
  return parseStudentImportRows(rows, state, intakeId, file.name)
}

export function parseStudentImportRows(rows, state, intakeId = state.intakeFilter, fileName = 'import.xlsx') {
  const headerIndex = rows.findIndex(exactHeaderMatch)
  if (headerIndex < 0) throw new Error('Les colonnes du modèle ont été renommées, supprimées ou déplacées. Téléchargez un nouveau modèle.')
  const rawRows = rows.slice(headerIndex + 1).filter(row => row.some(cell => cleanText(cell)))
  if (!rawRows.length) throw new Error('Le fichier ne contient aucun élève à importer.')
  if (rawRows.length > 500) throw new Error('Un fichier peut contenir au maximum 500 élèves.')

  const formationDirectory = new Map(state.formations.filter(item => item.active).map(item => [normalizeLabel(item.name), item]))
  const existingStudents = state.students.filter(student => student.intake_id === intakeId)
  const existingPhones = new Set(existingStudents.map(student => phoneKey(student.phone)).filter(Boolean))
  const existingEmails = new Set(existingStudents.map(student => emailKey(student.email)).filter(Boolean))
  const existingNames = new Set(existingStudents.map(student => nameKey(student.last_name, student.first_name, student.birth_date)).filter(Boolean))

  const parsed = rawRows.map((row, index) => {
    const line = headerIndex + index + 2
    const issues = []
    const lastName = cleanText(row[0])
    const firstName = cleanText(row[1])
    const phone = cleanText(row[2])
    const email = emailKey(row[3])
    const sexText = cleanText(row[4])
    const birthDateRaw = row[5]
    const birthDate = toIsoDate(birthDateRaw)
    const address = cleanText(row[6])
    const statusText = normalizeLabel(row[7])
    const status = statusText ? studentStatusMap.get(statusText) : 'actif'
    const note = cleanText(row[24])
    const followUpRaw = row[25]
    const followUpOn = toIsoDate(followUpRaw)

    if (!lastName) issues.push('Nom obligatoire.')
    if (!firstName) issues.push('Prénom(s) obligatoire(s).')
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) issues.push('Adresse e-mail invalide.')
    if (sexText && !sexMap.has(normalizeLabel(sexText))) issues.push('Sexe invalide : utilisez Femme ou Homme.')
    if (birthDateRaw !== null && birthDateRaw !== undefined && birthDateRaw !== '' && !birthDate) issues.push('Date de naissance invalide.')
    if (birthDate && birthDate > new Date().toISOString().slice(0, 10)) issues.push('La date de naissance ne peut pas être dans le futur.')
    if (statusText && !status) issues.push('Statut élève invalide : utilisez Actif, Suspendu ou Abandon.')
    if (followUpRaw !== null && followUpRaw !== undefined && followUpRaw !== '' && !followUpOn) issues.push('Date de relance invalide.')
    if (followUpOn && !note) issues.push('Ajoutez une note lorsqu’une date de relance est renseignée.')

    const enrollments = []
    const usedFormations = new Set()
    for (let slot = 1; slot <= 4; slot += 1) {
      const offset = 8 + (slot - 1) * 4
      const formationText = cleanText(row[offset])
      const enrollmentStatusText = normalizeLabel(row[offset + 1])
      const learningModeText = normalizeLabel(row[offset + 2])
      const tariffText = normalizeLabel(row[offset + 3])
      if (!formationText) {
        if (enrollmentStatusText || learningModeText || tariffText) issues.push(`Formation ${slot} manquante alors que ses options sont renseignées.`)
        continue
      }
      const formation = formationDirectory.get(normalizeLabel(formationText))
      if (!formation) issues.push(`Formation ${slot} inconnue : « ${formationText} ».`)
      if (formation && usedFormations.has(formation.id)) issues.push(`La formation « ${formation.name} » est indiquée plusieurs fois.`)
      if (formation) usedFormations.add(formation.id)
      const enrollmentStatus = enrollmentStatusText ? enrollmentStatusMap.get(enrollmentStatusText) : 'disponible'
      const learningMode = learningModeText ? learningModeMap.get(learningModeText) : 'presentiel'
      const scholarship = scholarshipMap.get(tariffText)
      if (enrollmentStatusText && !enrollmentStatus) issues.push(`Statut de la formation ${slot} invalide : utilisez Disponible ou Actif.`)
      if (learningModeText && !learningMode) issues.push(`Mode de la formation ${slot} invalide : utilisez Présentiel ou En ligne.`)
      if (!tariffText || scholarship === undefined) issues.push(`Tarif de la formation ${slot} obligatoire : utilisez Boursier ou Standard.`)
      if (formation && enrollmentStatus && learningMode && scholarship !== undefined) {
        enrollments.push({ slot, formation_id: formation.id, formation_name: formation.name, status: enrollmentStatus, learning_mode: learningMode, scholarship_status: scholarship })
      }
    }

    const normalized = {
      source_row: line,
      last_name: lastName,
      first_name: firstName,
      phone,
      email,
      sex: sexText ? sexMap.get(normalizeLabel(sexText)) : null,
      birth_date: birthDate,
      address,
      status: status || 'actif',
      note,
      follow_up_on: followUpOn,
      enrollments
    }
    return {
      line,
      normalized,
      issues,
      duplicateKeys: {
        phone: phoneKey(phone),
        email,
        name: nameKey(lastName, firstName, birthDate)
      }
    }
  })

  const keyCounts = { phone: new Map(), email: new Map(), name: new Map() }
  parsed.forEach(item => Object.entries(item.duplicateKeys).forEach(([type, key]) => {
    if (key) keyCounts[type].set(key, (keyCounts[type].get(key) || 0) + 1)
  }))
  parsed.forEach(item => {
    const { phone, email, name } = item.duplicateKeys
    if (phone && existingPhones.has(phone)) item.issues.push('Doublon : ce téléphone existe déjà dans la vague.')
    if (email && existingEmails.has(email)) item.issues.push('Doublon : cet e-mail existe déjà dans la vague.')
    if (name && existingNames.has(name)) item.issues.push('Doublon : même nom, prénom et date de naissance dans la vague.')
    if (phone && keyCounts.phone.get(phone) > 1) item.issues.push('Doublon dans le fichier : même téléphone.')
    if (email && keyCounts.email.get(email) > 1) item.issues.push('Doublon dans le fichier : même e-mail.')
    if (name && keyCounts.name.get(name) > 1) item.issues.push('Doublon dans le fichier : même nom, prénom et date de naissance.')
    item.issues = [...new Set(item.issues)]
    item.valid = item.issues.length === 0
  })

  const validRows = parsed.filter(item => item.valid).map(item => item.normalized)
  return {
    fileName,
    rows: parsed,
    validRows,
    total: parsed.length,
    valid: validRows.length,
    invalid: parsed.length - validRows.length
  }
}
