import type { ThemePreference } from '@dialox/shared';
import { useEffect } from 'react';

/** Applies the user's theme preference by toggling the `dark` class that the CSS tokens key off. */
export function useThemePreference(preference: ThemePreference | undefined) {
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = preference === 'dark' || ((preference ?? 'system') === 'system' && media.matches);
      document.documentElement.classList.toggle('dark', dark);
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [preference]);
}
