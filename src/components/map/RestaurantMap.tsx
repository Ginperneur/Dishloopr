import { logSearchClick } from '@/lib/searchLog';
import { useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { optimizedImage } from '@/lib/imageUrl';
import { metricContext } from '@/lib/metricRules';
import { sendAnalyticsEvent } from '@/lib/cookieConsent';

// Fix Leaflet default marker icons (bundlers sometimes break URL resolution)
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface Restaurant {
  id: string;
  name: string;
  slug: string;
  address: string;
  rating: number;
  review_count: number;
  geo_lat: number | null;
  geo_lng: number | null;
  is_featured: boolean;
  is_top_listing: boolean;
  images?: string[] | null;
  price_level: number;
}

interface RestaurantMapProps {
  restaurants: Restaurant[];
  userLocation?: { lat: number; lng: number } | null;
  onClose?: () => void;
  className?: string;
}

const priceLabels: Record<number, string> = {
  1: '€',
  2: '€€',
  3: '€€€',
  4: '€€€€',
};

function createRestaurantIcon(isFeatured: boolean) {
  const bg = isFeatured ? 'hsl(var(--primary))' : 'hsl(var(--secondary))';
  const fg = isFeatured ? 'hsl(var(--primary-foreground))' : 'hsl(var(--secondary-foreground))';

  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="width:32px;height:32px;border-radius:9999px;background:${bg};border:2px solid rgba(255,255,255,0.95);display:flex;align-items:center;justify-content:center;box-shadow:0 10px 18px rgba(0,0,0,0.25);">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${fg}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
          <circle cx="12" cy="10" r="3"></circle>
        </svg>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -28],
  });
}

function createUserIcon() {
  return L.divIcon({
    className: 'user-location-marker',
    html: `
      <div style="width:14px;height:14px;border-radius:9999px;background:hsl(var(--primary));border:2px solid rgba(255,255,255,0.95);box-shadow:0 10px 18px rgba(0,0,0,0.25);"></div>
    `,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    popupAnchor: [0, -10],
  });
}

