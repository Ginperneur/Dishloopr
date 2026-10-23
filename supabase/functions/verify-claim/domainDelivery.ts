/** Persistence must complete before sending; audit success only after accepted delivery. */
export async function deliverDomainCode(steps: {
  persist: () => Promise<void>;
  send: () => Promise<{ sent: boolean }>;
  recordSent: () => Promise<void>;
}): Promise<void> {
  await steps.persist();
  const result = await steps.send();
  if (!result.sent) throw new Error('Verificatiemail kan niet naar dit adres worden verstuurd. Neem contact op via info@dishloopr.com.');
  await steps.recordSent();
}