import { useState, useEffect } from "react";
import { Image, RefreshCw, AlertCircle, CheckCircle2, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
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

export function PhotosManager() {
  const [missingPhotos, setMissingPhotos] = useState<MissingPhotosRestaurant[]>([]);
  const [loading, setLoading] = useState(true);
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

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Image className="h-5 w-5" />
                Restaurants zonder foto's
              </CardTitle>
              <CardDescription>
                Google-foto's ophalen is gestopt: de Google-voorwaarden staan opslaan niet toe. Vraag de eigenaar om foto's (exporteer de lijst voor outreach) of upload ze zelf bij het restaurant.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchMissingPhotos} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Vernieuwen
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
            <Tabs value={filterMode} onValueChange={(v) => setFilterMode(v as "all" | "never")}>
              <TabsList>
                <TabsTrigger value="all">Alle zonder foto's</TabsTrigger>
                <TabsTrigger value="never">Nog nooit opgehaald</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={missingPhotos.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Exporteer CSV
            </Button>
          </div>
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
          </div>

          {/* Restaurants without photos */}
          {missingPhotos.length > 0 && (
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Restaurant</TableHead>
                    <TableHead>Adres</TableHead>
                    <TableHead>Stad</TableHead>
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
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
