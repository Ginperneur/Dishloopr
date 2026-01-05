import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { X, Plus, Bell, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface TagPreference {
  id: string;
  tag: string;
  tag_type: 'cuisine' | 'ambience' | 'dietary';
}

const CUISINE_OPTIONS = [
  'Italiaans', 'Frans', 'Japans', 'Chinees', 'Mexicaans', 'Indiaas', 
  'Grieks', 'Thais', 'Vietnamees', 'Koreaans', 'Amerikaans', 'Mediterraan',
  'Indonesisch', 'Marokkaans', 'Turks', 'Spaans', 'Nederlands'
];

const AMBIENCE_OPTIONS = [
  'Romantisch', 'Familievriendelijk', 'Zakelijk', 'Casual', 'Fine dining',
  'Terras', 'Gezellig', 'Modern', 'Traditioneel', 'Trendy', 'Intiem'
];

const DIETARY_OPTIONS = [
  'Vegetarisch', 'Veganistisch', 'Glutenvrij', 'Lactosevrij', 'Halal', 'Kosher'
];

export function TagPreferences() {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<TagPreference[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      fetchPreferences();
    }
  }, [user]);

  const fetchPreferences = async () => {
    try {
      const { data, error } = await supabase
        .from('user_tag_preferences' as any)
        .select('*')
        .eq('user_id', user?.id);

      if (error) throw error;
      setPreferences((data || []).map((p: any) => ({
        id: p.id,
        tag: p.tag,
        tag_type: p.tag_type as 'cuisine' | 'ambience' | 'dietary'
      })));
    } catch (error) {
      console.error('Error fetching preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const addPreference = async (tag: string, tagType: 'cuisine' | 'ambience' | 'dietary') => {
    if (!user) return;
    
    const exists = preferences.some(p => p.tag === tag && p.tag_type === tagType);
    if (exists) {
      toast.info('Deze tag staat al in je voorkeuren');
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('user_tag_preferences' as any)
        .insert({ user_id: user.id, tag, tag_type: tagType })
        .select()
        .single();

      if (error) throw error;
      
      const responseData = data as any;
      const newPref: TagPreference = {
        id: responseData.id,
        tag: responseData.tag,
        tag_type: responseData.tag_type as 'cuisine' | 'ambience' | 'dietary'
      };
      setPreferences([...preferences, newPref]);
      toast.success(`${tag} toegevoegd aan je voorkeuren`);
    } catch (error) {
      console.error('Error adding preference:', error);
      toast.error('Kon voorkeur niet opslaan');
    } finally {
      setSaving(false);
    }
  };

  const removePreference = async (id: string) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('user_tag_preferences' as any)
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setPreferences(preferences.filter(p => p.id !== id));
      toast.success('Voorkeur verwijderd');
    } catch (error) {
      console.error('Error removing preference:', error);
      toast.error('Kon voorkeur niet verwijderen');
    } finally {
      setSaving(false);
    }
  };

  const getPreferencesByType = (type: 'cuisine' | 'ambience' | 'dietary') => {
    return preferences.filter(p => p.tag_type === type);
  };

  const getAvailableOptions = (options: string[], type: 'cuisine' | 'ambience' | 'dietary') => {
    const selected = getPreferencesByType(type).map(p => p.tag);
    return options.filter(o => !selected.includes(o));
  };

  if (!user) {
    return null;
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          <CardTitle>Meldingsvoorkeuren</CardTitle>
        </div>
        <CardDescription>
          Selecteer je favoriete keukens en sferen. Je krijgt een email wanneer er een nieuw restaurant opent dat bij je past.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="cuisine" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="cuisine">Keukens</TabsTrigger>
            <TabsTrigger value="ambience">Sfeer</TabsTrigger>
            <TabsTrigger value="dietary">Dieet</TabsTrigger>
          </TabsList>

          <TabsContent value="cuisine" className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-3">Je favoriete keukens:</p>
              <div className="flex flex-wrap gap-2 min-h-[40px]">
                {getPreferencesByType('cuisine').map(pref => (
                  <Badge key={pref.id} variant="secondary" className="gap-1 pr-1">
                    {pref.tag}
                    <button
                      onClick={() => removePreference(pref.id)}
                      className="ml-1 rounded-full hover:bg-destructive/20 p-0.5"
                      disabled={saving}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                {getPreferencesByType('cuisine').length === 0 && (
                  <span className="text-sm text-muted-foreground italic">Nog geen keukens geselecteerd</span>
                )}
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-3">Voeg toe:</p>
              <div className="flex flex-wrap gap-2">
                {getAvailableOptions(CUISINE_OPTIONS, 'cuisine').map(option => (
                  <Button
                    key={option}
                    variant="outline"
                    size="sm"
                    onClick={() => addPreference(option, 'cuisine')}
                    disabled={saving}
                    className="gap-1"
                  >
                    <Plus className="h-3 w-3" />
                    {option}
                  </Button>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="ambience" className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-3">Je favoriete sferen:</p>
              <div className="flex flex-wrap gap-2 min-h-[40px]">
                {getPreferencesByType('ambience').map(pref => (
                  <Badge key={pref.id} variant="secondary" className="gap-1 pr-1">
                    {pref.tag}
                    <button
                      onClick={() => removePreference(pref.id)}
                      className="ml-1 rounded-full hover:bg-destructive/20 p-0.5"
                      disabled={saving}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                {getPreferencesByType('ambience').length === 0 && (
                  <span className="text-sm text-muted-foreground italic">Nog geen sferen geselecteerd</span>
                )}
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-3">Voeg toe:</p>
              <div className="flex flex-wrap gap-2">
                {getAvailableOptions(AMBIENCE_OPTIONS, 'ambience').map(option => (
                  <Button
                    key={option}
                    variant="outline"
                    size="sm"
                    onClick={() => addPreference(option, 'ambience')}
                    disabled={saving}
                    className="gap-1"
                  >
                    <Plus className="h-3 w-3" />
                    {option}
                  </Button>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="dietary" className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-3">Je dieetwensen:</p>
              <div className="flex flex-wrap gap-2 min-h-[40px]">
                {getPreferencesByType('dietary').map(pref => (
                  <Badge key={pref.id} variant="secondary" className="gap-1 pr-1">
                    {pref.tag}
                    <button
                      onClick={() => removePreference(pref.id)}
                      className="ml-1 rounded-full hover:bg-destructive/20 p-0.5"
                      disabled={saving}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                {getPreferencesByType('dietary').length === 0 && (
                  <span className="text-sm text-muted-foreground italic">Nog geen dieetwensen geselecteerd</span>
                )}
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-3">Voeg toe:</p>
              <div className="flex flex-wrap gap-2">
                {getAvailableOptions(DIETARY_OPTIONS, 'dietary').map(option => (
                  <Button
                    key={option}
                    variant="outline"
                    size="sm"
                    onClick={() => addPreference(option, 'dietary')}
                    disabled={saving}
                    className="gap-1"
                  >
                    <Plus className="h-3 w-3" />
                    {option}
                  </Button>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
