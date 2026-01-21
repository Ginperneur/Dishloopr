import { Clock, CheckCircle2, XCircle, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

interface OpeningHoursDisplayProps {
  openingHours: { [key: string]: string };
  className?: string;
}

// Dutch day names in correct order starting from Monday
const DAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DAY_LABELS: { [key: string]: string } = {
  mon: 'Maandag',
  tue: 'Dinsdag',
  wed: 'Woensdag',
  thu: 'Donderdag',
  fri: 'Vrijdag',
  sat: 'Zaterdag',
  sun: 'Zondag',
};

export function OpeningHoursDisplay({ openingHours, className }: OpeningHoursDisplayProps) {
  const now = new Date();
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
    if (!hours || hours === 'closed') return 'Gesloten';
    return hours;
  };

  // Get sorted entries based on DAY_ORDER
  const sortedDays = DAY_ORDER.map(day => ({
    key: day,
    label: DAY_LABELS[day],
    hours: openingHours[day] || 'closed',
    isToday: day === currentDayKey,
    isOpen: day === currentDayKey && isCurrentlyOpen(openingHours[day])
  }));

  const todayInfo = sortedDays.find(d => d.isToday);
  const todayHours = todayInfo ? formatHours(todayInfo.hours) : 'Onbekend';
  const isOpen = todayInfo?.isOpen || false;

  // Desktop view - full list
  const DesktopView = () => (
    <div className={cn("hidden md:block p-5 rounded-2xl border border-border bg-card", className)}>
      <h3 className="font-semibold mb-4 flex items-center gap-2">
        <Clock className="h-4 w-4 text-primary" />
        Openingstijden
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
                  {isToday && <span className="ml-1.5 text-xs text-primary">(vandaag)</span>}
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

  // Mobile view - accordion
  const MobileView = () => (
    <div className={cn("md:hidden", className)}>
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="opening-hours" className="border border-border rounded-2xl bg-card overflow-hidden">
          <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50 [&[data-state=open]>svg]:rotate-180">
            <div className="flex items-center justify-between w-full pr-2">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                <span className="font-semibold text-sm">Openingstijden</span>
              </div>
              <div className="flex items-center gap-2">
                {isOpen ? (
                  <span className="text-xs font-medium text-tag-family bg-tag-family/10 px-2 py-0.5 rounded-full">
                    Nu open
                  </span>
                ) : (
                  <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    Gesloten
                  </span>
                )}
                <span className="text-sm text-muted-foreground">{todayHours}</span>
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
                        {isToday && <span className="ml-1 text-xs text-primary">(vandaag)</span>}
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
    </div>
  );

  return (
    <>
      <DesktopView />
      <MobileView />
    </>
  );
}
