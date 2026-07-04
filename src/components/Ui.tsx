import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'
import clsx from 'clsx'

export const Card = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={clsx('rounded-2xl border border-slate-200 bg-white p-4 shadow-sm', className)}>{children}</div>
)

export const SectionTitle = ({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) => (
  <div className="mb-4 flex items-start justify-between gap-4">
    <div>
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
    </div>
    {actions ? <div className="shrink-0">{actions}</div> : null}
  </div>
)

export const EmptyState = ({ title, description, action }: { title: string; description: string; action?: ReactNode }) => (
  <Card className="border-dashed bg-slate-50">
    <div className="space-y-3 text-sm text-slate-600">
      <div>
        <p className="text-base font-semibold text-slate-900">{title}</p>
        <p className="mt-1 leading-6">{description}</p>
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  </Card>
)

export const Badge = ({ children, tone = 'slate' }: { children: ReactNode; tone?: 'slate' | 'green' | 'amber' | 'red' | 'indigo' }) => {
  const tones: Record<typeof tone, string> = {
    slate: 'bg-slate-100 text-slate-700',
    green: 'bg-emerald-100 text-emerald-700',
    amber: 'bg-amber-100 text-amber-700',
    red: 'bg-rose-100 text-rose-700',
    indigo: 'bg-indigo-100 text-indigo-700',
  }
  return <span className={clsx('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium', tones[tone])}>{children}</span>
}

export const Button = ({ children, variant = 'primary', className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' }) => {
  const variants: Record<typeof variant, string> = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700',
    secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200',
    ghost: 'bg-transparent text-slate-700 hover:bg-slate-100',
  }
  return (
    <button
      {...props}
      className={clsx(
        'inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        className,
      )}
    >
      {children}
    </button>
  )
}

export const Input = (props: InputHTMLAttributes<HTMLInputElement>) => (
  <input
    {...props}
    className={clsx(
      'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-0 placeholder:text-slate-400 focus:border-indigo-500',
      props.className,
    )}
  />
)

export const Select = (props: SelectHTMLAttributes<HTMLSelectElement>) => (
  <select
    {...props}
    className={clsx(
      'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500',
      props.className,
    )}
  />
)
