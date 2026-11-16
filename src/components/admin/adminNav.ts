import {
  Inbox, ListChecks, Store, ShieldCheck, FileText, Mail, Crown, TrendingUp, Settings,
  type LucideIcon,
} from 'lucide-react';

/** Open counts shown as badges; each key is filled by AdminPanel's stats query. */
export type AdminBadgeKey =
  | 'claims' | 'dishes' | 'reviews' | 'support' | 'contact' | 'edits' | 'tagRequests'
  | 'eventReleases' | 'optouts' | 'suggestions' | 'discovery' | 'manualReview'
  | 'outreachReplies' | 'menuService';

export type AdminBadges = Record<AdminBadgeKey, number>;

export const EMPTY_BADGES: AdminBadges = {
  claims: 0, dishes: 0, reviews: 0, support: 0, contact: 0, edits: 0, tagRequests: 0,
  eventReleases: 0, optouts: 0, suggestions: 0, discovery: 0, manualReview: 0,
  outreachReplies: 0, menuService: 0,
};

export interface AdminTab {
  /** Section id, also the `?section=` value in the URL. */
  id: string;
  label: string;
  description: string;
  badge?: AdminBadgeKey;
  /** A large standing backlog: shown on its tab in grey, left out of the red sidebar total. */
  backlog?: boolean;
}

export interface AdminGroup {
  id: string;
  label: string;
  icon: LucideIcon;
  tabs: AdminTab[];
}

