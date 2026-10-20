import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva('inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold', {
  variants: {
    variant: {
      neutral: 'bg-muted text-muted-foreground',
      success: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
      warning: 'bg-amber-500/12 text-amber-700 dark:text-amber-300',
      danger: 'bg-red-500/10 text-red-700 dark:text-red-300',
      info: 'bg-blue-500/10 text-blue-700 dark:text-blue-300'
    }
  },
  defaultVariants: { variant: 'neutral' }
})

export function Badge({ className, variant, dot = false, children, ...props }) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props}>{dot && <i className="size-1.5 rounded-full bg-current" />}{children}</span>
}
