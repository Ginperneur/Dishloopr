import { describe, expect, test } from 'bun:test';
import { hasParkingInfo, parseParkingInfo } from '../src/lib/parking';

describe('restaurant parking options', () => {
  test('own parking preserves both availability and explicit unavailability', () => {
    expect(parseParkingInfo({ own_parking: true }).own_parking).toBe(true);
    expect(parseParkingInfo({ own_parking: false }).own_parking).toBe(false);
    expect(hasParkingInfo(parseParkingInfo({ own_parking: false }))).toBe(true);
  });
  test('street parking remains independent from own parking', () => {
    const info = parseParkingInfo({ own_parking: false, street_parking: true });
    expect(info.own_parking).toBe(false);
    expect(info.street_parking).toBe(true);
  });
  test('a recommended garage retains its name and address', () => {
    const info = parseParkingInfo({ garage_name: ' Centrum ', garage_address: ' Parkstraat 1 ' });
    expect(info.garage_name).toBe('Centrum');
    expect(info.garage_address).toBe('Parkstraat 1');
    expect(hasParkingInfo(info)).toBe(true);
  });
  test('missing parking information never implies unavailable parking', () => {
    const info = parseParkingInfo(null);
    expect(info.own_parking).toBeNull();
    expect(info.street_parking).toBeNull();
    expect(hasParkingInfo(info)).toBe(false);
  });
});