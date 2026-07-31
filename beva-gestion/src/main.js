import { createClient } from '@supabase/supabase-js'
import './style.css'

const SUPABASE_URL = 'https://bxhgptcsuhbfuqamcdxs.supabase.co'
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_gQ3vAqx13bYldbATsPS6wA_2bvKXpBj'
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)

const app = document.querySelector('#app')
const state = { user: null, staff: null, students: [], enrollments: [], formations: [], payments: [], intakes: [], section: 'dashboard' }

const money = value => new Intl.NumberFormat('fr-FR').format(Number(value || 0)) + ' FCFA'
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]))
const roleLabel = role => ({ admin: 'Administrateur', direction: 'Direction', agent: 'Agent' }[role] || role)
const today = () => new Date().toISOString().slice(0, 10)

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
}

async function loadData() {
  const [staff, students, enrollments, formations, payments, intakes] = await Promise.all([
    supabase.from('staff_members').select('*').eq('user_id', state.user.id).single(),
    supabase.from('students').select('*').order('student_number', { ascending: false }),
    supabase.from('enrollments').select('*').order('dossier_code'),
    supabase.from('formations').select('*').order('name'),
    supabase.from('payments').select('*').order('paid_at', { ascending: false }),
    supabase.from('intakes').select('*').order('start_date', { ascending: false })
  ])
  const firstError = [staff, students, enrollments, formations, payments, intakes].find(x => x.error)?.error
  if (firstError) throw firstError
  state.staff = staff.data
  state.students = students.data
  state.enrollments = enrollments.data
  state.formations = formations.data
  state.payments = payments.data
  state.intakes = intakes.data
}