export const ADMIN_GROUPS: AdminGroup[] = [
  {
    id: 'today', label: 'Vandaag', icon: Inbox,
    tabs: [{ id: 'today', label: 'Vandaag', description: 'Alles wat op je wacht, op volgorde van deadline' }],
  },
  {
    id: 'queues', label: 'Wachtrijen', icon: ListChecks,
    tabs: [
      { id: 'claims', label: 'Claims', description: 'Restaurant claims verwerken', badge: 'claims' },
      { id: 'dish-approval', label: 'Gerechten', description: 'Voorgestelde gerechten screenen en goedkeuren', badge: 'dishes', backlog: true },
      { id: 'reviews', label: 'Reviews', description: 'Reviews modereren', badge: 'reviews' },
      { id: 'support', label: 'Support', description: 'Escalaties van de AI-klantenservice', badge: 'support' },
      { id: 'contact', label: 'Contact', description: 'Vragen, meldingen en klachten van eigenaren en bezoekers', badge: 'contact' },
      { id: 'edits', label: 'Wijzigingen', description: 'Naam- en beschrijvingswijzigingen die de automatische controle niet goedkeurde', badge: 'edits' },
      { id: 'tag-requests', label: 'Tags', description: 'Door eigenaren aangevraagde keuken-, sfeer- of conceptlabels', badge: 'tagRequests' },
      { id: 'event-releases', label: 'Evenementen', description: 'Specials en evenementen van eigenaren vrijgeven', badge: 'eventReleases' },
      { id: 'optouts', label: 'Afmeldingen', description: 'Opt-out- en aanpasverzoeken van restaurants', badge: 'optouts' },
      { id: 'suggestions', label: 'Suggesties', description: 'Door bezoekers ingediende restaurants', badge: 'suggestions' },
      { id: 'discovery', label: 'Discovery', description: 'Nieuwe restaurants uit de Google Places scan beoordelen', badge: 'discovery', backlog: true },
      { id: 'manual-review', label: 'Nakijken', description: 'Restaurants gemarkeerd om handmatig te controleren', badge: 'manualReview', backlog: true },
    ],
  },
  {
    id: 'restaurants', label: 'Restaurants', icon: Store,
    tabs: [
      { id: 'restaurants', label: 'Alle restaurants', description: 'Zoeken, filteren en openen' },
      { id: 'chains', label: 'Ketens', description: 'Restaurant ketens beheren' },
      { id: 'bulk-actions', label: 'Bulk-acties', description: 'Massale status-updates' },
      { id: 'bulk-import', label: 'Import', description: 'Restaurants importeren uit CSV' },
    ],
  },
  {
    id: 'quality', label: 'Datakwaliteit', icon: ShieldCheck,
    tabs: [
      { id: 'completeness', label: 'Volledigheid', description: 'Datakwaliteit per restaurant' },
      { id: 'audit', label: 'Audit', description: 'Restaurantgegevens controleren' },
      { id: 'empty-dishes', label: 'Zonder gerechten', description: 'Restaurants zonder gerechten' },
      { id: 'menu-scraper', label: 'Menu scraper', description: 'Gerechten van websites scrapen' },
      { id: 'manual-menu', label: 'Handmatig menu', description: 'Foto of PDF uploaden waar scrapen niet werkt' },
      { id: 'duplicates', label: 'Duplicaten', description: 'Dubbele restaurants samenvoegen' },
      { id: 'missing-website', label: 'Zonder website', description: 'Website-URL aanvullen via Google Places' },
      { id: 'link-health', label: 'Dode links', description: 'Controleer of restaurant-websites nog werken' },
      { id: 'broken-images', label: 'Kapotte foto’s', description: 'Kapotte afbeeldingen opsporen' },
      { id: 'photos', label: 'Foto’s ophalen', description: 'Google-foto’s ophalen' },
      { id: 'geocode', label: 'Coördinaten', description: 'Coördinaten toekennen' },
      { id: 'google-enrich', label: 'Google verrijking', description: 'Ratings en openingstijden importeren' },
      { id: 'reservation-detect', label: 'Reserveringslinks', description: 'TheFork, Zenchef en OpenTable links vinden op websites' },
      { id: 'ai-classify', label: 'AI-classificatie', description: 'Keuken, sfeer en concept via AI' },
      { id: 'seo-health', label: 'SEO-problemen', description: 'SEO-problemen monitoren' },
    ],
  },
  {
    id: 'content', label: 'Content en SEO', icon: FileText,
    tabs: [
      { id: 'dishes', label: 'Gerechten', description: 'Gerecht-taxonomie beheren' },
      { id: 'restaurant-dishes', label: 'Bekend om', description: 'Restaurant-gerecht koppelingen' },
      { id: 'cities', label: 'Steden', description: 'Steden en regio’s beheren' },
      { id: 'collections', label: 'Collecties', description: 'Samengestelde restaurantcollecties' },
      { id: 'seo', label: 'SEO-pagina’s', description: 'Gerecht × stad landingspagina’s en uitgelichte gerechten' },
    ],
  },
  {
    id: 'growth', label: 'Groei en mail', icon: Mail,
    tabs: [
      { id: 'outreach', label: 'Outreach', description: 'Mailgolf naar eigenaren, antwoorden en claim-opvolging', badge: 'outreachReplies' },
      { id: 'restaurant-mail', label: 'Mail restaurants', description: 'Vrije mail aan een selectie restaurants' },
      { id: 'upgrade-reviews', label: 'Review-verzoeken', description: 'Eigenaren vragen om reviews te verzamelen' },
      { id: 'reservation-outreach', label: 'Reserveringslink-mail', description: 'Mail eigenaren zonder reserveringslink' },
      { id: 'newsletter', label: 'Nieuwsbrief', description: 'Edities en plaatsingen' },
      { id: 'notifications', label: 'Notificaties', description: 'E-mail notificatie wachtrij' },
      { id: 'presale', label: 'Presale', description: 'Presale-doelgroep van voor de launch' },
    ],
  },
  {
    id: 'revenue', label: 'Omzet', icon: Crown,
    tabs: [
      { id: 'package-orders', label: 'Overzicht', description: 'Uitgelicht, Owner Pro, Menuservice en evenementen', badge: 'menuService' },
      { id: 'featured-slots', label: 'Uitgelicht-plekken', description: 'Plekken per pagina en sfeer-pricing' },
      { id: 'sponsored', label: 'Sponsored', description: 'Gesponsorde producten beheren' },
      { id: 'revenue', label: 'Oude producten', description: 'Featured spots, gesponsorde gerechten en nieuwsbrief' },
    ],
  },
  {
    id: 'insights', label: 'Inzichten', icon: TrendingUp,
    tabs: [
      { id: 'kpi', label: 'KPI’s', description: 'Platformgroei en kerncijfers' },
      { id: 'search-analytics', label: 'Zoeken', description: 'Populaire zoekopdrachten, zonder resultaat en klikken' },
      { id: 'claim-analytics', label: 'Claim-funnel', description: 'Claim funnel en conversie' },
      { id: 'geographic', label: 'Dekking', description: 'Restaurantdichtheid per stad' },
      { id: 'users', label: 'Gebruikers', description: 'Geregistreerde gebruikers' },
      { id: 'user-insights', label: 'Gebruikersgedrag', description: 'Gebruikersactiviteit en retentie' },
      { id: 'churn', label: 'Verlooprisico', description: 'Inactieve eigenaren en retentie' },
    ],
  },
  {
    id: 'system', label: 'Systeem', icon: Settings,
    tabs: [
      { id: 'settings', label: 'Instellingen', description: 'Platformconfiguratie, waaronder de launchdatum' },
      { id: 'roles', label: 'Rollen', description: 'Gebruikersrollen toewijzen' },
      { id: 'audit-trail', label: 'Logboek', description: 'Alle admin-acties' },
      { id: 'error-logs', label: 'Fouten', description: 'Frontend crashes en errors van gebruikers' },
      { id: 'rate-limits', label: 'API-bescherming', description: 'Rate limits, kill-switch en AI/API-gebruik' },
      { id: 'data-export', label: 'Export', description: 'Data exporteren als CSV' },
    ],
  },
];

/** Old section ids that were merged into another tab; old links keep working. */
const SECTION_ALIASES: Record<string, string> = {
  'dish-screening': 'dish-approval',
  'search-log': 'search-analytics',
  activity: 'audit-trail',
};

const TAB_INDEX = new Map<string, { group: AdminGroup; tab: AdminTab }>();
for (const group of ADMIN_GROUPS) for (const tab of group.tabs) TAB_INDEX.set(tab.id, { group, tab });

/**
 * Resolve a section id, an old alias or a group id (its first tab) to its group
 * and tab; unknown ids fall back to Vandaag.
 */
export function resolveSection(section: string | null | undefined) {
  const id = section ? SECTION_ALIASES[section] ?? section : 'today';
  const hit = TAB_INDEX.get(id);
  if (hit) return hit;
  const group = ADMIN_GROUPS.find((g) => g.id === id);
  if (group) return { group, tab: group.tabs[0] };
  return TAB_INDEX.get('today')!;
}

/** Red sidebar count: items people are waiting on, without standing backlogs. */
export function groupBadgeTotal(group: AdminGroup, badges: AdminBadges) {
  return group.tabs.reduce((sum, t) => sum + (t.badge && !t.backlog ? badges[t.badge] : 0), 0);
}
