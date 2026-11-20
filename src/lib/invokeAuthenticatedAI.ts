type Session = { access_token: string; expires_at?: number };
type Result = { data: any; error: any };
type Client = {
  auth: {
    getSession: () => Promise<{ data: { session: Session | null }; error?: unknown }>;
    refreshSession: () => Promise<{ data: { session: Session | null }; error?: unknown }>;
  };
  functions: {
    invoke: (name: string, options: { body: Record<string, unknown>; headers: Record<string, string> }) => Promise<Result>;
  };
};

export class RecommendationAuthError extends Error {
  constructor() {
    super('Log opnieuw in om een aanbeveling te ontvangen.');
    this.name = 'RecommendationAuthError';
  }
}

export async function invokeAuthenticatedAI(client: Client, body: Record<string, unknown>): Promise<Result> {
  const initial = await client.auth.getSession();
  let session = initial.data.session;
  if (initial.error || !session?.access_token) throw new RecommendationAuthError();

  if (session.expires_at && session.expires_at <= Math.floor(Date.now() / 1000) + 60) {
    const refreshed = await client.auth.refreshSession();
    session = refreshed.data.session;
    if (refreshed.error || !session?.access_token) throw new RecommendationAuthError();
  }

  const invoke = (token: string) => client.functions.invoke('ai-recommendations', {
    body,
    headers: { Authorization: `Bearer ${token}` },
  });
  let result = await invoke(session.access_token);
  if (result.error?.context?.status === 401) {
    const refreshed = await client.auth.refreshSession();
    if (refreshed.error || !refreshed.data.session?.access_token) throw new RecommendationAuthError();
    result = await invoke(refreshed.data.session.access_token);
    if (result.error?.context?.status === 401) throw new RecommendationAuthError();
  }
  return result;
}