// Mock data for Dishloopr MVP

export interface City {
  id: string;
  name: string;
  slug: string;
  countryCode: string;
  isActive: boolean;
}

export interface Dish {
  id: string;
  name: string;
  slug: string;
  synonyms: string[];
  cuisineTags: string[];
  isActive: boolean;
  searchCount: number;
}

export interface Restaurant {
  id: string;
  name: string;
  slug: string;
  cityId: string;
  address: string;
  postalCode: string;
  geoLat: number;
  geoLng: number;
  priceLevel: 1 | 2 | 3 | 4;
  cuisines: string[];
  ambienceTags: string[];
  dishes: { dishId: string; confidenceScore: number }[];
  phone: string;
  websiteUrl: string;
  reservationUrl?: string;
  openingHours: { [key: string]: string };
  images: string[];
  rating: number;
  reviewCount: number;
  isFeatured: boolean;
  featuredUntil?: string;
  isTopListing: boolean;
  topUntil?: string;
  claimedByOwnerId?: string;
}

export interface Review {
  id: string;
  restaurantId: string;
  userId: string;
  userName: string;
  rating: number;
  title: string;
  body: string;
  photos: string[];
  tagVotes: { [tag: string]: boolean | null };
  suggestedTags: string[];
  createdAt: string;
  status: 'published' | 'pending' | 'flagged';
}

// Cities
export const cities: City[] = [
  { id: 'ams', name: 'Amsterdam', slug: 'amsterdam', countryCode: 'NL', isActive: true },
  { id: 'rtd', name: 'Rotterdam', slug: 'rotterdam', countryCode: 'NL', isActive: true },
];

// Dishes
export const dishes: Dish[] = [
  { id: 'd1', name: 'Sushi', slug: 'sushi', synonyms: ['sashimi', 'maki', 'nigiri'], cuisineTags: ['japanese'], isActive: true, searchCount: 1520 },
  { id: 'd2', name: 'Ramen', slug: 'ramen', synonyms: ['noodle soup', 'japanese noodles'], cuisineTags: ['japanese'], isActive: true, searchCount: 980 },
  { id: 'd3', name: 'Pizza', slug: 'pizza', synonyms: ['pizzas', 'italian pizza'], cuisineTags: ['italian'], isActive: true, searchCount: 1850 },
  { id: 'd4', name: 'Pasta', slug: 'pasta', synonyms: ['spaghetti', 'penne', 'tagliatelle'], cuisineTags: ['italian'], isActive: true, searchCount: 1200 },
  { id: 'd5', name: 'Biefstuk', slug: 'biefstuk', synonyms: ['steak', 'beef steak', 'entrecote'], cuisineTags: ['french', 'american'], isActive: true, searchCount: 890 },
  { id: 'd6', name: 'Burger', slug: 'burger', synonyms: ['hamburger', 'cheeseburger'], cuisineTags: ['american'], isActive: true, searchCount: 1650 },
  { id: 'd7', name: 'Tacos', slug: 'tacos', synonyms: ['taco', 'mexican tacos'], cuisineTags: ['mexican'], isActive: true, searchCount: 720 },
  { id: 'd8', name: 'Pad Thai', slug: 'pad-thai', synonyms: ['thai noodles', 'pad thai noodles'], cuisineTags: ['thai'], isActive: true, searchCount: 560 },
  { id: 'd9', name: 'Dim Sum', slug: 'dim-sum', synonyms: ['dumplings', 'chinese dumplings'], cuisineTags: ['chinese'], isActive: true, searchCount: 480 },
  { id: 'd10', name: 'Paella', slug: 'paella', synonyms: ['spanish rice', 'seafood paella'], cuisineTags: ['spanish'], isActive: true, searchCount: 340 },
  { id: 'd11', name: 'Pho', slug: 'pho', synonyms: ['vietnamese soup', 'beef pho'], cuisineTags: ['vietnamese'], isActive: true, searchCount: 620 },
  { id: 'd12', name: 'Curry', slug: 'curry', synonyms: ['indian curry', 'tikka masala'], cuisineTags: ['indian'], isActive: true, searchCount: 780 },
  { id: 'd13', name: 'Croquetten', slug: 'croquetten', synonyms: ['kroket', 'bitterballen'], cuisineTags: ['dutch'], isActive: true, searchCount: 450 },
  { id: 'd14', name: 'Seafood', slug: 'seafood', synonyms: ['fish', 'lobster', 'oysters', 'mussels'], cuisineTags: ['french', 'mediterranean'], isActive: true, searchCount: 680 },
  { id: 'd15', name: 'Risotto', slug: 'risotto', synonyms: ['italian rice', 'arborio'], cuisineTags: ['italian'], isActive: true, searchCount: 390 },
];

