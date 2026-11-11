import { useState, useCallback } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { isNativeApp } from '@/lib/native';

/** Native app: use the OS location permission flow instead of the WebView prompt. */
async function requestNativeLocation(): Promise<{ latitude: number; longitude: number }> {
  let perm = await Geolocation.checkPermissions();
  if (perm.location === 'prompt' || perm.location === 'prompt-with-rationale') {
    perm = await Geolocation.requestPermissions({ permissions: ['location', 'coarseLocation'] });
  }
  if (perm.location === 'denied' && perm.coarseLocation !== 'granted') {
    throw new Error('Locatietoegang geweigerd. Sta locatie toe in Instellingen > Dishloopr.');
  }
  try {
    const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
    return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
  } catch {
    throw new Error('Kon je locatie niet bepalen, probeer opnieuw');
  }
}

interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  error: string | null;
  loading: boolean;
}

interface UseGeolocationReturn extends GeolocationState {
  requestLocation: () => void;
  clearLocation: () => void;
}

export function useGeolocation(): UseGeolocationReturn {
  const [state, setState] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    error: null,
    loading: false,
  });

  const requestLocation = useCallback(() => {
    if (isNativeApp()) {
      setState(prev => ({ ...prev, loading: true, error: null }));
      requestNativeLocation()
        .then(({ latitude, longitude }) => setState({ latitude, longitude, error: null, loading: false }))
        .catch((err: Error) => setState({ latitude: null, longitude: null, error: err.message, loading: false }));
      return;
    }

    if (!navigator.geolocation) {
      setState(prev => ({
        ...prev,
        error: 'Geolocation is not supported by your browser',
        loading: false,
      }));
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    const onSuccess = (position: GeolocationPosition) => {
      setState({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        error: null,
        loading: false,
      });
    };
    const onFinalError = (error: GeolocationPositionError) => {
      let errorMessage = 'Kon je locatie niet bepalen';
      switch (error.code) {
        case error.PERMISSION_DENIED:
          errorMessage = 'Locatietoegang geweigerd. Sta locatie toe in je browserinstellingen.';
          break;
        case error.POSITION_UNAVAILABLE:
          errorMessage = 'Locatie niet beschikbaar';
          break;
        case error.TIMEOUT:
          errorMessage = 'Locatie ophalen duurde te lang, probeer opnieuw';
          break;
      }
      setState({ latitude: null, longitude: null, error: errorMessage, loading: false });
    };

    // Fast, low-accuracy attempt first (works on desktop/wifi); fall back to GPS.
    navigator.geolocation.getCurrentPosition(
      onSuccess,
      (err) => {
        if (err.code === err.PERMISSION_DENIED) return onFinalError(err);
        navigator.geolocation.getCurrentPosition(onSuccess, onFinalError, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 300000,
        });
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    );
  }, []);

  const clearLocation = useCallback(() => {
    setState({
      latitude: null,
      longitude: null,
      error: null,
      loading: false,
    });
  }, []);

  return {
    ...state,
    requestLocation,
    clearLocation,
  };
}

// Calculate distance between two points in km
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}
