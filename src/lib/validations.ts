import { z } from 'zod';

// Review validation schema
export const reviewSchema = z.object({
  rating: z.number().int().min(1, 'Minimaal 1 ster').max(5, 'Maximaal 5 sterren'),
  title: z.string().trim().min(1, 'Titel is verplicht').max(200, 'Titel mag maximaal 200 tekens zijn'),
  body: z.string().trim().min(10, 'Review moet minimaal 10 tekens bevatten').max(5000, 'Review mag maximaal 5000 tekens zijn'),
  photos: z.array(z.string().url('Ongeldige foto URL')).max(10, 'Maximaal 10 foto\'s').optional(),
  dishRatings: z.array(z.object({
    dishId: z.string().uuid(),
    rating: z.number().int().min(1).max(5)
  })).optional()
});

export type ReviewInput = z.infer<typeof reviewSchema>;

// Profile validation schema
export const profileSchema = z.object({
  name: z.string().trim().max(100, 'Naam mag maximaal 100 tekens zijn').optional(),
  bio: z.string().trim().max(500, 'Bio mag maximaal 500 tekens zijn').optional(),
  preferred_language: z.enum(['nl', 'en', 'de', 'es', 'fr']).optional()
});

export type ProfileInput = z.infer<typeof profileSchema>;

// Restaurant validation schema (for admin)
export const restaurantSchema = z.object({
  name: z.string().trim().min(1, 'Naam is verplicht').max(200, 'Naam mag maximaal 200 tekens zijn'),
  slug: z.string().trim().min(1).max(200).regex(/^[a-z0-9-]+$/, 'Slug mag alleen kleine letters, cijfers en streepjes bevatten'),
  address: z.string().trim().min(1, 'Adres is verplicht').max(500, 'Adres mag maximaal 500 tekens zijn'),
  postal_code: z.string().trim().max(20, 'Postcode mag maximaal 20 tekens zijn').regex(/^[0-9]{4}\s?[A-Za-z]{2}$/, 'Ongeldige postcode').optional().or(z.literal('')),
  city_id: z.string().uuid('Ongeldige stad'),
  phone: z.string().trim().max(30, 'Telefoonnummer mag maximaal 30 tekens zijn').optional().or(z.literal('')),
  website_url: z.string().trim().url('Ongeldige website URL').max(500).optional().or(z.literal('')),
  price_level: z.coerce.number().int().min(1).max(4)
});

export type RestaurantInput = z.infer<typeof restaurantSchema>;

// Contact form validation
export const contactSchema = z.object({
  name: z.string().trim().min(2, 'Naam is te kort').max(100, 'Naam mag maximaal 100 tekens zijn'),
  email: z.string().trim().email('Ongeldig e-mailadres').max(255, 'E-mail te lang'),
  subject: z.string().trim().min(2, 'Onderwerp is te kort').max(200, 'Onderwerp mag maximaal 200 tekens zijn'),
  message: z.string().trim().min(10, 'Bericht moet minimaal 10 tekens zijn').max(5000, 'Bericht mag maximaal 5000 tekens zijn'),
  // Honeypot: must be empty. Bots fill all fields.
  website: z.string().max(0, 'Spam gedetecteerd').optional().or(z.literal('')),
});

export type ContactInput = z.infer<typeof contactSchema>;

// Validation result type
export type ValidationResult<T> = 
  | { success: true; data: T; errors?: never } 
  | { success: false; data?: never; errors: string[] };

// Helper function to safely validate and return errors
export function validateWithErrors<T>(schema: z.ZodSchema<T>, data: unknown): ValidationResult<T> {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const errors = result.error.errors.map(e => e.message);
  return { success: false, errors };
}
