import { useEffect } from 'react';

interface SEOHeadProps {
  title: string;
  description: string;
  canonical?: string;
  ogType?: 'website' | 'article' | 'restaurant' | 'product';
  ogImage?: string;
  ogImageAlt?: string;
  twitterCard?: 'summary' | 'summary_large_image';
  keywords?: string[];
  author?: string;
  publishedTime?: string;
  modifiedTime?: string;
  noindex?: boolean;
  structuredData?: object;
}

export function SEOHead({
  title,
  description,
  canonical,
  ogType = 'website',
  ogImage = '/og-image.jpg',
  ogImageAlt,
  twitterCard = 'summary_large_image',
  keywords = [],
  author = 'Dishloopr',
  publishedTime,
  modifiedTime,
  noindex = false,
  structuredData,
}: SEOHeadProps) {
  const fullTitle = title.includes('Dishloopr') ? title : `${title} | Dishloopr`;
  const siteUrl = typeof window !== 'undefined' ? window.location.origin : 'https://dishloopr.com';
  const currentUrl = typeof window !== 'undefined' ? window.location.href : siteUrl;
  const canonicalUrl = canonical || currentUrl;
  const fullOgImage = ogImage.startsWith('http') ? ogImage : `${siteUrl}${ogImage}`;

  useEffect(() => {
    // Update document title
    document.title = fullTitle;

    // hreflang tags for multilingual support
    const supportedLangs = ['nl', 'en', 'de', 'fr', 'es'];
    const existingHreflangs = document.querySelectorAll('link[hreflang]');
    existingHreflangs.forEach(el => el.remove());
    
    supportedLangs.forEach(lang => {
      const link = document.createElement('link');
      link.setAttribute('rel', 'alternate');
      link.setAttribute('hreflang', lang);
      link.setAttribute('href', `${canonicalUrl}${canonicalUrl.includes('?') ? '&' : '?'}lang=${lang}`);
      document.head.appendChild(link);
    });
    // x-default hreflang
    const xDefault = document.createElement('link');
    xDefault.setAttribute('rel', 'alternate');
    xDefault.setAttribute('hreflang', 'x-default');
    xDefault.setAttribute('href', canonicalUrl);
    document.head.appendChild(xDefault);
    // Helper to update or create meta tag
    const updateMeta = (property: string, content: string, isName = false) => {
      const attr = isName ? 'name' : 'property';
      let meta = document.querySelector(`meta[${attr}="${property}"]`);
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute(attr, property);
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', content);
    };

    // Basic meta tags
    updateMeta('description', description, true);
    if (keywords.length > 0) {
      updateMeta('keywords', keywords.join(', '), true);
    }
    updateMeta('author', author, true);
    
    // Robots
    if (noindex) {
      updateMeta('robots', 'noindex, nofollow', true);
    } else {
      updateMeta('robots', 'index, follow, max-image-preview:large', true);
    }

    // Open Graph
    updateMeta('og:title', fullTitle);
    updateMeta('og:description', description);
    updateMeta('og:type', ogType);
    updateMeta('og:url', canonicalUrl);
    updateMeta('og:image', fullOgImage);
    updateMeta('og:image:width', '1200');
    updateMeta('og:image:height', '630');
    if (ogImageAlt) {
      updateMeta('og:image:alt', ogImageAlt);
    }
    updateMeta('og:site_name', 'Dishloopr');
    updateMeta('og:locale', 'nl_NL');

    // Twitter Card
    updateMeta('twitter:card', twitterCard, true);
    updateMeta('twitter:title', fullTitle, true);
    updateMeta('twitter:description', description, true);
    updateMeta('twitter:image', fullOgImage, true);
    if (ogImageAlt) {
      updateMeta('twitter:image:alt', ogImageAlt, true);
    }

    // Article specific
    if (publishedTime) {
      updateMeta('article:published_time', publishedTime);
    }
    if (modifiedTime) {
      updateMeta('article:modified_time', modifiedTime);
    }

    // Canonical link
    let link = document.querySelector('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      document.head.appendChild(link);
    }
    link.setAttribute('href', canonicalUrl);

    // Structured data
    if (structuredData) {
      let script = document.querySelector('script[data-seo-structured]');
      if (!script) {
        script = document.createElement('script');
        script.setAttribute('type', 'application/ld+json');
        script.setAttribute('data-seo-structured', 'true');
        document.head.appendChild(script);
      }
      script.textContent = JSON.stringify(structuredData);
    }

    // Cleanup function
    return () => {
      const structuredScript = document.querySelector('script[data-seo-structured]');
      if (structuredScript) {
        structuredScript.remove();
      }
      const hreflangs = document.querySelectorAll('link[hreflang]');
      hreflangs.forEach(el => el.remove());
    };
  }, [fullTitle, description, canonicalUrl, ogType, fullOgImage, ogImageAlt, twitterCard, keywords, author, publishedTime, modifiedTime, noindex, structuredData]);

  return null;
}

