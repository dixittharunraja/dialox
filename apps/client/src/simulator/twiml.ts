export type TwimlStep =
  { verb: 'say'; text: string } | { verb: 'gather'; prompts: string[] } | { verb: 'redirect' } | { verb: 'hangup' };

/** Parses the TwiML the API returns (the same documents Twilio would execute) into call steps. */
export function parseTwiml(xml: string): TwimlStep[] {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  return Array.from(doc.documentElement.children).flatMap((node): TwimlStep[] => {
    switch (node.tagName) {
      case 'Say':
        return [{ verb: 'say', text: node.textContent ?? '' }];
      case 'Gather':
        return [
          { verb: 'gather', prompts: Array.from(node.getElementsByTagName('Say')).map((s) => s.textContent ?? '') },
        ];
      case 'Redirect':
        return [{ verb: 'redirect' }];
      case 'Hangup':
        return [{ verb: 'hangup' }];
      default:
        return [];
    }
  });
}
