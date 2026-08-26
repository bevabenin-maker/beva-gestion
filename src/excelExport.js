const NAVY = '#071A33'
const BLUE = '#0C417D'
const GOLD = '#D4AF37'
const LIGHT_BLUE = '#EAF0F8'
const VERY_LIGHT_BLUE = '#F7FAFE'
const BORDER = '#DCE5F0'
const TEXT = '#1B304B'
const MUTED = '#5F7188'
const GREEN = '#18724A'
const RED = '#A52A2A'
const AMBER = '#9A6208'

const asDate = value => {
  if (!value) return null
  const text = String(value)
  const date = /^\d{4}-\d{2}-\d{2}$/.test(text)
    ? new Date(`${text}T12:00:00`)
    : new Date(text)
  return Number.isNaN(date.getTime()) ? null : date
}

const ageOf = birthDate => {
  const birth = asDate(birthDate)
  if (!birth) return null
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age -= 1
  return age >= 0 && age < 120 ? age : null
}

const studentAge = student => {
  const calculated = ageOf(student?.birth_date)
  if (calculated !== null) return calculated
  const recorded = Number(student?.age)
  return Number.isInteger(recorded) && recorded >= 0 && recorded < 120 ? recorded : null
}

const displayCode = value => String(value ?? '').replace(/^IN-?/i, '') || ''
const studentStatusLabel = status => ({ actif: 'Actif', suspendu: 'Suspendu', abandonne: 'Abandon' }[status] || status || '')
const enrollmentStatusLabel = status => ({ disponible: 'Disponible', inscrit: 'Actif', termine: 'Terminé', abandonne: 'Abandon' }[status] || status || '')
const learningModeLabel = mode => mode === 'en_ligne' ? 'En ligne' : mode ? 'Présentiel' : ''
const paymentMethodLabel = method => ({ especes: 'Espèces', mobile_money: 'Mobile Money', banque: 'Virement bancaire', carte: 'Carte bancaire', autre: 'Autre' }[method] || String(method || '').replaceAll('_', ' '))
const staffName = (staffDirectory, id) => staffDirectory.find(item => item.user_id === id)?.full_name || 'Système / ancien enregistrement'
const feeFor = scholarship => scholarship ? 90000 : 180000

const activePaymentsFor = (payments, enrollmentId) => payments.filter(payment => payment.enrollment_id === enrollmentId && !payment.cancelled_at)

function financialStatus(enrollment, student, payments) {
  const paid = activePaymentsFor(payments, enrollment.id).reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
  const accounted = Boolean(enrollment.formation_id && enrollment.status === 'inscrit' && student?.status === 'actif')
  const due = accounted ? Number(enrollment.agreed_fee ?? feeFor(Boolean(enrollment.scholarship_status))) : 0
  const remaining = Math.max(0, due - paid)
  return { paid, due, remaining, accounted }
}

// Spreadsheet readers sometimes reinterpret long phone numbers and codes made
// only of digits even when the Open XML cell is textual. A zero-width word
// joiner keeps the visible value unchanged while preventing that conversion.
const textCell = value => {
  const text = String(value ?? '')
  const protectedText = text && /^[+]?\d+$/.test(text) ? `\u2060${text}` : text
  return { value: protectedText, type: String, format: '@' }
}
const numberCell = value => ({ value: Number(value || 0), type: Number, format: '#,##0' })
const moneyCell = value => ({ value: Number(value || 0), type: Number, format: '#,##0 "FCFA"' })
const dateCell = (value, includeTime = false) => {
  const date = asDate(value)
  return date ? { value: date, type: Date, format: includeTime ? 'dd/mm/yyyy hh:mm' : 'dd/mm/yyyy' } : ''
}

const titleRow = (value, width) => [
  { value, type: String, columnSpan: width, height: 30, fontSize: 16, fontWeight: 'bold', textColor: GOLD, backgroundColor: NAVY, alignVertical: 'center' },
  ...Array(Math.max(0, width - 1)).fill(null)
]

const subtitleRow = (value, width) => [
  { value, type: String, columnSpan: width, height: 24, fontSize: 10, textColor: MUTED, backgroundColor: LIGHT_BLUE, alignVertical: 'center' },
  ...Array(Math.max(0, width - 1)).fill(null)
]

const headerCell = value => ({
  value,
  type: String,
  height: 28,
  fontWeight: 'bold',
  textColor: '#FFFFFF',
  backgroundColor: BLUE,
  alignVertical: 'center',
  wrap: true,
  bottomBorderColor: GOLD,
  bottomBorderStyle: 'medium'
})

