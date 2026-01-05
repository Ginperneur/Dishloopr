import { Navigation, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGeolocation } from '@/hooks/useGeolocation';
import { toast } from 'sonner';

interface NearbyButtonProps {
  onLocationFound: (lat: number, lng: number) => void;
  className?: string;
}

export function NearbyButton({ onLocationFound, className }: NearbyButtonProps) {
  const { latitude, longitude, loading, error, requestLocation } = useGeolocation();

  const handleClick = () => {
    if (latitude && longitude) {
      onLocationFound(latitude, longitude);
    } else {
      requestLocation();
    }
  };

  // When location is found, call the callback
  if (latitude && longitude && !loading) {
    // Trigger once when coordinates become available
    setTimeout(() => onLocationFound(latitude, longitude), 0);
  }

  if (error) {
    toast.error(error);
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={loading}
      className={className}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <Navigation className="h-4 w-4 mr-2" />
      )}
      Bij mij in de buurt
    </Button>
  );
}
