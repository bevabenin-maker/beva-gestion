import { motion } from 'motion/react'
import { ArrowRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export default function FormationsScreen({ data, view }) {
  const max=Math.max(...view.formationCounts.map(item=>item.count),1)
  return <div className="formation-studio"><section className="formation-studio-intro"><span className="section-kicker light">Offre pédagogique</span><h2>Cinq chemins.<br/><span>Une même ambition.</span></h2><p>Les volumes reflètent uniquement les dossiers actifs de la vague sélectionnée.</p><div className="formation-total-orb"><strong>{view.activeEnrollments.length}</strong><span>inscriptions actives</span></div></section><div className="formation-cards-v2">{data.formations.map((formation,index)=>{const count=view.formationCounts.find(item=>item.formation.id===formation.id)?.count||0;return <motion.article layout key={formation.id} className={cn('formation-card-v2',`formation-tone-${index%5}`)} whileHover={{y:-5}}><div className="formation-number">{String(index+1).padStart(2,'0')}</div><div><Badge variant={formation.active?'success':'neutral'} dot>{formation.active?'Active':'Archivée'}</Badge><h3>{formation.name}</h3><p>{formation.duration_months||3} mois de formation · Présentiel et en ligne</p></div><div className="formation-capacity"><div><span>Dossiers actifs</span><strong>{count}</strong></div><div className="formation-arc"><i style={{'--formation-width':`${Math.max(8,count/max*100)}%`}}/></div></div><Button variant="ghost" className="justify-between">Voir les étudiants<ArrowRight/></Button></motion.article>})}</div></div>
}
