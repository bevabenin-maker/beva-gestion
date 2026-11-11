import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { AlertCircle, BookOpenCheck, CalendarDays, Check, CheckCircle2, ChevronLeft, ChevronRight, Clock3, LogOut, RotateCcw, Search, UserCheck, UserX, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { BrandMark } from '@/components/app-chrome'
import { ATTENDANCE_REASONS, addDays, buildAttendanceWeek, mondayOf, teacherAttendanceApi } from '@/lib/attendance'

const DAY_LABELS = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche']
const fullName = enrollment => `${enrollment.students?.last_name || ''} ${enrollment.students?.first_name || ''}`.trim()

export default function TeacherPortal({ token, initialContext, onContext, onLogout, theme, onToggleTheme }) {
  const [context,setContext]=useState(initialContext)
  const [tab,setTab]=useState('roll')
  const [scheduleId,setScheduleId]=useState(null)
  const [presentIds,setPresentIds]=useState(new Set())
  const [lateIds,setLateIds]=useState(new Set())
  const [absentDetails,setAbsentDetails]=useState({})
  const [lateDetails,setLateDetails]=useState({})
  const [makeupIds,setMakeupIds]=useState(new Set())
  const [search,setSearch]=useState('')
  const [confirming,setConfirming]=useState(false)
  const [cancelling,setCancelling]=useState(false)
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  const [weekOffset,setWeekOffset]=useState(0)

  const todayWeekday = new Date(`${context.today}T12:00:00Z`).getUTCDay() || 7
  const todaySchedules = context.schedules.filter(item=>Number(item.weekday)===todayWeekday)
  const selectedSchedule = context.schedules.find(item=>item.id===scheduleId) || todaySchedules[0] || null
  const todaySession = selectedSchedule && context.sessions.find(item=>item.schedule_id===selectedSchedule.id&&item.session_date===context.today)
  const todayRecords = todaySession ? context.records.filter(item=>item.session_id===todaySession.id) : []

  useEffect(()=>{
    if(!scheduleId&&todaySchedules[0])setScheduleId(todaySchedules[0].id)
  },[context.today,context.schedules.length])

  useEffect(()=>{
    const records=todayRecords
    setPresentIds(new Set(records.filter(item=>item.status==='present'||item.status==='late').map(item=>item.enrollment_id)))
    setLateIds(new Set(records.filter(item=>item.status==='late').map(item=>item.enrollment_id)))
    setAbsentDetails(Object.fromEntries(records.filter(item=>item.status==='absent').map(item=>[item.enrollment_id,{notified:item.notice_status==='notified',reasonCode:item.reason_code||''}])))
    setLateDetails(Object.fromEntries(records.filter(item=>item.status==='late').map(item=>[item.enrollment_id,{reasonCode:item.reason_code||''}])))
  },[todaySession?.id,context.records])

  const visibleEnrollments=useMemo(()=>context.enrollments.filter(item=>fullName(item).toLowerCase().includes(search.trim().toLowerCase())),[context.enrollments,search])
  const absents=context.enrollments.filter(item=>!presentIds.has(item.id))
  const allPresent=context.enrollments.length>0&&context.enrollments.every(item=>presentIds.has(item.id))
  const weekStart=addDays(mondayOf(context.today),weekOffset*7)
  const week=buildAttendanceWeek({
    formations:[context.account.formation], students:context.enrollments.map(item=>item.students), enrollments:context.enrollments,
    attendanceSchedules:context.schedules, attendanceSessions:context.sessions, attendanceRecords:context.records, attendanceMakeups:context.makeups,
  },context.intake.id,weekStart,context.today)

  function updateContext(next){setContext(next);onContext(next);setConfirming(false);setCancelling(false);setMessage('')}
  function togglePresent(id){setPresentIds(current=>{const next=new Set(current);if(next.has(id)){next.delete(id);setLateIds(late=>{const copy=new Set(late);copy.delete(id);return copy})}else next.add(id);return next})}
  function toggleLate(id){setLateIds(current=>{const next=new Set(current);next.has(id)?next.delete(id):next.add(id);return next})}
  function toggleMakeup(id){setMakeupIds(current=>{const next=new Set(current);next.has(id)?next.delete(id):next.add(id);return next})}
  function toggleAllPresent(){if(allPresent){setPresentIds(new Set());setLateIds(new Set());return}setPresentIds(new Set(context.enrollments.map(item=>item.id)));setLateIds(new Set())}
  async function saveRoll(){setBusy(true);try{const result=await teacherAttendanceApi.submit(token,{scheduleId:selectedSchedule.id,sessionDate:context.today,presentEnrollmentIds:[...presentIds],lateEnrollmentIds:[...lateIds],absentDetails,lateDetails});updateContext(result.context);setMessage('Appel enregistré avec succès.')}catch(error){setMessage(error.message)}finally{setBusy(false)}}
  async function cancelClass(reason){setBusy(true);try{const result=await teacherAttendanceApi.cancel(token,{scheduleId:selectedSchedule.id,sessionDate:context.today,reason});updateContext(result.context);setMessage('Le cours a été marqué comme non tenu.')}catch(error){setMessage(error.message)}finally{setBusy(false)}}
  async function saveMakeups(){setBusy(true);try{const result=await teacherAttendanceApi.completeMakeups(token,[...makeupIds]);updateContext(result.context);setMakeupIds(new Set());setMessage('Rattrapage enregistré.')}catch(error){setMessage(error.message)}finally{setBusy(false)}}
  async function logout(){try{await teacherAttendanceApi.logout(token)}finally{onLogout()}}

  return <div className="teacher-portal">
    <header className="teacher-topbar"><div className="teacher-brand"><BrandMark/><div><strong>BEVA · Présences</strong><span>{context.account.formation.name}</span></div></div><div className="teacher-account"><div><strong>{context.account.professorName}</strong><span>{context.intake.name}</span></div><button type="button" onClick={onToggleTheme} aria-label="Changer le thème">{theme==='dark'?'☀':'☾'}</button><button type="button" onClick={logout} aria-label="Se déconnecter"><LogOut/></button></div></header>
    <main className="teacher-main"><section className="teacher-welcome"><div><Badge variant="info"><BookOpenCheck/> Espace professeur</Badge><h1>{DAY_LABELS[todayWeekday-1]} · {new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'long'}).format(new Date(`${context.today}T12:00:00`))}</h1><p>Faites l’appel en cochant uniquement les apprenants présents.</p></div><div className="teacher-glance"><span><Users/>{context.enrollments.length}<small>apprenants actifs</small></span><span><RotateCcw/>{context.openAbsences.length}<small>rattrapages à faire</small></span></div></section>
      <nav className="teacher-tabs"><button type="button" className={tab==='roll'?'active':''} onClick={()=>setTab('roll')}><UserCheck/>Appel</button><button type="button" className={tab==='makeups'?'active':''} onClick={()=>setTab('makeups')}><RotateCcw/>Rattrapages {context.openAbsences.length>0&&<b>{context.openAbsences.length}</b>}</button><button type="button" className={tab==='stats'?'active':''} onClick={()=>setTab('stats')}><CalendarDays/>Ma semaine</button></nav>
      {message&&<div className="teacher-message"><CheckCircle2/>{message}</div>}
      <AnimatePresence mode="wait" initial={false}>
        {tab==='roll'&&<motion.section key="roll" className="teacher-panel" initial={{opacity:0,scale:.995}} animate={{opacity:1,scale:1}} exit={{opacity:0}}>
          {!todaySchedules.length?<NoClassToday context={context} week={week}/>:<>
            <header className="roll-header"><div><span>Cours du jour</span><h2>{selectedSchedule.label||context.account.formation.name}</h2><p>{String(selectedSchedule.start_time).slice(0,5)} – {String(selectedSchedule.end_time).slice(0,5)} · {context.enrollments.length} apprenants</p></div>{todaySchedules.length>1&&<select value={selectedSchedule.id} onChange={event=>setScheduleId(event.target.value)}>{todaySchedules.map(item=><option key={item.id} value={item.id}>{item.label} · {String(item.start_time).slice(0,5)}</option>)}</select>}<Badge variant={todaySession?.status==='held'?'success':todaySession?.status==='cancelled'?'warning':'neutral'}>{todaySession?.status==='held'?'Appel enregistré':todaySession?.status==='cancelled'?'Cours non tenu':'À renseigner'}</Badge></header>
            {todaySession?.status==='cancelled'?<div className="cancelled-class"><AlertCircle/><h3>Cours marqué comme non tenu</h3><p>{todaySession.cancel_reason||'Aucune absence ne sera comptabilisée.'}</p><Button variant="secondary" onClick={saveRoll}>Le cours a finalement eu lieu</Button></div>:<>
              <div className="roll-tools"><label><Search/><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Rechercher un apprenant"/></label><Button variant="secondary" onClick={toggleAllPresent} aria-pressed={allPresent}>{allPresent?<UserX/>:<Check/>}{allPresent?'Tout désélectionner':'Tout le monde est présent'}</Button></div>
              <div className="roll-summary"><strong>{presentIds.size}</strong><span>présents cochés</span><i/><strong>{context.enrollments.length-presentIds.size}</strong><span>seront absents</span></div>
              <div className="roll-list">{visibleEnrollments.map(enrollment=>{const selected=presentIds.has(enrollment.id);const late=lateIds.has(enrollment.id);return <article key={enrollment.id} className={selected?'present':''}><button type="button" className="student-check" onClick={()=>togglePresent(enrollment.id)} aria-pressed={selected}><span>{selected?<Check/>:null}</span><div><strong>{fullName(enrollment)}</strong><small>N° {enrollment.students?.intake_student_number||enrollment.students?.student_number||'—'} · {enrollment.learning_mode==='en_ligne'?'En ligne':'Présentiel'}</small></div></button>{selected&&<button type="button" className={late?'late active':'late'} onClick={()=>toggleLate(enrollment.id)}><Clock3/>{late?'En retard':'Retard'}</button>}</article>})}</div>
              <div className="roll-actions"><Button variant="ghost" onClick={()=>setCancelling(true)}>Cours non tenu</Button><Button size="lg" onClick={()=>setConfirming(true)} disabled={!context.enrollments.length}><UserCheck/>Vérifier et enregistrer</Button></div>
            </>}
          </>}
        </motion.section>}
        {tab==='makeups'&&<motion.section key="makeups" className="teacher-panel" initial={{opacity:0,scale:.995}} animate={{opacity:1,scale:1}} exit={{opacity:0}}><header className="roll-header"><div><span>Rattrapages en attente</span><h2>Qui a repris son cours ?</h2><p>Cochez uniquement les personnes ayant réellement effectué leur rattrapage aujourd’hui.</p></div><Badge variant={context.openAbsences.length?'warning':'success'}>{context.openAbsences.length} en attente</Badge></header>{context.openAbsences.length?<><div className="makeup-list">{context.openAbsences.map(item=><button type="button" key={item.id} className={makeupIds.has(item.id)?'selected':''} onClick={()=>toggleMakeup(item.id)}><span>{makeupIds.has(item.id)&&<Check/>}</span><div><strong>{fullName(item.enrollment)}</strong><small>Absence du {new Intl.DateTimeFormat('fr-FR',{dateStyle:'medium'}).format(new Date(`${context.sessions.find(session=>session.id===item.session_id)?.session_date}T12:00:00`))}</small></div></button>)}</div><div className="roll-actions"><span>{makeupIds.size} sélectionné{makeupIds.size>1?'s':''}</span><Button onClick={saveMakeups} disabled={!makeupIds.size||busy}><RotateCcw/>{busy?'Enregistrement…':'Rattrapage effectué aujourd’hui'}</Button></div></>:<EmptyState icon={CheckCircle2} title="Aucun rattrapage en attente" text="Toutes les absences enregistrées sont à jour."/>}</motion.section>}
        {tab==='stats'&&<motion.section key="stats" className="teacher-panel teacher-stats" initial={{opacity:0,scale:.995}} animate={{opacity:1,scale:1}} exit={{opacity:0}}><header className="roll-header"><div><span>Résumé hebdomadaire</span><h2>{weekOffset===0?'Cette semaine':weekOffset===-1?'Semaine précédente':`Semaine du ${week.range.start}`}</h2><p>{new Intl.DateTimeFormat('fr-FR',{dateStyle:'medium'}).format(new Date(`${week.range.start}T12:00:00`))} – {new Intl.DateTimeFormat('fr-FR',{dateStyle:'medium'}).format(new Date(`${week.range.end}T12:00:00`))}</p></div><div className="week-nav"><button type="button" onClick={()=>setWeekOffset(value=>value-1)}><ChevronLeft/></button><button type="button" disabled={weekOffset===0} onClick={()=>setWeekOffset(value=>Math.min(0,value+1))}><ChevronRight/></button></div></header><WeekCards week={week}/>{week.missingSessions.length>0&&<div className="missing-rolls"><AlertCircle/><div><strong>{week.missingSessions.length} appel{week.missingSessions.length>1?'s':''} non renseigné{week.missingSessions.length>1?'s':''}</strong><p>Ces séances ne sont pas comptées comme des absences.</p></div></div>}</motion.section>}
      </AnimatePresence>
    </main>
    {confirming&&<div className="teacher-dialog-backdrop" role="presentation"><motion.div className="teacher-dialog" initial={{opacity:0,scale:.96}} animate={{opacity:1,scale:1}} role="dialog" aria-modal="true"><Badge variant="warning"><UserX/>Vérification</Badge><h2>Confirmer l’appel</h2><p><strong>{presentIds.size} présents.</strong> Les {absents.length} autres seront marqués absents, non prévenus et sans motif.</p>{absents.length>0&&<div className="absent-review">{absents.map(item=>{const detail=absentDetails[item.id]||{};return <article key={item.id}><div><strong>{fullName(item)}</strong><button type="button" className={detail.notified?'active':''} onClick={()=>setAbsentDetails(current=>({...current,[item.id]:{...current[item.id],notified:!detail.notified}}))}>{detail.notified?'A prévenu':'Non prévenu'}</button></div>{<select aria-label={`Motif d’absence de ${fullName(item)}`} value={detail.reasonCode||''} onChange={event=>setAbsentDetails(current=>({...current,[item.id]:{...current[item.id],reasonCode:event.target.value}}))}><option value="">Motif inconnu</option>{ATTENDANCE_REASONS.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>}</article>})}</div>}{lateIds.size>0&&<div className="absent-review">{context.enrollments.filter(item=>lateIds.has(item.id)).map(item=><article key={item.id}><strong>{fullName(item)} · Retard</strong><select aria-label={`Motif de retard de ${fullName(item)}`} value={lateDetails[item.id]?.reasonCode||''} onChange={event=>setLateDetails(current=>({...current,[item.id]:{...current[item.id],reasonCode:event.target.value}}))}><option value="">Motif non renseigné</option>{ATTENDANCE_REASONS.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></article>)}</div>}<div className="dialog-actions"><Button variant="secondary" onClick={()=>setConfirming(false)}>Retour</Button><Button onClick={saveRoll} disabled={busy}><Check/>{busy?'Enregistrement…':'Confirmer l’appel'}</Button></div></motion.div></div>}
    {cancelling&&<div className="teacher-dialog-backdrop" role="presentation"><motion.div className="teacher-dialog" initial={{opacity:0,scale:.96}} animate={{opacity:1,scale:1}} role="dialog" aria-modal="true"><Badge variant="neutral"><AlertCircle/>Aucune absence</Badge><h2>Le cours n’a pas eu lieu ?</h2><p>Aucun apprenant ne sera marqué absent et la séance sera exclue du taux de présence.</p><div className="cancel-reasons">{['Décision de BEVA','Professeur indisponible','Jour férié','Incident technique','Autre'].map(reason=><Button key={reason} variant="secondary" onClick={()=>cancelClass(reason)} disabled={busy}>{reason}</Button>)}</div><Button variant="ghost" onClick={()=>setCancelling(false)}>Retour à l’appel</Button></motion.div></div>}
  </div>
}

function WeekCards({week}){return <div className="week-stat-grid"><article><UserCheck/><span>Présences</span><strong>{week.present+week.late}</strong><small>{week.attendanceRate}% des pointages</small></article><article><UserX/><span>Absences</span><strong>{week.absent}</strong><small>{week.notified} signalée{week.notified>1?'s':''}</small></article><article><Clock3/><span>Retards</span><strong>{week.late}</strong><small>comptés présents</small></article><article><RotateCcw/><span>Rattrapages</span><strong>{week.recovered}</strong><small>{week.completionRate}% suivi au final</small></article></div>}
function NoClassToday({context,week}){return <div className="no-class-today"><CheckCircle2/><h2>Aucun cours obligatoire aujourd’hui</h2><p>Vous pouvez consulter les rattrapages ou le résumé de la semaine.</p><WeekCards week={week}/><small>{context.openAbsences.length} rattrapage{context.openAbsences.length>1?'s':''} encore en attente</small></div>}
function EmptyState({icon:Icon,title,text}){return <div className="teacher-empty"><Icon/><h3>{title}</h3><p>{text}</p></div>}
