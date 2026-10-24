/** Small presentational building blocks shared by every screen. */
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'success' | 'warn';

export function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'md' | 'lg' | 'sm' }) {
  return <button type="button" className={`btn btn-${variant} btn-${size} ${className}`} {...rest} />;
}

export function Card({
  children,
  className = '',
  title,
}: {
  children: ReactNode;
  className?: string;
  title?: ReactNode;
}) {
  return (
    <section className={`card ${className}`}>
      {title ? <h2 className="card-title">{title}</h2> : null}
      {children}
    </section>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle ? <p className="muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </header>
  );
}

export function Notice({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'success' | 'warn';
  children: ReactNode;
}) {
  return (
    <div className={`notice notice-${tone}`} role="status">
      {children}
    </div>
  );
}

export function Loading({ label }: { label: string }) {
  return (
    <div className="loading" role="status" aria-live="polite">
      <span className="spinner" aria-hidden />
      {label}
    </div>
  );
}

export function StepDots({ index, total }: { index: number; total: number }) {
  return (
    <div className="step-dots" aria-label={`${index + 1} / ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={i < index ? 'dot done' : i === index ? 'dot current' : 'dot'} />
      ))}
    </div>
  );
}
