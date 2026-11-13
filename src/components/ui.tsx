import { Children, cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react';
import type { Badge, Feature } from '../lib/features';

export function Seal({ size = 36 }: { size?: number }) {
  return (
    <div className="seal" style={{ width: size, height: size, fontSize: size * 0.5 }} aria-hidden>
      神
    </div>
  );
}

export function Badges({ badges }: { badges: Badge[] }) {
  const label: Record<Badge, string> = {
    sdk: 'SDK playground',
    live: 'Live on Sepolia',
    sim: 'Interactive simulation',
    off: 'Needs hosted services',
  };
  return (
    <div className="badges">
      {badges.map((b) => (
        <span key={b} className={`badge ${b}`}>
          {label[b]}
        </span>
      ))}
    </div>
  );
}

export function Section({ feature, children }: { feature: Feature; children: ReactNode }) {
  return (
    <section className="section" id={feature.id} data-section={feature.id}>
      <header>
        <Badges badges={feature.badges} />
        <h2>{feature.title}</h2>
        <p className="sub">{feature.blurb}</p>
      </header>
      {children}
    </section>
  );
}

export function Callout({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'warn' | 'ok' | 'bad';
  children: ReactNode;
}) {
  return <div className={`callout ${tone}`}>{children}</div>;
}

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="card">
      {title ? <h3>{title}</h3> : null}
      {children}
    </div>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const id = useId();
  const labelled = Children.map(children, (child) => {
    if (!isValidElement(child)) return child;
    const el = child as ReactElement<{ id?: string }>;
    return el.props.id ? child : cloneElement(el, { id });
  });
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {labelled}
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = 'default',
  disabled,
  type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void | Promise<void>;
  variant?: 'default' | 'primary' | 'ghost';
  disabled?: boolean;
  type?: 'button' | 'submit';
}) {
  return (
    <button type={type} className={`btn ${variant === 'default' ? '' : variant}`.trim()} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

export function Output({
  children,
  tone,
}: {
  children: ReactNode;
  tone?: 'ok' | 'bad';
}) {
  return <pre className={`output ${tone ?? ''}`.trim()}>{children}</pre>;
}

export function Steps({ items }: { items: { title: string; body: ReactNode }[] }) {
  return (
    <ol className="steps">
      {items.map((item) => (
        <li key={item.title}>
          <strong>{item.title}.</strong> {item.body}
        </li>
      ))}
    </ol>
  );
}
