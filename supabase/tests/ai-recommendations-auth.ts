import { strict as assert } from 'node:assert';
import { invokeAuthenticatedAI, RecommendationAuthError } from '../../src/lib/invokeAuthenticatedAI';

const session = (access_token: string, expires_at = Math.floor(Date.now() / 1000) + 3600) => ({ access_token, expires_at });
function fixture(initial: ReturnType<typeof session> | null, responses = [{ data: { recommendation: { dish: 'Ramen' } }, error: null }]) {
  const tokens: string[] = [];
  let refreshes = 0;
  const client = {
    auth: {
      getSession: async () => ({ data: { session: initial } }),
      refreshSession: async () => { refreshes++; return { data: { session: session('fresh') } }; },
    },
    functions: { invoke: async (_name: string, options: { headers: Record<string, string> }) => {
      tokens.push(options.headers.Authorization);
      return responses[Math.min(tokens.length - 1, responses.length - 1)];
    } },
  };
  return { client, tokens, refreshes: () => refreshes };
}
const active = fixture(session('active'));
assert.equal((await invokeAuthenticatedAI(active.client, { type: 'surprise' })).data.recommendation.dish, 'Ramen');
assert.deepEqual(active.tokens, ['Bearer active']);
assert.equal(active.refreshes(), 0);
const expired = fixture(session('old', 1));
await invokeAuthenticatedAI(expired.client, {});
assert.deepEqual(expired.tokens, ['Bearer fresh']);
const unauthorized = { data: null, error: { context: { status: 401 } } };
const retry = fixture(session('old'), [unauthorized, { data: { recommendation: { dish: 'Ramen' } }, error: null }] as any);
await invokeAuthenticatedAI(retry.client, {});
assert.deepEqual(retry.tokens, ['Bearer old', 'Bearer fresh']);
const rejected = fixture(session('old'), [unauthorized] as any);
await assert.rejects(() => invokeAuthenticatedAI(rejected.client, {}), RecommendationAuthError);
assert.equal(rejected.tokens.length, 2);
const anonymous = fixture(null);
await assert.rejects(() => invokeAuthenticatedAI(anonymous.client, {}), RecommendationAuthError);
assert.equal(anonymous.tokens.length, 0);
console.log('PASS: valid session, expired session, 401 retry, bounded retry, signed-out guard');