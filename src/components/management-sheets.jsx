import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowRight, Check, Clock3, FilePenLine, ReceiptText, Save, Trash2, UserRoundPen } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { feeFor, financialStatus, money, paymentMethodLabel, studentName } from '@/lib/business'
import { tr } from '@/lib/preferences'
import { Button } from '@/components/ui/button'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import { Sheet } from '@/components/ui/sheet'

const dayValue = value => value ? new Date(value).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)
const canManagePayments = role => ['admin', 'direction'].includes(role)
const canDeletePayments = role => role === 'admin'

export function EditStudentSheet({ student, onClose, data, mutate }) {
  if (!student) return null

  async function submit(event) {
    event.preventDefault()
    const values = Object.fromEntries(new FormData(event.currentTarget))
    const payload = {
      last_name: String(values.last_name || '').trim().toUpperCase(),
      first_name: String(values.first_name || '').trim(),
      phone: String(values.phone || '').trim() || null,
      email: String(values.email || '').trim() || null,
      birth_date: values.birth_date || null,
      sex: values.sex || null,
      address: String(values.address || '').trim() || null,
      status: values.status
    }
    const saved = await mutate({
      preview: current => ({ ...current, students: current.students.map(item => item.id === student.id ? { ...item, ...payload } : item) }),
      live: () => supabase.from('students').update(payload).eq('id', student.id).select('id').single(),
      success: tr('Informations de l’apprenant mises à jour.', 'Student information updated.')
    })
    if (saved) onClose()
  }

  const intake = data.intakes.find(item => item.id === student.intake_id)
  return <Sheet open={Boolean(student)} onOpenChange={value => !value && onClose()} title={tr('Modifier l’apprenant', 'Edit student')} description={`${studentName(student)} · ${intake?.name || tr('Vague non précisée', 'Cohort not specified')}`} className="management-sheet">
    <form className="sheet-form management-form" onSubmit={submit}>
      <div className="management-intro"><UserRoundPen/><div><strong>{tr('Informations personnelles', 'Personal information')}</strong><p>{tr('La vague et les dossiers restent inchangés.', 'The cohort and course records remain unchanged.')}</p></div></div>
      <div className="form-grid">
        <Field label={tr('Nom', 'Last name')}><Input name="last_name" defaultValue={student.last_name || ''} required /></Field>
        <Field label={tr('Prénom(s)', 'First name(s)')}><Input name="first_name" defaultValue={student.first_name || ''} required /></Field>
        <Field label={tr('Téléphone', 'Phone')}><Input name="phone" inputMode="tel" defaultValue={student.phone || ''} /></Field>
        <Field label={tr('Adresse e-mail', 'Email address')}><Input name="email" type="email" defaultValue={student.email || ''} /></Field>
        <Field label={tr('Date de naissance', 'Date of birth')}><Input name="birth_date" type="date" defaultValue={student.birth_date || ''} /></Field>
        <Field label={tr('Sexe', 'Sex')}><Input name="sex" defaultValue={student.sex || ''} placeholder={tr('Facultatif', 'Optional')} /></Field>
        <Field label={tr('Statut général', 'Overall status')}><Select name="status" defaultValue={student.status || 'actif'}><option value="actif">{tr('Actif', 'Active')}</option><option value="suspendu">{tr('Suspendu', 'Suspended')}</option><option value="abandonne">{tr('Abandon', 'Withdrawn')}</option></Select></Field>
      </div>
      <Field label={tr('Adresse', 'Address')}><Input name="address" defaultValue={student.address || ''} /></Field>
      <div className="sheet-actions"><Button type="button" variant="secondary" onClick={onClose}>{tr('Annuler', 'Cancel')}</Button><Button><Save/>{tr('Enregistrer les modifications', 'Save changes')}</Button></div>
    </form>
  </Sheet>
}

