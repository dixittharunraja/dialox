# Dialox

Email for your phone number. Every verified phone number gets a real mailbox, `9876543210@dialox.local`, reachable over SMTP and used through a WhatsApp-styled mobile app or a Gmail-styled web client. Accounts can be created by phone call (IVR), by SMS, on a two-field registration portal, or from either client.

Built for the Alphastack 7-day buildathon. The original brief is in [docs/brief/](docs/brief/).

## Quick start

```bash
docker compose up -d
```

That builds and starts Postgres 16, the API (REST, WebSocket and SMTP) and nginx serving the clients. Migrations run and demo data is seeded on first boot. No accounts or API keys are needed: without Twilio credentials, all SMS and calls go to the built-in telephony simulator.

| Surface                        | URL                             |
| ------------------------------ | ------------------------------- |
| Mobile client (WhatsApp style) | http://localhost:8080/          |
| Web client (Gmail style)       | http://localhost:8080/web       |
| Registration portal            | http://localhost:8080/register  |
| Virtual telephony simulator    | http://localhost:8080/simulator |
| SMTP (inbound mail)            | `localhost:2525`                |

Open the mobile client in a phone-sized window, or use Chrome DevTools device mode. On a desktop it renders inside a device frame.

### Demo accounts

All demo accounts use the password `demo1234`, or the OTP shown in the simulator's SMS log.

| Name         | Phone           | Address                                                          |
| ------------ | --------------- | ---------------------------------------------------------------- |
| Aarav Sharma | +91 98765 43210 | `9876543210@dialox.local` (alias `work.9876543210@dialox.local`) |
| Priya Nair   | +91 98123 45678 | `9812345678@dialox.local`                                        |
| Rahul Verma  | +91 99001 12233 | `9900112233@dialox.local`                                        |

### A five-minute tour

1. Open **/simulator** and set the virtual phone's number, for example `+91 90000 12345`.
2. **Phone tab:** call the toll-free number, listen to the IVR and press **1**. The account is created and a welcome SMS with a temporary password appears in **Messages**.
3. Open **/** (mobile). Pick a language, accept the terms and allow the permission prompts. The number is pre-filled from the virtual SIM, and the OTP is detected and submitted automatically.
4. Search `9876543210` on Home to open a chat with Aarav and send a mail with a subject. Sign in as Aarav on **/web** (OTP from the simulator log, or `demo1234`). The mail is there, and because Aarav has no mobile session, the simulator's gateway log shows his SMS alert: _"You have received an email from ... Subject: ..."_.
5. Back on mobile, swipe right on a message to reply. The subject field disappears, the reply is quoted, and a second swipe on the same message is refused.

## Feature map

