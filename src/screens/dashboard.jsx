import { LayoutGroup, motion } from 'motion/react'
import { Activity, ArrowRight, CalendarClock, CircleDollarSign, Clock3, FolderCheck, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArcGauge, SparkBars } from '@/components/visuals'
import { cn } from '@/lib/utils'
import { compactMoney, dateLabel, initials, money, paymentMethodLabel, studentName } from '@/lib/business'
import { localeCode, tr } from '@/lib/preferences'

const palette = ['blue','teal','violet','amber','coral']

export default function Dashboard(props) {
  return props.uiRefresh ? <RefreshedDashboard {...props} /> : <ClassicDashboard {...props} />
}

function RefreshedDashboard({ data, view, intake, onSection, onStudent }) {
  const activeStudents=view.students.filter(student=>student.status==='actif').length
  const outstanding=view.financial.filter(item=>item.accounted&&item.remaining>0).sort((a,b)=>b.remaining-a.remaining)
  const followUps=view.notes.filter(note=>note.follow_up_on&&new Date(`${note.follow_up_on}T23:59:59`)>=new Date()).sort((a,b)=>String(a.follow_up_on).localeCompare(String(b.follow_up_on)))
  const metrics=[
    {label:tr('Étudiants actifs','Active students'),value:activeStudents,detail:`${view.activeEnrollments.length} ${tr('dossiers actifs','active records')}`,icon:Users,tone:'blue'},
    {label:tr('Total encaissé','Total collected'),value:money(view.collected),detail:tr('Versements non annulés','Non-cancelled payments'),icon:CircleDollarSign,tone:'violet'},
    {label:tr('Reste à payer','Balance due'),value:money(view.remaining),detail:`${outstanding.length} ${tr('dossiers à suivre','records to follow up')}`,icon:Clock3,tone:'amber'}
  ]

  return <LayoutGroup><div className="refresh-dashboard">
    <header className="refresh-intro"><div><Badge variant="success"><Activity/> {tr('Données synchronisées','Data synchronised')}</Badge><h2>{tr('Votre activité, en un regard.','Your activity, at a glance.')}</h2><p>{tr('Les indicateurs essentiels de','Key indicators for')} <strong>{intake?.name||tr('la vague en cours','the current cohort')}</strong>, {tr('sans bruit inutile.','without unnecessary noise.')}</p></div><Button onClick={()=>onSection('students')}>{tr('Voir les étudiants','View students')}<ArrowRight/></Button></header>

    <section className="refresh-metrics" aria-label={tr('Indicateurs principaux','Key indicators')}>{metrics.map((item,index)=><RefreshMetric key={item.label} item={item} index={index}/>)}</section>

    <section className="refresh-main-grid">
      <FinancialSnapshot view={view}/>
      <FormationList items={view.formationCounts} total={view.activeEnrollments.length} unclassified={view.unclassified} onExplore={()=>onSection('students')}/>
    </section>

    <section className="refresh-lower-grid">
      <OutstandingList items={outstanding.slice(0,3)} onStudent={onStudent} onExplore={()=>onSection('payments')}/>
      <FollowUpList items={followUps.slice(0,3)} studentMap={view.studentMap} onStudent={onStudent} onExplore={()=>onSection('students')}/>
    </section>
  </div></LayoutGroup>
}

function RefreshMetric({ item, index }) {
  const Icon=item.icon
  return <motion.article layout className={cn('refresh-metric',`refresh-tone-${item.tone}`)} initial={{opacity:0,scale:.985}} animate={{opacity:1,scale:1}} transition={{delay:index*.035,duration:.2}} whileHover={{scale:1.008}}><div className="refresh-metric-head"><span>{item.label}</span><i><Icon/></i></div><strong>{item.value}</strong><small>{item.detail}</small></motion.article>
}

function FinancialSnapshot({ view }) {
  const active=view.financial.filter(item=>item.accounted)
  const expected=active.reduce((sum,item)=>sum+item.due,0)
  const paid=active.reduce((sum,item)=>sum+Math.min(item.paid,item.due),0)
  const remaining=active.reduce((sum,item)=>sum+item.remaining,0)
  const rate=expected?Math.min(100,Math.round(paid/expected*100)):0
  return <section className="refresh-panel refresh-finance"><header><div><span className="refresh-kicker">{tr('Situation financière','Financial position')}</span><h3>{tr('Encaissement des dossiers actifs','Active records collection')}</h3><p>{tr('Une lecture exacte des montants attendus, versés et restant à payer.','An exact view of expected, paid and outstanding amounts.')}</p></div><Badge variant={rate>=75?'success':rate>=40?'warning':'info'}>{rate}% {tr('encaissé','collected')}</Badge></header><div className="refresh-finance-body"><div className="refresh-finance-score" style={{'--finance-rate':`${rate}%`}}><div><strong>{rate}%</strong><span>{tr('taux réel','actual rate')}</span></div></div><div className="refresh-finance-values"><article><span>{tr('Montant attendu','Expected amount')}</span><strong>{money(expected)}</strong></article><article><span>{tr('Déjà versé','Already paid')}</span><strong>{money(paid)}</strong></article><article className="remaining"><span>{tr('Reste à payer','Balance due')}</span><strong>{money(remaining)}</strong></article><div className="refresh-finance-track" role="progressbar" aria-label={tr('Taux encaissé','Collection rate')} aria-valuenow={rate} aria-valuemin="0" aria-valuemax="100"><motion.i initial={{width:0}} animate={{width:`${rate}%`}} transition={{duration:.6,ease:[.22,1,.36,1]}}/><span>{rate}%</span></div></div></div></section>
}

