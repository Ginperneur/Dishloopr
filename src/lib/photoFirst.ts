/** A restaurant has a photo when its first image is set; restaurants without one still list (with their dishes as the image). */
export function hasPhoto(r: { images?: string[] | null }): boolean {
  return !!r.images && r.images.length > 0 && !!r.images[0];
}

/** Restaurants with a photo first, keeping the existing order within both groups. */
export function photoFirst<T extends { images?: string[] | null }>(rows: T[]): T[] {
  return [...rows.filter(hasPhoto), ...rows.filter((r) => !hasPhoto(r))];
}
