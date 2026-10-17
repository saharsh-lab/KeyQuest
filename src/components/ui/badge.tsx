import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'
import { cn } from '@/lib/utils'

const badgeVariants = cva('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium leading-none [&_svg]:size-3', {
  variants: {
    variant: {
      default: 'bg-surface-3 text-muted',
      accent: 'bg-accent-soft text-accent-text',
      danger: 'bg-danger-soft text-danger',
      outline: 'border border-border-strong text-muted',
      sample: 'border border-dashed border-border-strong text-subtle',
    },
  },
  defaultVariants: { variant: 'default' },
})

export function Badge({ className, variant, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}
