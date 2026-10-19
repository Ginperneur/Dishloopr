export interface ParkingInfo {
  own_parking: boolean | null;
  street_parking: boolean | null;
  garage_name: string;
  garage_address: string;
  notes: string;
}

export function parseParkingInfo(value: unknown): ParkingInfo {
  const data = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
  const text = (key: string) => typeof data[key] === 'string' ? (data[key] as string).trim() : '';
  return {
    own_parking: typeof data.own_parking === 'boolean' ? data.own_parking : null,
    street_parking: typeof data.street_parking === 'boolean' ? data.street_parking : null,
    garage_name: text('garage_name'),
    garage_address: text('garage_address'),
    notes: text('notes'),
  };
}

export function hasParkingInfo(info: ParkingInfo): boolean {
  return info.own_parking !== null || info.street_parking !== null || Boolean(info.garage_name || info.notes);
}