| Brief requirement                                                              | Where it is implemented                                                                                                                           |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phone number as email ID                                                       | `packages/shared/src/phone.ts`. Home-country numbers use the national form (`9876543210@`) and others keep their country code (`14155550100@`).   |
| IVR registration ("press 1")                                                   | `apps/api/src/services/telephony.ts` generates TwiML, served to Twilio at `/api/telephony/voice` and to the simulator dialer                      |
| SMS registration (START)                                                       | same file; `STOP` pauses alerts, `HELP` explains                                                                                                  |
| Registration portal: 2 fields, resets after each account                       | `apps/client/src/register/RegisterPortal.tsx`                                                                                                     |
| OTP, with password fallback when no gateway is available                       | `apps/api/src/services/auth.ts`, `apps/client/src/lib/use-phone-auth.ts`                                                                          |
| SMS alerts only for users without the mobile app                               | `notifyBySms` in `apps/api/src/services/delivery.ts`, which checks for an active `mobile` session                                                 |
| Twilio trial limits and pre-approved template                                  | `SMS_TEMPLATE` is configurable. A failed send (trial account to an unverified number) is logged, and OTP falls back to password.                  |
| Mobile: WhatsApp design language                                               | `apps/client/src/mobile/**`, with light and dark tokens in `index.css`                                                                            |
| Onboarding: language, terms, phone (auto-detected), OTP (auto-detected)        | `mobile/onboarding/*`, `mobile/permissions.tsx`                                                                                                   |
| Permission prompts at the right stage                                          | SIM before the phone step, SMS before OTP, contacts and notifications after profile setup                                                         |
| No Inbox/Sent split: mail organised as chats                                   | `apps/api/src/services/conversations.ts`                                                                                                          |
| Full-width search; All / Unread / Attachments / Favorites chips                | `mobile/home/Home.tsx`                                                                                                                            |
| Top-left menu: Home, Drafts, Spam, Trash                                       | `mobile/home/Drawer.tsx`, `mobile/home/FolderView.tsx`                                                                                            |
| Profile: alias IDs, language, personal details, photo                          | `mobile/profile/Profile.tsx`                                                                                                                      |
| Compose via FAB, or search a number and start typing                           | `mobile/compose/Composer.tsx`, `mobile/home/Home.tsx`                                                                                             |
| Compact subject above the message box; hidden when replying                    | `mobile/chat/ChatComposer.tsx`                                                                                                                    |
| Swipe right to reply; one reply per message                                    | `mobile/chat/MessageBubble.tsx`, plus the `messages_single_reply` unique index                                                                    |
| Long mail: tap to open the traditional view, with Reply at the bottom          | `mobile/reader/Reader.tsx`                                                                                                                        |
| Traditional composer in the camera slot, To/Cc locked                          | `ChatComposer.tsx` opens `/compose?conversation=...`. Inside a chat the server ignores any other recipients.                                      |
| 2+ recipients from Home create a group chat; 1:1 mail stays 1:1                | Conversation key = the set of other participants (`ensureConversation`)                                                                           |
| Web: single sign-in screen with phone, OTP, Next and the Terms of Service link | `components/PhoneAuthCard.tsx`                                                                                                                    |
| Web: Gmail-like client with profile and settings                               | `apps/client/src/web/**`: folders, labels, snooze, stars, search and advanced filters, bulk actions, rich-text compose, forward, drafts, settings |
| Local SMTP                                                                     | `apps/api/src/smtp.ts`, using `smtp-server` and `mailparser`                                                                                      |
| Dockerised, `docker compose up -d`                                             | `docker-compose.yml`, `apps/*/Dockerfile`, `infra/nginx/nginx.conf`                                                                               |

## Architecture

```
                 ┌──────────────── nginx (web container, :8080) ─────────────────┐
                 │  /  mobile SPA   /web  Gmail SPA   /register   /simulator     │
                 │  /api/*  ->  api:4000  (REST + WebSocket upgrade)             │
                 └───────────────────────────────┬───────────────────────────────┘
                                                 │
  Twilio ──webhooks──▶ ┌─────────── api (Fastify, Node 22) ───────────┐ ◀── SMTP :2525 ── other mail servers
  (voice / SMS)        │ auth (OTP / password)   telephony (IVR, SMS) │
                       │ mail engine: delivery, conversations, mailbox│
                       │ realtime hub (WebSocket push)                │
                       └──────────────────────┬───────────────────────┘
                                              │ Drizzle ORM
                                    ┌─────────▼─────────┐
                                    │   PostgreSQL 16   │
                                    └───────────────────┘
```

**Monorepo** (pnpm workspaces and Turborepo):

```
apps/api          Fastify REST + WebSocket + SMTP server, Drizzle schema and migrations
apps/client       One Vite + React 19 app, code-split into the mobile, web, portal and simulator surfaces
packages/shared   Types, zod request schemas, phone/address helpers used by both sides
infra/nginx       Reverse proxy + static hosting config
```

### How mail works

