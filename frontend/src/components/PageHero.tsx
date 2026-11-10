import { ReactNode } from 'react';

type Props = {
  kicker: string;
  title: string;
  accent: string;
  children?: ReactNode;
  actions?: ReactNode;
};

export default function PageHero({ kicker, title, accent, children, actions }: Props) {
  return (
    <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <p className="hi-eyebrow mb-1.5 font-mono text-[12px] uppercase tracking-[0.14em] text-orange-500">{kicker}</p>
        <h1 className="font-display text-[clamp(48px,10vw,112px)] font-normal uppercase leading-[0.9] tracking-[0.01em] text-white">
          {title} <em className="hi-stroke not-italic">{accent}</em>
        </h1>
        {children}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