// Cuisine types
export const cuisineTypes = [
  'japanese', 'italian', 'french', 'american', 'mexican', 'thai', 'chinese', 
  'spanish', 'vietnamese', 'indian', 'dutch', 'mediterranean', 'korean', 'greek'
];

// Ambience tags
export const ambienceTags = [
  'romantic', 'family-friendly', 'high-end', 'cozy', 'business', 'trendy', 'casual', 'lively'
];

// Restaurant images (placeholder URLs - will be replaced with actual images)
const restaurantImages = [
  'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800',
  'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800',
  'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800',
  'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800',
  'https://images.unsplash.com/photo-1537047902294-62a40c20a6ae?w=800',
  'https://images.unsplash.com/photo-1552566626-52f8b828add9?w=800',
];

// Restaurants
export const restaurants: Restaurant[] = [
  {
    id: 'r1',
    name: 'Omakase Amsterdam',
    slug: 'omakase-amsterdam',
    cityId: 'ams',
    address: 'Reguliersdwarsstraat 45',
    postalCode: '1017 BK',
    geoLat: 52.3667,
    geoLng: 4.8945,
    priceLevel: 4,
    cuisines: ['japanese'],
    ambienceTags: ['high-end', 'romantic'],
    dishes: [
      { dishId: 'd1', confidenceScore: 0.98 },
      { dishId: 'd2', confidenceScore: 0.75 },
    ],
    phone: '+31 20 123 4567',
    websiteUrl: 'https://omakase-amsterdam.nl',
    reservationUrl: 'https://omakase-amsterdam.nl/reserveren',
    openingHours: { mon: '17:00-23:00', tue: '17:00-23:00', wed: '17:00-23:00', thu: '17:00-23:00', fri: '17:00-00:00', sat: '17:00-00:00', sun: 'closed' },
    images: [restaurantImages[0], restaurantImages[1]],
    rating: 4.8,
    reviewCount: 234,
    isFeatured: true,
    featuredUntil: '2026-03-01',
    isTopListing: false,
  },
  {
    id: 'r2',
    name: 'La Piazza Centrale',
    slug: 'la-piazza-centrale',
    cityId: 'ams',
    address: 'Leidseplein 12',
    postalCode: '1017 PT',
    geoLat: 52.3636,
    geoLng: 4.8828,
    priceLevel: 2,
    cuisines: ['italian'],
    ambienceTags: ['family-friendly', 'cozy', 'lively'],
    dishes: [
      { dishId: 'd3', confidenceScore: 0.95 },
      { dishId: 'd4', confidenceScore: 0.92 },
      { dishId: 'd15', confidenceScore: 0.85 },
    ],
    phone: '+31 20 234 5678',
    websiteUrl: 'https://lapiazza.nl',
    openingHours: { mon: '12:00-22:00', tue: '12:00-22:00', wed: '12:00-22:00', thu: '12:00-22:00', fri: '12:00-23:00', sat: '12:00-23:00', sun: '12:00-21:00' },
    images: [restaurantImages[2], restaurantImages[3]],
    rating: 4.3,
    reviewCount: 567,
    isFeatured: false,
    isTopListing: true,
    topUntil: '2026-02-15',
  },
  {
    id: 'r3',
    name: 'The Butcher Social Club',
    slug: 'the-butcher-social-club',
    cityId: 'ams',
    address: 'Albert Cuypstraat 129',
    postalCode: '1072 CS',
    geoLat: 52.3553,
    geoLng: 4.8950,
    priceLevel: 2,
    cuisines: ['american'],
    ambienceTags: ['trendy', 'casual', 'lively'],
    dishes: [
      { dishId: 'd6', confidenceScore: 0.99 },
      { dishId: 'd5', confidenceScore: 0.70 },
    ],
    phone: '+31 20 345 6789',
    websiteUrl: 'https://the-butcher.com',
    openingHours: { mon: '12:00-22:00', tue: '12:00-22:00', wed: '12:00-22:00', thu: '12:00-22:00', fri: '12:00-23:00', sat: '12:00-23:00', sun: '12:00-22:00' },
    images: [restaurantImages[4], restaurantImages[5]],
    rating: 4.5,
    reviewCount: 892,
    isFeatured: false,
    isTopListing: false,
  },
  {
    id: 'r4',
    name: 'Takumi Ramen',
    slug: 'takumi-ramen',
    cityId: 'ams',
    address: 'Zeedijk 67',
    postalCode: '1012 AS',
    geoLat: 52.3752,
    geoLng: 4.9012,
    priceLevel: 2,
    cuisines: ['japanese'],
    ambienceTags: ['casual', 'cozy'],
    dishes: [
      { dishId: 'd2', confidenceScore: 0.98 },
    ],
    phone: '+31 20 456 7890',
    websiteUrl: 'https://takumi.nl',
    openingHours: { mon: '12:00-21:30', tue: '12:00-21:30', wed: '12:00-21:30', thu: '12:00-21:30', fri: '12:00-22:00', sat: '12:00-22:00', sun: '12:00-21:00' },
    images: [restaurantImages[0], restaurantImages[2]],
    rating: 4.6,
    reviewCount: 1243,
    isFeatured: false,
    isTopListing: false,
  },
  {
    id: 'r5',
    name: 'Restaurant Bougainville',
    slug: 'restaurant-bougainville',
    cityId: 'ams',
    address: 'Herenstraat 28',
    postalCode: '1015 CB',
    geoLat: 52.3780,
    geoLng: 4.8820,
    priceLevel: 4,
    cuisines: ['french', 'mediterranean'],
    ambienceTags: ['high-end', 'romantic', 'business'],
    dishes: [
      { dishId: 'd5', confidenceScore: 0.90 },
      { dishId: 'd14', confidenceScore: 0.88 },
    ],
    phone: '+31 20 567 8901',
    websiteUrl: 'https://bougainville.nl',
    reservationUrl: 'https://bougainville.nl/reserveren',
    openingHours: { mon: 'closed', tue: '18:00-23:00', wed: '18:00-23:00', thu: '18:00-23:00', fri: '18:00-00:00', sat: '18:00-00:00', sun: 'closed' },
    images: [restaurantImages[3], restaurantImages[1]],
    rating: 4.7,
    reviewCount: 189,
    isFeatured: true,
    featuredUntil: '2026-02-28',
    isTopListing: false,
  },
  {
    id: 'r6',
    name: 'Fenix Food Factory',
    slug: 'fenix-food-factory',
    cityId: 'rtd',
    address: 'Veerlaan 19D',
    postalCode: '3072 AN',
    geoLat: 51.9045,
    geoLng: 4.4853,
    priceLevel: 2,
    cuisines: ['dutch', 'international'],
    ambienceTags: ['casual', 'family-friendly', 'trendy'],
    dishes: [
      { dishId: 'd13', confidenceScore: 0.85 },
      { dishId: 'd6', confidenceScore: 0.75 },
    ],
    phone: '+31 10 123 4567',
    websiteUrl: 'https://fenixfoodfactory.nl',
    openingHours: { mon: '10:00-18:00', tue: '10:00-18:00', wed: '10:00-18:00', thu: '10:00-18:00', fri: '10:00-21:00', sat: '10:00-21:00', sun: '10:00-18:00' },
    images: [restaurantImages[4], restaurantImages[5]],
    rating: 4.4,
    reviewCount: 678,
    isFeatured: false,
    isTopListing: false,
  },
  {
    id: 'r7',
    name: 'FG Restaurant',
    slug: 'fg-restaurant',
    cityId: 'rtd',
    address: 'Katshoek 37',
    postalCode: '3012 CL',
    geoLat: 51.9225,
    geoLng: 4.4792,
    priceLevel: 4,
    cuisines: ['french'],
    ambienceTags: ['high-end', 'romantic'],
    dishes: [
      { dishId: 'd5', confidenceScore: 0.95 },
      { dishId: 'd14', confidenceScore: 0.90 },
    ],
    phone: '+31 10 234 5678',
    websiteUrl: 'https://fgrestaurant.nl',
    reservationUrl: 'https://fgrestaurant.nl/reserveren',
    openingHours: { mon: 'closed', tue: '18:30-22:00', wed: '18:30-22:00', thu: '18:30-22:00', fri: '18:30-22:30', sat: '18:30-22:30', sun: 'closed' },
    images: [restaurantImages[1], restaurantImages[3]],
    rating: 4.9,
    reviewCount: 156,
    isFeatured: true,
    featuredUntil: '2026-03-15',
    isTopListing: true,
    topUntil: '2026-03-15',
  },
  {
    id: 'r8',
    name: 'Héroine',
    slug: 'heroine-rotterdam',
    cityId: 'rtd',
    address: 'Schiedamsevest 91',
    postalCode: '3012 BG',
    geoLat: 51.9194,
    geoLng: 4.4745,
    priceLevel: 3,
    cuisines: ['french', 'mediterranean'],
    ambienceTags: ['romantic', 'trendy', 'cozy'],
    dishes: [
      { dishId: 'd5', confidenceScore: 0.88 },
      { dishId: 'd15', confidenceScore: 0.82 },
    ],
    phone: '+31 10 345 6789',
    websiteUrl: 'https://heroine-rotterdam.nl',
    openingHours: { mon: '17:30-22:00', tue: '17:30-22:00', wed: '17:30-22:00', thu: '17:30-22:00', fri: '17:30-23:00', sat: '17:30-23:00', sun: 'closed' },
    images: [restaurantImages[2], restaurantImages[0]],
    rating: 4.6,
    reviewCount: 312,
    isFeatured: false,
    isTopListing: false,
  },
  {
    id: 'r9',
    name: 'Sumo Rotterdam',
    slug: 'sumo-rotterdam',
    cityId: 'rtd',
    address: 'Coolsingel 40',
    postalCode: '3011 AD',
    geoLat: 51.9244,
    geoLng: 4.4777,
    priceLevel: 3,
    cuisines: ['japanese'],
    ambienceTags: ['trendy', 'business'],
    dishes: [
      { dishId: 'd1', confidenceScore: 0.95 },
      { dishId: 'd2', confidenceScore: 0.80 },
    ],
    phone: '+31 10 456 7890',
    websiteUrl: 'https://sumo.nl/rotterdam',
    openingHours: { mon: '12:00-22:00', tue: '12:00-22:00', wed: '12:00-22:00', thu: '12:00-22:00', fri: '12:00-23:00', sat: '12:00-23:00', sun: '13:00-22:00' },
    images: [restaurantImages[5], restaurantImages[4]],
    rating: 4.2,
    reviewCount: 445,
    isFeatured: false,
    isTopListing: false,
  },
  {
    id: 'r10',
    name: 'Taqueria Los Pilones',
    slug: 'taqueria-los-pilones',
    cityId: 'ams',
    address: 'Gérard Doustraat 80',
    postalCode: '1072 VX',
    geoLat: 52.3541,
    geoLng: 4.8920,
    priceLevel: 1,
    cuisines: ['mexican'],
    ambienceTags: ['casual', 'lively', 'cozy'],
    dishes: [
      { dishId: 'd7', confidenceScore: 0.98 },
    ],
    phone: '+31 20 678 9012',
    websiteUrl: 'https://lospilones.nl',
    openingHours: { mon: '12:00-22:00', tue: '12:00-22:00', wed: '12:00-22:00', thu: '12:00-22:00', fri: '12:00-23:00', sat: '12:00-23:00', sun: '12:00-21:00' },
    images: [restaurantImages[3], restaurantImages[2]],
    rating: 4.4,
    reviewCount: 789,
    isFeatured: false,
    isTopListing: false,
  },
  {
    id: 'r11',
    name: 'Blue Pepper',
    slug: 'blue-pepper',
    cityId: 'ams',
    address: 'Nassaukade 366',
    postalCode: '1054 AB',
    geoLat: 52.3678,
    geoLng: 4.8721,
    priceLevel: 3,
    cuisines: ['indonesian'],
    ambienceTags: ['romantic', 'high-end'],
    dishes: [
      { dishId: 'd12', confidenceScore: 0.85 },
    ],
    phone: '+31 20 789 0123',
    websiteUrl: 'https://bluepepper.nl',
    reservationUrl: 'https://bluepepper.nl/reserveren',
    openingHours: { mon: 'closed', tue: '18:00-22:00', wed: '18:00-22:00', thu: '18:00-22:00', fri: '18:00-23:00', sat: '18:00-23:00', sun: '18:00-22:00' },
    images: [restaurantImages[1], restaurantImages[5]],
    rating: 4.5,
    reviewCount: 423,
    isFeatured: false,
    isTopListing: false,
  },
  {
    id: 'r12',
    name: 'District V',
    slug: 'district-v',
    cityId: 'ams',
    address: 'Haarlemmerdijk 66',
    postalCode: '1013 JE',
    geoLat: 52.3811,
    geoLng: 4.8875,
    priceLevel: 2,
    cuisines: ['vietnamese'],
    ambienceTags: ['casual', 'trendy', 'cozy'],
    dishes: [
      { dishId: 'd11', confidenceScore: 0.95 },
      { dishId: 'd8', confidenceScore: 0.70 },
    ],
    phone: '+31 20 890 1234',
    websiteUrl: 'https://districtv.nl',
    openingHours: { mon: '17:00-22:00', tue: '17:00-22:00', wed: '17:00-22:00', thu: '17:00-22:00', fri: '17:00-23:00', sat: '12:00-23:00', sun: '12:00-22:00' },
    images: [restaurantImages[0], restaurantImages[4]],
    rating: 4.3,
    reviewCount: 534,
    isFeatured: false,
    isTopListing: false,
  },
];