function FormationList({ items, total, unclassified, onExplore }) {
  const max=Math.max(...items.map(item=>item.count),1)
  return <section className="refresh-panel refresh-formations"><header><div><span className="refresh-kicker">{tr('Répartition','Distribution')}</span><h3>{tr('Par formation','By course')}</h3><p>{tr('Dossiers actifs uniquement','Active records only')}</p></div><strong>{total}</strong></header><div className="refresh-formation-list">{items.slice(0,5).map((item,index)=><button key={item.formation.id} type="button" className={`refresh-formation formation-tone-${index%5}`} onClick={onExplore}><span><i/><b>{item.formation.name}</b></span><em>{item.count} {tr('élèves','students')}</em><small><i style={{width:`${Math.max(8,item.count/max*100)}%`}}/></small></button>)}</div><footer><span>{unclassified} {tr('sans formation active','without an active course')}</span><button type="button" onClick={onExplore}>{tr('Explorer','Explore')}<ArrowRight/></button></footer></section>
}

function OutstandingList({ items, onStudent, onExplore }) {
  return <section className="refresh-panel refresh-list"><header><div><span className="refresh-kicker">{tr('Priorité','Priority')}</span><h3>{tr('Dossiers à suivre','Records to follow up')}</h3><p>{tr('Classés par solde restant.','Sorted by outstanding balance.')}</p></div><button type="button" onClick={onExplore}>{tr('Voir tout','View all')}<ArrowRight/></button></header><div>{items.map((item,index)=><motion.button type="button" key={item.enrollment.id} onClick={()=>onStudent(item.student)} initial={{opacity:0}} animate={{opacity:1}} transition={{delay:index*.03,duration:.18}}><span className={`refresh-avatar avatar-${index%5}`}>{initials(item.student)}</span><span><strong>{studentName(item.student)}</strong><small>{item.formation?.name||tr('Formation','Course')}</small></span><em><small>RAF</small><strong>{money(item.remaining)}</strong></em><ArrowRight/></motion.button>)}{!items.length&&<p className="refresh-empty">{tr('Aucun solde à suivre.','No outstanding balance.')}</p>}</div></section>
}

function FollowUpList({ items, studentMap, onStudent, onExplore }) {
  return <section className="refresh-panel refresh-list refresh-followups"><header><div><span className="refresh-kicker">{tr('Agenda','Schedule')}</span><h3>{tr('Relances prévues','Scheduled follow-ups')}</h3><p>{tr('Notes de suivi à traiter.','Follow-up notes to handle.')}</p></div><button type="button" onClick={onExplore}>{tr('Voir tout','View all')}<ArrowRight/></button></header><div>{items.map((note,index)=>{const student=studentMap.get(note.student_id);const date=new Date(`${note.follow_up_on}T12:00:00`);return <motion.button type="button" key={note.id} onClick={()=>onStudent(student)} initial={{opacity:0}} animate={{opacity:1}} transition={{delay:index*.03,duration:.18}}><span className="refresh-date"><b>{date.toLocaleDateString(localeCode(),{day:'2-digit'})}</b>{date.toLocaleDateString(localeCode(),{month:'short'}).replace('.','')}</span><span><strong>{studentName(student)}</strong><small>{note.content}</small></span><i className={index===0?'urgent':''}/></motion.button>})}{!items.length&&<p className="refresh-empty">{tr('Aucune relance planifiée.','No scheduled follow-up.')}</p>}</div></section>
}

