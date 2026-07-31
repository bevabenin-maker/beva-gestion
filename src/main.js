import { createClient } from '@supabase/supabase-js'
import './style.css'

const SUPABASE_URL = 'https://bxhgptcsuhbfuqamcdxs.supabase.co'
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_gQ3vAqx13bYldbATsPS6wA_2bvKXpBj'
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
// Works locally and on the GitHub Pages address without hard-coding localhost.
const appUrl = () => window.location.href.split('#')[0]

const app = document.querySelector('#app')
const state = { user: null, staff: null, staffDirectory: [], students: [], enrollments: [], formations: [], payments: [], paymentAudit: [], intakes: [], section: 'dashboard', intakeFilter: null, paymentMonth: 'all', paymentHistoryRange: 'week' }

const money = value => new Intl.NumberFormat('fr-FR').format(Number(value || 0)) + ' FCFA'
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]))
const roleLabel = role => ({ admin: 'Administrateur', direction: 'Direction', agent: 'Agent' }[role] || role)
const studentStatusLabel = status => ({ actif: 'Actif', suspendu: 'Suspendu', abandonne: 'Abandon' }[status] || status)
const enrollmentStatusLabel = status => ({ disponible: 'Disponible', inscrit: 'Actif', termine: 'Terminé', abandonne: 'Abandon' }[status] || status)
const learningModeLabel = mode => mode === 'en_ligne' ? 'En ligne' : 'Présentiel'
const stageLabel = stage => ({ inscription: 'Inscription', premier_mois: '1er mois', mensualite: 'Mensualité', tranche_1: 'Tranche 1', tranche_2: 'Tranche 2', solde: 'Solde', versement: 'Versement' }[stage] || stage)
const today = () => new Date().toISOString().slice(0, 10)
const ageOf = birthDate => {
  if (!birthDate) return null
  const birth = new Date(`${birthDate}T12:00:00`)
  if (Number.isNaN(birth.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const birthdayPassed = now.getMonth() > birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() >= birth.getDate())
  if (!birthdayPassed) age -= 1
  return age >= 0 && age < 120 ? age : null
}
const studentAge = student => {
  const calculated = ageOf(student?.birth_date)
  if (calculated !== null) return calculated
  const recorded = Number(student?.age)
  return Number.isInteger(recorded) && recorded >= 0 && recorded < 120 ? recorded : null
}
const selectedIntake = () => state.intakes.find(x => x.id === state.intakeFilter) || null
// Keep every intake in the same visual order.  The database renumbers students
// 1, 2, 3… after a deletion; this view deliberately shows the highest number
// first, so a refresh, an edit, or a deletion never leaves the list shuffled.
const scopedStudents = () => state.intakeFilter
  ? state.students
    .filter(x => x.intake_id === state.intakeFilter)
    .slice()
    .sort((a, b) => Number(b.intake_student_number || 0) - Number(a.intake_student_number || 0) || String(b.created_at || '').localeCompare(String(a.created_at || '')))
  : []
const scopedEnrollments = () => {
  const ids = new Set(scopedStudents().map(x => x.id))
  return state.enrollments.filter(x => ids.has(x.student_id))
}
const scopedPayments = () => {
  const ids = new Set(scopedEnrollments().map(x => x.id))
  return state.payments.filter(x => ids.has(x.enrollment_id) && !x.cancelled_at)
}
const pendingPayments = () => state.payments.filter(x => x.payment_context === 'pending' && !x.cancelled_at)
const enrollmentPayments = enrollmentId => state.payments.filter(x => x.enrollment_id === enrollmentId && !x.cancelled_at)
const paymentIsCancelled = payment => Boolean(payment.cancelled_at)
function financialStatus(enrollment) {
  const paid = enrollmentPayments(enrollment.id).reduce((sum, item) => sum + Number(item.amount || 0), 0)
  // `agreed_fee` can be lower for a returning learner who only resumes the
  // months that still need to be completed. Older dossiers keep their BEVA fee.
  const due = enrollment.formation_id ? Number(enrollment.agreed_fee ?? feeFor(Boolean(enrollment.scholarship_status))) : 0
  const remaining = Math.max(0, due - paid)
  return { paid, due, remaining, label: due > 0 && remaining === 0 ? 'Soldé' : paid > 0 ? 'Partiel' : 'Non payé', className: due > 0 && remaining === 0 ? 'ok' : paid > 0 ? 'warning' : 'due' }
}

const formationFor = enrollment => state.formations.find(x => x.id === enrollment.formation_id)
const studentFor = enrollment => state.students.find(x => x.id === enrollment.student_id)
const monthsFor = enrollment => Math.max(1, Number(formationFor(enrollment)?.duration_months || 3))
// A debt is actionable only while both the student's record and this formation
// are active. Payments remain part of the history whatever their later status.
const activeEnrollment = enrollment => enrollment.status === 'inscrit' && studentFor(enrollment)?.status === 'actif'
const enrolledEnrollment = enrollment => enrollment.status !== 'disponible'
const feeFor = scholarship => scholarship ? 90000 : 180000
const monthlyFeeFor = enrollment => Math.ceil(feeFor(Boolean(enrollment.scholarship_status)) / monthsFor(enrollment))
const paymentMonthLabel = month => month ? `Mois ${month}` : 'Paiement global'
const canDeleteStudents = () => ['admin', 'direction'].includes(state.staff?.role)
const canManagePayments = () => ['admin', 'direction'].includes(state.staff?.role)
const canPermanentlyDeletePayments = () => state.staff?.role === 'admin'
const dateTime = value => value ? new Date(value).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }) : '—'
const auditActionLabel = action => ({ created: 'Versement enregistré', updated: 'Versement modifié', cancelled: 'Versement annulé', deleted: 'Versement supprimé' }[action] || 'Mise à jour')
const staffName = id => state.staffDirectory.find(x => x.user_id === id)?.full_name || 'Système / ancien enregistrement'
function monthlyProgress(enrollment, month) {
  const summary = financialStatus(enrollment)
  const monthlyFee = monthlyFeeFor(enrollment)
  if (!month) return { trackable: false, required: 0, paid: summary.paid, remaining: summary.remaining }
  const uncappedRequired = monthlyFee * Number(month)
  const required = financialStatus(enrollment).due > 0 ? Math.min(financialStatus(enrollment).due, uncappedRequired) : uncappedRequired
  return { trackable: true, required, paid: summary.paid, remaining: Math.max(0, required - summary.paid) }
}
function maxPaymentMonths() {
  return Math.max(3, ...scopedEnrollments().filter(x => x.status !== 'disponible').map(monthsFor))
}

function monthlyPaymentState(enrollment, month) {
  const progress = monthlyProgress(enrollment, month)
  if (progress.remaining === 0) return { label: 'Payé', className: 'ok' }
  return { label: progress.paid > 0 ? 'Partiel' : 'Non payé', className: progress.paid > 0 ? 'warning' : 'due' }
}

function receiptNumber(payment) {
  return `BEVA-${new Date(payment.paid_at).getFullYear()}-${String(payment.id || '').replaceAll('-', '').slice(0, 8).toUpperCase()}`
}

// A payment reference is never typed by hand.  It is created before saving so
// it is also present in Supabase, the payment history and the PDF receipt.
function automaticPaymentReference() {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)
  const suffix = crypto.randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase()
  return `BEVA-PAY-${stamp}-${suffix}`
}

// GitHub Pages hosts the application inside /beva-gestion/. Resolving from the
// current page (rather than from the domain root) keeps the logo and stamp in
// the receipt on both the site and a local preview.
const receiptAsset = file => new URL(`${import.meta.env.BASE_URL}brand/${file}`, window.location.href).href
const paymentMethodLabel = method => ({ especes: 'Espèces', mobile_money: 'Mobile Money', banque: 'Virement bancaire', carte: 'Carte bancaire' }[method] || String(method || '—').replaceAll('_', ' '))

