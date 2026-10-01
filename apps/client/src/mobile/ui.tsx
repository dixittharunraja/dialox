import { ArrowLeft, type LucideIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';

export function IconButton({
  icon: Icon,
  label,
  onClick,
  className = '',
  size = 22,
  disabled,
}: {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  className?: string;
  size?: number;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition hover:bg-black/10 active:bg-black/15 disabled:opacity-40 dark:hover:bg-white/10 ${className}`}
    >
      <Icon size={size} />
    </button>
  );
}

/** WhatsApp green top bar with a back arrow, used by every secondary screen. */
interface TopBarProps {
  title: ReactNode;
  subtitle?: ReactNode;
  children?: ReactNode;
  /** Route to go back to (default: history back), or a handler that intercepts the back tap. */
  back?: string | (() => void);
}

export function TopBar({ title, subtitle, children, back }: TopBarProps) {
  const navigate = useNavigate();
  const goBack = () => (typeof back === 'function' ? back() : back ? navigate(back) : navigate(-1));
  return (
    <header
      className="flex min-h-14 shrink-0 items-center gap-1 bg-wa-header px-1 text-wa-header-text shadow-sm"
      style={{ paddingTop: 'var(--safe-area-inset-top, 0px)' }}
    >
      <IconButton icon={ArrowLeft} label="Back" onClick={goBack} />
      <div className="min-w-0 flex-1 px-1">
        <div className="truncate text-[17px] font-medium">{title}</div>
        {subtitle && <div className="truncate text-xs opacity-80">{subtitle}</div>}
      </div>
      {children}
    </header>
  );
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="min-w-32 rounded-full bg-wa-accent px-8 py-2.5 text-sm font-medium text-white shadow-sm transition hover:brightness-110 disabled:opacity-50 dark:text-[#111b21]"
    >
      {children}
    </button>
  );
}

/** Android-style modal dialog (permission prompts and confirmations). */
export function Dialog({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            role="dialog"
            aria-modal
            className="w-full max-w-sm rounded-3xl bg-wa-panel p-6 text-wa-text shadow-xl"
            initial={{ scale: 0.92 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.92 }}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function DialogActions({ children }: { children: ReactNode }) {
  return <div className="mt-6 flex justify-end gap-2">{children}</div>;
}

export function TextButton({
  children,
  onClick,
  danger,
}: {
  children: ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/10 ${danger ? 'text-red-500' : 'text-wa-accent'}`}
    >
      {children}
    </button>
  );
}

const ToastContext = createContext<(message: string) => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const show = useCallback((text: string) => {
    setMessage(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(null), 2800);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <AnimatePresence>
        {message && (
          <motion.div
            role="status"
            className="pointer-events-none absolute inset-x-0 bottom-24 z-50 flex justify-center px-6"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <span className="rounded-full bg-[#323232] px-4 py-2 text-sm text-white shadow-lg">{message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

export function EmptyState({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center text-sm text-wa-muted">
      <Icon size={44} strokeWidth={1.5} />
      <p className="max-w-64">{text}</p>
    </div>
  );
}
