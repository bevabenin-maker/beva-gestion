import { LayoutGroup, motion } from 'motion/react'
import { Activity, ArrowRight, CalendarClock, CircleDollarSign, FolderCheck, NotebookPen, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArcGauge, SparkBars } from '@/components/visuals'
import { cn } from '@/lib/utils'
import { compactMoney, dateLabel, money, paymentMethodLabel, studentName } from '@/lib/business'

const palette = ['blue','teal','violet','amber','coral']

export default function Dashboard({ data, view, intake, onSection }) {
  const rate=view.expected?Math.min(100,Math.round(view.collected/view.expected*100)):0
  const activeStudents=view.students.filter(student=>student.status==='actif').length
  const pendingNotes=view.notes.filter(note=>note.follow_up_on&&new Date(note.follow_up_on)>=new Date(new Date().toDateString())).length
  const metrics=[
    {label:'Étudiants',value:view.students.length,detail:`${activeStudents} actifs`,icon:Users,tone:'blue',bars:[2,4,3,6,4,8,7]},
    {label:'Dossiers actifs',value:view.activeEnrollments.length,detail:`${view.unclassified} à classer`,icon:FolderCheck,tone:'teal',bars:[3,3,4,5,6,6,8]},
    {label:'Total encaissé',value:compactMoney(view.collected),detail:'FCFA',icon:CircleDollarSign,tone:'violet',bars:[2,5,3,7,4,6,9]},
    {label:'Relances',value:pendingNotes,detail:'notes planifiées',icon:CalendarClock,tone:'amber',bars:[6,4,7,5,3,6,4]}
  ]
  return <LayoutGroup><div className="dashboard-hero"><div className="hero-copy"><Badge className="hero-badge"><Activity/> Données synchronisées</Badge><p>Bonjour {data.staff?.full_name?.split(' ')[0]},</p><h2>Voici le rythme de <span>{intake?.name || 'la vague'}</span>.</h2><div className="hero-actions"><Button size="sm" className="bg-white text-slate-900 hover:bg-white/90" onClick={()=>onSection('payments')}>Voir les paiements<ArrowRight/></Button><small>Mis à jour à l’ouverture de la session</small></div></div><div className="hero-gauge"><ArcGauge value={rate} label="encaissé" detail={`${compactMoney(view.collected)} sur ${compactMoney(view.expected)}`} /></div><div className="hero-glow one"/><div className="hero-glow two"/></div>
    <div className="metric-orbit">{metrics.map((item,index)=><MetricTile key={item.label} item={item} index={index}/>)}</div>
    <div className="dashboard-bottom"><FormationUniverse items={view.formationCounts} unclassified={view.unclassified} onExplore={()=>onSection('students')} /><PaymentPulse view={view} onExplore={()=>onSection('payments')} /></div></LayoutGroup>
}

function MetricTile({ item, index }) { const Icon=item.icon; return <motion.article layout className={cn('metric-tile',`tone-${item.tone}`)} initial={{opacity:0,y:14}} animate={{opacity:1,y:0}} transition={{delay:index*.04}} whileHover={{y:-4}}><div className="metric-icon"><Icon/></div><div><span>{item.label}</span><strong>{item.value}</strong><small>{item.detail}</small></div><SparkBars values={item.bars}/></motion.article> }

function FormationUniverse({ items, unclassified, onExplore }) {
  return <section className="universe-card"><header><div><span className="section-kicker">Répartition</span><h3>L’univers des formations</h3><p>Chaque bulle reflète le nombre de dossiers actifs.</p></div><Button variant="ghost" size="sm" onClick={onExplore}>Explorer<ArrowRight/></Button></header><div className="mini-universe"><div className="mini-core"><strong>{items.reduce((sum,item)=>sum+item.count,0)}</strong><span>actifs</span></div>{items.slice(0,5).map((item,index)=><motion.div key={item.formation.id} className={cn('mini-planet',`planet-${palette[index]}`)} data-index={index} whileHover={{scale:1.06}}><strong>{item.count}</strong><span>{item.formation.name}</span></motion.div>)}</div><footer><span><i className="bg-amber-400"/>{unclassified} sans formation active</span><span><i className="bg-emerald-500"/>Dossiers actifs uniquement</span></footer></section>
}

function PaymentPulse({ view, onExplore }) {
  const recent=view.payments.filter(payment=>!payment.cancelled_at).slice(0,4)
  return <section className="pulse-card"><header><div><span className="section-kicker">Activité</span><h3>Les derniers versements</h3></div><Button variant="ghost" size="sm" onClick={onExplore}>Tout voir<ArrowRight/></Button></header><div className="pulse-total"><div><span>Reste à payer</span><strong>{money(view.remaining)}</strong></div><div className="pulse-visual"><i/><i/><i/><i/><i/><i/></div></div><div className="pulse-list">{recent.map(payment=>{const enrollment=view.enrollments.find(item=>item.id===payment.enrollment_id);const student=enrollment&&view.studentMap.get(enrollment.student_id);return <div key={payment.id}><span className="payment-dot"/><div><strong>{studentName(student)}</strong><small>{paymentMethodLabel(payment.method)} · {dateLabel(payment.paid_at)}</small></div><b>{money(payment.amount)}</b></div>})}</div></section>
}
