import { Clock, CheckCircle2, XCircle, Phone, Navigation } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';

interface OpeningHoursDisplayProps {
  openingHours: { [key: string]: string | string[] };
  phone?: string | null;
  geoLat?: number | null;
  geoLng?: number | null;
  restaurantName?: string;
  className?: string;
}

// Day keys in correct order starting from Monday
const DAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

// Mapping from day keys to i18n keys
const DAY_I18N_KEYS: { [key: string]: string } = {
  mon: 'openingHours.monday',
  tue: 'openingHours.tuesday',
  wed: 'openingHours.wednesday',
  thu: 'openingHours.thursday',
  fri: 'openingHours.friday',
  sat: 'openingHours.saturday',
  sun: 'openingHours.sunday',
};

// Mapping from Dutch/English day names to keys (for Google weekday_text format)
const DAY_NAME_TO_KEY: { [key: string]: string } = {
  'maandag': 'mon', 'monday': 'mon',
  'dinsdag': 'tue', 'tuesday': 'tue',
  'woensdag': 'wed', 'wednesday': 'wed',
  'donderdag': 'thu', 'thursday': 'thu',
  'vrijdag': 'fri', 'friday': 'fri',
  'zaterdag': 'sat', 'saturday': 'sat',
  'zondag': 'sun', 'sunday': 'sun',
};

// Parse Google weekday_text format: ["maandag: 12:00–22:00", "dinsdag: Gesloten", ...]
function parseWeekdayText(weekdayText: string[]): { [key: string]: string } {
  const result: { [key: string]: string } = {};
  
  for (const line of weekdayText) {
    // Split on first colon
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;
    
    const dayName = line.substring(0, colonIndex).toLowerCase().trim();
    let hours = line.substring(colonIndex + 1).trim();
    
    const dayKey = DAY_NAME_TO_KEY[dayName];
    if (!dayKey) continue;
    
    // Normalize hours format
    hours = hours
      .replace(/–/g, ' - ')  // Replace en-dash with spaced hyphen
      .replace(/-/g, ' - ')  // Normalize regular hyphen
      .replace(/\s+/g, ' ')  // Collapse multiple spaces
      .trim();
    
    // Handle closed variants
    if (hours.toLowerCase().includes('gesloten') || hours.toLowerCase().includes('closed')) {
      result[dayKey] = 'closed';
    } else {
      result[dayKey] = hours;
    }
  }
  
  return result;
}

// Normalize opening hours from various formats to consistent format
function normalizeOpeningHours(openingHours: { [key: string]: string | string[] }): { [key: string]: string } {
  // Check if it's in Google weekday_text format
  if (openingHours.weekday_text && Array.isArray(openingHours.weekday_text)) {
    return parseWeekdayText(openingHours.weekday_text as string[]);
  }

  // Accept English short keys (mon/tue/…) and Dutch/English full day names
  // (maandag, dinsdag, monday, tuesday, …) as object keys.
  const result: { [key: string]: string } = {};
  for (const rawKey of Object.keys(openingHours)) {
    const value = openingHours[rawKey];
    if (typeof value !== 'string') continue;
    const lower = rawKey.toLowerCase().trim();
    const dayKey = (DAY_ORDER as readonly string[]).includes(lower)
      ? lower
      : DAY_NAME_TO_KEY[lower];
    if (!dayKey) continue;
    const normalized = value
      .replace(/–/g, ' - ')
      .replace(/-/g, ' - ')
      .replace(/\s+/g, ' ')
      .trim();
    if (normalized.toLowerCase().includes('gesloten') || normalized.toLowerCase().includes('closed')) {
      result[dayKey] = 'closed';
    } else {
      result[dayKey] = normalized;
    }
  }
  return result;
}