function ClassicDashboard({ data, view, intake, onSection }) {
  const rate=Math.round(view.collectionRate)
  const activeStudents=view.students.filter(student=>student.status==='actif').length
  const pendingNotes=view.notes.filter(note=>note.follow_up_on&&new Date(note.follow_up_on)>=new Date(new Date().toDateString())).length
  const metrics=[
    {label:tr('Étudiants','Students'),value:view.students.length,detail:`${activeStudents} ${tr('actifs','active')}`,icon:Users,tone:'blue',bars:[2,4,3,6,4,8,7]},
    {label:tr('Dossiers actifs','Active records'),value:view.activeEnrollments.length,detail:`${view.unclassified} ${tr('à classer','to classify')}`,icon:FolderCheck,tone:'teal',bars:[3,3,4,5,6,6,8]},
    {label:tr('Total encaissé','Total collected'),value:compactMoney(view.collected),detail:tr('tous versements','all payments'),icon:CircleDollarSign,tone:'violet',bars:[2,5,3,7,4,6,9]},
    {label:tr('Relances','Follow-ups'),value:pendingNotes,detail:tr('notes planifiées','scheduled notes'),icon:CalendarClock,tone:'amber',bars:[6,4,7,5,3,6,4]}
  ]
  return <LayoutGroup><div className="dashboard-hero"><div className="hero-copy"><Badge className="hero-badge"><Activity/> {tr('Données synchronisées','Data synchronised')}</Badge><p>{tr('Bonjour','Hello')} {data.staff?.full_name?.split(' ')[0]},</p><h2>{tr('Voici le rythme de','Here is the pace of')} <span>{intake?.name || tr('la vague','the cohort')}</span>.</h2><div className="hero-actions"><Button size="sm" className="bg-white text-slate-900 hover:bg-white/90" onClick={()=>onSection('payments')}>{tr('Voir les paiements','View payments')}<ArrowRight/></Button><small>{tr('Mis à jour à l’ouverture de la session','Updated when the session opened')}</small></div></div><div className="hero-gauge"><ArcGauge value={rate} label={tr('encaissé','collected')} detail={`${compactMoney(view.collected)} ${tr('sur','of')} ${compactMoney(view.collectionExpected)}`} /></div><div className="hero-glow one"/><div className="hero-glow two"/></div>
    <div className="metric-orbit">{metrics.map((item,index)=><ClassicMetricTile key={item.label} item={item} index={index}/>)}</div>
    <div className="dashboard-bottom"><ClassicFormationUniverse items={view.formationCounts} unclassified={view.unclassified} onExplore={()=>onSection('students')} /><ClassicPaymentPulse view={view} onExplore={()=>onSection('payments')} /></div></LayoutGroup>
}

function ClassicMetricTile({ item, index }) { const Icon=item.icon; return <motion.article layout className={cn('metric-tile',`tone-${item.tone}`)} initial={{opacity:0,y:14}} animate={{opacity:1,y:0}} transition={{delay:index*.04}} whileHover={{y:-4}}><div className="metric-icon"><Icon/></div><div><span>{item.label}</span><strong>{item.value}</strong><small>{item.detail}</small></div><SparkBars values={item.bars}/></motion.article> }

function ClassicFormationUniverse({ items, unclassified, onExplore }) {
  return <section className="universe-card"><header><div><span className="section-kicker">{tr('Répartition','Distribution')}</span><h3>{tr('L’univers des formations','Course universe')}</h3><p>{tr('Chaque bulle reflète le nombre de dossiers actifs.','Each bubble reflects the number of active records.')}</p></div><Button variant="ghost" size="sm" onClick={onExplore}>{tr('Explorer','Explore')}<ArrowRight/></Button></header><div className="mini-universe"><div className="mini-core"><strong>{items.reduce((sum,item)=>sum+item.count,0)}</strong><span>{tr('actifs','active')}</span></div>{items.slice(0,5).map((item,index)=><motion.div key={item.formation.id} className={cn('mini-planet',`planet-${palette[index]}`)} data-index={index} whileHover={{scale:1.06}}><strong>{item.count}</strong><span>{item.formation.name}</span></motion.div>)}</div><footer><span><i className="bg-amber-400"/>{unclassified} {tr('sans formation active','without active course')}</span><span><i className="bg-emerald-500"/>{tr('Dossiers actifs uniquement','Active records only')}</span></footer></section>
}

function ClassicPaymentPulse({ view, onExplore }) {
  const recent=view.payments.filter(payment=>!payment.cancelled_at).slice(0,4)
  return <section className="pulse-card"><header><div><span className="section-kicker">{tr('Activité','Activity')}</span><h3>{tr('Les derniers versements','Latest payments')}</h3></div><Button variant="ghost" size="sm" onClick={onExplore}>{tr('Tout voir','View all')}<ArrowRight/></Button></header><div className="pulse-total"><div><span>{tr('Reste à payer','Balance due')}</span><strong>{money(view.remaining)}</strong></div><div className="pulse-visual"><i/><i/><i/><i/><i/><i/></div></div><div className="pulse-list">{recent.map(payment=>{const enrollment=view.enrollments.find(item=>item.id===payment.enrollment_id);const student=enrollment&&view.studentMap.get(enrollment.student_id);return <div key={payment.id}><span className="payment-dot"/><div><strong>{studentName(student)}</strong><small>{paymentMethodLabel(payment.method)} · {dateLabel(payment.paid_at)}</small></div><b>{money(payment.amount)}</b></div>})}</div></section>
}