export function PaymentManagementSheet({ payment, onClose, data, mutate, onReceipt }) {
  const [mode, setMode] = useState('summary')
  const [confirmation, setConfirmation] = useState('')
  const [reason, setReason] = useState('')
  useEffect(() => { setMode('summary'); setConfirmation(''); setReason('') }, [payment?.id])
  if (!payment) return null

  const current = data.payments.find(item => item.id === payment.id) || payment
  const pending = current.payment_context === 'pending'
  const enrollment = data.enrollments.find(item => item.id === current.enrollment_id)
  const student = enrollment && data.students.find(item => item.id === enrollment.student_id)
  const formation = enrollment
    ? data.formations.find(item => item.id === enrollment.formation_id)
    : data.formations.find(item => item.id === current.pending_formation_id)
  const summary = enrollment ? financialStatus(enrollment, student, data.payments) : null
  const allowedAmount = enrollment ? summary.remaining + Number(current.amount || 0) : undefined
  const manager = canManagePayments(data.staff?.role)
  const administrator = canDeletePayments(data.staff?.role)
  const cancelled = Boolean(current.cancelled_at)
  const owner = pending ? `${current.pending_last_name || ''} ${current.pending_first_name || ''}`.trim() : studentName(student)

  async function saveEdit(event) {
    event.preventDefault()
    const values = Object.fromEntries(new FormData(event.currentTarget))
    const payload = {
      amount: Number(values.amount),
      method: values.method,
      paid_at: new Date(`${values.paid_at}T12:00:00`).toISOString(),
      notes: String(values.notes || '').trim() || null
    }
    if (pending) {
      Object.assign(payload, {
        pending_last_name: String(values.pending_last_name || '').trim().toUpperCase(),
        pending_first_name: String(values.pending_first_name || '').trim(),
        pending_phone: String(values.pending_phone || '').trim() || null,
        pending_formation_id: values.pending_formation_id || null,
        pending_scholarship_status: values.pending_scholarship_status === 'true'
      })
    } else {
      payload.billing_month = values.billing_month ? Number(values.billing_month) : null
      payload.installment = values.installment ? Number(values.installment) : null
      payload.payment_stage = payload.installment === 1 ? 'tranche_1' : payload.installment === 2 ? 'tranche_2' : (payload.billing_month ? 'mensualite' : 'versement')
    }
    const saved = await mutate({
      preview: state => ({ ...state, payments: state.payments.map(item => item.id === current.id ? { ...item, ...payload } : item) }),
      live: () => supabase.from('payments').update(payload).eq('id', current.id).select('id').single(),
      success: tr('Paiement modifié. La trace reste dans le journal.', 'Payment updated. The audit trail is preserved.')
    })
    if (saved) setMode('summary')
  }

  async function cancelPayment(event) {
    event.preventDefault()
    if (confirmation.trim() !== 'ANNULER' || !reason.trim()) return
    const payload = { cancelled_at: new Date().toISOString(), cancelled_by: data.staff.user_id, cancellation_reason: reason.trim() }
    const saved = await mutate({
      preview: state => ({ ...state, payments: state.payments.map(item => item.id === current.id ? { ...item, ...payload } : item) }),
      live: () => supabase.from('payments').update(payload).eq('id', current.id).select('id,cancelled_at').single(),
      success: tr('Paiement annulé et retiré des calculs.', 'Payment cancelled and removed from totals.')
    })
    if (saved) onClose()
  }

  async function moveToPending(event) {
    event.preventDefault()
    if (confirmation.trim() !== 'METTRE EN ATTENTE' || !enrollment || !student) return
    const payload = {
      enrollment_id: null,
      payment_context: 'pending',
      pending_first_name: student.first_name,
      pending_last_name: student.last_name,
      pending_phone: student.phone || null,
      pending_formation_id: enrollment.formation_id || null,
      pending_scholarship_status: Boolean(enrollment.scholarship_status)
    }
    const saved = await mutate({
      preview: state => ({ ...state, payments: state.payments.map(item => item.id === current.id ? { ...item, ...payload } : item) }),
      live: () => supabase.from('payments').update(payload).eq('id', current.id).select('id').single(),
      success: tr('Paiement placé en attente d’affectation.', 'Payment moved to pending allocation.')
    })
    if (saved) onClose()
  }

  async function deletePayment(event) {
    event.preventDefault()
    if (confirmation.trim() !== 'SUPPRIMER') return
    const saved = await mutate({
      preview: state => ({ ...state, payments: state.payments.filter(item => item.id !== current.id) }),
      live: () => supabase.from('payments').delete().eq('id', current.id).select('id').single(),
      success: tr('Paiement supprimé définitivement.', 'Payment permanently deleted.')
    })
    if (saved) onClose()
  }

  const title = mode === 'edit' ? tr('Modifier le paiement', 'Edit payment') : mode === 'cancel' ? tr('Annuler le paiement', 'Cancel payment') : mode === 'pending' ? tr('Mettre en attente', 'Move to pending') : mode === 'delete' ? tr('Supprimer le paiement', 'Delete payment') : tr('Gérer le paiement', 'Manage payment')
  return <Sheet open={Boolean(payment)} onOpenChange={value => !value && onClose()} title={title} description={`${owner || tr('Personne non précisée', 'Person not specified')} · ${formation?.name || tr('Formation non précisée', 'Course not specified')}`} className="management-sheet">
    {mode === 'summary' && <div className="payment-management-home">
      <div className="payment-management-amount"><span>{pending ? tr('En attente d’affectation', 'Pending allocation') : cancelled ? tr('Paiement annulé', 'Cancelled payment') : tr('Paiement comptabilisé', 'Recorded payment')}</span><strong>{money(current.amount)}</strong><small>{dayValue(current.paid_at)} · {paymentMethodLabel(current.method)}</small></div>
      <div className="management-action-grid">
        <Button variant="outline" onClick={() => onReceipt(current)}><ReceiptText/>{tr('Voir le reçu', 'View receipt')}</Button>
        {manager && !cancelled && <Button variant="outline" onClick={() => setMode('edit')}><FilePenLine/>{tr('Modifier', 'Edit')}</Button>}
        {manager && !cancelled && !pending && <Button variant="outline" onClick={() => { setConfirmation(''); setMode('pending') }}><Clock3/>{tr('Mettre en attente', 'Move to pending')}</Button>}
        {manager && !cancelled && <Button variant="danger" onClick={() => { setConfirmation(''); setReason(''); setMode('cancel') }}><AlertTriangle/>{tr('Annuler', 'Cancel')}</Button>}
        {administrator && <Button variant="danger" onClick={() => { setConfirmation(''); setMode('delete') }}><Trash2/>{tr('Supprimer définitivement', 'Delete permanently')}</Button>}
      </div>
      {!manager && <p className="management-permission-note">{tr('La modification des paiements est réservée à la Direction et à l’Administration.', 'Payment changes are restricted to Management and Administration.')}</p>}
    </div>}

    {mode === 'edit' && <form className="sheet-form management-form" onSubmit={saveEdit}>
      {pending && <div className="form-grid"><Field label={tr('Nom', 'Last name')}><Input name="pending_last_name" defaultValue={current.pending_last_name || ''} required /></Field><Field label={tr('Prénom(s)', 'First name(s)')}><Input name="pending_first_name" defaultValue={current.pending_first_name || ''} required /></Field><Field label={tr('Téléphone', 'Phone')}><Input name="pending_phone" defaultValue={current.pending_phone || ''} /></Field><Field label={tr('Formation souhaitée', 'Preferred course')}><Select name="pending_formation_id" defaultValue={current.pending_formation_id || ''}><option value="">{tr('Non précisée', 'Not specified')}</option>{data.formations.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field><Field label={tr('Tarif', 'Fee type')}><Select name="pending_scholarship_status" defaultValue={String(Boolean(current.pending_scholarship_status))}><option value="true">{tr('Boursier', 'Scholarship')}</option><option value="false">{tr('Standard', 'Standard')}</option></Select></Field></div>}
      <div className="form-grid"><Field label={tr('Montant', 'Amount')}><Input name="amount" type="number" min="1" max={allowedAmount} defaultValue={Number(current.amount || 0)} required /></Field><Field label={tr('Date', 'Date')}><Input name="paid_at" type="date" defaultValue={dayValue(current.paid_at)} required /></Field><Field label={tr('Moyen', 'Method')}><Select name="method" defaultValue={current.method || 'especes'}><option value="especes">{tr('Espèces', 'Cash')}</option><option value="mobile_money">Mobile Money</option><option value="banque">{tr('Virement bancaire', 'Bank transfer')}</option><option value="carte">{tr('Carte bancaire', 'Card')}</option><option value="autre">{tr('Autre', 'Other')}</option></Select></Field>{!pending && <><Field label={tr('Échéance', 'Period')}><Select name="billing_month" defaultValue={current.billing_month || ''}><option value="">{tr('Paiement global', 'General payment')}</option><option value="1">{tr('Mois 1', 'Month 1')}</option><option value="2">{tr('Mois 2', 'Month 2')}</option><option value="3">{tr('Mois 3', 'Month 3')}</option></Select></Field><Field label={tr('Tranche', 'Instalment')}><Select name="installment" defaultValue={current.installment || ''}><option value="">{tr('Non précisée', 'Not specified')}</option><option value="1">{tr('Tranche 1', 'Instalment 1')}</option><option value="2">{tr('Tranche 2', 'Instalment 2')}</option></Select></Field></>}</div>
      <Field label={tr('Note', 'Note')}><Textarea name="notes" defaultValue={current.notes || ''} /></Field>
      <div className="sheet-actions"><Button type="button" variant="secondary" onClick={() => setMode('summary')}>{tr('Retour', 'Back')}</Button><Button><Check/>{tr('Enregistrer', 'Save')}</Button></div>
    </form>}

    {mode === 'cancel' && <form className="management-confirm" onSubmit={cancelPayment}><AlertTriangle/><h3>{tr('Le versement restera visible, mais ne comptera plus dans les calculs.', 'The payment will remain visible but will no longer count in totals.')}</h3><Field label={tr('Motif de l’annulation', 'Cancellation reason')}><Textarea value={reason} onChange={event => setReason(event.target.value)} required /></Field><Field label={tr('Saisissez ANNULER pour confirmer', 'Type ANNULER to confirm')}><Input value={confirmation} onChange={event => setConfirmation(event.target.value)} autoComplete="off" /></Field><div className="sheet-actions"><Button type="button" variant="secondary" onClick={() => setMode('summary')}>{tr('Retour', 'Back')}</Button><Button variant="danger" disabled={confirmation.trim() !== 'ANNULER' || !reason.trim()}>{tr('Annuler le paiement', 'Cancel payment')}</Button></div></form>}

    {mode === 'pending' && <form className="management-confirm" onSubmit={moveToPending}><Clock3/><h3>{tr('Le paiement sera retiré de ce dossier et conservé dans les paiements en attente.', 'The payment will be removed from this record and retained as pending.')}</h3><Field label={tr('Saisissez METTRE EN ATTENTE pour confirmer', 'Type METTRE EN ATTENTE to confirm')}><Input value={confirmation} onChange={event => setConfirmation(event.target.value)} autoComplete="off" /></Field><div className="sheet-actions"><Button type="button" variant="secondary" onClick={() => setMode('summary')}>{tr('Retour', 'Back')}</Button><Button disabled={confirmation.trim() !== 'METTRE EN ATTENTE'}><Clock3/>{tr('Mettre en attente', 'Move to pending')}</Button></div></form>}

    {mode === 'delete' && <form className="management-confirm danger-zone-v2" onSubmit={deletePayment}><Trash2/><h3>{tr('Cette suppression est définitive. Le journal d’audit conservera la trace de l’opération.', 'This deletion is permanent. The audit log will retain the action.')}</h3><Field label={tr('Saisissez SUPPRIMER pour confirmer', 'Type SUPPRIMER to confirm')}><Input value={confirmation} onChange={event => setConfirmation(event.target.value)} autoComplete="off" /></Field><div className="sheet-actions"><Button type="button" variant="secondary" onClick={() => setMode('summary')}>{tr('Retour', 'Back')}</Button><Button variant="danger" disabled={confirmation.trim() !== 'SUPPRIMER'}><Trash2/>{tr('Supprimer définitivement', 'Delete permanently')}</Button></div></form>}
  </Sheet>
}

export function PendingPaymentSheet({ open, onClose, data, mutate }) {
  async function submit(event) {
    event.preventDefault()
    const values = Object.fromEntries(new FormData(event.currentTarget))
    const payment = {
      id: crypto.randomUUID(),
      enrollment_id: null,
      payment_context: 'pending',
      pending_last_name: String(values.pending_last_name || '').trim().toUpperCase(),
      pending_first_name: String(values.pending_first_name || '').trim(),
      pending_phone: String(values.pending_phone || '').trim() || null,
      pending_formation_id: values.pending_formation_id || null,
      pending_scholarship_status: values.pending_scholarship_status === 'true',
      amount: Number(values.amount),
      paid_at: new Date(`${values.paid_at}T12:00:00`).toISOString(),
      method: values.method,
      notes: String(values.notes || '').trim() || null,
      reference: `BEVA-PAY-${Date.now()}`,
      received_by: data.staff.user_id
    }
    const saved = await mutate({
      preview: current => ({ ...current, payments: [payment, ...current.payments] }),
      live: () => { const { id, ...payload } = payment; return supabase.from('payments').insert(payload).select('id').single() },
      success: tr('Paiement en attente enregistré.', 'Pending payment recorded.')
    })
    if (saved) onClose()
  }
  return <Sheet open={open} onOpenChange={value => !value && onClose()} title={tr('Paiement en attente', 'Pending payment')} description={tr('Pour une personne ayant payé avant son affectation à une vague.', 'For a person who paid before being assigned to a cohort.')} className="management-sheet"><form className="sheet-form management-form" onSubmit={submit}><div className="management-intro"><Clock3/><div><strong>{tr('Montant conservé sans être compté dans une vague', 'Amount retained without counting in a cohort')}</strong><p>{tr('Il pourra être affecté plus tard sans être ressaisi.', 'It can be assigned later without entering it again.')}</p></div></div><div className="form-grid"><Field label={tr('Nom', 'Last name')}><Input name="pending_last_name" required /></Field><Field label={tr('Prénom(s)', 'First name(s)')}><Input name="pending_first_name" required /></Field><Field label={tr('Téléphone', 'Phone')}><Input name="pending_phone" inputMode="tel" /></Field><Field label={tr('Formation souhaitée', 'Preferred course')}><Select name="pending_formation_id"><option value="">{tr('Non précisée', 'Not specified')}</option>{data.formations.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field><Field label={tr('Montant', 'Amount')}><Input name="amount" type="number" min="1" required /></Field><Field label={tr('Tarif', 'Fee type')}><Select name="pending_scholarship_status" defaultValue="true"><option value="true">{tr('Boursier', 'Scholarship')}</option><option value="false">{tr('Standard', 'Standard')}</option></Select></Field><Field label={tr('Date', 'Date')}><Input name="paid_at" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></Field><Field label={tr('Moyen', 'Method')}><Select name="method"><option value="especes">{tr('Espèces', 'Cash')}</option><option value="mobile_money">Mobile Money</option><option value="banque">{tr('Virement bancaire', 'Bank transfer')}</option><option value="autre">{tr('Autre', 'Other')}</option></Select></Field></div><Field label={tr('Note / raison de l’attente', 'Note / reason for pending status')}><Textarea name="notes" placeholder={tr('Ex. Attend la prochaine vague', 'E.g. Waiting for the next cohort')} /></Field><div className="sheet-actions"><Button type="button" variant="secondary" onClick={onClose}>{tr('Annuler', 'Cancel')}</Button><Button><Check/>{tr('Enregistrer', 'Save')}</Button></div></form></Sheet>
}

export function AssignPendingPaymentSheet({ payment, onClose, data, mutate }) {
  if (!payment) return null
  async function submit(event) {
    event.preventDefault()
    const values = Object.fromEntries(new FormData(event.currentTarget))
    const scholarship = values.scholarship_status === 'true'
    const studentId = crypto.randomUUID()
    const studentNumber = Math.max(0, ...data.students.filter(item => item.intake_id === values.intake_id).map(item => Number(item.intake_student_number || 0))) + 1
    const slots = Array.from({ length: 4 }, (_, index) => ({ id: `${studentId}-${index + 1}`, student_id: studentId, slot: index + 1, dossier_code: `IN-${studentNumber}-${index + 1}`, formation_id: index === 0 ? values.formation_id : null, status: index === 0 ? 'inscrit' : 'disponible', scholarship_status: index === 0 ? scholarship : false, agreed_fee: index === 0 ? feeFor(scholarship) : 180000, monthly_fee: index === 0 ? feeFor(scholarship) / 3 : 60000, learning_mode: index === 0 ? values.learning_mode : 'presentiel', enrolled_at: index === 0 ? new Date().toISOString().slice(0, 10) : null }))
    const assigned = { enrollment_id: slots[0].id, payment_context: 'assigned', pending_first_name: null, pending_last_name: null, pending_phone: null, pending_formation_id: null }
    const saved = await mutate({
      preview: current => ({ ...current, students: [{ id: studentId, intake_id: values.intake_id, intake_student_number: studentNumber, last_name: payment.pending_last_name, first_name: payment.pending_first_name, phone: payment.pending_phone || null, status: 'actif', created_at: new Date().toISOString() }, ...current.students], enrollments: [...current.enrollments, ...slots], payments: current.payments.map(item => item.id === payment.id ? { ...item, ...assigned } : item) }),
      live: async () => {
        const created = await supabase.from('students').insert({ last_name: payment.pending_last_name, first_name: payment.pending_first_name, phone: payment.pending_phone || null, intake_id: values.intake_id, status: 'actif', created_by: data.staff.user_id }).select().single()
        if (created.error || !created.data) return created
        const available = await supabase.from('enrollments').select('*').eq('student_id', created.data.id).order('slot')
        if (available.error) return available
        const slot = available.data?.find(item => item.status === 'disponible')
        if (!slot) return { error: new Error(tr('Aucun dossier disponible n’a été créé.', 'No available record was created.')) }
        const enrollment = await supabase.from('enrollments').update({ formation_id: values.formation_id, agreed_fee: feeFor(scholarship), monthly_fee: feeFor(scholarship) / 3, scholarship_status: scholarship, learning_mode: values.learning_mode, status: 'inscrit', enrolled_at: new Date().toISOString().slice(0, 10) }).eq('id', slot.id).select().single()
        if (enrollment.error || !enrollment.data) return enrollment
        return supabase.from('payments').update({ enrollment_id: enrollment.data.id, payment_context: 'assigned', pending_first_name: null, pending_last_name: null, pending_phone: null, pending_formation_id: null }).eq('id', payment.id).select('id').single()
      },
      success: tr('Paiement affecté à la nouvelle fiche apprenant.', 'Payment assigned to the new student record.')
    })
    if (saved) onClose()
  }
  return <Sheet open={Boolean(payment)} onOpenChange={value => !value && onClose()} title={tr('Affecter le paiement', 'Assign payment')} description={`${payment.pending_last_name || ''} ${payment.pending_first_name || ''} · ${money(payment.amount)}`} className="management-sheet"><form className="sheet-form management-form" onSubmit={submit}><div className="management-intro"><ArrowRight/><div><strong>{tr('Créer la fiche et rattacher le même versement', 'Create the record and attach the same payment')}</strong><p>{tr('Le montant ne sera pas saisi une deuxième fois.', 'The amount will not be entered a second time.')}</p></div></div><div className="form-grid"><Field label={tr('Vague', 'Cohort')}><Select name="intake_id" required>{data.intakes.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field><Field label={tr('Formation', 'Course')}><Select name="formation_id" defaultValue={payment.pending_formation_id || ''} required><option value="">{tr('Choisir', 'Select')}</option>{data.formations.filter(item => item.active !== false).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field><Field label={tr('Mode de suivi', 'Learning mode')}><Select name="learning_mode"><option value="presentiel">{tr('Présentiel', 'On-site')}</option><option value="en_ligne">{tr('En ligne', 'Online')}</option></Select></Field><Field label={tr('Tarif', 'Fee type')}><Select name="scholarship_status" defaultValue={String(Boolean(payment.pending_scholarship_status))}><option value="true">{tr('Boursier', 'Scholarship')}</option><option value="false">{tr('Standard', 'Standard')}</option></Select></Field></div><div className="sheet-actions"><Button type="button" variant="secondary" onClick={onClose}>{tr('Annuler', 'Cancel')}</Button><Button><ArrowRight/>{tr('Créer et affecter', 'Create and assign')}</Button></div></form></Sheet>
}