function styledDataCell(cell, index) {
  const normalized = cell && typeof cell === 'object' && 'value' in cell ? cell : { value: cell ?? '' }
  return {
    ...normalized,
    height: normalized.height || 22,
    textColor: normalized.textColor || TEXT,
    backgroundColor: normalized.backgroundColor || (index % 2 ? VERY_LIGHT_BLUE : '#FFFFFF'),
    alignVertical: normalized.alignVertical || 'center',
    wrap: normalized.wrap ?? true,
    bottomBorderColor: normalized.bottomBorderColor || BORDER,
    bottomBorderStyle: normalized.bottomBorderStyle || 'thin'
  }
}

function makeSheet({ sheet, title, subtitle, headers, widths, rows, zoomScale = 0.9 }) {
  const data = [
    titleRow(title, headers.length),
    subtitleRow(subtitle, headers.length),
    Array(headers.length).fill(null),
    headers.map(headerCell),
    ...rows.map((row, rowIndex) => row.map(cell => styledDataCell(cell, rowIndex)))
  ]
  return {
    data,
    sheet,
    columns: widths.map(width => ({ width })),
    orientation: 'landscape',
    stickyRowsCount: 4,
    showGridLines: false,
    zoomScale
  }
}

const exportDateLabel = () => new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' }).format(new Date())
const cleanFilePart = value => String(value || 'BEVA').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'BEVA'
const sortStudents = students => students.slice().sort((a, b) => Number(b.intake_student_number || 0) - Number(a.intake_student_number || 0))

export function buildStudentWorkbookSheets(state, intakeId = state.intakeFilter) {
  const intake = state.intakes.find(item => item.id === intakeId)
  const students = sortStudents(state.students.filter(student => student.intake_id === intakeId))
  const studentIds = new Set(students.map(student => student.id))
  const studentOrder = new Map(students.map((student, index) => [student.id, index]))
  const enrollments = state.enrollments
    .filter(enrollment => studentIds.has(enrollment.student_id))
    .sort((a, b) => (studentOrder.get(a.student_id) - studentOrder.get(b.student_id)) || Number(a.slot || 0) - Number(b.slot || 0))
  const notes = state.studentNotes.filter(note => studentIds.has(note.student_id)).slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  const subtitle = `${intake?.name || 'Vague non classée'} · Export du ${exportDateLabel()}`

  const studentRows = students.map(student => [
    Number(student.intake_student_number || student.student_number || 0) || '',
    student.last_name || '',
    student.first_name || '',
    student.sex || '',
    dateCell(student.birth_date),
    studentAge(student) ?? '',
    textCell(student.phone),
    student.email || '',
    student.address || '',
    intake?.name || '',
    studentStatusLabel(student.status),
    dateCell(student.created_at, true)
  ])

  const dossierRows = enrollments.map(enrollment => {
    const student = state.students.find(item => item.id === enrollment.student_id)
    const formation = state.formations.find(item => item.id === enrollment.formation_id)
    const summary = financialStatus(enrollment, student, state.payments)
    return [
      Number(student?.intake_student_number || student?.student_number || 0) || '',
      student?.last_name || '',
      student?.first_name || '',
      Number(enrollment.slot || 0) || '',
      textCell(displayCode(enrollment.dossier_code)),
      formation?.name || '',
      enrollmentStatusLabel(enrollment.status),
      learningModeLabel(enrollment.learning_mode),
      enrollment.scholarship_status ? 'Boursier' : 'Non boursier',
      summary.accounted ? 'Oui' : 'Non',
      moneyCell(summary.due),
      moneyCell(summary.paid),
      moneyCell(summary.remaining)
    ]
  })

  const noteRows = notes.map(note => {
    const student = state.students.find(item => item.id === note.student_id)
    return [
      Number(student?.intake_student_number || student?.student_number || 0) || '',
      student?.last_name || '',
      student?.first_name || '',
      { value: note.content || '', wrap: true, alignVertical: 'top', height: 34 },
      dateCell(note.follow_up_on),
      staffName(state.staffDirectory, note.created_by),
      dateCell(note.created_at, true),
      dateCell(note.updated_at, true)
    ]
  })

  return {
    fileName: `BEVA_Eleves_${cleanFilePart(intake?.name)}_${new Date().toISOString().slice(0, 10)}.xlsx`,
    sheets: [
      makeSheet({ sheet: 'Élèves', title: 'BEVA — Liste des élèves', subtitle: `${subtitle} · ${students.length} élève(s)`, headers: ['N°', 'Nom', 'Prénom(s)', 'Sexe', 'Date de naissance', 'Âge', 'Téléphone', 'E-mail', 'Adresse', 'Vague', 'Statut', 'Date d’inscription'], widths: [8, 18, 22, 12, 16, 8, 17, 27, 28, 18, 13, 19], rows: studentRows }),
      makeSheet({ sheet: 'Dossiers', title: 'BEVA — Dossiers de formation', subtitle: `${subtitle} · Le montant attendu ne compte que les dossiers actifs.`, headers: ['N° élève', 'Nom', 'Prénom(s)', 'Dossier', 'Code', 'Formation', 'Statut du dossier', 'Mode', 'Tarif', 'Comptabilisé', 'Montant attendu', 'Montant encaissé', 'Reste à payer'], widths: [10, 18, 22, 9, 14, 24, 18, 13, 15, 14, 18, 18, 17], rows: dossierRows }),
      makeSheet({ sheet: 'Notes de suivi', title: 'BEVA — Notes de suivi', subtitle: `${subtitle} · ${notes.length} note(s)`, headers: ['N° élève', 'Nom', 'Prénom(s)', 'Note', 'Date de relance', 'Auteur', 'Date d’ajout', 'Dernière modification'], widths: [10, 18, 22, 48, 17, 24, 20, 20], rows: noteRows })
    ]
  }
}

