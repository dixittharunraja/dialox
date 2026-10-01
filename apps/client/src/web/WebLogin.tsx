import { Link } from 'react-router';
import { PhoneAuthCard } from '@/components/PhoneAuthCard';
import { useThemePreference } from '@/lib/theme';
import { usePhoneAuth } from '@/lib/use-phone-auth';

export function WebLogin() {
  useThemePreference('system');
  const auth = usePhoneAuth({ mode: 'login', client: 'web' });
  return (
    <PhoneAuthCard
      auth={auth}
      title="Sign in"
      subtitle="Use your phone number to continue to Dialox Mail. New numbers get an account automatically."
      submitLabel="Next"
      footer={
        <Link to="/register" className="font-medium text-gm-blue">
          Registration portal
        </Link>
      }
    />
  );
}
