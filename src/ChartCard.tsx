import type { ReactNode } from 'react'

export function ChartCard({
  number,
  title,
  subtitle,
  tag,
  className = '',
  children,
  footer,
}: {
  number: string
  title: string
  subtitle: string
  tag?: string
  className?: string
  children: ReactNode
  footer: ReactNode
}) {
  return (
    <section className={`chart-card ${className}`}>
      <header className="chart-heading">
        <div className="chart-title-block">
          <span className="chart-number" aria-hidden="true">
            {number}
          </span>
          <div>
            <h2>{title}</h2>
            <p className="chart-kicker">{subtitle}</p>
          </div>
        </div>
        {tag && <span className="subtle-tag">{tag}</span>}
      </header>
      {children}
      <div className="chart-footer">{footer}</div>
    </section>
  )
}