export function RestaurantMap({ restaurants, userLocation, onClose, className = '' }: RestaurantMapProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const searchOrigin = location.pathname === '/search' ? `${location.pathname}${location.search}${location.hash}` : undefined;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const didInitialFitRef = useRef(false);
  const lastUserKeyRef = useRef<string | null>(null);

  const mappableRestaurants = useMemo(
    () =>
      restaurants.filter(
        (r) =>
          typeof r.geo_lat === 'number' &&
          typeof r.geo_lng === 'number' &&
          !Number.isNaN(r.geo_lat) &&
          !Number.isNaN(r.geo_lng),
      ),
    [restaurants],
  );

  const defaultCenter: [number, number] = [52.3676, 4.9041];

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    // Initial view: user → first restaurant → default city
    const initialCenter: [number, number] = userLocation
      ? [userLocation.lat, userLocation.lng]
      : mappableRestaurants.length
        ? [mappableRestaurants[0].geo_lat as number, mappableRestaurants[0].geo_lng as number]
        : defaultCenter;
    map.setView(initialCenter, userLocation ? 14 : 13);

    const layer = L.layerGroup().addTo(map);
    mapRef.current = map;
    layerRef.current = layer;

    const invalidate = () => map.invalidateSize();
    // Multiple invalidations to catch layout shifts (sticky headers, fonts loading, etc.)
    const timers = [50, 200, 600].map((d) => window.setTimeout(invalidate, d));
    window.addEventListener('resize', invalidate);
    window.addEventListener('orientationchange', invalidate);

    // Observe container size changes (e.g. when SearchPage toggles map view)
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      ro = new ResizeObserver(() => map.invalidateSize());
      ro.observe(containerRef.current);
    }

    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      ro?.disconnect();
      window.removeEventListener('resize', invalidate);
      window.removeEventListener('orientationchange', invalidate);
      layer.clearLayers();
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update markers (do NOT force view on every render — that wedges interaction)
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    if (userLocation) {
      const userMarker = L.marker([userLocation.lat, userLocation.lng], { icon: createUserIcon() });
      userMarker.bindPopup('<div style="font-weight:600">Jouw locatie</div>');
      userMarker.addTo(layer);
    }

    mappableRestaurants.forEach((restaurant) => {
      const isFeatured = restaurant.is_featured || restaurant.is_top_listing;
      const marker = L.marker([restaurant.geo_lat as number, restaurant.geo_lng as number], {
        icon: createRestaurantIcon(isFeatured),
      });

      const root = document.createElement('div');
      root.dataset.restaurantId = restaurant.id;
      root.style.minWidth = '200px';

      if (restaurant.images?.[0]) {
        const img = document.createElement('img');
        img.src = optimizedImage(restaurant.images[0], { width: 480 });
        img.width = 240;
        img.height = 96;
        img.alt = restaurant.name;
        img.loading = 'lazy';
        img.style.width = '100%';
        img.style.height = '96px';
        img.style.objectFit = 'cover';
        img.style.borderRadius = '10px';
        img.style.marginBottom = '8px';
        root.appendChild(img);
      }

      const title = document.createElement('div');
      title.textContent = restaurant.name;
      title.style.fontWeight = '700';
      title.style.fontSize = '14px';
      title.style.marginBottom = '6px';
      root.appendChild(title);

      const meta = document.createElement('div');
      meta.textContent = `${restaurant.rating.toFixed(1)} • ${priceLabels[restaurant.price_level] ?? ''}`;
      meta.style.fontSize = '12px';
      meta.style.opacity = '0.85';
      meta.style.marginBottom = '8px';
      root.appendChild(meta);

      const addr = document.createElement('div');
      addr.textContent = restaurant.address;
      addr.style.fontSize = '12px';
      addr.style.opacity = '0.8';
      addr.style.marginBottom = '10px';
      root.appendChild(addr);

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = 'Bekijk restaurant';
      btn.style.width = '100%';
      btn.style.height = '32px';
      btn.style.borderRadius = '10px';
      btn.style.border = '1px solid hsl(var(--border))';
      btn.style.background = 'hsl(var(--primary))';
      btn.style.color = 'hsl(var(--primary-foreground))';
      btn.style.fontWeight = '600';
      btn.style.fontSize = '12px';
      btn.addEventListener('click', () => {
        logSearchClick(restaurant.id);
        sendAnalyticsEvent('select_restaurant', { restaurant_slug: restaurant.slug, position: mappableRestaurants.indexOf(restaurant) + 1, list: 'kaart' });
        navigate(`/restaurant/${restaurant.slug}`, { state: { ...(searchOrigin ? { from: searchOrigin } : {}), metricContext: metricContext(window.location.pathname, window.location.search) } });
      });
      root.appendChild(btn);

      marker.bindPopup(root, { closeButton: true, autoPan: true });
      marker.addTo(layer);
    });

    // First time we have data, fit the map to the markers (incl. user)
    if (!didInitialFitRef.current) {
      const points: L.LatLngTuple[] = mappableRestaurants.map(
        (r) => [r.geo_lat as number, r.geo_lng as number] as L.LatLngTuple,
      );
      if (userLocation) points.push([userLocation.lat, userLocation.lng]);
      if (points.length >= 2) {
        map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 15 });
        didInitialFitRef.current = true;
      } else if (points.length === 1) {
        map.setView(points[0], 14);
        didInitialFitRef.current = true;
      }
    }
  }, [mappableRestaurants, navigate, userLocation, searchOrigin]);

  // When the user's location arrives or changes, fly to it.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !userLocation) return;
    const key = `${userLocation.lat.toFixed(5)},${userLocation.lng.toFixed(5)}`;
    if (lastUserKeyRef.current === key) return;
    lastUserKeyRef.current = key;
    map.flyTo([userLocation.lat, userLocation.lng], 14, { duration: 0.8 });
  }, [userLocation]);

  return (
    <div className={`relative rounded-xl overflow-hidden h-full w-full ${className}`}>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 z-[1000] inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-lg active:scale-95 touch-manipulation"
          aria-label="Sluit kaart"
        >
          ✕
        </button>
      )}
      <div
        ref={containerRef}
        className="touch-manipulation"
        style={{ height: '100%', width: '100%', minHeight: '60vh' }}
      />
    </div>
  );
}
