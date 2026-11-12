import { useEffect, useState } from 'react';
import { ZENCHEF_SDK_ID, ZENCHEF_SDK_SRC, isZenchefId, zenchefConfigAttributes, zenchefPartnerId } from '@/lib/zenchef';

/**
 * unavailable: Zenchef itself refuses the widget for this restaurant (inactive module,
 * unknown ID). The booking iframe then removes itself, so a button would do nothing.
 */
export type ZenchefSdkState = 'idle' | 'loading' | 'ready' | 'error' | 'conflict' | 'unavailable';

const LOAD_TIMEOUT_MS = 10000;
const BOOKING_ORIGIN = 'https://bookings.zenchef.com';
let loading: Promise<'ready' | 'error'> | null = null;
let unavailable = false;
const listeners = new Set<() => void>();

function markUnavailable() {
  if (unavailable) return;
  unavailable = true;
  listeners.forEach((l) => l());
}

function bookingIframePresent() {
  return !!document.querySelector(`iframe[src^="${BOOKING_ORIGIN}/"]`);
}

/**
 * Loads the official Zenchef SDK at most once per page session. The SDK reads one
 * .zc-widget-config element at load time and cannot be re-initialised, so when the user
 * navigates to a second Zenchef restaurant the caller gets 'conflict' and should use the
 * official booking link instead.
 */
export function ensureZenchefSdk(id: string, lang?: string | null): Promise<'ready' | 'error' | 'conflict' | 'unavailable'> {
  if (typeof document === 'undefined' || !isZenchefId(id)) return Promise.resolve('error');
  const existing = document.querySelector<HTMLElement>('.zc-widget-config');
  if (existing && existing.getAttribute('data-restaurant') !== id) return Promise.resolve('conflict');
  if (!existing) {
    const el = document.createElement('div');
    el.className = 'zc-widget-config';
    for (const [k, v] of Object.entries(zenchefConfigAttributes(id, { lang, partnerId: zenchefPartnerId() }))) el.setAttribute(k, v);
    document.body.appendChild(el);
  }
  if (!loading) {
    if (document.getElementById(ZENCHEF_SDK_ID)) {
      loading = Promise.resolve('ready');
    } else {
      // The booking page asks the SDK to drop its iframe when the widget is not available.
      window.addEventListener('message', (e) => {
        if (e.origin === BOOKING_ORIGIN && (e.data as { type?: unknown } | null)?.type === 'remove-iframe') markUnavailable();
      });
      loading = new Promise((resolve) => {
        const script = document.createElement('script');
        script.id = ZENCHEF_SDK_ID;
        script.src = ZENCHEF_SDK_SRC;
        script.async = true;
        const timer = window.setTimeout(() => resolve('error'), LOAD_TIMEOUT_MS);
        // The SDK builds its iframe right after it runs; give it a moment before checking.
        script.onload = () => { window.clearTimeout(timer); window.setTimeout(() => resolve(bookingIframePresent() ? 'ready' : 'error'), 300); };
        script.onerror = () => { window.clearTimeout(timer); resolve('error'); };
        document.body.appendChild(script);
      });
      // A failed load may be retried on a later page.
      loading.then((s) => { if (s === 'error') { loading = null; document.getElementById(ZENCHEF_SDK_ID)?.remove(); } });
    }
  }
  return loading.then((s) => (s === 'ready' && (unavailable || !bookingIframePresent()) ? 'unavailable' : s));
}

export function useZenchefSdk(id: string | null | undefined, lang?: string | null): ZenchefSdkState {
  const [state, setState] = useState<ZenchefSdkState>(id ? 'loading' : 'idle');
  useEffect(() => {
    if (!id) { setState('idle'); return; }
    let alive = true;
    setState('loading');
    ensureZenchefSdk(id, lang).then((s) => { if (alive) setState(s); });
    const onUnavailable = () => { if (alive) setState((s) => (s === 'conflict' ? s : 'unavailable')); };
    listeners.add(onUnavailable);
    return () => { alive = false; listeners.delete(onUnavailable); };
  }, [id, lang]);
  return state;
}
