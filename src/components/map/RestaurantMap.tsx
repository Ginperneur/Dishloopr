import { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

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
  const center: [number, number] = userLocation
    ? [userLocation.lat, userLocation.lng]
    : mappableRestaurants.length
      ? [
          mappableRestaurants.reduce((sum, r) => sum + (r.geo_lat as number), 0) / mappableRestaurants.length,
          mappableRestaurants.reduce((sum, r) => sum + (r.geo_lng as number), 0) / mappableRestaurants.length,
        ]
      : defaultCenter;

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

    map.setView(center, 13);

    const layer = L.layerGroup().addTo(map);
    mapRef.current = map;
    layerRef.current = layer;

    const invalidate = () => map.invalidateSize();
    const t = window.setTimeout(invalidate, 80);
    window.addEventListener('resize', invalidate);
    window.addEventListener('orientationchange', invalidate);

    return () => {
      window.clearTimeout(t);
      window.removeEventListener('resize', invalidate);
      window.removeEventListener('orientationchange', invalidate);
      layer.clearLayers();
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update markers + view
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    // Keep view aligned with latest center
    map.setView(center, 13, { animate: false });

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
      root.style.minWidth = '200px';

      if (restaurant.images?.[0]) {
        const img = document.createElement('img');
        img.src = restaurant.images[0];
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
        navigate(`/restaurant/${restaurant.slug}`);
      });
      root.appendChild(btn);

      marker.bindPopup(root, { closeButton: true, autoPan: true });
      marker.addTo(layer);
    });
  }, [center, mappableRestaurants, navigate, userLocation]);

  return (
    <div className={`relative rounded-xl overflow-hidden ${className}`}>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-[1000] inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-secondary text-secondary-foreground shadow-lg"
          aria-label="Sluit kaart"
        >
          ✕
        </button>
      )}
      <div ref={containerRef} style={{ height: '100%', width: '100%', minHeight: '400px' }} />
    </div>
  );
}
