import { useState, useEffect } from "react";
import { Image, RefreshCw, AlertCircle, CheckCircle2, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface MissingPhotosRestaurant {
  id: string;
  name: string;
  address: string;
  phone: string | null;
  website_url: string | null;
  photos_fetched_at: string | null;
  cities: { name: string } | null;
}

interface FetchResult {
  id: string;
  name: string;
  status: "success" | "no_photos" | "error";
  count?: number;
  error?: string;
}

export function PhotosManager() {
  const [missingPhotos, setMissingPhotos] = useState<MissingPhotosRestaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [fetchingSingle, setFetchingSingle] = useState<string | null>(null);
  const [lastResults, setLastResults] = useState<FetchResult[]>([]);
  const [progress, setProgress] = useState(0);
  const [currentRestaurant, setCurrentRestaurant] = useState<string>("");
  const [filterMode, setFilterMode] = useState<"all" | "never">("all");

  useEffect(() => {
    fetchMissingPhotos();
  }, [filterMode]);

  const fetchMissingPhotos = async () => {
    setLoading(true);
    let query = supabase
      .from("restaurants")
      .select("id, name, address, phone, website_url, photos_fetched_at, cities(name)")
      .or("images.is.null,images.eq.{}")
      .eq("is_active", true)
      .order("name");
    if (filterMode === "never") {
      query = query.is("photos_fetched_at", null);
    }
    const { data, error } = await query;

    if (error) {
      console.error("Error fetching restaurants:", error);
      toast.error("Kon restaurants niet ophalen");
    } else {
      setMissingPhotos((data || []) as MissingPhotosRestaurant[]);
    }
    setLoading(false);
  };

  const markAttempted = async (id: string) => {
    await supabase
      .from("restaurants")
      .update({ photos_fetched_at: new Date().toISOString() })
      .eq("id", id);
  };

  const exportCsv = () => {
    if (missingPhotos.length === 0) {
      toast.info("Geen data om te exporteren");
      return;
    }
    const headers = ["name", "address", "city", "phone", "website_url", "photos_fetched_at"];
    const escape = (v: string) =>
      v.includes(",") || v.includes('"') || v.includes("\n") ? `"${v.replace(/"/g, '""')}"` : v;
    const rows = missingPhotos.map((r) =>
      [r.name, r.address || "", r.cities?.name || "", r.phone || "", r.website_url || "", r.photos_fetched_at || ""]
        .map((v) => escape(String(v)))
        .join(",")
    );
    const csv = "\uFEFF" + [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `restaurants-zonder-fotos-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`${missingPhotos.length} rijen geëxporteerd`);
  };

  const searchPlaceAndFetchPhotos = async (restaurant: MissingPhotosRestaurant): Promise<FetchResult> => {
    try {
      // First search for the place using Google Places
      const searchQuery = `${restaurant.name} ${restaurant.address}`;
      const city = restaurant.cities?.name || "";
      
      const { data: searchData, error: searchError } = await supabase.functions.invoke("google-places-search", {
        body: { query: searchQuery, city },
      });

      if (searchError) throw searchError;

      const place = searchData?.results?.[0];
      if (!place || !place.photo_references?.length) {
        await markAttempted(restaurant.id);
        return { id: restaurant.id, name: restaurant.name, status: "no_photos" };
      }

      // Now fetch the photos
      const { data: photoData, error: photoError } = await supabase.functions.invoke("fetch-google-photos", {
        body: {
          place_id: place.place_id,
          photo_references: place.photo_references,
          restaurant_id: restaurant.id,
          max_photos: 5,
        },
      });

      if (photoError) throw photoError;

      if (photoData?.count > 0) {
        return { 
          id: restaurant.id, 
          name: restaurant.name, 
          status: "success", 
          count: photoData.count 
        };
      } else {
        return { id: restaurant.id, name: restaurant.name, status: "no_photos" };
      }
    } catch (err: any) {
      console.error(`Error fetching photos for ${restaurant.name}:`, err);
      return { 
        id: restaurant.id, 
        name: restaurant.name, 
        status: "error", 
        error: err.message 
      };
    }
  };

  const fetchAllPhotos = async () => {
    if (missingPhotos.length === 0) {
      toast.info("Alle restaurants hebben al foto's!");
      return;
    }

    setFetching(true);
    setLastResults([]);
    setProgress(0);

    const results: FetchResult[] = [];
    let successCount = 0;

    for (let i = 0; i < missingPhotos.length; i++) {
      const restaurant = missingPhotos[i];
      setCurrentRestaurant(restaurant.name);
      setProgress(((i + 1) / missingPhotos.length) * 100);

      const result = await searchPlaceAndFetchPhotos(restaurant);
      results.push(result);
      
      if (result.status === "success") {
        successCount++;
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    setLastResults(results);
    toast.success(`${successCount} van ${missingPhotos.length} restaurants met foto's bijgewerkt`);
    setCurrentRestaurant("");
    setFetching(false);

    // Refresh the list
    await fetchMissingPhotos();
  };

  const fetchSinglePhotos = async (restaurant: MissingPhotosRestaurant) => {
    setFetchingSingle(restaurant.id);

    const result = await searchPlaceAndFetchPhotos(restaurant);

    if (result.status === "success") {
      toast.success(`${result.count} foto's toegevoegd voor ${restaurant.name}`);
      setMissingPhotos((prev) => prev.filter((r) => r.id !== restaurant.id));
    } else if (result.status === "no_photos") {
      toast.warning(`Geen foto's gevonden voor ${restaurant.name}`);
    } else {
      toast.error(`Fout: ${result.error || "Onbekende fout"}`);
    }

    setFetchingSingle(null);
  };

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Image className="h-5 w-5" />
                Google Photos Manager
              </CardTitle>
              <CardDescription>
                Haal automatisch foto's op van Google Places voor restaurants zonder afbeeldingen
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchMissingPhotos} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Vernieuwen
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg mb-4">
            <div className="flex items-center gap-3">
              {missingPhotos.length === 0 ? (
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              ) : (
                <AlertCircle className="h-8 w-8 text-orange-500" />
              )}
              <div>
                <p className="font-semibold text-lg">
                  {missingPhotos.length === 0
                    ? "Alle restaurants hebben foto's!"
                    : `${missingPhotos.length} restaurant(s) zonder foto's`}
                </p>
                <p className="text-sm text-muted-foreground">
                  {missingPhotos.length === 0
                    ? "Alle restaurants tonen afbeeldingen in de listings."
                    : "Deze restaurants tonen geen afbeeldingen."}
                </p>
              </div>
            </div>
            {missingPhotos.length > 0 && (
              <Button onClick={fetchAllPhotos} disabled={fetching}>
                {fetching ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Bezig...
                  </>
                ) : (
                  <>
                    <Image className="h-4 w-4 mr-2" />
                    Alle foto's ophalen
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Progress indicator */}
          {fetching && (
            <div className="mb-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Ophalen: {currentRestaurant}</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}

          {/* Restaurants without photos */}
          {missingPhotos.length > 0 && (
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
                  {missingPhotos.map((restaurant) => (
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
                          onClick={() => fetchSinglePhotos(restaurant)}
                          disabled={fetchingSingle === restaurant.id || fetching}
                        >
                          {fetchingSingle === restaurant.id ? (
                            <RefreshCw className="h-3 w-3 animate-spin" />
                          ) : (
                            <Image className="h-3 w-3" />
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
                      result.status === "success" 
                        ? "bg-green-50 dark:bg-green-950" 
                        : result.status === "no_photos"
                        ? "bg-yellow-50 dark:bg-yellow-950"
                        : "bg-red-50 dark:bg-red-950"
                    }`}
                  >
                    <span className="font-medium">{result.name}</span>
                    <div className="flex items-center gap-2">
                      {result.status === "success" ? (
                        <>
                          <span className="text-muted-foreground">
                            {result.count} foto's toegevoegd
                          </span>
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        </>
                      ) : result.status === "no_photos" ? (
                        <>
                          <span className="text-yellow-600 text-xs">Geen foto's gevonden</span>
                          <AlertCircle className="h-4 w-4 text-yellow-500" />
                        </>
                      ) : (
                        <>
                          <span className="text-red-600 text-xs">{result.error}</span>
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