- **One message, many mailboxes.** A mail is stored once in `messages`. Every participant gets a `mailbox_entries` row holding their own folder, read, star, snooze and label state. That is how the sender's Sent copy, each recipient's Inbox copy, and read receipts coexist.
- **Chats are derived, not stored threads.** Each user's `conversations` row is keyed by the sorted set of _other_ participants. Mail to one person always lands in the 1:1 chat. Mail to several people creates a group chat for exactly that set. Replies inherit the parent's conversation.
- **Recipients are locked server-side.** When a send carries `conversationId` or `replyToEntryId`, the API ignores the client's To and Cc and uses the chat's participants, so a modified client cannot add people inside a chat.
- **Reply once.** A unique index on `(sender_user_id, in_reply_to_id)` enforces the rule in the database. The API returns `409 already_replied`.
- **Delivery ticks.** Mail is `sent` once relayed externally and `delivered` once stored in local mailboxes. It turns `read` (blue ticks) when every local recipient has read it, pushed live over WebSocket.
- **SMTP.** Only accepts `RCPT TO` for registered numbers and aliases on the mail domain. It is not an open relay, and mail for unknown numbers gets a `550` during the SMTP dialogue. Mail sent from the app to unknown numbers or to external domains (unless `SMTP_RELAY_URL` is set) bounces back as a _Delivery Status Notification_.
- **Spam.** _Report spam_ moves the mail and remembers the sender, so future mail from that sender skips the inbox. _Not spam_ reverses it.

### Authentication

- OTPs are six digits, stored as a hash, valid for five minutes and limited to five attempts. OTP sends and logins are rate-limited per phone number.
- `OTP delivery` is `twilio` when credentials exist, `simulator` otherwise, or `none` (`OTP_MODE=none`). When it is `none`, or when Twilio rejects a send (common on trial accounts), clients switch to password sign-in automatically.
- Accounts created over the phone (IVR or SMS) receive a temporary password by SMS. That proves possession of the number and still allows sign-in when OTP is unavailable. Passwords are hashed with scrypt.
- Sessions are random bearer tokens, stored hashed and tagged `mobile` or `web`. An active `mobile` session is what "has the mobile app" means for SMS alerts.

### Mobile device features in a PWA

Browsers cannot read the SIM, so the mobile client is honest about it:

| Native behaviour         | Dialox                                                                                                                                                                            |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Read the SIM's number    | Reads the _virtual device_ number set in the simulator (same origin), or the last number used on the device                                                                       |
| Auto-read the OTP SMS    | **WebOTP API** on Android Chrome (every OTP SMS ends with `@host #code`). In simulator mode the app watches the virtual phone's inbox. `autocomplete="one-time-code"` covers iOS. |
| Contacts access          | **Contact Picker API** (Android Chrome) from the search bar                                                                                                                       |
| Notifications            | Real `Notification.requestPermission()`                                                                                                                                           |
| Voice input (mic button) | Web Speech API dictation where supported                                                                                                                                          |

## Using real Twilio

1. Create a Twilio trial account and buy the free trial number. Verify the phones you will test with, since trial accounts can only text verified numbers.
2. Expose the stack publicly, for example `ngrok http 8080`.
3. Create `.env` from `.env.example` and set `PUBLIC_URL` (the ngrok URL), `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and `TWILIO_FROM_NUMBER`. Then run `docker compose up -d`.
4. In the Twilio console, configure the number's webhooks (HTTP POST):
   - Voice, "A call comes in": `${PUBLIC_URL}/api/telephony/voice`
   - Messaging, "A message comes in": `${PUBLIC_URL}/api/telephony/sms`

Webhook requests are verified with Twilio's `X-Twilio-Signature`, which is why `PUBLIC_URL` must match exactly. Trial accounts prefix outgoing SMS with a trial notice. If custom text is not allowed on your account, set `SMS_TEMPLATE` to a pre-approved template.

## Try the API with curl

The Vite dev server and nginx both proxy `/api`, so use `http://localhost:8080` for Docker or `http://localhost:5173` for dev.

