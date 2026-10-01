import { simpleParser, type AddressObject } from 'mailparser';
import { SMTPServer } from 'smtp-server';
import { config } from './config';
import { isLocalAddress, resolveLocalAddress } from './services/accounts';
import { ingestInbound } from './services/delivery';

const MAX_MESSAGE_BYTES = 25 * 1024 * 1024;

function addresses(field: AddressObject | AddressObject[] | undefined): string[] {
  const list = Array.isArray(field) ? field : field ? [field] : [];
  return list.flatMap((o) => o.value.map((v) => v.address?.toLowerCase() ?? '')).filter(Boolean);
}

/**
 * Inbound-only MX for the mail domain. It is not an open relay: RCPT TO is accepted only for
 * addresses that belong to a registered account (phone local part or alias), so mail for
 * unregistered numbers is rejected during the SMTP dialogue with a 550.
 */
export function startSmtpServer() {
  const server = new SMTPServer({
    name: config.mailDomain,
    banner: 'Dialox ESMTP',
    authOptional: true,
    disabledCommands: ['AUTH', 'STARTTLS'],
    size: MAX_MESSAGE_BYTES,
    async onRcptTo(address, _session, callback) {
      const rcpt = address.address.toLowerCase();
      if (!isLocalAddress(rcpt)) return callback(new Error(`550 Relaying denied for ${rcpt}`));
      if (!(await resolveLocalAddress(rcpt))) return callback(new Error(`550 No such user ${rcpt}`));
      callback();
    },
    onData(stream, session, callback) {
      simpleParser(stream)
        .then(async (parsed) => {
          const sender = parsed.from?.value[0];
          const envelopeFrom = session.envelope.mailFrom ? session.envelope.mailFrom.address : '';
          const fromAddress = (sender?.address || envelopeFrom).toLowerCase();
          await ingestInbound({
            fromAddress: fromAddress || `unknown@${config.mailDomain}`,
            fromName: sender?.name ?? '',
            to: addresses(parsed.to),
            cc: addresses(parsed.cc),
            bcc: [],
            recipients: session.envelope.rcptTo.map((r) => r.address.toLowerCase()),
            subject: parsed.subject ?? '',
            text: parsed.text ?? '',
            html: typeof parsed.html === 'string' ? parsed.html : null,
            files: parsed.attachments.map((a) => ({
              filename: a.filename ?? 'attachment',
              contentType: a.contentType,
              content: a.content,
            })),
            rfcMessageId: parsed.messageId,
            inReplyToRfc: parsed.inReplyTo ?? null,
          });
          callback();
        })
        .catch((error: Error) => {
          console.error('[smtp] failed to ingest message', error);
          callback(new Error('451 Temporary failure, please retry'));
        });
    },
  });
  server.on('error', (error) => console.error('[smtp]', error.message));
  server.listen(config.smtpPort, '0.0.0.0', () =>
    console.log(`[smtp] listening on :${config.smtpPort} for *@${config.mailDomain}`),
  );
  return server;
}
