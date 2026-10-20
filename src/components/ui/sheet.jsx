import { Dialog } from 'radix-ui'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { X } from 'lucide-react'
import { Button } from './button'
import { cn } from '@/lib/utils'

export function Sheet({ open, onOpenChange, title, description, children, className }) {
  const reduceMotion = useReducedMotion()
  return <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <AnimatePresence>
      {open && <Dialog.Portal forceMount>
        <Dialog.Overlay asChild forceMount>
          <motion.div className="fixed inset-0 z-40 bg-slate-950/45" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
        </Dialog.Overlay>
        <Dialog.Content asChild forceMount onOpenAutoFocus={event => event.preventDefault()}>
          <motion.aside
            initial={reduceMotion ? { opacity: 0 } : { x: 56, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { x: 56, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 38 }}
            className={cn('fixed inset-y-0 right-0 z-50 w-full max-w-[430px] overflow-y-auto border-l border-border bg-card shadow-2xl outline-none max-sm:top-14 max-sm:rounded-t-[28px] max-sm:border-l-0', className)}
          >
            <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-border bg-card px-5 py-4">
              <div><Dialog.Title className="text-base font-bold">{title}</Dialog.Title>{description && <Dialog.Description className="mt-1 text-xs text-muted-foreground">{description}</Dialog.Description>}</div>
              <Dialog.Close asChild><Button variant="secondary" size="icon" aria-label="Fermer"><X /></Button></Dialog.Close>
            </header>
            {children}
          </motion.aside>
        </Dialog.Content>
      </Dialog.Portal>}
    </AnimatePresence>
  </Dialog.Root>
}