function dashboardStats() {
  const assigned = state.enrollments.filter(x => x.status !== 'disponible')
  const due = assigned.reduce((sum, item) => sum + Number(item.agreed_fee || 0), 0)
  const paid = state.payments.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  return { assigned: assigned.length, due, paid, balance: Math.max(0, due - paid) }
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
        </nav>
        <div class="sidebar-bottom">
          <p class="staff-name">${esc(state.staff.full_name)}</p>
          <p class="staff-role">${roleLabel(state.staff.role)}</p>
          <button id="logout" class="secondary">Déconnexion</button>
        </div>
      </aside>
      <main class="main">
        <header class="topbar">
          <div><h1 id="page-title">Tableau de bord</h1><p class="muted">Vue générale de l’activité BEVA</p></div>
          <button id="add-student-top" class="primary">+ Nouvel étudiant</button>
        </header>
        <section id="dashboard" class="section">
          <div class="cards">
            <div class="card"><div class="label">Étudiants</div><div class="value">${state.students.length}</div></div>
            <div class="card"><div class="label">Formations suivies</div><div class="value">${stats.assigned}</div></div>
            <div class="card"><div class="label">Total encaissé</div><div class="value">${money(stats.paid)}</div></div>
            <div class="card"><div class="label">Reste à payer</div><div class="value">${money(stats.balance)}</div></div>
          </div>
          ${studentPanel('Inscriptions récentes', state.students.slice(0, 8))}
        </section>
        <section id="students" class="section">${studentPanel('Tous les étudiants', state.students, true)}</section>
        <section id="payments" class="section">${paymentPanel()}</section>
        <section id="formations" class="section">${formationPanel()}</section>
      </main>
    </div>`
  bindShell()
  switchSection(state.section)
}

function studentPanel(title, students, searchable = false) {
  return `<div class="panel">
    <div class="panel-head"><h2>${title}</h2>${searchable ? '<div class="tools"><input id="student-search" placeholder="Rechercher un nom, numéro ou téléphone"></div>' : ''}</div>
    <div class="table-wrap"><table><thead><tr><th>N° étudiant</th><th>Nom et prénom</th><th>Téléphone</th><th>Formations</th><th>Action</th></tr></thead>
    <tbody id="${searchable ? 'student-table' : 'recent-table'}">${studentRows(students)}</tbody></table>
    ${students.length ? '' : '<div class="empty">Aucun étudiant enregistré.</div>'}</div>
  </div>`
}

function studentRows(students) {
  return students.map(student => {
    const items = state.enrollments.filter(x => x.student_id === student.id && x.status !== 'disponible')
    return `<tr>
      <td class="code">${esc(student.registration_code)}</td>
      <td><strong>${esc(student.last_name)} ${esc(student.first_name)}</strong></td>
      <td>${esc(student.phone || '—')}</td>
      <td><span class="badge ${items.length ? 'ok' : ''}">${items.length} / 4</span></td>
      <td><button class="link-btn manage-student" data-id="${student.id}">Gérer les dossiers</button></td>
    </tr>`
  }).join('')
}

function paymentPanel() {
  const rows = state.payments.map(payment => {
    const enrollment = state.enrollments.find(x => x.id === payment.enrollment_id)
    const student = enrollment && state.students.find(x => x.id === enrollment.student_id)
    return `<tr><td>${new Date(payment.paid_at).toLocaleDateString('fr-FR')}</td><td class="code">${esc(enrollment?.dossier_code || '—')}</td>
      <td>${student ? `${esc(student.last_name)} ${esc(student.first_name)}` : '—'}</td><td><strong>${money(payment.amount)}</strong></td>
      <td><span class="badge">${esc(payment.method.replace('_', ' '))}</span></td><td>${esc(payment.reference || '—')}</td></tr>`
  }).join('')
  return `<div class="panel"><div class="panel-head"><h2>Historique des paiements</h2></div><div class="table-wrap">
    <table><thead><tr><th>Date</th><th>Dossier</th><th>Étudiant</th><th>Montant</th><th>Moyen</th><th>Référence</th></tr></thead>
    <tbody>${rows}</tbody></table>${rows ? '' : '<div class="empty">Aucun paiement enregistré.</div>'}</div></div>`
}

function formationPanel() {
  const rows = state.formations.map(item => `<tr><td><strong>${esc(item.name)}</strong></td><td>${money(item.standard_fee)}</td>
    <td>${item.duration_months ? item.duration_months + ' mois' : '—'}</td><td><span class="badge ${item.active ? 'ok' : ''}">${item.active ? 'Active' : 'Inactive'}</span></td></tr>`).join('')
  return `<div class="panel"><div class="panel-head"><h2>Formations BEVA</h2></div><div class="table-wrap"><table>
    <thead><tr><th>Formation</th><th>Tarif standard</th><th>Durée</th><th>Statut</th></tr></thead><tbody>${rows}</tbody></table></div></div>`
}

function bindShell() {
  document.querySelectorAll('[data-section]').forEach(button => button.addEventListener('click', () => switchSection(button.dataset.section)))
  document.querySelector('#logout').addEventListener('click', () => supabase.auth.signOut())
  document.querySelector('#add-student-top').addEventListener('click', newStudentModal)
  document.querySelectorAll('.manage-student').forEach(button => button.addEventListener('click', () => manageStudentModal(button.dataset.id)))
  document.querySelector('#student-search')?.addEventListener('input', event => {
    const q = event.target.value.trim().toLowerCase()
    const result = state.students.filter(x => [x.registration_code, x.first_name, x.last_name, x.phone].some(v => String(v || '').toLowerCase().includes(q)))
    document.querySelector('#student-table').innerHTML = studentRows(result)
    document.querySelectorAll('.manage-student').forEach(button => button.addEventListener('click', () => manageStudentModal(button.dataset.id)))
  })
}

function switchSection(section) {
  state.section = section
  document.querySelectorAll('.section').forEach(el => el.classList.toggle('active', el.id === section))
  document.querySelectorAll('[data-section]').forEach(el => el.classList.toggle('active', el.dataset.section === section))
  const titles = { dashboard: 'Tableau de bord', students: 'Étudiants', payments: 'Paiements', formations: 'Formations' }
  document.querySelector('#page-title').textContent = titles[section]
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
  const intakeOptions = state.intakes.map(x => `<option value="${x.id}">${esc(x.name)}</option>`).join('')
  const modal = showModal('Inscrire un étudiant', `<form id="student-form">
    <div class="grid-2">
      <label>Nom<input name="last_name" required></label><label>Prénom(s)<input name="first_name" required></label>
      <label>Téléphone<input name="phone" inputmode="tel"></label><label>Adresse e-mail<input name="email" type="email"></label>
      <label>Sexe<select name="sex"><option value="">Non précisé</option><option>Femme</option><option>Homme</option></select></label>
      <label>Date de naissance<input name="birth_date" type="date"></label>
      <label>Rentrée / promotion<select name="intake_id"><option value="">Aucune</option>${intakeOptions}</select></label>
      <label>Adresse<input name="address"></label>
    </div>
    <label style="margin-top:15px">Notes<textarea name="notes" rows="3"></textarea></label>
    <p class="muted">Les quatre dossiers de formation seront créés automatiquement.</p>
    <div class="modal-actions"><button type="button" class="secondary cancel">Annuler</button><button class="primary" type="submit">Enregistrer</button></div>
  </form>`)
  modal.querySelector('.cancel').addEventListener('click', () => modal.remove())
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

function manageStudentModal(studentId) {
  const student = state.students.find(x => x.id === studentId)
  const slots = state.enrollments.filter(x => x.student_id === studentId).sort((a, b) => a.slot - b.slot)
  const rows = slots.map(slot => {
    const formationOptions = state.formations.filter(x => x.active).map(x => `<option value="${x.id}" ${x.id === slot.formation_id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')
    const paid = state.payments.filter(x => x.enrollment_id === slot.id).reduce((s, x) => s + Number(x.amount), 0)
    return `<tr><td class="code">${esc(slot.dossier_code)}</td><td class="formation-cell"><select class="slot-formation" data-id="${slot.id}">
      <option value="">Disponible</option>${formationOptions}</select></td><td><input class="slot-fee" data-id="${slot.id}" type="number" min="0" value="${slot.agreed_fee}"></td>
      <td>${money(paid)}</td><td>${money(Math.max(0, Number(slot.agreed_fee) - paid))}</td>
      <td><button class="link-btn save-slot" data-id="${slot.id}">Sauver</button>${slot.formation_id ? `<button class="link-btn pay-slot" data-id="${slot.id}">Paiement</button>` : ''}</td></tr>`
  }).join('')
  const modal = showModal(`${esc(student.last_name)} ${esc(student.first_name)} — ${esc(student.registration_code)}`, `
    <div class="table-wrap"><table><thead><tr><th>Dossier</th><th>Formation</th><th>Tarif convenu</th><th>Payé</th><th>Reste</th><th>Action</th></tr></thead>
    <tbody>${rows}</tbody></table></div>`)
  modal.querySelectorAll('.save-slot').forEach(button => button.addEventListener('click', async () => {
    const id = button.dataset.id
    const formationId = modal.querySelector(`.slot-formation[data-id="${id}"]`).value || null
    const fee = Number(modal.querySelector(`.slot-fee[data-id="${id}"]`).value || 0)
    const { error } = await supabase.from('enrollments').update({
      formation_id: formationId, agreed_fee: fee, status: formationId ? 'inscrit' : 'disponible', enrolled_at: formationId ? today() : null
    }).eq('id', id)
    if (error) return toast(error.message, true)
    modal.remove()
    await refresh('Dossier mis à jour.')
  }))
  modal.querySelectorAll('.pay-slot').forEach(button => button.addEventListener('click', () => {
    modal.remove()
    paymentModal(button.dataset.id)
  }))
}

function paymentModal(enrollmentId) {
  const enrollment = state.enrollments.find(x => x.id === enrollmentId)
  const modal = showModal(`Paiement — ${esc(enrollment.dossier_code)}`, `<form id="payment-form">
    <div class="grid-2">
      <label>Montant versé<input name="amount" type="number" min="1" required></label>
      <label>Moyen de paiement<select name="method"><option value="especes">Espèces</option><option value="mobile_money">Mobile Money</option><option value="banque">Banque</option><option value="autre">Autre</option></select></label>
      <label>Date<input name="paid_at" type="date" value="${today()}" required></label>
      <label>Référence<input name="reference"></label>
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
    if (!data.reference) data.reference = null
    if (!data.notes) data.notes = null
    const { error } = await supabase.from('payments').insert(data)
    if (error) return toast(error.message, true)
    modal.remove()
    await refresh('Paiement enregistré.')
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

const { data: { session } } = await supabase.auth.getSession()
await start(session)
supabase.auth.onAuthStateChange((event, currentSession) => {
  if (event === 'SIGNED_IN' && currentSession) start(currentSession)
  if (event === 'SIGNED_OUT') { state.user = null; state.staff = null; loginView() }
})
