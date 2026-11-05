import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { money, studentName } from '@/lib/business'
import { previewResumption, resumptionBalance, validateResumption } from '@/lib/student-resumption'
import { tr } from '@/lib/preferences'
import { Button } from '@/components/ui/button'
import { Field, Input, Select } from '@/components/ui/field'
import { Sheet } from '@/components/ui/sheet'

export function ResumeStudentSheet({ student, data, mutate, onClose, onResumed }) {
  const sources = data.enrollments.filter(item => item.student_id === student.id && item.formation_id && item.status !== 'disponible')
  const [sourceId, setSourceId] = useState(sources[0]?.id || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const source = sources.find(item => item.id === sourceId)
  const balance = source ? resumptionBalance(source, data.payments) : 0
  const targets = data.intakes.filter(item => item.id !== student.intake_id)
  async function submit(event) {
    event.preventDefault()
    if (busy) return
    const values = Object.fromEntries(new FormData(event.currentTarget))
    try { validateResumption(data, student, values) } catch (error) { setError(error.message); return }
    setBusy(true); setError('')
    const saved = await mutate({
      preview: current => previewResumption(current, student, values),
      live: () => supabase.rpc('resume_student_in_intake', { p_source_enrollment_id: values.source_enrollment_id, p_intake_id: values.intake_id, p_resumes_from_month: Number(values.resumes_from_month), p_remaining_fee: Number(values.remaining_fee), p_learning_mode: values.learning_mode }),
      success: tr('Reprise créée dans la nouvelle vague.', 'Resumption created in the new cohort.')
    })
    setBusy(false)
    if (saved) onResumed(values.intake_id)
  }
  return <Sheet open onOpenChange={value => !value && !busy && onClose()} title={tr('Reprendre dans une autre vague', 'Resume in another cohort')} description={studentName(student)} className="management-sheet"><form className="sheet-form management-form" onSubmit={submit}>
    <div className="management-intro"><ArrowRight/><div><strong>{tr('Une reprise liée à l’ancien dossier', 'A resumption linked to the previous record')}</strong><p>{tr('L’ancien dossier, ses paiements, notes et présences restent dans leur vague. Le nouveau dossier sera actif dans la vague choisie.', 'The previous record, payments, notes and attendance stay in their cohort. The new record will be active in the selected cohort.')}</p></div></div>
    <Field label={tr('Formation à reprendre', 'Course to resume')}><Select name="source_enrollment_id" value={sourceId} onChange={event => setSourceId(event.target.value)} required>{sources.map(item => <option key={item.id} value={item.id}>{data.formations.find(formation => formation.id === item.formation_id)?.name} · {item.dossier_code}</option>)}</Select></Field>
    <Field label={tr('Nouvelle vague', 'New cohort')}><Select name="intake_id" defaultValue="" required><option value="" disabled>{tr('Choisir une vague', 'Choose a cohort')}</option>{targets.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field>
    <div className="form-grid"><Field label={tr('Reprendre à partir du mois', 'Resume from month')}><Select key={sourceId} name="resumes_from_month" defaultValue={source?.resumes_from_month || 1}>{[1, 2, 3].map(month => <option key={month} value={month}>{tr('Mois', 'Month')} {month}</option>)}</Select></Field><Field label={tr('Mode de suivi', 'Learning mode')}><Select key={sourceId} name="learning_mode" defaultValue={source?.learning_mode || 'presentiel'}><option value="presentiel">{tr('Présentiel', 'In person')}</option><option value="en_ligne">{tr('En ligne', 'Online')}</option></Select></Field></div>
    <p>{tr('Reste de l’ancien dossier après les versements :', 'Previous record balance after payments:')} <strong>{money(balance)}</strong></p>
    <Field label={tr('Solde à payer dans la nouvelle vague (FCFA)', 'Balance payable in the new cohort (XOF)')}><Input key={sourceId} name="remaining_fee" type="number" min="0" max={balance} step="1" defaultValue={balance} required /></Field>
    <p className="muted">{tr('Vérifiez ce solde et réduisez-le si des mois acquis ne doivent plus être facturés. Changer le mois ne recalcule pas le montant. Les anciens paiements ne sont ni déplacés ni encaissés une seconde fois.', 'Review this balance and reduce it if completed months should no longer be charged. Changing the month does not recalculate the amount. Previous payments are neither moved nor collected a second time.')}</p>
    {error && <p role="alert">{error}</p>}
    {!sources.length && <p role="alert">{tr('Aucun dossier de formation à reprendre.', 'No course record to resume.')}</p>}
    {!targets.length && <p role="alert">{tr('Créez d’abord la prochaine vague.', 'Create the next cohort first.')}</p>}
    <div className="sheet-actions"><Button type="button" variant="secondary" disabled={busy} onClick={onClose}>{tr('Annuler', 'Cancel')}</Button><Button disabled={busy || !source || !targets.length}>{busy ? tr('Enregistrement…', 'Saving…') : tr('Créer la reprise', 'Create resumption')}<ArrowRight/></Button></div>
  </form></Sheet>
}
