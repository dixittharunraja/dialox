export type ClientKind = 'mobile' | 'web';
export type RegistrationChannel = 'ivr' | 'sms' | 'portal' | 'web' | 'mobile';
export type Folder = 'inbox' | 'sent' | 'spam' | 'trash';
export type MailView = Folder | 'starred' | 'snoozed';
export type ConversationFilter = 'all' | 'unread' | 'attachments' | 'favorites';
export type DeliveryStatus = 'sent' | 'delivered' | 'read' | 'failed';
export type OtpDelivery = 'twilio' | 'simulator' | 'none';
export type ThemePreference = 'system' | 'light' | 'dark';

export interface AppConfig {
  mailDomain: string;
  defaultCountry: string;
  otpDelivery: OtpDelivery;
  simulatorEnabled: boolean;
  tollFreeNumber: string;
}

export interface User {
  id: string;
  phone: string;
  address: string;
  displayName: string;
  about: string;
  avatarUrl: string | null;
  language: string;
  theme: ThemePreference;
  signature: string;
  hasPassword: boolean;
  registeredVia: RegistrationChannel;
  createdAt: string;
}

export interface Alias {
  id: string;
  address: string;
  createdAt: string;
}

export interface Label {
  id: string;
  name: string;
  color: string;
}

export interface Participant {
  address: string;
  name: string | null;
  avatarUrl: string | null;
}

export interface ConversationPreview {
  subject: string;
  snippet: string;
  outgoing: boolean;
  status: DeliveryStatus;
  at: string;
}

export interface Conversation {
  id: string;
  kind: 'direct' | 'group';
  participants: Participant[];
  isFavorite: boolean;
  unreadCount: number;
  hasAttachments: boolean;
  last: ConversationPreview | null;
  updatedAt: string;
}

export interface AttachmentMeta {
  id: string;
  filename: string;
  contentType: string;
  size: number;
}

export interface QuotedMessage {
  entryId: string | null;
  fromName: string;
  subject: string;
  snippet: string;
}

export interface MailEntry {
  id: string;
  conversationId: string;
  folder: Folder;
  from: Participant;
  ownAddress: string;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  snippet: string;
  text: string;
  html: string | null;
  outgoing: boolean;
  isRead: boolean;
  isStarred: boolean;
  snoozedUntil: string | null;
  labelIds: string[];
  attachments: AttachmentMeta[];
  quoted: QuotedMessage | null;
  repliedByMe: boolean;
  status: DeliveryStatus;
  createdAt: string;
  /** How many messages of this conversation are visible in the current folder/filter (list views only; always 1 from single-entry lookups). */
  threadCount: number;
}

export interface MailPage {
  items: MailEntry[];
  total: number;
}

export interface Draft {
  id: string;
  from: string;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  text: string;
  html: string | null;
  conversationId: string | null;
  replyToEntryId: string | null;
  updatedAt: string;
}

export interface FolderCounts {
  inbox: number;
  drafts: number;
  spam: number;
  trash: number;
}

export interface SmsLog {
  id: string;
  phone: string;
  direction: 'inbound' | 'outbound';
  body: string;
  provider: 'twilio' | 'simulator';
  status: 'sent' | 'received' | 'failed';
  createdAt: string;
}

export interface AuthResult {
  token: string;
  user: User;
  isNew: boolean;
}

export interface SendResult {
  senderEntryId: string | null;
  conversationId: string | null;
}

export interface RegisterResult {
  address: string;
  created: boolean;
}

/** Messages pushed over the authenticated WebSocket (and the public simulator channel). */
export type ServerEvent =
  | { type: 'mail'; conversationId: string; entryId: string }
  | { type: 'mail:changed'; conversationId: string | null }
  | { type: 'sms'; log: SmsLog };

export type ClientEvent = { type: 'auth'; token: string } | { type: 'watch-sms'; phone: string | null };