```bash
API=http://localhost:8080/api

# Configuration the clients use
curl $API/config

# Sign in with a password (demo account) and keep the token
TOKEN=$(curl -s $API/auth/password -H 'content-type: application/json' \
  -d '{"phone":"9876543210","password":"demo1234","client":"web"}' | sed -E 's/.*"token":"([^"]+)".*/\1/')

# OTP flow: request a code, read it from the simulator's SMS log, verify
curl -s $API/auth/otp -H 'content-type: application/json' -d '{"phone":"+919000000001"}'
curl -s "$API/simulator/sms?phone=%2B919000000001"
curl -s $API/auth/otp/verify -H 'content-type: application/json' \
  -d '{"phone":"+919000000001","code":"123456","client":"mobile"}'

# Registration portal (creates the account only, no session)
curl -s $API/accounts/register -H 'content-type: application/json' \
  -d '{"phone":"+919000000002","password":"s3cret-pass"}'

# Chats, one conversation, mailbox views
curl -s $API/conversations -H "authorization: Bearer $TOKEN"
curl -s "$API/conversations?filter=unread&q=trip" -H "authorization: Bearer $TOKEN"
curl -s "$API/mail?view=inbox&hasAttachment=true" -H "authorization: Bearer $TOKEN"

# Send: 1 recipient -> 1:1 chat, 2+ -> group chat
curl -s $API/mail/send -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"to":["9812345678","9900112233"],"subject":"Lunch?","text":"Canteen at 1?"}'

# Aliases
curl -s $API/aliases -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' -d '{"name":"shop"}'

# Simulator: call the IVR, press 1, and text START
curl -s $API/simulator/call -H 'content-type: application/json' -d '{"from":"+919000000003"}'
curl -s $API/simulator/call/gather -H 'content-type: application/json' -d '{"from":"+919000000003","digits":"1"}'
curl -s $API/simulator/sms -H 'content-type: application/json' -d '{"from":"+919000000004","body":"START"}'
```

Send real SMTP mail into a mailbox:

```bash
printf 'From: Alice <alice@example.com>\r\nTo: 9876543210@dialox.local\r\nSubject: Over SMTP\r\n\r\nHello from outside.\r\n' > mail.eml
curl smtp://localhost:2525 --mail-from alice@example.com --mail-rcpt 9876543210@dialox.local --upload-file mail.eml
```

### Endpoint reference

| Method              | Path                                                                                 | Purpose                                                                   |
| ------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| GET                 | `/api/config`                                                                        | Mail domain, country, OTP delivery mode, simulator flag, toll-free number |
| POST                | `/api/auth/otp` · `/api/auth/otp/verify` · `/api/auth/password` · `/api/auth/logout` | Sign in or up                                                             |
| POST                | `/api/accounts/register`                                                             | Portal registration (OTP or password)                                     |
| GET/PATCH           | `/api/me` · PUT `/api/me/password`                                                   | Profile, language, theme, signature, password                             |
| GET/POST/DELETE     | `/api/aliases[/:id]` · `/api/labels[/:id]`                                           | Alias IDs and labels                                                      |
| GET/POST            | `/api/conversations`                                                                 | List chats (filter, search) or open one with participants                 |
| GET/PATCH           | `/api/conversations/:id` · GET `/:id/messages` · POST `/:id/read`                    | Chat detail, favourite, thread, mark read                                 |
| GET                 | `/api/mail?view=&q=&from=&to=&subject=&after=&before=&hasAttachment=&labelId=&page=` | Gmail-style views and search                                              |
| GET/PATCH           | `/api/mail/:id` · POST `/api/mail/bulk` · POST `/api/mail/delete`                    | Read, star, move, snooze, label; delete forever                           |
| POST                | `/api/mail/send`                                                                     | Send (attachments as base64, up to 10 MB)                                 |
| GET                 | `/api/mail/counts` · `/api/attachments/:id`                                          | Folder badges; authenticated download                                     |
| GET/POST/PUT/DELETE | `/api/drafts[/:id]`                                                                  | Drafts                                                                    |
| POST                | `/api/telephony/voice[/gather]` · `/api/telephony/sms`                               | Twilio webhooks (signature-checked)                                       |
| GET/POST            | `/api/simulator/sms` · POST `/api/simulator/call[/gather]`                           | Simulator (disable with `SIMULATOR_ENABLED=false`)                        |
| WS                  | `/api/ws`                                                                            | Live mailbox events; simulator SMS feed                                   |

