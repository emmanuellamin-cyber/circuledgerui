/**
 * Pure USSD helpers (§8.19). No menu text lives here: menus are always rendered exactly as the
 * API returns them; these functions only interpret the protocol and the returned text.
 */

export type UssdKind = 'CON' | 'END';

export interface UssdReply {
  kind: UssdKind;
  /** Text to display: the response with its 4-character "CON " / "END " prefix removed. */
  message: string;
}

export interface UssdOption {
  key: string;
  label: string;
}

export type FoundCodeType = 'reference' | 'certificate';

export interface FoundCode {
  type: FoundCodeType;
  value: string;
}

export interface Segment {
  text: string;
  code?: FoundCode;
}

/** `text` sent to the gateway: the whole input history joined by "*". */
export function historyText(history: readonly string[]): string {
  return history.join('*');
}

/**
 * "CON …" = show and wait for input, "END …" = final message. Anything else (which the API
 * shouldn't send) is treated as a final message so the session can't hang.
 */
export function parseUssdResponse(raw: string): UssdReply {
  if (raw.startsWith('CON ') || raw.startsWith('CON\n'))
    return { kind: 'CON', message: raw.slice(4) };
  if (raw.startsWith('END ') || raw.startsWith('END\n'))
    return { kind: 'END', message: raw.slice(4) };
  if (raw === 'CON' || raw === 'END') return { kind: raw, message: '' };
  return { kind: 'END', message: raw };
}

const OPTION_LINE = /^\s*(\d{1,2})\s*[.):-]\s*(.+?)\s*$/;

/** Numbered options ("1. Sell a phone") parsed from the returned text, for quick-select chips. */
export function parseOptions(message: string): UssdOption[] {
  const out: UssdOption[] = [];
  for (const line of message.split(/\r?\n/)) {
    const m = OPTION_LINE.exec(line);
    if (m) out.push({ key: m[1], label: m[2] });
  }
  return out;
}

const TEXT_PROMPT =
  /\b(name|area|landmark|town|village|location|address|street|reference|ref|code|certificate|cert|type|enter|write)\b/i;

/**
 * Suggest the QWERTY keyboard when the prompt (ignoring option lines) asks for a name, area,
 * landmark, reference code or certificate number. Otherwise use the numeric keypad.
 */
export function suggestsText(message: string): boolean {
  const prompt = message
    .split(/\r?\n/)
    .filter((l) => !OPTION_LINE.test(l))
    .join(' ');
  return TEXT_PROMPT.test(prompt);
}

/** Certificate numbers look like CDS-2026-000045 (§8.3). */
const CERTIFICATE = /\bCDS-\d{4}-\d{6}\b/gi;
/** Reference codes follow "Ref:" (e.g. "Ref: SY56JDVN", §10) or the SY-prefixed format. */
const REFERENCE_AFTER_LABEL =
  /\bRef(?:erence)?(?:\s+(?:code|no\.?|number))?\s*[:#]?\s*((?=[A-Z]*\d)[A-Z0-9]{6,12})\b/gi;
const REFERENCE_SY = /\bSY[A-Z0-9]{6}\b/g;

/** Reference codes and certificate numbers found in a message, in order, without duplicates. */
export function extractCodes(message: string): FoundCode[] {
  const hits: { index: number; code: FoundCode }[] = [];
  for (const m of message.matchAll(CERTIFICATE)) {
    hits.push({ index: m.index ?? 0, code: { type: 'certificate', value: m[0].toUpperCase() } });
  }
  for (const m of message.matchAll(REFERENCE_AFTER_LABEL)) {
    const value = m[1].toUpperCase();
    if (/^\d+$/.test(value) || value.startsWith('CDS')) continue;
    hits.push({
      index: (m.index ?? 0) + m[0].lastIndexOf(m[1]),
      code: { type: 'reference', value },
    });
  }
  for (const m of message.matchAll(REFERENCE_SY)) {
    hits.push({ index: m.index ?? 0, code: { type: 'reference', value: m[0] } });
  }
  hits.sort((a, b) => a.index - b.index);
  const seen = new Set<string>();
  return hits
    .map((h) => h.code)
    .filter((c) => (seen.has(c.value) ? false : (seen.add(c.value), true)));
}

/** Splits a message into plain text and highlighted code segments. */
export function segmentMessage(message: string, codes: readonly FoundCode[]): Segment[] {
  if (!codes.length) return [{ text: message }];
  const escaped = codes.map((c) => c.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = new RegExp(`(${escaped.join('|')})`, 'gi');
  return message
    .split(re)
    .filter((part) => part !== '')
    .map((part) => {
      const code = codes.find((c) => c.value === part.toUpperCase());
      return code ? { text: part, code } : { text: part };
    });
}

/** A USSD service code: starts with *, digits and * inside, ends with #. */
export function isServiceCode(value: string): boolean {
  return /^\*\d+(\*\d+)*#$/.test(value);
}

/** crypto.randomUUID needs a secure context; LAN demo URLs (http://192.168…) may not be one. */
export function newSessionId(): string {
  if (globalThis.isSecureContext !== false) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** "Copy as curl" for a form-encoded webhook call. */
export function buildCurl(url: string, fields: Record<string, string>): string {
  const q = (s: string): string => `'${s.replace(/'/g, `'\\''`)}'`;
  const data = Object.entries(fields)
    .map(([k, v]) => `  --data-urlencode ${q(`${k}=${v}`)}`)
    .join(' \\\n');
  return `curl -X POST ${q(url)} \\\n  -H 'Content-Type: application/x-www-form-urlencoded' \\\n${data}`;
}