export function OpeningHoursDisplay({ openingHours: rawOpeningHours, phone, geoLat, geoLng, restaurantName, className }: OpeningHoursDisplayProps) {
  const { t } = useTranslation();
  const now = new Date();
  
  // Normalize opening hours from various formats
  const openingHours = normalizeOpeningHours(rawOpeningHours);
  
  // Generate Google Maps directions URL
  const getDirectionsUrl = () => {
    if (!geoLat || !geoLng) return null;
    const destination = `${geoLat},${geoLng}`;
    const label = restaurantName ? encodeURIComponent(restaurantName) : '';
    return `https://www.google.com/maps/dir/?api=1&destination=${destination}&destination_place_id=${label}`;
  };
  
  const currentDayIndex = now.getDay();
  const currentDayKey = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][currentDayIndex];
  
  const isCurrentlyOpen = (hours: string): boolean => {
    if (!hours || hours === 'closed') return false;
    
    // Try to parse hours like "12:00 - 22:00" or "12:00-22:00"
    const match = hours.match(/(\d{1,2}):?(\d{2})?\s*[-–]\s*(\d{1,2}):?(\d{2})?/);
    if (!match) return true; // If can't parse, assume open
    
    const openHour = parseInt(match[1]);
    const openMin = parseInt(match[2] || '0');
    const closeHour = parseInt(match[3]);
    const closeMin = parseInt(match[4] || '0');
    
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const openMinutes = openHour * 60 + openMin;
    const closeMinutes = closeHour * 60 + closeMin;
    
    return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
  };

  const formatHours = (hours: string): string => {
    if (!hours || hours === 'closed') return t('openingHours.closed');
    return hours;
  };

  // Get sorted entries based on DAY_ORDER
  const sortedDays = DAY_ORDER.map(day => ({
    key: day,
    label: t(DAY_I18N_KEYS[day]),
    hours: openingHours[day] || 'closed',
    isToday: day === currentDayKey,
    isOpen: day === currentDayKey && isCurrentlyOpen(openingHours[day])
  }));

  const todayInfo = sortedDays.find(d => d.isToday);
  const todayHours = todayInfo ? formatHours(todayInfo.hours) : t('openingHours.unknown');
  const isOpen = todayInfo?.isOpen || false;

  // Desktop view - full list
  const DesktopView = () => (
    <div className={cn("hidden md:block p-5 rounded-2xl border border-border bg-card", className)}>
      <h3 className="font-semibold mb-4 flex items-center gap-2">
        <Clock className="h-4 w-4 text-primary" />
        {t('openingHours.title')}
      </h3>
      
      <div className="space-y-0">
        {sortedDays.map(({ key, label, hours, isToday, isOpen: dayIsOpen }) => {
          const isClosed = hours === 'closed' || !hours;
          
          return (
            <div 
              key={key} 
              className={cn(
                "flex items-center justify-between py-2.5 border-b border-border/50 last:border-0",
                isToday && "bg-primary/5 -mx-3 px-3 rounded-lg border-0"
              )}
            >
              <div className="flex items-center gap-2">
                {isToday && (
                  dayIsOpen ? (
                    <CheckCircle2 className="h-4 w-4 text-tag-family" />
                  ) : (
                    <XCircle className="h-4 w-4 text-muted-foreground" />
                  )
                )}
                <span className={cn(
                  "text-sm",
                  isToday ? "font-semibold text-foreground" : "text-muted-foreground"
                )}>
                  {label}
                  {isToday && <span className="ml-1.5 text-xs text-primary">({t('openingHours.today')})</span>}
                </span>
              </div>
              
              <span className={cn(
                "text-sm font-medium",
                isClosed && "text-muted-foreground",
                isToday && dayIsOpen && "text-tag-family",
                isToday && !dayIsOpen && isClosed && "text-destructive"
              )}>
                {formatHours(hours)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );

  // Mobile view - accordion with call button
  const MobileView = () => (
    <div className={cn("md:hidden", className)}>
      <div className="flex gap-2 min-w-0">
        {/* Opening hours accordion */}
        <Accordion type="single" collapsible className="flex-1 min-w-0 overflow-hidden">
          <AccordionItem value="opening-hours" className="border border-border rounded-2xl bg-card overflow-hidden">
            <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50 [&[data-state=open]>svg]:rotate-180">
              <div className="flex items-center justify-between w-full pr-2 min-w-0">
                <div className="flex items-center gap-2 shrink-0">
                  <Clock className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-sm">{t('openingHours.title')}</span>
                </div>
                <div className="flex items-center gap-1.5 ml-2 min-w-0">
                  {isOpen ? (
                    <span className="text-xs font-medium text-tag-family bg-tag-family/10 px-2 py-0.5 rounded-full whitespace-nowrap">
                      {t('openingHours.openNow')}
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-destructive bg-destructive/10 px-2 py-0.5 rounded-full whitespace-nowrap">
                      {t('openingHours.closed')}
                    </span>
                  )}
                  {todayInfo?.hours && todayInfo.hours !== 'closed' && (
                    <span className="text-xs text-muted-foreground truncate max-w-[80px]">{todayHours}</span>
                  )}
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-0">
              <div className="px-4 pb-4 space-y-0">
                {sortedDays.map(({ key, label, hours, isToday, isOpen: dayIsOpen }) => {
                  const isClosed = hours === 'closed' || !hours;
                  
                  return (
                    <div 
                      key={key} 
                      className={cn(
                        "flex items-center justify-between py-2.5 border-b border-border/50 last:border-0",
                        isToday && "bg-primary/5 -mx-2 px-2 rounded-lg border-0"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        {isToday && (
                          dayIsOpen ? (
                            <CheckCircle2 className="h-4 w-4 text-tag-family" />
                          ) : (
                            <XCircle className="h-4 w-4 text-muted-foreground" />
                          )
                        )}
                        <span className={cn(
                          "text-sm",
                          isToday ? "font-semibold text-foreground" : "text-muted-foreground"
                        )}>
                          {label}
                          {isToday && <span className="ml-1 text-xs text-primary">({t('openingHours.today')})</span>}
                        </span>
                      </div>
                      
                      <span className={cn(
                        "text-sm font-medium",
                        isClosed && "text-muted-foreground",
                        isToday && dayIsOpen && "text-tag-family",
                        isToday && !dayIsOpen && isClosed && "text-destructive"
                      )}>
                        {formatHours(hours)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Action buttons - call and directions on mobile */}
        {(phone || (geoLat && geoLng)) && (
          <div className="flex flex-col gap-2 flex-shrink-0">
            {phone && (
              <Button
                asChild
                className="h-auto rounded-2xl px-4 py-3"
              >
                <a href={`tel:${phone}`} className="flex flex-col items-center gap-1">
                  <Phone className="h-5 w-5" />
                  <span className="text-xs font-medium">{t('openingHours.callNow')}</span>
                </a>
              </Button>
            )}
            {geoLat && geoLng && (
              <Button
                asChild
                variant="outline"
                className="h-auto rounded-2xl px-4 py-3"
              >
                <a 
                  href={getDirectionsUrl()!} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex flex-col items-center gap-1"
                >
                  <Navigation className="h-5 w-5" />
                  <span className="text-xs font-medium">{t('openingHours.route')}</span>
                </a>
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <DesktopView />
      <MobileView />
    </>
  );
}