// Helper functions for structured data
export function createRestaurantSchema(restaurant: {
  name: string;
  description?: string;
  image?: string;
  address: string;
  city: string;
  postalCode?: string;
  phone?: string;
  website?: string;
  cuisines?: string[];
  priceRange?: string;
  rating?: number;
  reviewCount?: number;
  geo?: { lat: number; lng: number };
  openingHours?: { [key: string]: string };
  slug?: string;
}) {
  const dayMap: { [key: string]: string } = {
    mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday',
    thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday',
  };

  const openingHoursSpec = restaurant.openingHours
    ? Object.entries(restaurant.openingHours)
        .filter(([, hours]) => hours && hours !== 'closed')
        .map(([day, hours]) => {
          const match = hours.match(/(\d{1,2}):?(\d{2})?\s*[-–]\s*(\d{1,2}):?(\d{2})?/);
          if (!match) return null;
          return {
            '@type': 'OpeningHoursSpecification',
            dayOfWeek: dayMap[day] || day,
            opens: `${match[1].padStart(2, '0')}:${match[2] || '00'}`,
            closes: `${match[3].padStart(2, '0')}:${match[4] || '00'}`,
          };
        })
        .filter(Boolean)
    : undefined;

  return {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    name: restaurant.name,
    description: restaurant.description,
    image: restaurant.image,
    url: `https://dishloopr.com/restaurant/${restaurant.slug}`,
    address: {
      '@type': 'PostalAddress',
      streetAddress: restaurant.address,
      addressLocality: restaurant.city,
      postalCode: restaurant.postalCode,
      addressCountry: 'NL',
    },
    telephone: restaurant.phone,
    sameAs: restaurant.website ? [restaurant.website] : undefined,
    servesCuisine: restaurant.cuisines,
    priceRange: restaurant.priceRange,
    aggregateRating: restaurant.rating && restaurant.reviewCount && restaurant.reviewCount > 0 ? {
      '@type': 'AggregateRating',
      ratingValue: restaurant.rating,
      reviewCount: restaurant.reviewCount,
      bestRating: 5,
      worstRating: 1,
    } : undefined,
    geo: restaurant.geo ? {
      '@type': 'GeoCoordinates',
      latitude: restaurant.geo.lat,
      longitude: restaurant.geo.lng,
    } : undefined,
    openingHoursSpecification: openingHoursSpec,
  };
}

export function createBreadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function createFAQSchema(faqs: { question: string; answer: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

export function createWebsiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Dishloopr',
    url: 'https://dishloopr.com',
    description: 'Ontdek de beste restaurants en gerechten in Nederland',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: 'https://dishloopr.com/search?q={search_term_string}',
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

export function createItemListSchema(items: { name: string; url: string; image?: string; position: number }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: items.map(item => ({
      '@type': 'ListItem',
      position: item.position,
      name: item.name,
      url: item.url,
      ...(item.image ? { image: item.image } : {}),
    })),
  };
}

export function createLocalBusinessSchema(business: {
  name: string;
  description: string;
  image: string;
  telephone?: string;
  address: {
    street: string;
    city: string;
    postalCode: string;
  };
  geo?: { lat: number; lng: number };
  openingHours?: string[];
  priceRange?: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: business.name,
    description: business.description,
    image: business.image,
    telephone: business.telephone,
    address: {
      '@type': 'PostalAddress',
      streetAddress: business.address.street,
      addressLocality: business.address.city,
      postalCode: business.address.postalCode,
      addressCountry: 'NL',
    },
    geo: business.geo ? {
      '@type': 'GeoCoordinates',
      latitude: business.geo.lat,
      longitude: business.geo.lng,
    } : undefined,
    openingHoursSpecification: business.openingHours,
    priceRange: business.priceRange,
  };
}
