import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Save, Loader2, Settings, Mail } from 'lucide-react';
import { useActivityLog } from '@/hooks/useActivityLog';

interface AppSetting {
  id: string;
  key: string;
  value: string;
  description: string | null;
}

export function SettingsManager() {
  const [settings, setSettings] = useState<AppSetting[]>([]);
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { logActivity } = useActivityLog();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('*')
        .order('key');

      if (error) throw error;
      
      setSettings(data || []);
      const values: Record<string, string> = {};
      data?.forEach(s => { values[s.key] = s.value; });
      setEditedValues(values);
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Kon instellingen niet laden');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (setting: AppSetting) => {
    const newValue = editedValues[setting.key];
    if (newValue === setting.value) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('app_settings')
        .update({ value: newValue })
        .eq('id', setting.id);

      if (error) throw error;

      await logActivity({
        actionType: 'update',
        entityType: 'setting',
        entityId: setting.id,
        entityName: setting.key,
        details: { old_value: setting.value, new_value: newValue }
      });

      setSettings(prev => prev.map(s => 
        s.id === setting.id ? { ...s, value: newValue } : s
      ));

      toast.success('Instelling opgeslagen');
    } catch (error) {
      console.error('Error saving setting:', error);
      toast.error('Kon instelling niet opslaan');
    } finally {
      setIsSaving(false);
    }
  };

  const getSettingIcon = (key: string) => {
    if (key.includes('email')) return Mail;
    return Settings;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Instellingen</h2>
        <p className="text-muted-foreground">Beheer platform-brede instellingen</p>
      </div>

      <div className="grid gap-4">
        {settings.map((setting) => {
          const Icon = getSettingIcon(setting.key);
          const hasChanges = editedValues[setting.key] !== setting.value;

          return (
            <Card key={setting.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Icon className="w-5 h-5 text-muted-foreground" />
                  <CardTitle className="text-lg">{setting.key}</CardTitle>
                </div>
                {setting.description && (
                  <CardDescription>{setting.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <Label htmlFor={setting.key} className="sr-only">
                      {setting.key}
                    </Label>
                    <Input
                      id={setting.key}
                      value={editedValues[setting.key] || ''}
                      onChange={(e) => setEditedValues(prev => ({
                        ...prev,
                        [setting.key]: e.target.value
                      }))}
                      placeholder={setting.description || ''}
                    />
                  </div>
                  <Button
                    onClick={() => handleSave(setting)}
                    disabled={!hasChanges || isSaving}
                    variant={hasChanges ? 'default' : 'outline'}
                  >
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    <span className="ml-2 hidden sm:inline">Opslaan</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {settings.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Geen instellingen gevonden
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
