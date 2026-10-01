import { useThemePreference } from '@/lib/theme';

const SECTIONS = [
  {
    title: 'Your address',
    body: 'Dialox gives every verified phone number an email address at the service domain. You may add up to five alias addresses that deliver to the same mailbox.',
  },
  {
    title: 'Verification',
    body: 'Accounts are verified by a one-time code sent by SMS, by calling the toll-free number, or by texting START. When SMS delivery is unavailable, a password protects the account instead.',
  },
  {
    title: 'SMS notifications',
    body: 'If you do not use the Dialox mobile app, we text you when a new email arrives. Reply STOP to pause these alerts and START to resume them. Carrier rates may apply.',
  },
  {
    title: 'Acceptable use',
    body: 'Do not use Dialox to send spam, malware, or unlawful content, or to impersonate others. Messages you report as spam train your mailbox to filter that sender.',
  },
  {
    title: 'Privacy',
    body: 'We store your phone number, profile, and messages to operate the service. Passwords are stored as salted hashes, and one-time codes expire after five minutes.',
  },
];

export function Terms() {
  useThemePreference('system');
  return (
    <main className="min-h-full bg-gm-bg px-4 py-10 font-google text-gm-text">
      <article className="mx-auto max-w-2xl rounded-2xl bg-gm-surface p-8">
        <h1 className="text-3xl">Terms of Service</h1>
        <p className="mt-2 text-sm text-gm-muted">Dialox: email for your phone number.</p>
        {SECTIONS.map((section) => (
          <section key={section.title} className="mt-6">
            <h2 className="text-lg font-medium">{section.title}</h2>
            <p className="mt-1 leading-relaxed text-gm-muted">{section.body}</p>
          </section>
        ))}
      </article>
    </main>
  );
}
