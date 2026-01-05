import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Link } from 'react-router-dom';
import { Star, MapPin, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom marker icon
const createCustomIcon = (isFeatured: boolean) => {
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div class="relative">
        <div class="w-8 h-8 ${isFeatured ? 'bg-primary' : 'bg-secondary'} rounded-full flex items-center justify-center shadow-lg border-2 border-white">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
        </div>
        ${isFeatured ? '<div class="absolute -top-1 -right-1 w-3 h-3 bg-rating rounded-full border border-white"></div>' : ''}
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
};

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

function MapController({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  
  return null;
}

export function RestaurantMap({ restaurants, userLocation, onClose, className = '' }: RestaurantMapProps) {
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  
  // Filter restaurants with valid coordinates
  const mappableRestaurants = restaurants.filter(
    r => r.geo_lat && r.geo_lng && !isNaN(r.geo_lat) && !isNaN(r.geo_lng)
  );

  // Calculate center from restaurants or use default (Amsterdam)
  const defaultCenter: [number, number] = [52.3676, 4.9041];
  const center: [number, number] = userLocation 
    ? [userLocation.lat, userLocation.lng]
    : mappableRestaurants.length > 0
      ? [
          mappableRestaurants.reduce((sum, r) => sum + r.geo_lat!, 0) / mappableRestaurants.length,
          mappableRestaurants.reduce((sum, r) => sum + r.geo_lng!, 0) / mappableRestaurants.length,
        ]
      : defaultCenter;

  const priceLabels: { [key: number]: string } = {
    1: '€',
    2: '€€',
    3: '€€€',
    4: '€€€€',
  };

  return (
    <div className={`relative rounded-xl overflow-hidden ${className}`}>
      {onClose && (
        <Button
          variant="secondary"
          size="icon"
          className="absolute top-4 right-4 z-[1000] shadow-lg"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
      
      <MapContainer
        center={center}
        zoom={13}
        style={{ height: '100%', width: '100%', minHeight: '400px' }}
        className="z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <MapController center={center} zoom={13} />
        
        {/* User location marker */}
        {userLocation && (
          <Marker
            position={[userLocation.lat, userLocation.lng]}
            icon={L.divIcon({
              className: 'user-location-marker',
              html: `
                <div class="relative">
                  <div class="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg animate-pulse"></div>
                  <div class="absolute inset-0 w-4 h-4 bg-blue-500 rounded-full opacity-50 animate-ping"></div>
                </div>
              `,
              iconSize: [16, 16],
              iconAnchor: [8, 8],
            })}
          >
            <Popup>
              <span className="font-medium">Jouw locatie</span>
            </Popup>
          </Marker>
        )}
        
        {/* Restaurant markers */}
        {mappableRestaurants.map((restaurant) => (
          <Marker
            key={restaurant.id}
            position={[restaurant.geo_lat!, restaurant.geo_lng!]}
            icon={createCustomIcon(restaurant.is_featured || restaurant.is_top_listing)}
            eventHandlers={{
              click: () => setSelectedRestaurant(restaurant),
            }}
          >
            <Popup>
              <div className="min-w-[200px] p-1">
                {restaurant.images?.[0] && (
                  <img
                    src={restaurant.images[0]}
                    alt={restaurant.name}
                    className="w-full h-24 object-cover rounded-lg mb-2"
                  />
                )}
                <h3 className="font-bold text-sm mb-1">{restaurant.name}</h3>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                  <div className="flex items-center gap-0.5">
                    <Star className="h-3 w-3 fill-rating text-rating" />
                    <span>{restaurant.rating.toFixed(1)}</span>
                  </div>
                  <span>•</span>
                  <span>{priceLabels[restaurant.price_level]}</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
                  <MapPin className="h-3 w-3" />
                  <span className="line-clamp-1">{restaurant.address}</span>
                </div>
                <Link to={`/restaurant/${restaurant.slug}`}>
                  <Button size="sm" className="w-full text-xs h-7">
                    Bekijk restaurant
                  </Button>
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
