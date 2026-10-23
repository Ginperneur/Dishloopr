import { expect, test } from 'bun:test';
import { deliverDomainCode } from '../supabase/functions/verify-claim/domainDelivery';

test('code persistence precedes mail and DOMAIN_CODE_SENT follows successful mail', async () => {
  const events: string[] = [];
  await deliverDomainCode({
    persist: async () => { events.push('persist'); },
    send: async () => { events.push('send'); return { sent: true }; },
    recordSent: async () => { events.push('DOMAIN_CODE_SENT'); },
  });
  expect(events).toEqual(['persist', 'send', 'DOMAIN_CODE_SENT']);
});
test('failed mail never records DOMAIN_CODE_SENT', async () => {
  let logged = false;
  await expect(deliverDomainCode({
    persist: async () => {}, send: async () => { throw new Error('provider failure'); },
    recordSent: async () => { logged = true; },
  })).rejects.toThrow('provider failure');
  expect(logged).toBe(false);
});
test('missing persistence prevents sending a code', async () => {
  let sent = false;
  await expect(deliverDomainCode({
    persist: async () => { throw new Error('missing claim'); },
    send: async () => { sent = true; return { sent: true }; }, recordSent: async () => {},
  })).rejects.toThrow('missing claim');
  expect(sent).toBe(false);
});
test('suppressed delivery never records DOMAIN_CODE_SENT', async () => {
  let logged = false;
  await expect(deliverDomainCode({
    persist: async () => {}, send: async () => ({ sent: false }), recordSent: async () => { logged = true; },
  })).rejects.toThrow();
  expect(logged).toBe(false);
});