function receiptHtml(payment) {
  const enrollment = state.enrollments.find(x => x.id === payment.enrollment_id)
  const student = enrollment && studentFor(enrollment)
  const formation = enrollment ? formationFor(enrollment) : state.formations.find(x => x.id === payment.pending_formation_id)
  const paidBefore = enrollmentPayments(enrollment?.id).filter(x => x.id !== payment.id && new Date(x.paid_at) <= new Date(payment.paid_at)).reduce((sum, x) => sum + Number(x.amount || 0), 0)
  const total = enrollment ? financialStatus(enrollment).due : null
  const remaining = Math.max(0, total - paidBefore - Number(payment.amount || 0))
  const paymentObject = `${paymentMonthLabel(payment.billing_month)}${payment.installment ? ` - Tranche ${payment.installment}` : ''}`
  const pending = payment.payment_context === 'pending'
  const payerName = pending ? `${payment.pending_last_name || ''} ${payment.pending_first_name || ''}`.trim() : (student ? `${student.last_name} ${student.first_name}` : '—')
  const dossier = pending ? 'En attente d’affectation' : (formation?.name || 'Formation non précisée')
  const status = pending ? (payment.pending_scholarship_status ? 'Boursier' : 'Standard') : (enrollment?.scholarship_status ? 'Boursier' : 'Standard')
  const cancelled = paymentIsCancelled(payment)
  const totals = cancelled ? `<section class="totals"><div class="total-row remaining"><span>Statut</span><b>VERSEMENT ANNULÉ — non comptabilisé</b></div><div class="total-row"><span>Motif</span><b>${esc(payment.cancellation_reason || 'Non précisé')}</b></div></section>` : pending ? `<section class="totals"><div class="total-row"><span>Situation</span><b>Paiement conservé en attente d’affectation</b></div></section>` : `<section class="totals"><div class="total-row"><span>Coût total de la formation</span><b>${money(total)}</b></div><div class="total-row"><span>Total payé après ce versement</span><b>${money(total - remaining)}</b></div><div class="total-row remaining"><span>Reste à payer après ce versement</span><b>${money(remaining)}</b></div></section>`
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${cancelled ? 'Annulation' : 'Reçu'} ${esc(receiptNumber(payment))}</title><style>
    *{box-sizing:border-box} body{margin:0;background:#edf2f8;font-family:Arial,Helvetica,sans-serif;color:#14243a}.toolbar{position:sticky;top:0;z-index:2;display:flex;justify-content:center;gap:8px;flex-wrap:wrap;padding:14px;background:#071a33}.toolbar button{border:0;border-radius:8px;padding:11px 18px;background:#d4af37;color:#071a33;font-weight:800;cursor:pointer}.receipt{width:210mm;min-height:297mm;margin:24px auto;padding:17mm 16mm 13mm;background:white;box-shadow:0 2px 18px #60738d55;position:relative}.top{display:grid;grid-template-columns:1fr auto;gap:20px;align-items:start;border-bottom:5px solid #0b3d91;padding-bottom:12px}.logo{width:205px;max-width:100%;height:auto;display:block}.receipt-title{text-align:right;color:#0b3d91}.receipt-title h1{font-size:23px;margin:0 0 8px;letter-spacing:.3px}.receipt-title p{margin:0;color:#344a67;font-size:12px}.receipt-number{display:inline-block;margin-top:8px;padding:7px 10px;background:#e8f1fb;color:#0b3d91;font-weight:800;font-size:12px}.bar{margin-top:15px;padding:7px 10px;color:white;background:#0b3d91;font-size:12px;font-weight:800}.info{display:grid;grid-template-columns:1fr 1fr;border:1px solid #cbd7e5;border-top:0}.field{display:grid;grid-template-columns:128px 1fr;gap:8px;min-height:35px;padding:9px 10px;border-top:1px solid #d6e0eb;font-size:12px}.field:nth-child(odd){border-right:1px solid #d6e0eb}.field b{color:#405574}.field strong{color:#102c50}.payment-box{margin-top:20px;border:1px solid #b9d8c5}.payment-box h2{margin:0;padding:8px 10px;background:#176b42;color:#fff;font-size:12px;text-align:center}.payment-row{display:grid;grid-template-columns:1.4fr .75fr .75fr 1fr;min-height:40px}.payment-row>*{padding:11px 9px;border-right:1px solid #c7dfd0;font-size:12px}.payment-row>*:last-child{border:0}.payment-head{font-weight:800;color:white;background:#17477e}.payment-detail{background:#dcf5e8}.payment-detail strong{color:#176b42}.amount{display:flex;justify-content:space-between;align-items:center;margin-top:19px;padding:10px 13px;color:white;background:#0b3d91;font-weight:800;font-size:13px}.amount b{font-size:22px;color:#0b3d91;background:#fff7df;padding:4px 15px}.totals{margin-top:20px;border:1px solid #cbd7e5}.total-row{display:flex;justify-content:space-between;padding:8px 12px;border-bottom:1px solid #d6e0eb;font-size:12px}.total-row:last-child{border:0}.total-row b{color:#0b3d91}.total-row.remaining{background:#fff0ef}.total-row.remaining b{color:#b42318}.notice{margin-top:19px;padding:7px 10px;color:white;background:#0b3d91;text-align:center;font-size:10px;font-weight:700}.stamp-wrap{text-align:center;margin-top:21px}.stamp{width:120px;height:auto;opacity:.96}.signature{font-size:11px;color:#405574;margin-top:3px}.contact{margin-top:14px;text-align:center;color:#61738a;font-size:10px}@page{size:A4;margin:0}@media print{body{background:white}.toolbar{display:none}.receipt{margin:0;box-shadow:none;width:210mm;min-height:297mm}}
    @media(max-width:760px){.receipt{width:100%;min-height:0;margin:0;padding:22px 16px}.top{grid-template-columns:1fr}.receipt-title{text-align:left}.payment-row{grid-template-columns:1fr 1fr}.payment-head>*:nth-child(n+3),.payment-detail>*:nth-child(n+3){border-top:1px solid #c7dfd0}.field{grid-template-columns:100px 1fr}.field:nth-child(odd){border-right:0}.info{grid-template-columns:1fr}.amount{align-items:flex-start;gap:10px}.amount b{font-size:17px}}
  </style></head><body><div class="toolbar"><button onclick="window.print()">Enregistrer / imprimer le PDF</button></div><main class="receipt"><section class="top"><img class="logo" src="${receiptAsset('beva-logo.png')}" alt="BEVA"><div class="receipt-title"><h1>${cancelled ? 'ANNULATION DE VERSEMENT' : 'REÇU DE PAIEMENT'}</h1><p>Date : <b>${new Date(payment.paid_at).toLocaleDateString('fr-FR')}</b></p><div class="receipt-number">N° ${esc(receiptNumber(payment))}</div></div></section><div class="bar">INFORMATIONS DE L'ÉTUDIANT(E)</div><section class="info"><div class="field"><b>Nom et prénom</b><strong>${esc(payerName)}</strong></div><div class="field"><b>Formation</b><strong>${esc(dossier)}</strong></div><div class="field"><b>Formation</b><strong>${esc(formation?.name || 'Non précisée')}</strong></div><div class="field"><b>Statut tarifaire</b><strong>${status}</strong></div></section><section class="payment-box"><h2>DÉTAIL DU VERSEMENT</h2><div class="payment-row payment-head"><b>Description</b><b>Montant reçu</b><b>Mode</b><b>Référence</b></div><div class="payment-row payment-detail"><strong>${esc(pending ? 'Paiement en attente d’affectation' : paymentObject)}</strong><strong>${money(payment.amount)}</strong><span>${esc(paymentMethodLabel(payment.method))}</span><span>${esc(payment.reference || receiptNumber(payment))}</span></div></section><div class="amount"><span>MONTANT DU VERSEMENT (FCFA)</span><b>${money(payment.amount)}</b></div>${totals}<p class="notice">${cancelled ? 'Ce document confirme l’annulation du versement indiqué.' : 'Ce reçu tient lieu de preuve de paiement. Conservez-le précieusement.'} - BEVA, Abomey-Calavi, Bénin</p><div class="stamp-wrap"><img class="stamp" src="${receiptAsset('beva-stamp.png')}" alt="Cachet BEVA"><div class="signature">La Direction</div></div><p class="contact">BEVA - Bénin Vivi Académie - Abomey-Calavi, Bénin</p></main></body></html>`
}

function downloadReceipt(paymentId) {
  const payment = state.payments.find(x => x.id === paymentId)
  if (!payment) return toast('Reçu introuvable.', true)
  // "noopener" makes some browsers return a null WindowProxy. That created
  // the blank receipt tab because the document could no longer be written.
  const receipt = window.open('about:blank', '_blank')
  if (!receipt) return toast('Autorisez les fenêtres surgissantes pour télécharger le reçu.', true)
  receipt.document.write(receiptHtml(payment))
  receipt.document.close()
  try { receipt.opener = null } catch (_) { /* The receipt does not need its opener. */ }
}

function toast(message, bad = false) {
  const el = document.createElement('div')
  el.className = `toast ${bad ? 'bad' : ''}`
  el.textContent = message
  document.body.append(el)
  setTimeout(() => el.remove(), 3200)
}

function loginView() {
  app.innerHTML = `
    <div class="login-page">
      <section class="login-brand">
        <div class="brand-mark">BEVA</div>
        <h1>Gestion claire.<br>Suivi précis.</h1>
        <p>L’espace sécurisé du personnel de BEVA pour suivre les étudiants, leurs formations et chaque paiement séparément.</p>
      </section>
      <section class="login-panel">
        <div class="login-card">
          <h2>Connexion</h2>
          <p class="muted">Accès réservé au personnel autorisé de BEVA.</p>
          <form id="login-form" class="form-stack">
            <label>Adresse e-mail<input name="email" type="email" autocomplete="email" required placeholder="nom@exemple.com"></label>
            <label>Mot de passe<input name="password" type="password" autocomplete="current-password" required placeholder="••••••••"></label>
            <p id="login-error" class="error"></p>
            <button class="primary" type="submit">Se connecter</button>
          </form>
          <button id="forgot-password" class="link-btn auth-link" type="button">Mot de passe oublié&nbsp;?</button>
        </div>
      </section>
    </div>`
  document.querySelector('#login-form').addEventListener('submit', async event => {
    event.preventDefault()
    const button = event.currentTarget.querySelector('button')
    const data = new FormData(event.currentTarget)
    button.disabled = true
    button.textContent = 'Connexion…'
    const { error } = await supabase.auth.signInWithPassword({ email: data.get('email'), password: data.get('password') })
    if (error) {
      document.querySelector('#login-error').textContent = 'Adresse e-mail ou mot de passe incorrect.'
      button.disabled = false
      button.textContent = 'Se connecter'
    }
  })
  document.querySelector('#forgot-password').addEventListener('click', passwordResetView)
}

function passwordResetView() {
  app.innerHTML = `
    <div class="login-page">
      <section class="login-brand"><div class="brand-mark">BEVA</div><h1>Réinitialiser<br>votre accès.</h1><p>Nous vous enverrons un lien sécurisé pour choisir un nouveau mot de passe.</p></section>
      <section class="login-panel"><div class="login-card">
        <h2>Mot de passe oublié</h2><p class="muted">Saisissez l’adresse e-mail liée à votre compte BEVA.</p>
        <form id="reset-request-form" class="form-stack">
          <label>Adresse e-mail<input name="email" type="email" autocomplete="email" required placeholder="nom@exemple.com"></label>
          <p id="reset-message" class="error"></p>
          <button class="primary" type="submit">Envoyer le lien</button>
        </form>
        <button id="back-login" class="link-btn auth-link" type="button">← Retour à la connexion</button>
      </div></section>
    </div>`
  document.querySelector('#back-login').addEventListener('click', loginView)
  document.querySelector('#reset-request-form').addEventListener('submit', async event => {
    event.preventDefault()
    const button = event.currentTarget.querySelector('button')
    const message = document.querySelector('#reset-message')
    button.disabled = true
    button.textContent = 'Envoi…'
    const { error } = await supabase.auth.resetPasswordForEmail(new FormData(event.currentTarget).get('email'), { redirectTo: appUrl() })
    if (error) {
      message.textContent = error.message
      button.disabled = false
      button.textContent = 'Envoyer le lien'
      return
    }
    message.className = 'success'
    message.textContent = 'Si cette adresse correspond à un compte, un lien de réinitialisation vient d’être envoyé.'
    button.textContent = 'Lien envoyé'
  })
}

function choosePasswordView() {
  app.innerHTML = `
    <div class="login-page">
      <section class="login-brand"><div class="brand-mark">BEVA</div><h1>Choisissez un<br>nouveau mot de passe.</h1><p>Utilisez un mot de passe personnel et conservez-le en lieu sûr.</p></section>
      <section class="login-panel"><div class="login-card">
        <h2>Nouveau mot de passe</h2><p class="muted">Votre lien a bien été reconnu.</p>
        <form id="new-password-form" class="form-stack">
          <label>Nouveau mot de passe<input name="password" type="password" autocomplete="new-password" minlength="8" required placeholder="Au moins 8 caractères"></label>
          <label>Confirmer le mot de passe<input name="confirmation" type="password" autocomplete="new-password" minlength="8" required placeholder="Répétez le mot de passe"></label>
          <p id="new-password-message" class="error"></p>
          <button class="primary" type="submit">Enregistrer le mot de passe</button>
        </form>
      </div></section>
    </div>`
  document.querySelector('#new-password-form').addEventListener('submit', async event => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const message = document.querySelector('#new-password-message')
    if (data.get('password') !== data.get('confirmation')) {
      message.textContent = 'Les deux mots de passe doivent être identiques.'
      return
    }
    const button = event.currentTarget.querySelector('button')
    button.disabled = true
    button.textContent = 'Enregistrement…'
    const { error } = await supabase.auth.updateUser({ password: data.get('password') })
    if (error) {
      message.textContent = error.message
      button.disabled = false
      button.textContent = 'Enregistrer le mot de passe'
      return
    }
    window.history.replaceState({}, '', appUrl())
    message.className = 'success'
    message.textContent = 'Mot de passe enregistré. Ouverture de votre espace…'
    const { data: { session } } = await supabase.auth.getSession()
    setTimeout(() => start(session), 700)
  })
}

async function loadData() {
  const [staff, staffDirectory, students, enrollments, formations, payments, paymentAudit, intakes] = await Promise.all([
    supabase.from('staff_members').select('*').eq('user_id', state.user.id).single(),
    supabase.from('staff_members').select('user_id,full_name'),
    supabase.from('students').select('*').order('student_number', { ascending: false }),
    supabase.from('enrollments').select('*').order('dossier_code'),
    supabase.from('formations').select('*').order('name'),
    supabase.from('payments').select('*').order('paid_at', { ascending: false }),
    supabase.from('payment_audit_log').select('*').order('occurred_at', { ascending: false }),
    supabase.from('intakes').select('*').order('start_date', { ascending: false })
  ])
  const firstError = [staff, staffDirectory, students, enrollments, formations, payments, paymentAudit, intakes].find(x => x.error)?.error
  if (firstError) throw firstError
  state.staff = staff.data
  state.staffDirectory = staffDirectory.data
  state.students = students.data
  state.enrollments = enrollments.data
  state.formations = formations.data
  state.payments = payments.data
  state.paymentAudit = paymentAudit.data
  state.intakes = intakes.data
  if (!selectedIntake()) state.intakeFilter = state.intakes.find(x => x.active)?.id || state.intakes[0]?.id || null
}

function dashboardStats() {
  const assigned = scopedEnrollments().filter(enrolledEnrollment)
  const active = assigned.filter(activeEnrollment)
  const paid = scopedPayments().reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const students = scopedStudents()
  const activeStudents = students.filter(x => x.status === 'actif').length
  const abandonedStudentIds = new Set(students.filter(x => x.status === 'abandonne').map(x => x.id))
  const abandonedStudents = abandonedStudentIds.size
  // A dossier marked abandoned is also counted, unless its student is already
  // counted as abandoned (to avoid displaying the same abandonment twice).
  const abandonedDossiers = assigned.filter(x => x.status === 'abandonne' && !abandonedStudentIds.has(x.student_id)).length
  // Never subtract payments belonging to abandoned/non-active dossiers here:
  // each active dossier brings only its own remaining balance.
  const balance = active.reduce((sum, item) => sum + financialStatus(item).remaining, 0)
  return { assigned: assigned.length, active: active.length, activeStudents, abandonedStudents, abandonedDossiers, abandoned: abandonedStudents + abandonedDossiers, paid, balance }
}

function shellView() {
  const stats = dashboardStats()
  app.innerHTML = `
    <div class="shell">
      <aside class="sidebar">
        <div class="logo"><div class="mini-mark">B</div><div><strong>BEVA</strong><small>Gestion interne</small></div></div>
        <nav class="nav">
          <button data-section="dashboard"><span>▦ &nbsp;Tableau de bord</span></button>
          <button data-section="students"><span>♙ &nbsp;Étudiants</span></button>
          <button data-section="payments"><span>₣ &nbsp;Paiements</span></button>
          <button data-section="formations"><span>◫ &nbsp;Formations</span></button>
          <button data-section="intakes"><span>◉ &nbsp;Vagues</span></button>
        </nav>
        <div class="sidebar-bottom">
          <p class="staff-name">${esc(state.staff.full_name)}</p>
          <p class="staff-role">${roleLabel(state.staff.role)}</p>
          <button id="logout" class="secondary">Déconnexion</button>
        </div>
      </aside>
      <main class="main">
        <header class="topbar">
          <div><h1 id="page-title">Tableau de bord</h1><p id="page-subtitle" class="muted">Vue générale de l’activité BEVA</p></div>
          <div class="topbar-actions"><select id="intake-filter" aria-label="Choisir une vague">${state.intakes.map(x => `<option value="${x.id}" ${x.id === state.intakeFilter ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select><button id="add-student-top" class="primary desktop-only">+ Nouvel étudiant</button></div>
        </header>
        <section id="dashboard" class="section">
          <div class="cards">
            <div class="card"><div class="label">Étudiants</div><div class="value">${scopedStudents().length}</div></div>
            <div class="card"><div class="label">Dossiers inscrits</div><div class="value">${stats.assigned}</div></div>
            <div class="card"><div class="label">Étudiants actifs</div><div class="value">${stats.activeStudents}</div></div>
            <div class="card"><div class="label">Abandons</div><div class="value">${stats.abandoned}</div></div>
            <div class="card"><div class="label">Dossiers actifs</div><div class="value">${stats.active}</div></div>
            <div class="card"><div class="label">Total encaissé</div><div class="value">${money(stats.paid)}</div></div>
            <div class="card"><div class="label">Reste à payer</div><div class="value">${money(stats.balance)}</div></div>
            <div class="card"><div class="label">Paiements en attente</div><div class="value">${pendingPayments().length}</div></div>
          </div>
          ${studentPanel('Inscriptions récentes', scopedStudents().slice(0, 8))}
        </section>
        <section id="students" class="section">${studentPanel('Tous les étudiants', scopedStudents(), true)}</section>
        <section id="payments" class="section">${paymentPanel()}</section>
        <section id="formations" class="section">${formationPanel()}</section>
        <section id="intakes" class="section">${intakePanel()}</section>
      </main>
    </div>`
  bindShell()
  switchSection(state.section)
}

function studentPanel(title, students, searchable = false) {
  const ageStats = studentAgeStats(students)
  return `${searchable ? ageStatisticsPanel(ageStats) : ''}<div class="panel student-panel">
    <div class="panel-head"><h2>${title}</h2>${searchable ? '<div class="tools"><input id="student-search" placeholder="Rechercher un nom, numéro ou téléphone"></div>' : ''}</div>
    <div class="mobile-student-list">${studentMobileCards(students)}</div>
    <div class="table-wrap desktop-table"><table><thead><tr><th>N°</th><th>Nom et prénom</th><th>Âge</th><th>Vague</th><th>Téléphone</th><th>Formations</th><th>Action</th></tr></thead>
    <tbody id="${searchable ? 'student-table' : 'recent-table'}">${studentRows(students)}</tbody></table>
    ${students.length ? '' : '<div class="empty">Aucun étudiant enregistré.</div>'}</div>
  </div>`
}

function studentAgeStats(students) {
  const groups = [
    { label: 'Moins de 18 ans', min: 0, max: 17, count: 0 },
    { label: '18 à 24 ans', min: 18, max: 24, count: 0 },
    { label: '25 à 34 ans', min: 25, max: 34, count: 0 },
    { label: '35 ans et plus', min: 35, max: Infinity, count: 0 }
  ]
  let known = 0
  let totalAge = 0
  students.forEach(student => {
    const age = studentAge(student)
    if (age === null) return
    known += 1
    totalAge += age
    const group = groups.find(item => age >= item.min && age <= item.max)
    if (group) group.count += 1
  })
  return { groups, known, missing: Math.max(0, students.length - known), average: known ? Math.round(totalAge / known) : null }
}

function ageStatisticsPanel(stats) {
  const maximum = Math.max(1, ...stats.groups.map(item => item.count))
  const groups = stats.groups.map(item => `<div class="age-stat-row"><div><strong>${item.label}</strong><span>${item.count} étudiant${item.count > 1 ? 's' : ''}</span></div><div class="age-bar" aria-label="${esc(item.label)} : ${item.count}"><i style="width:${Math.round(item.count / maximum * 100)}%"></i></div></div>`).join('')
  return `<section class="panel age-statistics"><div class="panel-head"><div><h2>Répartition des étudiants par âge</h2><p class="muted">Statistiques de la vague sélectionnée, calculées à partir des dates de naissance enregistrées.</p></div></div><div class="age-stat-summary"><div><span>Âge moyen</span><strong>${stats.average === null ? '—' : `${stats.average} ans`}</strong></div><div><span>Âge renseigné</span><strong>${stats.known}</strong></div><div><span>À compléter</span><strong>${stats.missing}</strong></div></div><div class="age-stat-list">${groups}</div></section>`
}

function studentMobileCards(students) {
  if (!students.length) return '<div class="empty">Aucun étudiant enregistré.</div>'
  return students.map(student => {
    const items = state.enrollments.filter(x => x.student_id === student.id && x.status !== 'disponible')
    const age = studentAge(student)
    const statusClass = student.status === 'actif' ? 'ok' : student.status === 'abandonne' ? 'due' : 'warning'
    return `<article class="student-mobile-card"><div><span class="code">N° ${esc(student.intake_student_number || '—')}</span><span class="badge ${statusClass}">${esc(studentStatusLabel(student.status))}</span></div><button class="link-btn student-payment-history" data-id="${student.id}" title="Voir son historique de paiements"><strong>${esc(student.last_name)} ${esc(student.first_name)}</strong></button><dl><div><dt>Âge</dt><dd>${age === null ? 'Non renseigné' : `${age} ans`}</dd></div><div><dt>Formations</dt><dd>${items.length} / 4</dd></div><div><dt>Téléphone</dt><dd>${esc(student.phone || '—')}</dd></div></dl></article>`
  }).join('')
}

function studentRows(students) {
  return students.map(student => {
    const items = state.enrollments.filter(x => x.student_id === student.id && x.status !== 'disponible')
    const intake = state.intakes.find(x => x.id === student.intake_id)
    return `<tr>
      <td class="code">${student.intake_student_number ? 'N° ' + esc(student.intake_student_number) : '—'}</td>
      <td><button class="link-btn student-payment-history" data-id="${student.id}" title="Voir son historique de paiements"><strong>${esc(student.last_name)} ${esc(student.first_name)}</strong></button><small class="legacy-code">Historique et reçus</small></td>
      <td>${studentAge(student) === null ? '—' : `${studentAge(student)} ans`}</td>
      <td><span class="badge">${esc(intake?.name || 'Non classé')}</span></td>
      <td>${esc(student.phone || '—')}</td>
      <td><span class="badge ${student.status === 'actif' ? 'ok' : student.status === 'abandonne' ? 'due' : 'warning'}">${esc(studentStatusLabel(student.status))}</span> <span class="badge ${items.length ? 'ok' : ''}">${items.length} / 4</span></td>
      <td class="row-actions desktop-only"><button class="link-btn manage-student" data-id="${student.id}">Gérer les dossiers</button>${canDeleteStudents() ? `<button class="danger delete-student" data-id="${student.id}">Supprimer</button>` : ''}</td>
    </tr>`
  }).join('')
}

function paymentActionButtons(payment) {
  const cancelled = paymentIsCancelled(payment)
  return `<div class="row-actions"><button class="link-btn receipt-payment" data-id="${payment.id}">${cancelled ? 'Document' : 'Reçu PDF'}</button>${canManagePayments() && !cancelled ? `<button class="link-btn edit-payment" data-id="${payment.id}">Modifier</button><button class="danger cancel-payment" data-id="${payment.id}">Annuler</button>` : ''}${canPermanentlyDeletePayments() ? `<button class="danger delete-payment" data-id="${payment.id}">Supprimer</button>` : ''}</div>`
}

function paymentHistoryRow(payment) {
  const enrollment = state.enrollments.find(x => x.id === payment.enrollment_id)
  const student = enrollment && studentFor(enrollment)
  const remaining = enrollment ? financialStatus(enrollment).remaining : 0
  const cancelled = paymentIsCancelled(payment)
  return `<tr><td>${dateTime(payment.paid_at)}</td><td>${esc(formation?.name || '—')}</td>
    <td>${student ? `<button class="link-btn student-payment-history" data-id="${student.id}">${esc(student.last_name)} ${esc(student.first_name)}</button>` : '—'}</td><td><strong>${money(payment.amount)}</strong></td>
    <td>${cancelled ? '—' : money(remaining)}</td><td><span class="badge">${paymentMonthLabel(payment.billing_month)}${payment.installment ? ' · Tranche ' + payment.installment : ''}</span></td><td><span class="badge">${esc(paymentMethodLabel(payment.method))}</span></td><td>${cancelled ? `<span class="badge due">Annulé</span><small class="legacy-code">${esc(payment.cancellation_reason || 'Sans motif')}</small>` : esc(payment.reference || '—')}</td><td>${paymentActionButtons(payment)}</td></tr>`
}

function paymentAuditDescription(entry) {
  const before = entry.before_data || {}
  const after = entry.after_data || {}
  if (entry.action === 'updated') {
    const changes = []
    if (Number(before.amount) !== Number(after.amount)) changes.push(`${money(before.amount)} → ${money(after.amount)}`)
    if (before.paid_at !== after.paid_at) changes.push(`date : ${dateTime(before.paid_at)} → ${dateTime(after.paid_at)}`)
    if (before.method !== after.method) changes.push(`moyen : ${paymentMethodLabel(before.method)} → ${paymentMethodLabel(after.method)}`)
    if (before.billing_month !== after.billing_month || before.installment !== after.installment) changes.push('mois / tranche modifié')
    if (before.enrollment_id !== after.enrollment_id || before.payment_context !== after.payment_context) changes.push('affectation modifiée')
    return changes.length ? changes.join(' · ') : 'Informations du versement mises à jour'
  }
  if (entry.action === 'cancelled') return after.cancellation_reason ? `Motif : ${after.cancellation_reason}` : 'Retiré des calculs financiers'
  if (entry.action === 'deleted') return `Ancien montant : ${money(before.amount)}`
  return `Montant : ${money(after.amount)}`
}

function paymentPanel() {
  const selectedMonth = state.paymentMonth === 'all' ? null : Number(state.paymentMonth)
  const allEnrollments = scopedEnrollments().filter(enrolledEnrollment)
  // The monthly follow-up deliberately excludes inactive and abandoned dossiers.
  const followUpEnrollments = allEnrollments.filter(activeEnrollment)
  const displayed = state.paymentMonth === 'settled'
    ? followUpEnrollments.filter(x => financialStatus(x).due > 0 && financialStatus(x).remaining === 0)
    : selectedMonth
      ? followUpEnrollments.filter(x => monthlyProgress(x, selectedMonth).remaining > 0)
      : allEnrollments
  const enrollmentRows = displayed.map(enrollment => {
    const student = studentFor(enrollment)
    const formation = formationFor(enrollment)
    const summary = financialStatus(enrollment)
    const progress = monthlyProgress(enrollment, selectedMonth)
    const paidTarget = selectedMonth && progress.trackable ? `${money(progress.paid)} / ${money(progress.required)}` : money(summary.paid)
    // "Reste dû" always stays the outstanding balance over the full 3 months.
    // The monthly status, however, is evaluated against that month's cumulative target.
    const remaining = summary.remaining
    const monthStatus = selectedMonth && progress.trackable ? monthlyPaymentState(enrollment, selectedMonth) : null
    const label = monthStatus?.label || summary.label
    const className = monthStatus?.className || summary.className
    return `<tr><td>${esc(formation?.name || '—')}</td><td><strong>${student ? `${esc(student.last_name)} ${esc(student.first_name)}` : '—'}</strong></td>
      <td>${esc(formation?.name || '—')}</td><td><span class="badge ${enrollment.scholarship_status ? 'ok' : ''}">${enrollment.scholarship_status ? 'Boursier' : 'Non boursier'}</span></td>
      <td>${paidTarget}</td><td>${money(remaining)}</td><td>${money(summary.due)}</td>
      <td><span class="badge ${className}">${label}</span></td><td><button class="link-btn pay-slot" data-id="${enrollment.id}">Ajouter paiement</button></td></tr>`
  }).join('')
  const historyScope = state.payments.filter(payment => {
    const enrollment = state.enrollments.find(x => x.id === payment.enrollment_id)
    return enrollment && scopedEnrollments().some(x => x.id === enrollment.id)
  })
  const weekStart = Date.now() - 7 * 24 * 60 * 60 * 1000
  const historyPayments = state.paymentHistoryRange === 'all' ? historyScope : historyScope.filter(payment => new Date(payment.paid_at).getTime() >= weekStart)
  const rows = historyPayments.map(paymentHistoryRow).join('')
  const monthOptions = Array.from({ length: maxPaymentMonths() }, (_, i) => i + 1).map(month => `<option value="${month}" ${String(month) === state.paymentMonth ? 'selected' : ''}>Mois ${month} — impayés à cette échéance</option>`).join('')
  const monthCounts = selectedMonth ? followUpEnrollments.reduce((counts, enrollment) => {
    const status = monthlyPaymentState(enrollment, selectedMonth).label
    counts[status] += 1
    return counts
  }, { 'Payé': 0, 'Partiel': 0, 'Non payé': 0 }) : null
  const monthlySummary = monthCounts ? `<div class="payment-summary"><strong>Mois ${selectedMonth} :</strong><span class="badge ok">${monthCounts.Payé} payé${monthCounts.Payé > 1 ? 's' : ''}</span><span class="badge warning">${monthCounts.Partiel} partiel${monthCounts.Partiel > 1 ? 's' : ''}</span><span class="badge due">${monthCounts['Non payé']} non payé${monthCounts['Non payé'] > 1 ? 's' : ''}</span></div>` : ''
  const mobileCards = displayed.map(enrollment => {
    const student = studentFor(enrollment)
    const formation = formationFor(enrollment)
    const summary = financialStatus(enrollment)
    const progress = monthlyProgress(enrollment, selectedMonth)
    const status = selectedMonth ? monthlyPaymentState(enrollment, selectedMonth) : summary
    const target = selectedMonth ? `${money(progress.paid)} / ${money(progress.required)}` : money(summary.paid)
    return `<article class="payment-mobile-card"><div><strong>${esc(formation?.name || 'Formation')}</strong><span class="badge ${status.className}">${status.label}</span></div><p>${esc(student ? `${student.last_name} ${student.first_name}` : '—')} · ${esc(formation?.name || '—')}</p><dl><div><dt>Payé${selectedMonth ? ' / attendu' : ''}</dt><dd>${target}</dd></div><div><dt>Reste dû</dt><dd>${money(summary.remaining)}</dd></div><div><dt>Frais totaux</dt><dd>${money(summary.due)}</dd></div></dl></article>`
  }).join('')
  return `${pendingPaymentPanel()}<div class="panel financial-panel"><div class="panel-head"><div><h2>Suivi financier par formation</h2><p class="muted">Le filtre mensuel ne montre que les dossiers actifs. Les dossiers abandonnés ou non actifs restent visibles dans l’historique.</p>${monthlySummary}</div><label class="payment-filter">Échéance<select id="payment-month-filter"><option value="all" ${state.paymentMonth === 'all' ? 'selected' : ''}>Vue complète</option>${monthOptions}<option value="settled" ${state.paymentMonth === 'settled' ? 'selected' : ''}>Soldés — 3 mois</option></select></label></div><div class="mobile-payment-list">${mobileCards || '<div class="empty">Aucun dossier pour cette échéance.</div>'}</div><div class="table-wrap desktop-table">
    <table><thead><tr><th>Dossier</th><th>Étudiant</th><th>Formation</th><th>Bourse</th><th>Payé / attendu</th><th>Reste dû</th><th>Frais totaux</th><th>État</th><th></th></tr></thead>
    <tbody>${enrollmentRows}</tbody></table>${enrollmentRows ? '' : '<div class="empty">Aucun dossier impayé pour cette échéance.</div>'}</div></div>
    <div class="panel history-panel"><div class="panel-head"><div><h2>${state.paymentHistoryRange === 'week' ? 'Versements récents — 7 derniers jours' : 'Historique complet des versements'}</h2><p class="muted">Cliquez sur le nom d’un élève pour ouvrir son historique, ses reçus et toutes les actions liées à ses paiements.</p></div><label class="payment-filter">Période<select id="payment-history-range"><option value="week" ${state.paymentHistoryRange === 'week' ? 'selected' : ''}>7 derniers jours</option><option value="all" ${state.paymentHistoryRange === 'all' ? 'selected' : ''}>Tout l’historique</option></select></label></div><div class="table-wrap">
    <table><thead><tr><th>Date</th><th>Dossier</th><th>Étudiant</th><th>Montant</th><th>Reste du dossier</th><th>Mois / tranche</th><th>Moyen</th><th>Référence</th><th></th></tr></thead>
    <tbody>${rows}</tbody></table>${rows ? '' : `<div class="empty">${state.paymentHistoryRange === 'week' ? 'Aucun versement au cours des 7 derniers jours.' : 'Aucun paiement enregistré.'}</div>`}</div></div>`
}

function pendingPaymentPanel() {
  const rows = pendingPayments().map(payment => {
    const formation = state.formations.find(x => x.id === payment.pending_formation_id)
    return `<tr><td>${new Date(payment.paid_at).toLocaleDateString('fr-FR')}</td><td><strong>${esc(payment.pending_last_name)} ${esc(payment.pending_first_name)}</strong><small class="legacy-code">${esc(payment.pending_phone || 'Sans téléphone')}</small></td><td>${esc(formation?.name || 'Formation non précisée')}</td><td><strong>${money(payment.amount)}</strong></td><td>${payment.pending_scholarship_status ? 'Boursier' : 'Non boursier'}</td><td class="row-actions"><button class="primary assign-pending" data-id="${payment.id}">Affecter à une vague</button><button class="link-btn receipt-payment" data-id="${payment.id}">Reçu PDF</button></td></tr>`
  }).join('')
  return `<div class="panel pending-panel"><div class="panel-head"><div><h2>Paiements en attente d’affectation</h2><p class="muted">Ces montants sont encaissés, mais ne comptent dans aucune vague tant que l’élève n’y est pas affecté.</p></div><button id="add-pending-payment" class="primary desktop-only">+ Paiement en attente</button></div><div class="table-wrap"><table><thead><tr><th>Date</th><th>Personne</th><th>Formation</th><th>Montant</th><th>Bourse</th><th></th></tr></thead><tbody>${rows}</tbody></table>${rows ? '' : '<div class="empty">Aucun paiement en attente.</div>'}</div></div>`
}

function formationPanel() {
  const rows = state.formations.map(item => `<tr><td><strong>${esc(item.name)}</strong></td><td>${money(item.standard_fee)}</td><td>${money(item.scholarship_fee)}</td>
    <td>${item.duration_months ? item.duration_months + ' mois' : '—'}</td><td><span class="badge ${item.active ? 'ok' : ''}">${item.active ? 'Active' : 'Inactive'}</span></td></tr>`).join('')
  return `<div class="panel"><div class="panel-head"><h2>Formations BEVA</h2></div><div class="table-wrap"><table>
    <thead><tr><th>Formation</th><th>Tarif standard</th><th>Tarif boursier</th><th>Durée</th><th>Statut</th></tr></thead><tbody>${rows}</tbody></table></div></div>`
}

function intakePanel() {
  const rows = state.intakes.map(intake => {
    const intakeStudents = state.students.filter(x => x.intake_id === intake.id)
    const studentIds = new Set(intakeStudents.map(x => x.id))
    const items = state.enrollments.filter(x => studentIds.has(x.student_id) && x.status !== 'disponible')
    const itemIds = new Set(items.map(x => x.id))
    const paid = state.payments.filter(x => itemIds.has(x.enrollment_id)).reduce((sum, x) => sum + Number(x.amount || 0), 0)
    const activeItems = items.filter(activeEnrollment)
    const activeStudents = intakeStudents.filter(x => x.status === 'actif').length
    const abandonedStudents = intakeStudents.filter(x => x.status === 'abandonne').length
    const balance = activeItems.reduce((sum, x) => sum + financialStatus(x).remaining, 0)
    return `<tr><td><strong>${esc(intake.name)}</strong></td><td>${intake.start_date ? new Date(`${intake.start_date}T12:00:00`).toLocaleDateString('fr-FR') : '—'}</td><td>${intake.end_date ? new Date(`${intake.end_date}T12:00:00`).toLocaleDateString('fr-FR') : '—'}</td><td>${studentIds.size}</td><td>${items.length}</td><td>${activeStudents}</td><td>${abandonedStudents}</td><td>${money(paid)}</td><td>${money(balance)}</td><td><span class="badge ${intake.active ? 'ok' : 'warning'}">${intake.active ? 'En cours' : 'Clôturée'}</span></td><td class="row-actions"><button class="link-btn edit-intake" data-id="${intake.id}">Modifier</button><button class="danger delete-intake" data-id="${intake.id}">Supprimer</button></td></tr>`
  }).join('')
  return `<div class="panel"><div class="panel-head"><div><h2>Vagues de formation</h2><p class="muted">Le reste ne compte que les dossiers actifs ; une vague supprimée efface aussi ses étudiants, dossiers et paiements.</p></div><button id="add-intake" class="primary">+ Nouvelle vague</button></div><div class="table-wrap"><table><thead><tr><th>Vague</th><th>Début</th><th>Fin</th><th>Inscrits</th><th>Dossiers</th><th>Actifs</th><th>Abandons</th><th>Encaissé</th><th>Reste actif</th><th>Statut</th><th></th></tr></thead><tbody>${rows}</tbody></table>${rows ? '' : '<div class="empty">Aucune vague enregistrée.</div>'}</div></div>`
}

function bindShell() {
  document.querySelectorAll('[data-section]').forEach(button => button.addEventListener('click', () => switchSection(button.dataset.section)))
  document.querySelector('#logout').addEventListener('click', () => supabase.auth.signOut())
  document.querySelector('#add-student-top').addEventListener('click', newStudentModal)
  document.querySelector('#add-pending-payment')?.addEventListener('click', pendingPaymentModal)
  document.querySelector('#add-intake')?.addEventListener('click', newIntakeModal)
  document.querySelectorAll('.edit-intake').forEach(button => button.addEventListener('click', () => editIntakeModal(button.dataset.id)))
  document.querySelectorAll('.delete-intake').forEach(button => button.addEventListener('click', () => deleteIntakeModal(button.dataset.id)))
  document.querySelectorAll('.pay-slot').forEach(button => button.addEventListener('click', () => paymentModal(button.dataset.id)))
  document.querySelectorAll('.receipt-payment').forEach(button => button.addEventListener('click', () => downloadReceipt(button.dataset.id)))
  document.querySelectorAll('.edit-payment').forEach(button => button.addEventListener('click', () => editPaymentModal(button.dataset.id)))
  document.querySelectorAll('.cancel-payment').forEach(button => button.addEventListener('click', () => cancelPaymentModal(button.dataset.id)))
  document.querySelectorAll('.delete-payment').forEach(button => button.addEventListener('click', () => deletePaymentModal(button.dataset.id)))
  document.querySelectorAll('.student-payment-history').forEach(button => button.addEventListener('click', () => studentPaymentHistoryModal(button.dataset.id)))
  document.querySelectorAll('.assign-pending').forEach(button => button.addEventListener('click', () => assignPendingPaymentModal(button.dataset.id)))
  document.querySelector('#intake-filter').addEventListener('change', event => {
    state.intakeFilter = event.target.value
    state.paymentMonth = 'all'
    shellView()
  })
  document.querySelector('#payment-month-filter')?.addEventListener('change', event => {
    state.paymentMonth = event.target.value
    shellView()
    switchSection('payments')
  })
  document.querySelector('#payment-history-range')?.addEventListener('change', event => {
    state.paymentHistoryRange = event.target.value
    shellView()
    switchSection('payments')
  })
  document.querySelectorAll('.manage-student').forEach(button => button.addEventListener('click', () => manageStudentModal(button.dataset.id)))
  document.querySelectorAll('.delete-student').forEach(button => button.addEventListener('click', () => deleteStudentModal(button.dataset.id)))
  document.querySelector('#student-search')?.addEventListener('input', event => {
    const q = event.target.value.trim().toLowerCase()
    const result = scopedStudents().filter(x => [x.registration_code, x.first_name, x.last_name, x.phone].some(v => String(v || '').toLowerCase().includes(q)))
    const panel = document.querySelector('#students')
    panel.querySelector('#student-table').innerHTML = studentRows(result)
    panel.querySelector('.mobile-student-list').innerHTML = studentMobileCards(result)
    panel.querySelectorAll('.student-payment-history').forEach(button => button.addEventListener('click', () => studentPaymentHistoryModal(button.dataset.id)))
    panel.querySelectorAll('.manage-student').forEach(button => button.addEventListener('click', () => manageStudentModal(button.dataset.id)))
    panel.querySelectorAll('.delete-student').forEach(button => button.addEventListener('click', () => deleteStudentModal(button.dataset.id)))
  })
}

function switchSection(section) {
  state.section = section
  document.querySelectorAll('.section').forEach(el => el.classList.toggle('active', el.id === section))
  document.querySelectorAll('[data-section]').forEach(el => el.classList.toggle('active', el.dataset.section === section))
  const titles = { dashboard: 'Tableau de bord', students: 'Étudiants', payments: 'Paiements', formations: 'Formations', intakes: 'Vagues de formation' }
  document.querySelector('#page-title').textContent = titles[section]
  const intake = selectedIntake()
  document.querySelector('#page-subtitle').textContent = intake ? `Suivi de ${intake.name}` : 'Vue générale de l’activité BEVA'
}

function showModal(title, body) {
  const backdrop = document.createElement('div')
  backdrop.className = 'modal-backdrop'
  backdrop.innerHTML = `<div class="modal"><div class="modal-head"><h2>${title}</h2><button class="close" aria-label="Fermer">×</button></div><div class="modal-body">${body}</div></div>`
  document.body.append(backdrop)
  backdrop.querySelector('.close').addEventListener('click', () => backdrop.remove())
  backdrop.addEventListener('click', event => { if (event.target === backdrop) backdrop.remove() })
  return backdrop
}

function newStudentModal() {
  const intakeOptions = state.intakes.map(x => `<option value="${x.id}" ${(x.id === state.intakeFilter || (state.intakeFilter === 'all' && x.active)) ? 'selected' : ''}>${esc(x.name)}</option>`).join('')
  const modal = showModal('Inscrire un étudiant', `<form id="student-form">
    <div class="grid-2">
      <label>Nom<input name="last_name" required></label><label>Prénom(s)<input name="first_name" required></label>
      <label>Téléphone<input name="phone" inputmode="tel"></label><label>Adresse e-mail<input name="email" type="email"></label>
      <label>Sexe<select name="sex"><option value="">Non précisé</option><option>Femme</option><option>Homme</option></select></label>
      <label>Date de naissance<input name="birth_date" type="date"></label>
      <label>Vague de formation<select name="intake_id" required><option value="">Choisir une vague</option>${intakeOptions}</select></label>
      <label>Statut de l’étudiant<select name="status"><option value="actif">Actif</option><option value="suspendu">Suspendu</option><option value="abandonne">Abandon</option></select></label>
      <label>Adresse<input name="address"></label>
    </div>
    <label style="margin-top:15px">Notes<textarea name="notes" rows="3"></textarea></label>
    <p class="muted">Les quatre dossiers de formation seront créés automatiquement.</p>
    <div class="modal-actions"><button type="button" id="start-return" class="secondary">Reprise de formation</button><button type="button" class="secondary cancel">Annuler</button><button class="primary" type="submit">Enregistrer</button></div>
  </form>`)
  modal.querySelector('.cancel').addEventListener('click', () => modal.remove())
  modal.querySelector('#start-return').addEventListener('click', () => { modal.remove(); returnStudentModal() })
  modal.querySelector('#student-form').addEventListener('submit', async event => {
    event.preventDefault()
    const button = event.currentTarget.querySelector('[type=submit]')
    const data = Object.fromEntries(new FormData(event.currentTarget))
    Object.keys(data).forEach(key => { if (data[key] === '') data[key] = null })
    data.created_by = state.user.id
    button.disabled = true
    const { error } = await supabase.from('students').insert(data)
    if (error) return toast(error.message, true), button.disabled = false
    modal.remove()
    await refresh('Étudiant enregistré avec ses quatre dossiers.')
  })
}

function pendingPaymentModal() {
  const formationOptions = state.formations.filter(x => x.active).map(x => `<option value="${x.id}">${esc(x.name)}</option>`).join('')
  const modal = showModal('Enregistrer un paiement en attente', `<p class="muted modal-context">À utiliser lorsqu’une personne a payé mais n’a pas encore intégré une vague. La référence de paiement et le reçu PDF sont créés automatiquement.</p><form id="pending-payment-form"><div class="grid-2"><label>Nom<input name="pending_last_name" required></label><label>Prénom(s)<input name="pending_first_name" required></label><label>Téléphone<input name="pending_phone" inputmode="tel"></label><label>Formation souhaitée<select name="pending_formation_id"><option value="">Non précisée</option>${formationOptions}</select></label><label>Montant versé<input name="amount" type="number" min="1" required></label><label>Bourse<select name="pending_scholarship_status"><option value="true">Boursier</option><option value="false">Non boursier</option></select></label><label>Date<input name="paid_at" type="date" value="${today()}" required></label><label>Moyen de paiement<select name="method"><option value="especes">Espèces</option><option value="mobile_money">Mobile Money</option><option value="banque">Banque</option><option value="autre">Autre</option></select></label></div><label style="margin-top:15px">Note / raison de l’attente<textarea name="notes" rows="3" placeholder="Ex. Attend la prochaine vague"></textarea></label><div class="modal-actions"><button type="button" class="secondary cancel">Annuler</button><button class="primary" type="submit">Enregistrer et créer le reçu</button></div></form>`)
  modal.querySelector('.cancel').addEventListener('click', () => modal.remove())
  modal.querySelector('#pending-payment-form').addEventListener('submit', async event => {
    event.preventDefault()
    const data = Object.fromEntries(new FormData(event.currentTarget))
    data.amount = Number(data.amount)
    data.payment_context = 'pending'
    data.pending_scholarship_status = data.pending_scholarship_status === 'true'
    data.pending_formation_id ||= null
    data.pending_phone ||= null
    data.reference = automaticPaymentReference()
    data.notes ||= null
    data.received_by = state.user.id
    data.paid_at = new Date(`${data.paid_at}T12:00:00`).toISOString()
    const { data: created, error } = await supabase.from('payments').insert(data).select().single()
    if (error || !created) return toast(error?.message || 'Le paiement en attente n’a pas été enregistré.', true)
    modal.remove()
    await refresh('Paiement en attente enregistré.')
    setTimeout(() => downloadReceipt(created.id), 100)
  })
}

function assignPendingPaymentModal(paymentId) {
  const payment = pendingPayments().find(x => x.id === paymentId)
  if (!payment) return toast('Paiement en attente introuvable.', true)
  const formationOptions = state.formations.filter(x => x.active).map(x => `<option value="${x.id}" ${x.id === payment.pending_formation_id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')
  const intakeOptions = state.intakes.map(x => `<option value="${x.id}" ${x.id === state.intakeFilter ? 'selected' : ''}>${esc(x.name)}</option>`).join('')
  const modal = showModal('Affecter le paiement à une vague', `<p class="muted modal-context"><strong>${esc(payment.pending_last_name)} ${esc(payment.pending_first_name)}</strong> · ${money(payment.amount)}. Le même paiement sera rattaché à son nouveau dossier : il ne sera pas saisi une deuxième fois.</p><form id="assign-pending-form"><div class="grid-2"><label>Vague<select name="intake_id" required>${intakeOptions}</select></label><label>Formation<select name="formation_id" required><option value="">Choisir</option>${formationOptions}</select></label><label>Mode de suivi<select name="learning_mode"><option value="presentiel">Présentiel</option><option value="en_ligne">En ligne</option></select></label><label>Bourse<select name="scholarship_status"><option value="true" ${payment.pending_scholarship_status ? 'selected' : ''}>Boursier</option><option value="false" ${!payment.pending_scholarship_status ? 'selected' : ''}>Non boursier</option></select></label></div><div class="modal-actions"><button type="button" class="secondary cancel">Annuler</button><button class="primary" type="submit">Affecter à cette vague</button></div></form>`)
  modal.querySelector('.cancel').addEventListener('click', () => modal.remove())
  modal.querySelector('#assign-pending-form').addEventListener('submit', async event => {
    event.preventDefault()
    const data = Object.fromEntries(new FormData(event.currentTarget))
    const scholarship = data.scholarship_status === 'true'
    const { data: student, error: studentError } = await supabase.from('students').insert({ last_name: payment.pending_last_name, first_name: payment.pending_first_name, phone: payment.pending_phone || null, intake_id: data.intake_id, status: 'actif', notes: payment.notes || null, created_by: state.user.id }).select().single()
    if (studentError || !student) return toast(studentError?.message || 'Impossible de créer l’élève.', true)
    const { data: slots, error: slotsError } = await supabase.from('enrollments').select('*').eq('student_id', student.id).order('slot')
    const slot = slots?.find(x => x.status === 'disponible')
    if (slotsError || !slot) return toast(slotsError?.message || 'Dossier de formation introuvable.', true)
    const { data: enrollment, error: enrollmentError } = await supabase.from('enrollments').update({ formation_id: data.formation_id, agreed_fee: feeFor(scholarship), monthly_fee: feeFor(scholarship) / 3, scholarship_status: scholarship, learning_mode: data.learning_mode, status: 'inscrit', enrolled_at: today() }).eq('id', slot.id).select().single()
    if (enrollmentError || !enrollment) return toast(enrollmentError?.message || 'Impossible de créer le dossier.', true)
    const { error: paymentError } = await supabase.from('payments').update({ enrollment_id: enrollment.id, payment_context: 'assigned', pending_first_name: null, pending_last_name: null, pending_phone: null, pending_formation_id: null }).eq('id', payment.id)
    if (paymentError) return toast(`Dossier créé, mais paiement non affecté : ${paymentError.message}`, true)
    modal.remove()
    state.intakeFilter = data.intake_id
    await refresh('Paiement affecté à la vague et au dossier.')
  })
}

function returnStudentModal() {
  // An abandonment can be recorded either on the student or on a particular
  // dossier. Both cases must be available for a return.
  const sourceEnrollments = state.enrollments.filter(x => x.formation_id && (x.status === 'abandonne' || studentFor(x)?.status === 'abandonne'))
  if (!sourceEnrollments.length) return toast('Aucun dossier abandonné n’est disponible pour une reprise.', true)
  const sources = sourceEnrollments.map(x => {
    const student = studentFor(x); const formation = formationFor(x)
    const reason = x.status === 'abandonne' ? 'dossier abandonné' : 'étudiant abandonné'
    return `<option value="${x.id}">${esc(student?.last_name)} ${esc(student?.first_name)} — ${esc(formation?.name || 'Formation')} (${reason})</option>`
  }).join('')
  const intakeOptions = state.intakes.map(x => `<option value="${x.id}" ${x.id === state.intakeFilter ? 'selected' : ''}>${esc(x.name)}</option>`).join('')
  const modal = showModal('Créer une reprise de formation', `<p class="muted modal-context">L’ancien dossier reste dans sa vague et dans son historique. La reprise crée un nouvel élève numéroté dans la nouvelle vague, avec seulement les mois à refaire.</p><form id="return-form"><div class="grid-2"><label>Ancien dossier<select name="source_enrollment_id" required>${sources}</select></label><label>Nouvelle vague<select name="intake_id" required>${intakeOptions}</select></label><label>Reprendre à partir de<select name="resumes_from_month"><option value="1">Mois 1 — recommencer</option><option value="2">Mois 2 — mois 1 déjà acquis</option><option value="3">Mois 3 — mois 1 et 2 déjà acquis</option></select></label><label>Mode de suivi<select name="learning_mode"><option value="presentiel">Présentiel</option><option value="en_ligne">En ligne</option></select></label></div><div class="modal-actions"><button type="button" class="secondary cancel">Annuler</button><button class="primary" type="submit">Créer la reprise</button></div></form>`)
  modal.querySelector('.cancel').addEventListener('click', () => modal.remove())
  modal.querySelector('#return-form').addEventListener('submit', async event => {
    event.preventDefault()
    const data = Object.fromEntries(new FormData(event.currentTarget))
    const source = state.enrollments.find(x => x.id === data.source_enrollment_id)
    const oldStudent = source && studentFor(source)
    if (!source || !oldStudent) return toast('Ancien dossier introuvable.', true)
    const resumesFromMonth = Number(data.resumes_from_month)
    const fullFee = feeFor(Boolean(source.scholarship_status))
    const remainingFee = Math.max(0, fullFee - (resumesFromMonth - 1) * Math.ceil(fullFee / monthsFor(source)))
    const { data: student, error: studentError } = await supabase.from('students').insert({ first_name: oldStudent.first_name, last_name: oldStudent.last_name, sex: oldStudent.sex, birth_date: oldStudent.birth_date, phone: oldStudent.phone, email: oldStudent.email, address: oldStudent.address, intake_id: data.intake_id, status: 'actif', returning_from_student_id: oldStudent.id, notes: `Reprise de ${formationFor(source)?.name || 'formation'} à partir du mois ${resumesFromMonth}.`, created_by: state.user.id }).select().single()
    if (studentError || !student) return toast(studentError?.message || 'Impossible de créer la reprise.', true)
    const { data: slots, error: slotsError } = await supabase.from('enrollments').select('*').eq('student_id', student.id).order('slot')
    const slot = slots?.find(x => x.status === 'disponible')
    if (slotsError || !slot) return toast(slotsError?.message || 'Dossier de reprise introuvable.', true)
    const { error: enrollmentError } = await supabase.from('enrollments').update({ formation_id: source.formation_id, agreed_fee: remainingFee, monthly_fee: Math.ceil(fullFee / monthsFor(source)), scholarship_status: source.scholarship_status, learning_mode: data.learning_mode, status: 'inscrit', enrolled_at: today(), resumed_from_enrollment_id: source.id, resumes_from_month: resumesFromMonth }).eq('id', slot.id)
    if (enrollmentError) return toast(enrollmentError.message, true)
    modal.remove()
    state.intakeFilter = data.intake_id
    await refresh(`Reprise créée : il reste ${money(remainingFee)} à payer.`)
  })
}

function newIntakeModal() {
  const modal = showModal('Créer une nouvelle vague', `<form id="intake-form" class="form-stack">
    <label>Nom de la vague<input name="name" required placeholder="Ex. Vague 2"></label>
    <div class="grid-2"><label>Date de début<input name="start_date" type="date"></label><label>Date de fin prévue<input name="end_date" type="date"></label></div>
    <p id="intake-error" class="error"></p>
    <div class="modal-actions"><button type="button" class="secondary cancel">Annuler</button><button class="primary" type="submit">Créer la vague</button></div>
  </form>`)
  modal.querySelector('.cancel').addEventListener('click', () => modal.remove())
  modal.querySelector('#intake-form').addEventListener('submit', async event => {
    event.preventDefault()
    const data = Object.fromEntries(new FormData(event.currentTarget))
    if (!data.start_date) data.start_date = null
    if (!data.end_date) data.end_date = null
    const { data: intake, error } = await supabase.from('intakes').insert(data).select().single()
    if (error) return modal.querySelector('#intake-error').textContent = error.message
    state.intakeFilter = intake.id
    modal.remove()
    await refresh('Nouvelle vague créée.')
  })
}

function editIntakeModal(intakeId) {
  const intake = state.intakes.find(x => x.id === intakeId)
  if (!intake) return
  const modal = showModal(`Modifier ${esc(intake.name)}`, `<form id="edit-intake-form" class="form-stack">
    <label>Nom de la vague<input name="name" required value="${esc(intake.name)}"></label>
    <div class="grid-2"><label>Date de début<input name="start_date" type="date" value="${intake.start_date || ''}"></label><label>Date de fin<input name="end_date" type="date" value="${intake.end_date || ''}"></label></div>
    <label>Statut<select name="active"><option value="true" ${intake.active ? 'selected' : ''}>En cours</option><option value="false" ${!intake.active ? 'selected' : ''}>Clôturée</option></select></label>
    <p id="edit-intake-error" class="error"></p><div class="modal-actions"><button type="button" class="secondary cancel">Annuler</button><button class="primary" type="submit">Enregistrer les modifications</button></div>
  </form>`)
  modal.querySelector('.cancel').addEventListener('click', () => modal.remove())
  modal.querySelector('#edit-intake-form').addEventListener('submit', async event => {
    event.preventDefault()
    const data = Object.fromEntries(new FormData(event.currentTarget))
    data.active = data.active === 'true'
    if (!data.start_date) data.start_date = null
    if (!data.end_date) data.end_date = null
    const { error } = await supabase.from('intakes').update(data).eq('id', intakeId).select().single()
    if (error) return modal.querySelector('#edit-intake-error').textContent = error.message
    modal.remove()
    await refresh('Vague mise à jour.')
  })
}

function deleteIntakeModal(intakeId) {
  const intake = state.intakes.find(x => x.id === intakeId)
  if (!intake) return
  const students = state.students.filter(x => x.intake_id === intakeId)
  const studentIds = new Set(students.map(x => x.id))
  const enrollments = state.enrollments.filter(x => studentIds.has(x.student_id) && x.status !== 'disponible')
  const enrollmentIds = new Set(enrollments.map(x => x.id))
  const payments = state.payments.filter(x => enrollmentIds.has(x.enrollment_id))
  const modal = showModal('⚠ Suppression définitive', `<div class="danger-zone"><h3>Attention : cette action est irréversible.</h3><p>Vous allez supprimer la <strong>${esc(intake.name)}</strong>, avec <strong>${students.length} étudiant(s)</strong>, <strong>${enrollments.length} dossier(s)</strong> et <strong>${payments.length} paiement(s)</strong>.</p><label>Pour confirmer, saisissez exactement <strong>SUPPRIMER ${esc(intake.name)}</strong><input id="delete-confirmation" autocomplete="off"></label><p id="delete-intake-error" class="error"></p></div><div class="modal-actions"><button type="button" class="secondary cancel">Annuler</button><button id="confirm-delete-intake" class="danger" type="button" disabled>Supprimer définitivement</button></div>`)
  const required = `SUPPRIMER ${intake.name}`
  const confirm = modal.querySelector('#delete-confirmation')
  const submit = modal.querySelector('#confirm-delete-intake')
  modal.querySelector('.cancel').addEventListener('click', () => modal.remove())
  confirm.addEventListener('input', () => { submit.disabled = confirm.value.trim() !== required })
  submit.addEventListener('click', async () => {
    submit.disabled = true
    const { error } = await supabase.from('intakes').delete().eq('id', intakeId)
    if (error) { modal.querySelector('#delete-intake-error').textContent = error.message; submit.disabled = false; return }
    if (state.intakeFilter === intakeId) state.intakeFilter = null
    modal.remove()
    await refresh('Vague et toutes ses données supprimées.')
  })
}

function manageStudentModal(studentId) {
  const student = state.students.find(x => x.id === studentId)
  const intake = state.intakes.find(x => x.id === student.intake_id)
  const slots = state.enrollments.filter(x => x.student_id === studentId).sort((a, b) => a.slot - b.slot)
  const rows = slots.map(slot => {
    const formationOptions = state.formations.filter(x => x.active).map(x => `<option value="${x.id}" ${x.id === slot.formation_id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')
    const summary = financialStatus(slot)
    const simpleNumber = student.intake_student_number || student.student_number || '—'
    const totalFee = summary.due
    const returnNote = slot.resumed_from_enrollment_id ? `<small class="legacy-code">Reprise à partir du mois ${esc(slot.resumes_from_month || 1)} · montant ajusté</small>` : ''
    return `<article class="dossier-card"><div class="dossier-card-head"><div><strong>Dossier ${esc(slot.slot)} — N° ${esc(simpleNumber)}</strong>${slot.legacy_code ? `<small class="legacy-code">Ancien : ${esc(slot.legacy_code)}</small>` : ''}${returnNote}</div><div><span class="badge ${summary.className}">${summary.label}</span><span class="badge">Payé ${money(summary.paid)} · Reste ${money(summary.remaining)}</span></div></div>
      <div class="dossier-grid">
        <label>Formation<select class="slot-formation" data-id="${slot.id}"><option value="">Disponible</option>${formationOptions}</select></label>
        <label>Statut<select class="slot-status" data-id="${slot.id}"><option value="disponible" ${slot.status === 'disponible' ? 'selected' : ''}>Disponible</option><option value="inscrit" ${slot.status === 'inscrit' ? 'selected' : ''}>Actif</option><option value="termine" ${slot.status === 'termine' ? 'selected' : ''}>Terminé</option><option value="abandonne" ${slot.status === 'abandonne' ? 'selected' : ''}>Abandon</option></select></label>
        <label>Mode de suivi<select class="slot-mode" data-id="${slot.id}"><option value="presentiel" ${slot.learning_mode === 'presentiel' ? 'selected' : ''}>Présentiel</option><option value="en_ligne" ${slot.learning_mode === 'en_ligne' ? 'selected' : ''}>En ligne</option></select></label>
        <label>Bourse<select class="slot-scholarship" data-id="${slot.id}"><option value="false" ${!slot.scholarship_status ? 'selected' : ''}>Non boursier</option><option value="true" ${slot.scholarship_status ? 'selected' : ''}>Boursier</option></select></label>
        <div class="fee-summary"><span>Frais totaux</span><strong class="slot-fee-display" data-id="${slot.id}">${money(totalFee)}</strong><small>${slot.scholarship_status ? 'Bourse BEVA' : 'Tarif standard BEVA'}</small></div>
      </div><div class="dossier-actions"><button class="primary save-slot" data-id="${slot.id}">Enregistrer ce dossier</button>${slot.formation_id ? `<button class="link-btn pay-slot" data-id="${slot.id}">+ Paiement</button>` : '<button class="secondary save-slot" data-pay-after="true" data-id="' + slot.id + '">Enregistrer + paiement</button>'}</div></article>`
  }).join('')
  const studentPayments = state.payments.filter(payment => slots.some(slot => slot.id === payment.enrollment_id))
  const deleteButton = canDeleteStudents() ? '<button id="delete-student-from-modal" class="danger" type="button">Supprimer cet élève</button>' : ''
  const pendingButton = studentPayments.length && canDeleteStudents() ? '<button id="move-student-to-pending" class="secondary" type="button">Mettre ses paiements en attente</button>' : ''
  const modal = showModal(`${esc(student.last_name)} ${esc(student.first_name)} — N° ${esc(student.intake_student_number || '—')}`, `<section class="student-settings"><div class="student-status-control"><label>Statut général de l’étudiant<select id="student-status"><option value="actif" ${student.status === 'actif' ? 'selected' : ''}>Actif</option><option value="suspendu" ${student.status === 'suspendu' ? 'selected' : ''}>Suspendu</option><option value="abandonne" ${student.status === 'abandonne' ? 'selected' : ''}>Abandon</option></select></label><button id="save-student-status" class="secondary">Enregistrer le statut</button></div>${pendingButton || deleteButton ? `<div class="student-actions">${pendingButton}${deleteButton}</div>` : ''}</section><p class="muted modal-context">${esc(intake?.name || 'Non classé')} · Modifiez seulement les informations nécessaires dans chaque dossier.</p><div class="dossier-list">${rows}</div>`)
  modal.querySelector('#save-student-status').addEventListener('click', async event => {
    const button = event.currentTarget
    button.disabled = true
    const { data: updated, error } = await supabase.from('students').update({ status: modal.querySelector('#student-status').value }).eq('id', studentId).select('id,status').single()
    if (error || !updated) { toast(error?.message || 'Le statut n’a pas été enregistré.', true); button.disabled = false; return }
    student.status = updated.status
    modal.remove()
    await refresh('Statut de l’étudiant mis à jour.')
  })
  modal.querySelectorAll('.slot-scholarship').forEach(select => select.addEventListener('change', () => {
    const target = modal.querySelector(`.slot-fee-display[data-id="${select.dataset.id}"]`)
    if (target) target.textContent = money(feeFor(select.value === 'true'))
  }))
  modal.querySelectorAll('.save-slot').forEach(button => button.addEventListener('click', async () => {
    const id = button.dataset.id
    const currentSlot = slots.find(item => item.id === id)
    if (!currentSlot) return toast('Dossier introuvable.', true)
    const formationId = modal.querySelector(`.slot-formation[data-id="${id}"]`).value || null
    const status = modal.querySelector(`.slot-status[data-id="${id}"]`).value
    const scholarship = modal.querySelector(`.slot-scholarship[data-id="${id}"]`).value === 'true'
    button.disabled = true
    if (button.dataset.payAfter === 'true' && !formationId) {
      toast('Choisissez d’abord une formation pour pouvoir enregistrer un paiement.', true)
      button.disabled = false
      return
    }
    const { data: updated, error } = await supabase.from('enrollments').update({
      formation_id: formationId, agreed_fee: currentSlot.resumed_from_enrollment_id ? Number(currentSlot.agreed_fee) : feeFor(scholarship),
      monthly_fee: monthlyFeeFor({ ...currentSlot, formation_id: formationId, scholarship_status: scholarship }),
      learning_mode: modal.querySelector(`.slot-mode[data-id="${id}"]`).value,
      scholarship_status: scholarship,
      status: formationId ? (status === 'disponible' ? 'inscrit' : status) : 'disponible',
      enrolled_at: formationId ? (currentSlot.enrolled_at || today()) : null
    }).eq('id', id).select('id,status').single()
    if (error || !updated) { toast(error?.message || 'Le dossier n’a pas été enregistré.', true); button.disabled = false; return }
    modal.remove()
    await refresh(button.dataset.payAfter === 'true' ? 'Dossier enregistré. Ajoutez maintenant le versement.' : 'Dossier mis à jour.')
    if (button.dataset.payAfter === 'true') paymentModal(id)
  }))
  modal.querySelectorAll('.pay-slot').forEach(button => button.addEventListener('click', () => {
    modal.remove()
    paymentModal(button.dataset.id)
  }))
  modal.querySelector('#delete-student-from-modal')?.addEventListener('click', () => {
    modal.remove()
    deleteStudentModal(studentId)
  })
  modal.querySelector('#move-student-to-pending')?.addEventListener('click', () => {
    modal.remove()
    moveStudentToPendingModal(studentId)
  })
}

function moveStudentToPendingModal(studentId) {
  const student = state.students.find(x => x.id === studentId)
  if (!student) return toast('Élève introuvable.', true)
  const intake = state.intakes.find(x => x.id === student.intake_id)
  const enrollments = state.enrollments.filter(x => x.student_id === studentId)
  const paidEnrollments = enrollments.filter(x => enrollmentPayments(x.id).length)
  const payments = paidEnrollments.flatMap(x => enrollmentPayments(x.id))
  if (!payments.length) return toast('Cet élève n’a aucun paiement à placer en attente.', true)
  const amount = payments.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const fullName = `${student.last_name} ${student.first_name}`.trim()
  const modal = showModal('⚠ Mettre les paiements en attente', `<div class="danger-zone"><h3>Retirer l’élève de la vague</h3><p><strong>${esc(fullName)}</strong> sera retiré de <strong>${esc(intake?.name || 'sa vague')}</strong>. Ses <strong>${payments.length} versement(s)</strong>, soit <strong>${money(amount)}</strong>, resteront conservés dans « Paiements en attente d’affectation ».</p><p>Il n’apparaîtra plus dans cette vague. Plus tard, chaque versement pourra être affecté à une nouvelle vague sans ressaisir l’argent.</p><label>Pour confirmer, saisissez exactement <strong>METTRE EN ATTENTE</strong><input id="pending-confirmation" autocomplete="off"></label><p id="pending-move-error" class="error"></p></div><div class="modal-actions"><button type="button" class="secondary cancel">Annuler</button><button id="confirm-pending-move" class="danger" type="button" disabled>Retirer de la vague</button></div>`)
  const confirmation = modal.querySelector('#pending-confirmation')
  const submit = modal.querySelector('#confirm-pending-move')
  modal.querySelector('.cancel').addEventListener('click', () => modal.remove())
  confirmation.addEventListener('input', () => { submit.disabled = confirmation.value.trim() !== 'METTRE EN ATTENTE' })
  submit.addEventListener('click', async () => {
    submit.disabled = true
    const results = await Promise.all(paidEnrollments.map(enrollment => supabase.from('payments').update({
      enrollment_id: null,
      payment_context: 'pending',
      pending_first_name: student.first_name,
      pending_last_name: student.last_name,
      pending_phone: student.phone || null,
      pending_formation_id: enrollment.formation_id || null,
      pending_scholarship_status: Boolean(enrollment.scholarship_status)
    }).eq('enrollment_id', enrollment.id).select('id')))
    const failed = results.find(result => result.error)
    if (failed) {
      modal.querySelector('#pending-move-error').textContent = failed.error.message
      submit.disabled = false
      return
    }
    const { error } = await supabase.from('students').delete().eq('id', studentId)
    if (error) {
      modal.querySelector('#pending-move-error').textContent = `Les paiements sont en attente, mais l’élève doit encore être supprimé : ${error.message}`
      submit.disabled = false
      return
    }
    modal.remove()
    await refresh('Élève retiré de la vague ; ses paiements sont en attente d’affectation.')
  })
}

function deleteStudentModal(studentId) {
  const student = state.students.find(x => x.id === studentId)
  if (!student) return
  const intake = state.intakes.find(x => x.id === student.intake_id)
  const enrollments = state.enrollments.filter(x => x.student_id === studentId)
  const enrollmentIds = new Set(enrollments.map(x => x.id))
  const payments = state.payments.filter(x => enrollmentIds.has(x.enrollment_id))
  const fullName = `${student.last_name} ${student.first_name}`.trim()
  const required = `SUPPRIMER ${fullName}`
  const modal = showModal('⚠ Suppression d’un élève', `<div class="danger-zone"><h3>Attention : cette action est irréversible.</h3><p>Vous allez supprimer <strong>${esc(fullName)}</strong> de <strong>${esc(intake?.name || 'cette vague')}</strong>, avec ses <strong>${enrollments.length} dossier(s)</strong> et ses <strong>${payments.length} paiement(s)</strong>.</p><p>Les autres élèves de cette vague seront automatiquement renumérotés : N° 2 devient N° 1, puis la suite sera corrigée.</p><label>Pour confirmer, saisissez exactement <strong>${esc(required)}</strong><input id="delete-student-confirmation" autocomplete="off"></label><p id="delete-student-error" class="error"></p></div><div class="modal-actions"><button type="button" class="secondary cancel">Annuler</button><button id="confirm-delete-student" class="danger" type="button" disabled>Supprimer définitivement</button></div>`)
  const confirmation = modal.querySelector('#delete-student-confirmation')
  const submit = modal.querySelector('#confirm-delete-student')
  modal.querySelector('.cancel').addEventListener('click', () => modal.remove())
  confirmation.addEventListener('input', () => { submit.disabled = confirmation.value.trim() !== required })
  submit.addEventListener('click', async () => {
    submit.disabled = true
    const { error } = await supabase.from('students').delete().eq('id', studentId)
    if (error) {
      modal.querySelector('#delete-student-error').textContent = error.message
      submit.disabled = false
      return
    }
    modal.remove()
    await refresh('Élève supprimé. Les numéros de la vague ont été réorganisés.')
  })
}

function cancelPaymentModal(paymentId) {
  const payment = state.payments.find(x => x.id === paymentId)
  if (!payment || paymentIsCancelled(payment)) return toast('Ce versement est introuvable ou déjà annulé.', true)
  const enrollment = state.enrollments.find(x => x.id === payment.enrollment_id)
  const student = enrollment && studentFor(enrollment)
  const owner = student ? `${student.last_name} ${student.first_name}` : 'Paiement en attente'
  const modal = showModal('⚠ Annuler un paiement', `<form id="cancel-payment-form"><div class="danger-zone"><h3>Cette action retire le versement des calculs.</h3><p>Vous êtes sur le point d’annuler <strong>${money(payment.amount)}</strong> pour <strong>${esc(owner)}</strong>. Il restera dans l’historique avec la mention « Annulé », mais ne comptera plus dans l’encaissé, le reste dû ou les statuts mensuels.</p><label>Motif de l’annulation<textarea name="cancellation_reason" rows="3" required placeholder="Ex. Saisie en double, remboursement, erreur de montant"></textarea></label><label>Pour confirmer, saisissez exactement <strong>ANNULER</strong><input name="confirmation" autocomplete="off" required></label><p id="cancel-payment-error" class="error"></p></div><div class="modal-actions"><button type="button" class="secondary cancel">Retour</button><button id="confirm-cancel-payment" class="danger" type="submit" disabled>Annuler le paiement</button></div></form>`)
  const form = modal.querySelector('#cancel-payment-form')
  const submit = modal.querySelector('#confirm-cancel-payment')
  modal.querySelector('.cancel').addEventListener('click', () => modal.remove())
  form.confirmation.addEventListener('input', () => { submit.disabled = form.confirmation.value.trim() !== 'ANNULER' })
  form.addEventListener('submit', async event => {
    event.preventDefault()
    if (form.confirmation.value.trim() !== 'ANNULER') return
    submit.disabled = true
    const { error } = await supabase.from('payments').update({
      cancelled_at: new Date().toISOString(),
      cancelled_by: state.user.id,
      cancellation_reason: form.cancellation_reason.value.trim()
    }).eq('id', paymentId).select('id,cancelled_at').single()
    if (error) {
      modal.querySelector('#cancel-payment-error').textContent = error.message
      submit.disabled = false
      return
    }
    modal.remove()
    await refresh('Paiement annulé : il reste visible dans l’historique mais n’est plus comptabilisé.')
  })
}

function studentPaymentHistoryModal(studentId) {
  const student = state.students.find(x => x.id === studentId)
  if (!student) return toast('Élève introuvable.', true)
  const enrollments = state.enrollments.filter(x => x.student_id === studentId)
  const enrollmentIds = new Set(enrollments.map(x => x.id))
  const payments = state.payments.filter(x => enrollmentIds.has(x.enrollment_id)).sort((a, b) => new Date(b.paid_at) - new Date(a.paid_at))
  const audit = state.paymentAudit.filter(entry => enrollmentIds.has(entry.enrollment_id)).sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at))
  const activeTotal = payments.filter(x => !paymentIsCancelled(x)).reduce((sum, x) => sum + Number(x.amount || 0), 0)
  const rows = payments.map(payment => {
    const enrollment = state.enrollments.find(x => x.id === payment.enrollment_id)
    const cancelled = paymentIsCancelled(payment)
    return `<tr><td>${dateTime(payment.paid_at)}</td><td>${esc(formationFor(enrollment)?.name || '—')}</td><td><strong>${money(payment.amount)}</strong></td><td>${esc(paymentMethodLabel(payment.method))}</td><td>${cancelled ? '<span class="badge due">Annulé</span>' : '<span class="badge ok">Comptabilisé</span>'}</td><td>${paymentActionButtons(payment)}</td></tr>`
  }).join('')
  const timeline = audit.map(entry => `<li class="audit-entry"><div><span class="badge ${entry.action === 'cancelled' || entry.action === 'deleted' ? 'due' : entry.action === 'updated' ? 'warning' : 'ok'}">${esc(auditActionLabel(entry.action))}</span><strong>${dateTime(entry.occurred_at)}</strong></div><p>${esc(paymentAuditDescription(entry))}</p><small>Par : ${esc(staffName(entry.actor_id))}</small></li>`).join('')
  const modal = showModal(`Historique — ${esc(student.last_name)} ${esc(student.first_name)}`, `<div class="history-overview"><div><span>Total actuellement comptabilisé</span><strong>${money(activeTotal)}</strong></div><div><span>Versements</span><strong>${payments.length}</strong></div><div><span>Actions enregistrées</span><strong>${audit.length}</strong></div></div><section class="history-detail"><h3>Ses reçus et versements</h3><div class="table-wrap"><table><thead><tr><th>Date</th><th>Dossier</th><th>Montant</th><th>Moyen</th><th>État</th><th></th></tr></thead><tbody>${rows}</tbody></table>${rows ? '' : '<div class="empty">Aucun versement associé à cet élève.</div>'}</div></section><section class="history-detail"><h3>Journal des opérations</h3><p class="muted">Chaque ajout, modification, annulation ou suppression est conservé ici.</p><ol class="audit-list">${timeline || '<li class="empty">Aucune opération enregistrée.</li>'}</ol></section>`)
  modal.querySelectorAll('.receipt-payment').forEach(button => button.addEventListener('click', () => downloadReceipt(button.dataset.id)))
  modal.querySelectorAll('.edit-payment').forEach(button => button.addEventListener('click', () => { modal.remove(); editPaymentModal(button.dataset.id) }))
  modal.querySelectorAll('.cancel-payment').forEach(button => button.addEventListener('click', () => { modal.remove(); cancelPaymentModal(button.dataset.id) }))
  modal.querySelectorAll('.delete-payment').forEach(button => button.addEventListener('click', () => { modal.remove(); deletePaymentModal(button.dataset.id) }))
}

function editPaymentModal(paymentId) {
  const payment = state.payments.find(x => x.id === paymentId)
  if (!payment || paymentIsCancelled(payment)) return toast('Seul un paiement non annulé peut être modifié.', true)
  const enrollment = state.enrollments.find(x => x.id === payment.enrollment_id)
  if (!enrollment) return toast('Le dossier de ce paiement est introuvable.', true)
  const summary = financialStatus(enrollment)
  const allowedAmount = summary.remaining + Number(payment.amount || 0)
  const monthOptions = Array.from({ length: monthsFor(enrollment) }, (_, i) => i + 1).map(month => `<option value="${month}" ${payment.billing_month === month ? 'selected' : ''}>Mois ${month}</option>`).join('')
  const dateValue = new Date(payment.paid_at).toISOString().slice(0, 10)
  const modal = showModal('Modifier un versement', `<p class="muted modal-context">Toute modification reste inscrite dans le journal de l’élève. Montant maximum autorisé : <strong>${money(allowedAmount)}</strong>.<br>Référence automatique : <strong>${esc(payment.reference || receiptNumber(payment))}</strong></p><form id="edit-payment-form"><div class="grid-2"><label>Montant versé<input name="amount" type="number" min="1" max="${allowedAmount}" value="${Number(payment.amount)}" required></label><label>Moyen de paiement<select name="method"><option value="especes" ${payment.method === 'especes' ? 'selected' : ''}>Espèces</option><option value="mobile_money" ${payment.method === 'mobile_money' ? 'selected' : ''}>Mobile Money</option><option value="banque" ${payment.method === 'banque' ? 'selected' : ''}>Banque</option><option value="carte" ${payment.method === 'carte' ? 'selected' : ''}>Carte bancaire</option></select></label><label>Date<input name="paid_at" type="date" value="${dateValue}" required></label><label>Mois concerné<select name="billing_month"><option value="">Paiement global</option>${monthOptions}</select></label><label>Tranche<select name="installment"><option value="">Paiement complet / non précisé</option><option value="1" ${payment.installment === 1 ? 'selected' : ''}>Tranche 1</option><option value="2" ${payment.installment === 2 ? 'selected' : ''}>Tranche 2</option></select></label></div><label style="margin-top:15px">Notes<textarea name="notes" rows="3">${esc(payment.notes || '')}</textarea></label><p id="edit-payment-error" class="error"></p><div class="modal-actions"><button type="button" class="secondary cancel">Annuler</button><button class="primary" type="submit">Enregistrer la modification</button></div></form>`)
  modal.querySelector('.cancel').addEventListener('click', () => modal.remove())
  modal.querySelector('#edit-payment-form').addEventListener('submit', async event => {
    event.preventDefault()
    const data = Object.fromEntries(new FormData(event.currentTarget))
    data.amount = Number(data.amount)
    if (data.amount > allowedAmount) return modal.querySelector('#edit-payment-error').textContent = `Le montant dépasse le maximum autorisé (${money(allowedAmount)}).`
    data.paid_at = new Date(`${data.paid_at}T12:00:00`).toISOString()
    data.billing_month = data.billing_month ? Number(data.billing_month) : null
    data.installment = data.installment ? Number(data.installment) : null
    data.payment_stage = data.installment === 1 ? 'tranche_1' : data.installment === 2 ? 'tranche_2' : (data.billing_month ? 'mensualite' : 'versement')
    data.notes = data.notes || null
    const { error } = await supabase.from('payments').update(data).eq('id', paymentId).select('id').single()
    if (error) return modal.querySelector('#edit-payment-error').textContent = error.message
    modal.remove()
    await refresh('Versement modifié. La trace de la modification est conservée.')
  })
}

function deletePaymentModal(paymentId) {
  const payment = state.payments.find(x => x.id === paymentId)
  if (!payment) return toast('Paiement introuvable.', true)
  if (!canPermanentlyDeletePayments()) return toast('Seul un administrateur peut supprimer définitivement un paiement.', true)
  const modal = showModal('⚠ Supprimer définitivement un paiement', `<div class="danger-zone"><h3>Cette suppression est définitive.</h3><p>Le versement de <strong>${money(payment.amount)}</strong> sera retiré de la liste et des calculs. Son empreinte restera dans le journal d’audit avec l’ancienne valeur et l’heure de suppression.</p><label>Pour confirmer, saisissez exactement <strong>SUPPRIMER</strong><input id="delete-payment-confirmation" autocomplete="off"></label><p id="delete-payment-error" class="error"></p></div><div class="modal-actions"><button type="button" class="secondary cancel">Retour</button><button id="confirm-delete-payment" class="danger" type="button" disabled>Supprimer définitivement</button></div>`)
  const confirmation = modal.querySelector('#delete-payment-confirmation')
  const submit = modal.querySelector('#confirm-delete-payment')
  modal.querySelector('.cancel').addEventListener('click', () => modal.remove())
  confirmation.addEventListener('input', () => { submit.disabled = confirmation.value.trim() !== 'SUPPRIMER' })
  submit.addEventListener('click', async () => {
    submit.disabled = true
    const { error } = await supabase.from('payments').delete().eq('id', paymentId)
    if (error) { modal.querySelector('#delete-payment-error').textContent = error.message; submit.disabled = false; return }
    modal.remove()
    await refresh('Paiement supprimé. Son empreinte est conservée dans le journal d’audit.')
  })
}

function paymentModal(enrollmentId) {
  const enrollment = state.enrollments.find(x => x.id === enrollmentId)
  const summary = financialStatus(enrollment)
  const monthOptions = Array.from({ length: monthsFor(enrollment) }, (_, i) => i + 1).map(month => `<option value="${month}">Mois ${month}</option>`).join('')
  const dossierNumber = `${enrollment.slot || '—'} — N° ${studentFor(enrollment)?.intake_student_number || '—'}`
  const modal = showModal(`Paiement — Dossier ${esc(dossierNumber)}`, `<p class="muted modal-context">Montant total : <strong>${money(summary.due)}</strong> · Déjà payé : <strong>${money(summary.paid)}</strong> · Reste : <strong>${money(summary.remaining)}</strong></p><form id="payment-form">
    <div class="grid-2">
      <label>Montant versé<input name="amount" type="number" min="1" required></label>
      <label>Moyen de paiement<select name="method"><option value="especes">Espèces</option><option value="mobile_money">Mobile Money</option><option value="banque">Banque</option><option value="autre">Autre</option></select></label>
      <label>Date<input name="paid_at" type="date" value="${today()}" required></label>
      <label>Mois concerné<select name="billing_month"><option value="">Paiement global</option>${monthOptions}</select></label>
      <label>Tranche<select name="installment"><option value="">Paiement complet / non précisé</option><option value="1">Tranche 1</option><option value="2">Tranche 2</option></select></label>
    </div>
    <label style="margin-top:15px">Notes<textarea name="notes" rows="3"></textarea></label>
    <div class="modal-actions"><button type="button" class="secondary cancel">Annuler</button><button class="primary" type="submit">Enregistrer le paiement</button></div>
  </form>`)
  modal.querySelector('.cancel').addEventListener('click', () => modal.remove())
  modal.querySelector('#payment-form').addEventListener('submit', async event => {
    event.preventDefault()
    const data = Object.fromEntries(new FormData(event.currentTarget))
    data.amount = Number(data.amount)
    data.enrollment_id = enrollmentId
    data.received_by = state.user.id
    data.paid_at = new Date(`${data.paid_at}T12:00:00`).toISOString()
    data.billing_month = data.billing_month ? Number(data.billing_month) : null
    data.installment = data.installment ? Number(data.installment) : null
    data.payment_stage = data.installment === 1 ? 'tranche_1' : data.installment === 2 ? 'tranche_2' : (data.billing_month ? 'mensualite' : 'versement')
    if (summary.due > 0 && data.amount > summary.remaining) return toast(`Le versement dépasse le reste à payer (${money(summary.remaining)}).`, true)
    data.reference = automaticPaymentReference()
    if (!data.notes) data.notes = null
    const { data: created, error } = await supabase.from('payments').insert(data).select().single()
    if (error || !created) return toast(error?.message || 'Le paiement n’a pas été enregistré.', true)
    modal.remove()
    await refresh('Paiement enregistré.')
    setTimeout(() => downloadReceipt(created.id), 100)
  })
}

async function refresh(message) {
  try {
    await loadData()
    shellView()
    if (message) toast(message)
  } catch (error) {
    toast(error.message, true)
  }
}

async function start(session) {
  if (!session) return loginView()
  state.user = session.user
  try {
    await loadData()
    if (!state.staff?.active) throw new Error('Ce compte ne dispose pas d’un accès actif au personnel BEVA.')
    shellView()
  } catch (error) {
    await supabase.auth.signOut()
    loginView()
    setTimeout(() => {
      const el = document.querySelector('#login-error')
      if (el) el.textContent = error.message
    })
  }
}

const isRecovery = new URLSearchParams(window.location.hash.slice(1)).get('type') === 'recovery'
const { data: { session } } = await supabase.auth.getSession()
if (isRecovery && session) choosePasswordView()
else await start(session)
supabase.auth.onAuthStateChange((event, currentSession) => {
  if (event === 'PASSWORD_RECOVERY' && currentSession) choosePasswordView()
  if (event === 'SIGNED_IN' && currentSession) start(currentSession)
  if (event === 'SIGNED_OUT') { state.user = null; state.staff = null; loginView() }
})
