import { cn } from '@/lib/utils'

export function Field({ label, hint, className, children }) {
  return <label className={cn('grid gap-1.5 text-sm font-medium text-foreground', className)}>{label}<span className="font-normal">{children}</span>{hint && <small className="text-xs text-muted-foreground">{hint}</small>}</label>
}

export function Input({ className, ...props }) {
  return <input className={cn('h-11 w-full rounded-xl border border-input bg-card px-3.5 text-sm outline-none transition focus:border-primary/40 focus:ring-4 focus:ring-primary/10', className)} {...props} />
}

export function Select({ className, ...props }) {
  return <select className={cn('h-11 w-full rounded-xl border border-input bg-card px-3.5 text-sm outline-none transition focus:border-primary/40 focus:ring-4 focus:ring-primary/10', className)} {...props} />
}

export function Textarea({ className, ...props }) {
  return <textarea className={cn('min-h-24 w-full resize-y rounded-xl border border-input bg-card px-3.5 py-3 text-sm outline-none transition focus:border-primary/40 focus:ring-4 focus:ring-primary/10', className)} {...props} />
}
