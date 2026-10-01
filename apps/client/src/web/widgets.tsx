import type { LucideIcon } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';

export function GmIconButton({
  icon: Icon,
  label,
  onClick,
  type = 'button',
  active,
  size = 20,
  className = '',
}: {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  type?: 'button' | 'submit';
  active?: boolean;
  size?: number;
  className?: string;
}) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-gm-muted transition hover:bg-gm-hover hover:text-gm-text ${active ? 'text-gm-text' : ''} ${className}`}
    >
      <Icon size={size} />
    </button>
  );
}

/** Anchored dropdown that closes on outside click or Escape. */
export function Popover({
  open,
  onClose,
  className = '',
  children,
}: {
  open: boolean;
  onClose: () => void;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    const timer = setTimeout(() => document.addEventListener('pointerdown', onPointer));
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      ref={ref}
      className={`absolute z-40 rounded-2xl bg-gm-surface text-gm-text shadow-[0_4px_16px_rgba(0,0,0,0.2)] ${className}`}
    >
      {children}
    </div>
  );
}

export function MenuItem({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm hover:bg-gm-hover"
    >
      {children}
    </button>
  );
}
