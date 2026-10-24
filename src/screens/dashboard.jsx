import { LayoutGroup, motion } from 'motion/react'
import { Activity, ArrowRight, CalendarClock, CircleDollarSign, FolderCheck, NotebookPen, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArcGauge, SparkBars } from '@/components/visuals'
import { cn } from '@/lib/utils'
import { compactMoney, dateLabel, money, paymentMethodLabel, studentName } from '@/lib/business'
import { tr } from '@/lib/preferences'

const palette = ['blue','teal','violet','amber','coral']

export default function Dashboard({ data, view, intake, onSection }) {
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
    <div className="metric-orbit">{metrics.map((item,index)=><MetricTile key={item.label} item={item} index={index}/>)}</div>
    <div className="dashboard-bottom"><FormationUniverse items={view.formationCounts} unclassified={view.unclassified} onExplore={()=>onSection('students')} /><PaymentPulse view={view} onExplore={()=>onSection('payments')} /></div></LayoutGroup>
}

function MetricTile({ item, index }) { const Icon=item.icon; return <motion.article layout className={cn('metric-tile',`tone-${item.tone}`)} initial={{opacity:0,y:14}} animate={{opacity:1,y:0}} transition={{delay:index*.04}} whileHover={{y:-4}}><div className="metric-icon"><Icon/></div><div><span>{item.label}</span><strong>{item.value}</strong><small>{item.detail}</small></div><SparkBars values={item.bars}/></motion.article> }

function FormationUniverse({ items, unclassified, onExplore }) {
  return <section className="universe-card"><header><div><span className="section-kicker">{tr('Répartition','Distribution')}</span><h3>{tr('L’univers des formations','Course universe')}</h3><p>{tr('Chaque bulle reflète le nombre de dossiers actifs.','Each bubble reflects the number of active records.')}</p></div><Button variant="ghost" size="sm" onClick={onExplore}>{tr('Explorer','Explore')}<ArrowRight/></Button></header><div className="mini-universe"><div className="mini-core"><strong>{items.reduce((sum,item)=>sum+item.count,0)}</strong><span>{tr('actifs','active')}</span></div>{items.slice(0,5).map((item,index)=><motion.div key={item.formation.id} className={cn('mini-planet',`planet-${palette[index]}`)} data-index={index} whileHover={{scale:1.06}}><strong>{item.count}</strong><span>{item.formation.name}</span></motion.div>)}</div><footer><span><i className="bg-amber-400"/>{unclassified} {tr('sans formation active','without active course')}</span><span><i className="bg-emerald-500"/>{tr('Dossiers actifs uniquement','Active records only')}</span></footer></section>
}

function PaymentPulse({ view, onExplore }) {
  const recent=view.payments.filter(payment=>!payment.cancelled_at).slice(0,4)
  return <section className="pulse-card"><header><div><span className="section-kicker">{tr('Activité','Activity')}</span><h3>{tr('Les derniers versements','Latest payments')}</h3></div><Button variant="ghost" size="sm" onClick={onExplore}>{tr('Tout voir','View all')}<ArrowRight/></Button></header><div className="pulse-total"><div><span>{tr('Reste à payer','Balance due')}</span><strong>{money(view.remaining)}</strong></div><div className="pulse-visual"><i/><i/><i/><i/><i/><i/></div></div><div className="pulse-list">{recent.map(payment=>{const enrollment=view.enrollments.find(item=>item.id===payment.enrollment_id);const student=enrollment&&view.studentMap.get(enrollment.student_id);return <div key={payment.id}><span className="payment-dot"/><div><strong>{studentName(student)}</strong><small>{paymentMethodLabel(payment.method)} · {dateLabel(payment.paid_at)}</small></div><b>{money(payment.amount)}</b></div>})}</div></section>
}
