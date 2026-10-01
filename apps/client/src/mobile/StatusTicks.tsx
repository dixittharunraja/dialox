import type { DeliveryStatus } from '@dialox/shared';
import { AlertCircle, Check, CheckCheck } from 'lucide-react';

/** WhatsApp delivery ticks: one grey (sent/relayed), two grey (delivered), two blue (read). */
export function StatusTicks({ status, size = 16 }: { status: DeliveryStatus; size?: number }) {
  if (status === 'failed') return <AlertCircle size={size - 2} className="shrink-0 text-red-500" aria-label="Failed" />;
  if (status === 'sent') return <Check size={size} className="shrink-0 text-wa-muted" aria-label="Sent" />;
  return (
    <CheckCheck
      size={size}
      className={`shrink-0 ${status === 'read' ? 'text-wa-tick' : 'text-wa-muted'}`}
      aria-label={status === 'read' ? 'Read' : 'Delivered'}
    />
  );
}