// Sample reviews
export const reviews: Review[] = [
  {
    id: 'rev1',
    restaurantId: 'r1',
    userId: 'u1',
    userName: 'Marco V.',
    rating: 5,
    title: 'Beste sushi van Amsterdam!',
    body: 'Ongelooflijk verse vis en perfecte rijst. De omakase was een culinaire reis door Japan. Absoluut het geld waard.',
    photos: [],
    tagVotes: { 'high-end': true, 'romantic': true },
    suggestedTags: [],
    createdAt: '2025-12-15T19:30:00Z',
    status: 'published',
  },
  {
    id: 'rev2',
    restaurantId: 'r1',
    userId: 'u2',
    userName: 'Sophie L.',
    rating: 5,
    title: 'Perfecte date night',
    body: 'De sfeer is intiem en elegant. Elk gerecht was een kunstwerk. De service was discreet maar attent.',
    photos: [],
    tagVotes: { 'high-end': true, 'romantic': true },
    suggestedTags: [],
    createdAt: '2025-12-10T20:00:00Z',
    status: 'published',
  },
  {
    id: 'rev3',
    restaurantId: 'r2',
    userId: 'u3',
    userName: 'Familie de Jong',
    rating: 4,
    title: 'Heerlijke pizza voor het hele gezin',
    body: 'De kinderen waren dol op de pizza. Authentiek Italiaans en grote porties. Wel wat druk op vrijdagavond.',
    photos: [],
    tagVotes: { 'family-friendly': true, 'cozy': true },
    suggestedTags: ['lively'],
    createdAt: '2025-12-08T18:45:00Z',
    status: 'published',
  },
  {
    id: 'rev4',
    restaurantId: 'r3',
    userId: 'u4',
    userName: 'Tom B.',
    rating: 5,
    title: 'Beste burger ooit!',
    body: 'The Aberdeen Angus burger is to die for. Sappig vlees, perfect gebakken. De frietjes zijn ook top.',
    photos: [],
    tagVotes: { 'trendy': true, 'casual': true },
    suggestedTags: [],
    createdAt: '2025-12-05T13:20:00Z',
    status: 'published',
  },
];

