import { motion } from 'motion/react'
import { ArrowRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { dateLabel } from '@/lib/business'

export default function IntakesScreen({ data, intakeId, setIntakeId }) {
  return <div className="intake-space"><section className="intake-intro"><div><span className="section-kicker">Chronologie</span><h2>Les vagues BEVA,<br/><span>sans mélanger les histoires.</span></h2><p>Chaque cohorte conserve ses élèves, ses dossiers et sa situation financière.</p></div><div className="intake-year">2026</div></section><div className="intake-timeline">{data.intakes.map(intake=><motion.button layout type="button" key={intake.id} className={cn('intake-pod',intake.id===intakeId&&'active')} onClick={()=>setIntakeId(intake.id)} whileHover={{scale:1.015}}><span className="timeline-node">{intake.id===intakeId&&<motion.i layoutId="intake-node"/>}</span><div><Badge variant={intake.active?'success':'neutral'}>{intake.active?'En cours':'Terminée'}</Badge><h3>{intake.name}</h3><p>{dateLabel(intake.start_date)} → {dateLabel(intake.end_date)}</p></div><div className="intake-arrow"><ArrowRight/></div></motion.button>)}</div></div>
}