export function buildPaymentWorkbookSheets(state, intakeId = state.intakeFilter) {
  const intake = state.intakes.find(item => item.id === intakeId)
  const students = state.students.filter(student => student.intake_id === intakeId)
  const studentIds = new Set(students.map(student => student.id))
  const enrollments = state.enrollments.filter(enrollment => studentIds.has(enrollment.student_id))
  const enrollmentIds = new Set(enrollments.map(enrollment => enrollment.id))
  const payments = state.payments.filter(payment => enrollmentIds.has(payment.enrollment_id)).slice().sort((a, b) => new Date(b.paid_at) - new Date(a.paid_at))
  const pending = state.payments.filter(payment => payment.payment_context === 'pending' && !payment.cancelled_at).slice().sort((a, b) => new Date(b.paid_at) - new Date(a.paid_at))
  const activePayments = payments.filter(payment => !payment.cancelled_at)
  const cancelledPayments = payments.filter(payment => payment.cancelled_at)
  const subtitle = `${intake?.name || 'Vague non classée'} · Export du ${exportDateLabel()}`

  const paymentSituationRows = enrollments
    .filter(enrollment => enrollment.formation_id)
    .slice()
    .sort((a, b) => {
      const studentA = state.students.find(item => item.id === a.student_id)
      const studentB = state.students.find(item => item.id === b.student_id)
      const nameA = `${studentA?.last_name || ''} ${studentA?.first_name || ''}`
      const nameB = `${studentB?.last_name || ''} ${studentB?.first_name || ''}`
      return nameA.localeCompare(nameB, 'fr', { sensitivity: 'base' }) || Number(a.slot || 0) - Number(b.slot || 0)
    })
    .map(enrollment => {
      const student = state.students.find(item => item.id === enrollment.student_id)
      const formation = state.formations.find(item => item.id === enrollment.formation_id)
      const situation = financialStatus(enrollment, student, state.payments)
      const paymentState = !situation.accounted
        ? { value: 'Non comptabilisé', textColor: MUTED, backgroundColor: LIGHT_BLUE, fontWeight: 'bold' }
        : situation.due > 0 && situation.remaining === 0
          ? { value: 'Soldé', textColor: GREEN, backgroundColor: '#E8F7EF', fontWeight: 'bold' }
          : situation.paid > 0
            ? { value: 'Partiel', textColor: AMBER, backgroundColor: '#FFF4D8', fontWeight: 'bold' }
            : { value: 'Non payé', textColor: RED, backgroundColor: '#FFF0F0', fontWeight: 'bold' }
      return [
        Number(student?.intake_student_number || student?.student_number || 0) || '',
        `${student?.last_name || ''} ${student?.first_name || ''}`.trim(),
        formation?.name || '',
        moneyCell(situation.due),
        moneyCell(situation.paid),
        moneyCell(situation.remaining),
        paymentState
      ]
    })

  const paymentRows = payments.map(payment => {
    const enrollment = state.enrollments.find(item => item.id === payment.enrollment_id)
    const student = enrollment && state.students.find(item => item.id === enrollment.student_id)
    const formation = enrollment && state.formations.find(item => item.id === enrollment.formation_id)
    return [
      dateCell(payment.paid_at, true),
      textCell(payment.reference),
      textCell(displayCode(enrollment?.dossier_code)),
      Number(student?.intake_student_number || student?.student_number || 0) || '',
      student?.last_name || '',
      student?.first_name || '',
      formation?.name || '',
      moneyCell(payment.amount),
      paymentMethodLabel(payment.method),
      payment.billing_month ? `Mois ${payment.billing_month}` : 'Paiement global',
      payment.installment ? `Tranche ${payment.installment}` : '',
      payment.cancelled_at ? { value: 'Annulé', textColor: RED, fontWeight: 'bold' } : { value: 'Comptabilisé', textColor: GREEN, fontWeight: 'bold' },
      payment.cancellation_reason || '',
      staffName(state.staffDirectory, payment.received_by),
      payment.notes || ''
    ]
  })

  const pendingRows = pending.map(payment => {
    const formation = state.formations.find(item => item.id === payment.pending_formation_id)
    return [
      dateCell(payment.paid_at, true),
      textCell(payment.reference),
      payment.pending_last_name || '',
      payment.pending_first_name || '',
      textCell(payment.pending_phone),
      formation?.name || 'Non précisée',
      moneyCell(payment.amount),
      paymentMethodLabel(payment.method),
      payment.pending_scholarship_status ? 'Boursier' : 'Non boursier',
      payment.notes || '',
      staffName(state.staffDirectory, payment.received_by)
    ]
  })

  const totalActive = activePayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
  const totalCancelled = cancelledPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
  const totalPending = pending.reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
  const summaryRows = [
    ['Vague exportée', intake?.name || 'Non classée'],
    ['Élèves dans la vague', numberCell(students.length)],
    ['Versements comptabilisés', numberCell(activePayments.length)],
    ['Total encaissé dans la vague', moneyCell(totalActive)],
    ['Versements annulés', numberCell(cancelledPayments.length)],
    ['Montant des versements annulés', moneyCell(totalCancelled)],
    ['Paiements en attente d’affectation', numberCell(pending.length)],
    ['Total global en attente', moneyCell(totalPending)]
  ]

  return {
    fileName: `BEVA_Paiements_${cleanFilePart(intake?.name)}_${new Date().toISOString().slice(0, 10)}.xlsx`,
    sheets: [
      makeSheet({ sheet: 'Synthèse', title: 'BEVA — Synthèse des paiements', subtitle, headers: ['Indicateur', 'Valeur'], widths: [38, 28], rows: summaryRows, zoomScale: 1 }),
      makeSheet({ sheet: 'Situation par formation', title: 'BEVA — Situation des paiements par formation', subtitle: `${subtitle} · Une ligne par étudiant et par formation sélectionnée. Les versements annulés sont exclus.`, headers: ['N° élève', 'Nom de l’étudiant', 'Formation', 'Coût total', 'Montant versé', 'Solde restant', 'État du paiement'], widths: [11, 28, 25, 18, 18, 18, 20], rows: paymentSituationRows, zoomScale: 0.9 }),
      makeSheet({ sheet: 'Paiements', title: 'BEVA — Historique des paiements', subtitle: `${subtitle} · ${payments.length} versement(s), annulations incluses`, headers: ['Date', 'Référence', 'Code dossier', 'N° élève', 'Nom', 'Prénom(s)', 'Formation', 'Montant', 'Moyen', 'Mois', 'Tranche', 'État', 'Motif d’annulation', 'Reçu par', 'Notes'], widths: [20, 30, 14, 10, 18, 22, 23, 17, 18, 17, 12, 15, 30, 24, 32], rows: paymentRows, zoomScale: 0.8 }),
      makeSheet({ sheet: 'En attente', title: 'BEVA — Paiements en attente d’affectation', subtitle: `Situation globale · Export du ${exportDateLabel()} · ${pending.length} paiement(s)`, headers: ['Date', 'Référence', 'Nom', 'Prénom(s)', 'Téléphone', 'Formation souhaitée', 'Montant', 'Moyen', 'Tarif', 'Notes', 'Reçu par'], widths: [20, 30, 18, 22, 17, 24, 17, 18, 16, 35, 24], rows: pendingRows })
    ]
  }
}

async function downloadWorkbook(workbook) {
  const { default: writeExcelFile } = await import('write-excel-file/browser')
  await writeExcelFile(workbook.sheets, { fontFamily: 'Arial', fontSize: 10 }).toFile(workbook.fileName)
  return workbook.fileName
}

export const downloadStudentsExcel = (state, intakeId) => downloadWorkbook(buildStudentWorkbookSheets(state, intakeId))
export const downloadPaymentsExcel = (state, intakeId) => downloadWorkbook(buildPaymentWorkbookSheets(state, intakeId))
