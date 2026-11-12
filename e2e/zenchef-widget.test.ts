import { describe, expect, test } from 'bun:test';
import {
  ZENCHEF_SDK_SRC, isZenchefId, parseZenchefRestaurantId, widgetBookingId, zenchefBookingUrl, zenchefConfigAttributes,
} from '../src/lib/zenchef';
import { reservationMode, summarizeReservationStats } from '../src/lib/reservationIntegration';

describe('Zenchef restaurant ID input', () => {
  test('a bare numeric ID is accepted', () => {
    expect(parseZenchefRestaurantId(' 378183 ')).toBe('378183');
  });
  test('the ID is taken from the official embed snippet, never the script', () => {
    const snippet = `<script>(function(d,s,id){js.src='https://sdk.zenchef.com/v1/sdk.min.js'})(document,'script','zenchef-sdk')</script>
      <div class="zc-widget-config" data-restaurant="378183" data-open="2000"></div>`;
    expect(parseZenchefRestaurantId(snippet)).toBe('378183');
  });
  test('booking and configurator links yield the ID', () => {
    expect(parseZenchefRestaurantId('https://bookings.zenchef.com/results?rid=12345&pax=4')).toBe('12345');
    expect(parseZenchefRestaurantId('sdk.zenchef.com/configure.html?restaurant=378183')).toBe('378183');
  });
  test('links on other hosts and invalid IDs are rejected', () => {
    expect(parseZenchefRestaurantId('https://evil.example/results?rid=12345')).toBeNull();
    expect(parseZenchefRestaurantId('https://bookings.zenchef.com.evil.example/?rid=1')).toBeNull();
    expect(parseZenchefRestaurantId('http://bookings.zenchef.com/results?rid=1')).toBeNull();
    expect(parseZenchefRestaurantId('abc')).toBeNull();
    expect(parseZenchefRestaurantId('12345678901')).toBeNull();
    expect(parseZenchefRestaurantId('<script src="https://x.example/a.js"></script>')).toBeNull();
    expect(isZenchefId('1 OR 1=1')).toBe(false);
  });
});

describe('Zenchef widget configuration', () => {
  test('only the official SDK URL is used', () => {
    expect(ZENCHEF_SDK_SRC).toBe('https://sdk.zenchef.com/v1/sdk.min.js');
  });
  test('booking link uses the documented parameters', () => {
    expect(zenchefBookingUrl('12345', { pax: 4, day: '2026-12-10', lang: 'nl', partnerId: '1001' }))
      .toBe('https://bookings.zenchef.com/results?rid=12345&pax=4&day=2026-12-10&lang=nl&pid=1001');
  });
  test('booking link drops invalid optional values', () => {
    expect(zenchefBookingUrl('12345', { pax: 0, day: 'morgen', lang: 'xx', partnerId: 'abc' })).toBe('https://bookings.zenchef.com/results?rid=12345');
    expect(() => zenchefBookingUrl('javascript:alert(1)')).toThrow();
  });
  test('config hides the default button and the widget\'s own tracking', () => {
    const a = zenchefConfigAttributes('378183', { lang: 'en' });
    expect(a['data-restaurant']).toBe('378183');
    expect(a['data-hide-default-button']).toBe('true');
    expect(a['data-disable-gtm']).toBe('true');
    expect(a['data-disable-ga4']).toBe('true');
    expect(a['data-lang']).toBe('en');
    expect(a['data-partner-id']).toBeUndefined();
  });
  test('widget booking events only expose a bounded booking id', () => {
    expect(widgetBookingId({ bookingId: 991 })).toBe('991');
    expect(widgetBookingId({ bookingId: { nested: true } })).toBeNull();
    expect(widgetBookingId(null)).toBeNull();
  });
});

describe('reservation route selection', () => {
  const widget = { provider: 'zenchef' as const, method: 'widget' as const, external_restaurant_id: '1', lang: null, timezone: 'Europe/Amsterdam' };
  test('without API access the widget is used, also when an API integration exists', () => {
    expect(reservationMode({ option: widget, nativeEnabled: true })).toBe('widget');
    expect(reservationMode({ option: { ...widget, method: 'api' }, nativeEnabled: false })).toBe('widget');
  });
  test('native flow only when the API integration is live and enabled', () => {
    expect(reservationMode({ option: { ...widget, method: 'api' }, nativeEnabled: true })).toBe('native');
  });
  test('legacy numeric zenchef_id still shows the widget; otherwise the link or nothing', () => {
    expect(reservationMode({ zenchefId: '378183' })).toBe('widget');
    expect(reservationMode({ zenchefId: 'https://old.example', reservationUrl: 'https://r.example' })).toBe('link');
    expect(reservationMode({})).toBe('none');
  });
});

describe('reservation statistics', () => {
  test('clicks, started flows, widget reports and confirmed bookings stay separate', () => {
    const s = summarizeReservationStats([
      { metric: 'clicks', context: 'truffelpasta', n: 40 },
      { metric: 'widget_opened', context: 'truffelpasta', n: 25 },
      { metric: 'widget_booking_reported', context: 'truffelpasta', n: 9 },
    ]);
    expect(s.clicks).toBe(40);
    expect(s.widgetOpened).toBe(25);
    expect(s.widgetReported).toBe(9);
    expect(s.confirmed).toBe(0);
    expect(s.conversionRate).toBe(0);
    expect(s.confirmedByDish).toEqual([]);
  });
  test('confirmed bookings are attributed per dish and drive conversion', () => {
    const s = summarizeReservationStats([
      { metric: 'clicks', context: 'zoek', n: '10' },
      { metric: 'confirmed', context: 'truffelpasta', n: '2' },
      { metric: 'confirmed', context: 'zoek', n: '1' },
      { metric: 'cancelled', context: 'truffelpasta', n: '1' },
    ]);
    expect(s.confirmed).toBe(3);
    expect(s.cancelled).toBe(1);
    expect(s.conversionRate).toBe(30);
    expect(s.confirmedByDish).toEqual([{ dish: 'truffelpasta', count: 2 }]);
  });
  test('no clicks means no conversion rate', () => {
    expect(summarizeReservationStats([]).conversionRate).toBeNull();
  });
});
