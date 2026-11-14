import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { AlertCircle, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock3, GraduationCap, RotateCcw, ShieldAlert, UserCheck, UserX, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ATTENDANCE_REASONS, addDays, buildAttendanceWeek, isoDate, mondayOf } from '@/lib/attendance'
import { tr } from '@/lib/preferences'

const dateText = value => new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'short'}).format(new Date(`${value}T12:00:00`))
const studentName = student => `${student?.last_name||''} ${student?.first_name||''}`.trim()

export default function AttendanceScreen({data,intakeId,onStudent}) {
  const [weekOffset,setWeekOffset]=useState(0)
  const [formationId,setFormationId]=useState('all')
  const today=isoDate(new Date())
  const weekStart=addDays(mondayOf(today),weekOffset*7)
  const scopedData=useMemo(()=>formationId==='all'?data:{
    ...data,
    formations:data.formations.filter(item=>item.id===formationId),
    attendanceSchedules:data.attendanceSchedules.filter(item=>item.formation_id===formationId),
    attendanceSessions:data.attendanceSessions.filter(item=>item.formation_id===formationId),
  },[data,formationId])
  const week=useMemo(()=>buildAttendanceWeek(scopedData,intakeId,weekStart,today),[scopedData,intakeId,weekStart,today])
  const currentLabel=weekOffset===0?tr('Cette semaine','This week'):weekOffset===-1?tr('Semaine précédente','Previous week'):`${tr('Semaine du','Week of')} ${dateText(week.range.start)}`
  const formationName=id=>data.formations.find(item=>item.id===id)?.name||tr('Formation','Course')

  return <div className="attendance-screen"><section className="attendance-hero"><div><Badge variant="info"><UserCheck/>{tr('Suivi pédagogique','Learning follow-up')}</Badge><h2>{tr('Présences et','Attendance and')}<br/><span>{tr('assiduité.','engagement.')}</span></h2><p>{tr('Une vue fiable des cours tenus, absences, retards et rattrapages.','A reliable view of classes held, absences, lateness and make-up sessions.')}</p></div><div className="attendance-week-control"><button type="button" onClick={()=>setWeekOffset(value=>value-1)} aria-label="Semaine précédente"><ChevronLeft/></button><div><small>{currentLabel}</small><strong>{dateText(week.range.start)} – {dateText(week.range.end)}</strong></div><button type="button" disabled={weekOffset===0} onClick={()=>setWeekOffset(value=>Math.min(0,value+1))} aria-label="Semaine suivante"><ChevronRight/></button></div></section>
    <section className="attendance-filters"><div className="formation-pills"><button type="button" className={formationId==='all'?'active':''} onClick={()=>setFormationId('all')}>{tr('Toutes les formations','All courses')}</button>{data.formations.filter(item=>item.active).map(item=><button type="button" key={item.id} aria-pressed={formationId===item.id} className={formationId===item.id?'active':''} onClick={()=>setFormationId(item.id)}>{item.name}</button>)}</div><Badge variant={week.missingSessions.length?'warning':'success'}>{week.missingSessions.length?<><AlertCircle/>{week.missingSessions.length} {tr('appels manquants','missing rolls')}</>:<><CheckCircle2/>{tr('Appels à jour','Rolls up to date')}</>}</Badge></section>
    <section className="attendance-kpis"><article className="primary"><span><UserCheck/></span><div><small>{tr('Taux de présence','Attendance rate')}</small><strong>{week.attendanceRate}%</strong><p>{week.present+week.late} {tr('présences sur','attendances out of')} {week.records.length} {tr('pointages','marks')}</p></div><i style={{'--value':`${week.attendanceRate}%`}}/></article><article><span><UserX/></span><small>{tr('Absences','Absences')}</small><strong>{week.absent}</strong><p>{week.notified} {tr('signalées à l’avance','reported in advance')}</p></article><article><span><Clock3/></span><small>{tr('Retards','Late arrivals')}</small><strong>{week.late}</strong><p>{tr('Comptés comme présents','Counted as present')}</p></article><article><span><RotateCcw/></span><small>{tr('Rattrapages','Make-up sessions')}</small><strong>{week.recovered}</strong><p>{week.completionRate}% {tr('de suivi final','final completion')}</p></article></section>
    <div className="attendance-layout"><section className="attendance-card formation-attendance"><header><div><span className="section-kicker">{tr('Lecture par formation','By course')}</span><h3>{tr('Situation de la semaine','Weekly position')}</h3></div><Badge variant="neutral">{week.held} {tr('cours tenus','classes held')}</Badge></header>{week.byFormation.length?<div className="attendance-formation-list">{week.byFormation.map((item,index)=>{const rate=item.expected?Math.round(item.present/item.expected*100):0;return <motion.button type="button" key={item.formation.id} aria-pressed={formationId===item.formation.id} onClick={()=>setFormationId(item.formation.id)} initial={{opacity:0,scale:.98}} animate={{opacity:1,scale:1}} transition={{delay:index*.03}}><span className="formation-attendance-icon"><GraduationCap/></span><div><strong>{item.formation.name}</strong><small>{item.sessions} {tr('cours ·','classes ·')} {item.cancelled} {tr('non tenu','not held')}</small><div className="formation-attendance-bar"><i style={{width:`${rate}%`}}/></div></div><div><strong>{rate}%</strong><small>{item.absent} {tr('absences','absences')}</small></div></motion.button>})}</div>:<Empty title={tr('Aucun appel pour cette semaine','No roll call for this week')} text={tr('Les statistiques apparaîtront après le premier cours renseigné.','Statistics will appear after the first recorded class.')}/>}</section>
      <section className="attendance-card risk-attendance"><header><div><span className="section-kicker">{tr('Incidents de la semaine','Weekly incidents')}</span><h3>{tr('Apprenants à surveiller','Students to monitor')}</h3></div><Badge variant={week.risks.length?'warning':'success'}>{week.risks.length}</Badge></header>{week.risks.length?<div className="risk-list" role="region" aria-label={tr('Apprenants à surveiller','Students to monitor')} tabIndex={0}>{week.risks.map(item=><button type="button" key={item.student.id} onClick={()=>onStudent?.(item.student)}><span className="risk-count">{item.count}</span><div><strong>{studentName(item.student)}</strong>{item.incidents.map(incident => <small key={incident.id} style={{ whiteSpace: 'normal' }}>
          {incident.status === 'late' ? tr('Retard','Late') : tr('Absence','Absent')}
          {' · '}{formationName(incident.formationId)}
          {' · '}{ATTENDANCE_REASONS.find(([code]) => code === incident.reason)?.[1] || tr('Motif non renseigné','Reason not recorded')}
          {incident.status === 'absent' && (incident.notified ? tr(' · A prévenu',' · Notified') : tr(' · Sans avertissement',' · No notice'))}
          {incident.note && ` · ${incident.note}`}
        </small>)}</div><ShieldAlert/></button>)}</div>:<Empty title={tr('Aucune alerte cette semaine','No alerts this week')} text={tr('Aucun retard ni absence non rattrapée dans les appels enregistrés.','No late arrivals or unresolved absences in recorded rolls.')}/>}</section>
    </div>
    <section className="attendance-card missing-attendance"><header><div><span className="section-kicker">{tr('Qualité du suivi','Tracking quality')}</span><h3>{tr('Séances non renseignées','Unrecorded classes')}</h3></div><Badge variant={week.missingSessions.length?'warning':'success'}>{week.missingSessions.length}</Badge></header>{week.missingSessions.length?<div className="missing-session-list">{week.missingSessions.map(item=><article key={`${item.schedule.id}-${item.date}`}><CalendarDays/><div><strong>{formationName(item.schedule.formation_id)}</strong><small>{dateText(item.date)} · {String(item.schedule.start_time).slice(0,5)} – {String(item.schedule.end_time).slice(0,5)}</small></div><Badge variant="warning">{tr('Non renseigné','Unrecorded')}</Badge></article>)}</div>:<div className="all-recorded"><CheckCircle2/><div><strong>{tr('Tous les appels attendus ont été renseignés','Every expected roll call is recorded')}</strong><p>{tr('Les cours non tenus sont exclus du calcul et ne créent aucune absence.','Classes not held are excluded and create no absences.')}</p></div></div>}</section>
  </div>
}

function Empty({title,text}){return <div className="attendance-empty"><Users/><strong>{title}</strong><p>{text}</p></div>}
