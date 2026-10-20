import { motion, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'

export function ArcGauge({ value, label, detail, tone = 'blue', className }) {
  const reduceMotion = useReducedMotion()
  const bounded = Math.max(0, Math.min(100, Number(value || 0)))
  const toneClass = { blue: 'from-blue-500 to-violet-500', teal: 'from-cyan-500 to-emerald-500', amber: 'from-amber-400 to-orange-500' }[tone]
  return <div className={cn('relative grid place-items-center', className)}>
    <svg viewBox="0 0 120 74" className="h-auto w-full overflow-visible" role="img" aria-label={`${label} : ${bounded}%`}>
      <path d="M12 66 A48 48 0 0 1 108 66" pathLength="100" className="fill-none stroke-muted stroke-[12]" strokeLinecap="round" />
      <defs><linearGradient id={`arc-${tone}`} x1="0" x2="1"><stop className={toneClass.includes('blue') ? '[stop-color:#2878ff]' : toneClass.includes('cyan') ? '[stop-color:#08a7c2]' : '[stop-color:#f1b93c]'} /><stop offset="1" className={toneClass.includes('violet') ? '[stop-color:#8664e9]' : toneClass.includes('emerald') ? '[stop-color:#22b07d]' : '[stop-color:#ef7c28]'} /></linearGradient></defs>
      <motion.path d="M12 66 A48 48 0 0 1 108 66" pathLength="100" className="fill-none stroke-[12]" stroke={`url(#arc-${tone})`} strokeLinecap="round" initial={{ pathLength: reduceMotion ? bounded / 100 : 0 }} animate={{ pathLength: bounded / 100 }} transition={{ duration: .8, ease: [.2,.8,.2,1] }} />
    </svg>
    <div className="absolute inset-x-0 bottom-0 text-center"><strong className="block text-2xl font-bold tracking-tight">{bounded}%</strong><span className="block text-[10px] font-semibold uppercase tracking-[.12em] text-muted-foreground">{label}</span>{detail && <small className="mt-1 block text-[10px] text-muted-foreground">{detail}</small>}</div>
  </div>
}

export function FormationOrbit({ items, selected, onSelect }) {
  const palette = ['orbit-blue','orbit-teal','orbit-violet','orbit-amber','orbit-coral']
  return <div className="formation-orbit" aria-label="Répartition des élèves par formation">
    <motion.button layout className={cn('orbit-core', selected === 'all' && 'selected')} onClick={() => onSelect('all')} type="button"><strong>{items.reduce((sum,item)=>sum+item.count,0)}</strong><span>Dossiers actifs</span></motion.button>
    {items.slice(0,5).map((item,index)=><motion.button layout key={item.formation.id} className={cn('orbit-node',palette[index],selected===item.formation.id&&'selected')} data-index={index} onClick={()=>onSelect(item.formation.id)} type="button" whileTap={{scale:.96}}><strong>{item.count}</strong><span>{item.formation.name}</span></motion.button>)}
  </div>
}

export function SparkBars({ values }) {
  const reduceMotion = useReducedMotion()
  const max = Math.max(...values, 1)
  return <div className="flex h-12 items-end gap-1" aria-label="Évolution récente">{values.map((value,index)=><motion.i key={index} className="block min-w-1 flex-1 rounded-full bg-current/75" initial={{height:reduceMotion?`${value/max*100}%`:0}} animate={{height:`${Math.max(12,value/max*100)}%`}} transition={{duration:.45,delay:index*.035}} />)}</div>
}
