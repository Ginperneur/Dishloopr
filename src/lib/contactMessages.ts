// Contact messages from the /contact page and the owner dashboard ("Hulp en contact").

export const CONTACT_CATEGORIES = [
  { id: 'vraag', label: 'Vraag' },
  { id: 'probleem', label: 'Probleem op de site' },
  { id: 'klacht', label: 'Klacht' },
  { id: 'betaling', label: 'Betaling of factuur' },
  { id: 'gegevens', label: 'Gegevens aanpassen of verwijderen' },
  { id: 'anders', label: 'Anders' },
] as const;

export const CONTACT_STATUS_LABEL: Record<string, string> = {
  nieuw: 'Ontvangen',
  in_behandeling: 'In behandeling',
  afgehandeld: 'Afgehandeld',
};

export interface ContactMessage {
  id: string;
  name?: string;
  email?: string;
  subject: string;
  message: string;
  category: string | null;
  status: string;
  restaurant_id: string | null;
  user_id?: string | null;
  admin_notes?: string | null;
  handled_at?: string | null;
  created_at: string;
}