## Development

Requires Node 22+ and pnpm (`corepack enable`).

```bash
pnpm install
pnpm dev            # API on :4000 (+ SMTP :2525) and Vite on :5173
```

Without `DATABASE_URL`, the API uses embedded **PGlite**: real Postgres compiled to WASM, stored in `apps/api/.data`. `pnpm dev` therefore needs neither Docker nor a database server. Set `DATABASE_URL` to use a real Postgres. Migrations run automatically at startup either way.

| Command                         | Purpose                                                        |
| ------------------------------- | -------------------------------------------------------------- |
| `pnpm build` / `pnpm typecheck` | Turborepo build / strict typecheck of every package            |
| `pnpm lint`                     | ESLint (unused imports and variables are errors)               |
| `pnpm knip`                     | Dead files, exports and dependencies                           |
| `pnpm dup`                      | Duplicate-code detection (jscpd)                               |
| `pnpm check`                    | All of the above plus a Prettier check                         |
| `pnpm db:generate`              | Generate a migration after editing `apps/api/src/db/schema.ts` |

A Husky pre-commit hook runs Prettier and ESLint on staged files, then knip and jscpd.

## Configuration

See [.env.example](.env.example). Every variable is optional.

| Variable                                                          | Default                          | Notes                                                                      |
| ----------------------------------------------------------------- | -------------------------------- | -------------------------------------------------------------------------- |
| `MAIL_DOMAIN`                                                     | `dialox.local`                   | Domain of every address                                                    |
| `DEFAULT_COUNTRY`                                                 | `IN`                             | Numbers from this country use the short national local part                |
| `PUBLIC_URL`                                                      | `http://localhost:8080`          | SMS links, WebOTP host, Twilio signature checks                            |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER` | none                             | All three switch OTP and SMS to Twilio                                     |
| `TOLL_FREE_NUMBER`                                                | Twilio number, or `+18005550199` | Shown to users for IVR and SMS sign-up                                     |
| `OTP_MODE`                                                        | auto                             | `none` forces password auth                                                |
| `SMS_TEMPLATE`                                                    | brief's wording                  | `{sender}` and `{subject}` placeholders                                    |
| `SMTP_RELAY_URL`                                                  | none                             | Outbound relay for non-Dialox domains                                      |
| `SIMULATOR_ENABLED` / `SEED_DEMO`                                 | `true`                           | Turn off in production                                                     |
| `HTTP_PORT` / `SMTP_PORT`                                         | `8080` / `2525`                  | Host ports. Map `25:2525` in compose to receive mail on the standard port. |

## Known limitations

- A PWA cannot read the SIM or SMS inbox directly. The mobile client uses WebOTP and Contact Picker where the browser supports them, and the simulator's virtual device elsewhere. A Capacitor wrapper could add the native SMS Retriever and SIM APIs.
- Inbound SMTP does not verify SPF, DKIM or DMARC, and has no TLS. Deploy it behind a real MX or a filtering relay before exposing port 25 publicly.
- Attachments live in Postgres (`bytea`, 10 MB per mail). Object storage would be the next step at scale.
- The WebSocket hub is in-process, so running several API replicas needs a shared pub/sub such as Postgres `LISTEN/NOTIFY` or Redis.
