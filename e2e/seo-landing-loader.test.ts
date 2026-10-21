import { describe, expect, test } from 'bun:test';
import { readAllPages, slugCandidates } from '../src/lib/seoLandingLoader';
import { QueryClient } from '@tanstack/react-query';

describe('landing reads', () => {
  test('includes every row beyond the 1000-row boundary', async () => {
    const source = Array.from({ length: 3105 }, (_, i) => i);
    const result = await readAllPages(async (from, to) => ({ data: source.slice(from, to + 1), error: null }));
    expect(result).toEqual(source);
  });
  test('failed reads are not empty results', async () => {
    await expect(readAllPages(async () => ({ data: null, error: new Error('read failed') }))).rejects.toThrow('read failed');
  });
  test('longest city suffix is evaluated first and gerecht is never a dish slug', () => {
    expect(slugCandidates('ramen-den-haag')[0]).toEqual({ dish: 'ramen', city: 'den-haag' });
    expect(slugCandidates('gerecht-amsterdam')).toEqual([]);
  });
  test('simultaneous and repeated base-page reads are reused', async () => {
    const client = new QueryClient();
    let reads = 0;
    const options = { queryKey: ['landing', 'ramen-amsterdam'], staleTime: 60_000,
      queryFn: async () => { reads++; return ['restaurant-1']; } };
    await Promise.all([client.fetchQuery(options), client.fetchQuery(options)]);
    await client.fetchQuery(options);
    expect(reads).toBe(1);
    client.clear();
  });
  test('an older slug response cannot overwrite the newer slug cache', async () => {
    const client = new QueryClient();
    let finishOld: (value: string) => void = () => {};
    const old = client.fetchQuery({ queryKey: ['landing', 'ramen-amsterdam'], queryFn: () => new Promise<string>(resolve => { finishOld = resolve; }) });
    await client.fetchQuery({ queryKey: ['landing', 'pizza-rotterdam'], queryFn: async () => 'pizza-results' });
    finishOld('ramen-results'); await old;
    expect(client.getQueryData(['landing', 'pizza-rotterdam'])).toBe('pizza-results');
    client.clear();
  });
});