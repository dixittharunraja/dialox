import { User, Users } from 'lucide-react';
import { colorFor, initials } from '@/lib/format';

interface AvatarProps {
  name: string;
  src?: string | null;
  size?: number;
  group?: boolean;
  /** "wa" renders WhatsApp's grey silhouette placeholder, "gm" renders Gmail's coloured initial. */
  variant?: 'wa' | 'gm';
}

export function Avatar({ name, src, size = 48, group = false, variant = 'wa' }: AvatarProps) {
  const style = { width: size, height: size };
  if (src) return <img src={src} alt="" style={style} className="shrink-0 rounded-full object-cover" />;
  if (variant === 'gm') {
    return (
      <span
        style={{ ...style, background: colorFor(name), fontSize: size * 0.45 }}
        className="flex shrink-0 items-center justify-center rounded-full font-medium text-white"
        aria-hidden
      >
        {initials(name)}
      </span>
    );
  }
  const Icon = group ? Users : User;
  return (
    <span
      style={style}
      className="flex shrink-0 items-center justify-center rounded-full bg-[#dfe5e7] text-white dark:bg-[#6a7175]"
      aria-hidden
    >
      <Icon size={size * 0.55} strokeWidth={2.2} />
    </span>
  );
}
