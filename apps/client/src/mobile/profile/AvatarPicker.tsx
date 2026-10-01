import { Camera } from 'lucide-react';
import { useRef } from 'react';
import { Avatar } from '@/components/Avatar';
import { avatarDataUrl } from '@/lib/files';

export function AvatarPicker({
  name,
  src,
  onChange,
  size = 128,
}: {
  name: string;
  src: string | null;
  onChange: (dataUrl: string) => void;
  size?: number;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <button
      type="button"
      onClick={() => input.current?.click()}
      className="relative rounded-full"
      aria-label="Change profile photo"
    >
      <Avatar name={name || '?'} src={src} size={size} />
      <span className="absolute right-1 bottom-1 flex h-11 w-11 items-center justify-center rounded-full bg-wa-accent text-white shadow">
        <Camera size={20} />
      </span>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (file) onChange(await avatarDataUrl(file));
          e.target.value = '';
        }}
      />
    </button>
  );
}
