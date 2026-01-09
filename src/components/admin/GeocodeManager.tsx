import { useState, useEffect } from "react";
import { MapPin, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface MissingCoordsRestaurant {
  id: string;
  name: string;
  address: string;
  cities: { name: string } | null;
}

interface GeocodeResult {
  id: string;
  name: string;
  status: string;
  lat?: number;
  lng?: number;
}

export function GeocodeManager() {
  const [missingCoords, setMissingCoords] = useState<MissingCoordsRestaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodingSingle, setGeocodingSingle] = useState<string | null>(null);
  const [lastResults, setLastResults] = useState<GeocodeResult[]>([]);

  useEffect(() => {
    fetchMissingCoords();
  }, []);

  const fetchMissingCoords = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("restaurants")
      .select("id, name, address, cities(name)")
      .or("geo_lat.is.null,geo_lng.is.null")
      .eq("is_active", true)
      .order("name");

    if (error) {
      console.error("Error fetching restaurants:", error);
      toast.error("Kon restaurants niet ophalen");
    } else {
      setMissingCoords(data || []);
    }
    setLoading(false);
  };

  const geocodeAll = async () => {
    if (missingCoords.length === 0) {
      toast.info("Alle restaurants hebben al coördinaten!");
      return;
    }

    setGeocoding(true);
    setLastResults([]);

    try {
      const { data, error } = await supabase.functions.invoke("geocode-restaurants", {
        body: { all: true },
      });

      if (error) throw error;

      setLastResults(data.results || []);
      toast.success(`${data.success} van ${data.processed} restaurants gegeocoded`);

      // Refresh the list
      await fetchMissingCoords();
    } catch (err: any) {
      console.error("Geocode error:", err);
      toast.error(err.message || "Geocoding mislukt");
    } finally {
      setGeocoding(false);
    }
  };

  const geocodeSingle = async (restaurantId: string) => {
    setGeocodingSingle(restaurantId);

    try {
      const { data, error } = await supabase.functions.invoke("geocode-restaurants", {
        body: { restaurantId },
      });

      if (error) throw error;

      const result = data.results?.[0];
      if (result?.status === "success") {
        toast.success(`${result.name} gegeocoded: ${result.lat?.toFixed(5)}, ${result.lng?.toFixed(5)}`);
        // Remove from list
        setMissingCoords((prev) => prev.filter((r) => r.id !== restaurantId));
      } else {
        toast.error(`Geocoding mislukt: ${result?.status || "onbekende fout"}`);
      }
    } catch (err: any) {
      console.error("Geocode error:", err);
      toast.error(err.message || "Geocoding mislukt");
    } finally {
      setGeocodingSingle(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Geocoding Manager
              </CardTitle>
              <CardDescription>
                Vul automatisch ontbrekende coördinaten in voor restaurants
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchMissingCoords} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Vernieuwen
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg mb-4">
            <div className="flex items-center gap-3">
              {missingCoords.length === 0 ? (
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              ) : (
                <AlertCircle className="h-8 w-8 text-orange-500" />
              )}
              <div>
                <p className="font-semibold text-lg">
                  {missingCoords.length === 0
                    ? "Alle restaurants hebben coördinaten!"
                    : `${missingCoords.length} restaurant(s) zonder coördinaten`}
                </p>
                <p className="text-sm text-muted-foreground">
                  {missingCoords.length === 0
                    ? "Je kaart toont alle markers correct."
                    : "Deze restaurants worden niet op de kaart getoond."}
                </p>
              </div>
            </div>
            {missingCoords.length > 0 && (
              <Button onClick={geocodeAll} disabled={geocoding}>
                {geocoding ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Bezig...
                  </>
                ) : (
                  <>
                    <MapPin className="h-4 w-4 mr-2" />
                    Alles geocoden
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Restaurants without coordinates */}
          {missingCoords.length > 0 && (
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Restaurant</TableHead>
                    <TableHead>Adres</TableHead>
                    <TableHead>Stad</TableHead>
                    <TableHead className="text-right">Actie</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {missingCoords.map((restaurant) => (
                    <TableRow key={restaurant.id}>
                      <TableCell className="font-medium">{restaurant.name}</TableCell>
                      <TableCell className="text-muted-foreground">{restaurant.address}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{restaurant.cities?.name || "-"}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => geocodeSingle(restaurant.id)}
                          disabled={geocodingSingle === restaurant.id || geocoding}
                        >
                          {geocodingSingle === restaurant.id ? (
                            <RefreshCw className="h-3 w-3 animate-spin" />
                          ) : (
                            <MapPin className="h-3 w-3" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Last Results */}
      {lastResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Laatste resultaten</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              <div className="space-y-2">
                {lastResults.map((result) => (
                  <div
                    key={result.id}
                    className={`flex items-center justify-between p-2 rounded text-sm ${
                      result.status === "success" ? "bg-green-50 dark:bg-green-950" : "bg-red-50 dark:bg-red-950"
                    }`}
                  >
                    <span className="font-medium">{result.name}</span>
                    <div className="flex items-center gap-2">
                      {result.status === "success" ? (
                        <>
                          <span className="text-muted-foreground">
                            {result.lat?.toFixed(5)}, {result.lng?.toFixed(5)}
                          </span>
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        </>
                      ) : (
                        <>
                          <span className="text-red-600 text-xs">{result.status}</span>
                          <AlertCircle className="h-4 w-4 text-red-500" />
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
