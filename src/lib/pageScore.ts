// One score for an owner's restaurant page, replacing the four separate meters the dashboard
// used to show (onboarding steps, profile completeness, optimization score, visibility).
// Each task names the dashboard section that fixes it, so the to-do list can link there.
import { hasOpeningHoursData } from './openingHours.ts';
import type { OwnerTab } from './ownerTabs.ts';

export interface PageScoreInput {
  isVerified: boolean;
  description?: string | null;
  images?: string[] | null;
  openingHours?: unknown;
  phone?: string | null;
  websiteUrl?: string | null;
  instagramUrl?: string | null;
  tiktokUrl?: string | null;
  approvedDishes: number;
  suggestedDishes: number;
  menuMinimum: number;
  unansweredReviews: number;
}

export interface PageTask {
  id: string;
  label: string;
  hint: string;
  done: boolean;
  tab: OwnerTab | 'verify';
}

export function pageTasks(i: PageScoreInput): PageTask[] {
  const photos = i.images?.length ?? 0;
  const dishesLeft = Math.max(0, i.menuMinimum - i.approvedDishes);
  return [
    { id: 'verify', label: 'Verifieer dat je de eigenaar bent', hint: 'Daarna kun je alles op je pagina zelf aanpassen', done: i.isVerified, tab: 'verify' },
    {
      id: 'dishes',
      label: dishesLeft > 0 ? `Voeg nog ${dishesLeft} ${dishesLeft === 1 ? 'gerecht' : 'gerechten'} toe` : 'Minimaal ' + i.menuMinimum + ' gerechten op je menu',
      hint: 'Gasten vinden je via je gerechten',
      done: dishesLeft === 0,
      tab: 'menu',
    },
    {
      id: 'suggested',
      label: `Bevestig ${i.suggestedDishes} voorgestelde ${i.suggestedDishes === 1 ? 'gerecht' : 'gerechten'}`,
      hint: 'Wij vonden ze op je menukaart of website',
      done: i.suggestedDishes === 0,
      tab: 'menu',
    },
    {
      id: 'photos',
      label: photos >= 3 ? "Minimaal 3 foto's" : `Voeg nog ${3 - photos} ${3 - photos === 1 ? 'foto' : "foto's"} toe`,
      hint: "Pagina's met 3 of meer foto's worden vaker aangeklikt",
      done: photos >= 3,
      tab: 'profile',
    },
    { id: 'hours', label: 'Vul je openingstijden in', hint: 'Dan zien gasten of je nu open bent', done: hasOpeningHoursData(i.openingHours), tab: 'profile' },
    { id: 'contact', label: 'Vul je telefoonnummer en website in', hint: 'Zo kunnen gasten je bellen of je site bekijken', done: !!i.phone?.trim() && !!i.websiteUrl?.trim(), tab: 'profile' },
    {
      id: 'description',
      label: 'Schrijf een korte beschrijving',
      hint: 'Minimaal een paar zinnen over je keuken',
      done: (i.description?.trim().length ?? 0) > 30,
      tab: 'profile',
    },
    { id: 'social', label: 'Koppel Instagram of TikTok', hint: 'Gasten volgen je direct vanaf je pagina', done: !!(i.instagramUrl?.trim() || i.tiktokUrl?.trim()), tab: 'profile' },
    {
      id: 'reviews',
      label: `Beantwoord ${i.unansweredReviews} ${i.unansweredReviews === 1 ? 'review' : 'reviews'}`,
      hint: 'Een reactie laat zien dat je luistert',
      done: i.unansweredReviews === 0,
      tab: 'reviews',
    },
  ];
}

export function pageScore(tasks: PageTask[]): number {
  if (!tasks.length) return 0;
  return Math.round((tasks.filter(t => t.done).length / tasks.length) * 100);
}
