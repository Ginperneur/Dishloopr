// Display names + chip headings per dish_group (hub) slug.
// Used for H1/meta on hub pages, backlinks on member pages, and the
// "variants" chip section on hubs.

export const HUB_DISPLAY_NAME: Record<string, string> = {
  biefstuk: 'Biefstuk & Steak',
  pizza: 'Pizza',
  pasta: 'Pasta',
  sushi: 'Sushi',
  hamburger: 'Burgers',
};

export const HUB_CHIP_HEADING: Record<string, string> = {
  biefstuk: 'Specifieke cuts',
  pizza: 'Pizza-varianten',
  pasta: 'Soorten pasta',
  sushi: 'Soorten sushi',
  hamburger: 'Soorten burgers',
};

export const HUB_CHIP_CAP = 12;

export function getHubDisplayName(hubSlug: string | null | undefined, fallback?: string | null): string {
  if (hubSlug && HUB_DISPLAY_NAME[hubSlug]) return HUB_DISPLAY_NAME[hubSlug];
  return fallback || '';
}

export function getHubChipHeading(hubSlug: string | null | undefined): string {
  if (hubSlug && HUB_CHIP_HEADING[hubSlug]) return HUB_CHIP_HEADING[hubSlug];
  return 'Varianten';
}