// Helper functions
export function getRestaurantsByCity(cityId: string): Restaurant[] {
  return restaurants.filter(r => r.cityId === cityId);
}

export function getRestaurantBySlug(slug: string): Restaurant | undefined {
  return restaurants.find(r => r.slug === slug);
}

export function getDishBySlug(slug: string): Dish | undefined {
  return dishes.find(d => d.slug === slug);
}

export function searchRestaurants(
  query: string,
  cityId?: string,
  filters?: {
    priceLevel?: number[];
    ambienceTags?: string[];
    cuisines?: string[];
  }
): Restaurant[] {
  let results = [...restaurants];

  // Filter by city
  if (cityId && cityId !== 'all') {
    results = results.filter(r => r.cityId === cityId);
  }

  // Filter by dish query
  if (query) {
    const queryLower = query.toLowerCase();
    const matchingDishIds = dishes
      .filter(d => 
        d.name.toLowerCase().includes(queryLower) ||
        d.synonyms.some(s => s.toLowerCase().includes(queryLower))
      )
      .map(d => d.id);

    results = results.filter(r =>
      r.dishes.some(rd => matchingDishIds.includes(rd.dishId))
    );

    // Sort by dish confidence score
    results.sort((a, b) => {
      const aScore = Math.max(...a.dishes.filter(d => matchingDishIds.includes(d.dishId)).map(d => d.confidenceScore), 0);
      const bScore = Math.max(...b.dishes.filter(d => matchingDishIds.includes(d.dishId)).map(d => d.confidenceScore), 0);
      return bScore - aScore;
    });
  }

  // Apply filters
  if (filters) {
    if (filters.priceLevel && filters.priceLevel.length > 0) {
      results = results.filter(r => filters.priceLevel!.includes(r.priceLevel));
    }
    if (filters.ambienceTags && filters.ambienceTags.length > 0) {
      results = results.filter(r =>
        filters.ambienceTags!.some(tag => r.ambienceTags.includes(tag))
      );
    }
    if (filters.cuisines && filters.cuisines.length > 0) {
      results = results.filter(r =>
        filters.cuisines!.some(c => r.cuisines.includes(c))
      );
    }
  }

  // Boost featured and top listings
  results.sort((a, b) => {
    if (a.isTopListing && !b.isTopListing) return -1;
    if (!a.isTopListing && b.isTopListing) return 1;
    if (a.isFeatured && !b.isFeatured) return -1;
    if (!a.isFeatured && b.isFeatured) return 1;
    return b.rating - a.rating;
  });

  return results;
}

export function getTrendingDishes(cityId?: string): Dish[] {
  const cityRestaurants = cityId && cityId !== 'all' 
    ? restaurants.filter(r => r.cityId === cityId)
    : restaurants;
  
  const dishCounts = new Map<string, number>();
  cityRestaurants.forEach(r => {
    r.dishes.forEach(d => {
      dishCounts.set(d.dishId, (dishCounts.get(d.dishId) || 0) + 1);
    });
  });

  return dishes
    .filter(d => dishCounts.has(d.id))
    .sort((a, b) => b.searchCount - a.searchCount)
    .slice(0, 8);
}

export function getReviewsForRestaurant(restaurantId: string): Review[] {
  return reviews.filter(r => r.restaurantId === restaurantId);
}
