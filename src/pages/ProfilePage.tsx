import { Layout } from '@/components/layout/Layout';
import { motion } from 'framer-motion';
import { Camera, User, Mail, Globe, Plus, X, Instagram, Link as LinkIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Link, useNavigate } from 'react-router-dom';
import { TagPreferences } from '@/components/profile/TagPreferences';
import { SEOHead } from '@/components/seo/SEOHead';
import { profileSchema, validateWithErrors } from '@/lib/validations';

const languages = [
  { code: 'nl', label: 'Nederlands' },
  { code: 'en', label: 'English' },
  { code: 'de', label: 'Deutsch' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
];

interface Profile {
  id: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
  bio: string | null;
  preferred_language: string | null;
  food_photos: string[] | null;
  instagram_url: string | null;
  tiktok_url: string | null;
  twitter_url: string | null;
  website_url: string | null;
}

export default function ProfilePage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingFood, setUploadingFood] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const foodInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: '',
    bio: '',
    preferred_language: 'nl',
    instagram_url: '',
    tiktok_url: '',
    twitter_url: '',
    website_url: '',
  });

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('Error fetching profile:', error);
    } else if (data) {
      setProfile(data);
      setFormData({
        name: data.name || '',
        bio: data.bio || '',
        preferred_language: data.preferred_language || 'nl',
        instagram_url: data.instagram_url || '',
        tiktok_url: data.tiktok_url || '',
        twitter_url: data.twitter_url || '',
        website_url: data.website_url || '',
      });
    }
    setLoading(false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploadingAvatar(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/avatar.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, file, { upsert: true });

    if (uploadError) {
      toast.error('Kon profielfoto niet uploaden');
      setUploadingAvatar(false);
      return;
    }

    const { data: publicUrl } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName);

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl.publicUrl })
      .eq('id', user.id);

    if (updateError) {
      toast.error('Kon profiel niet bijwerken');
    } else {
      toast.success('Profielfoto bijgewerkt!');
      fetchProfile();
    }
    setUploadingAvatar(false);
  };

  const handleFoodPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploadingFood(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('food-photos')
      .upload(fileName, file);

    if (uploadError) {
      toast.error('Kon foto niet uploaden');
      setUploadingFood(false);
      return;
    }

    const { data: publicUrl } = supabase.storage
      .from('food-photos')
      .getPublicUrl(fileName);

    const currentPhotos = profile?.food_photos || [];
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ food_photos: [...currentPhotos, publicUrl.publicUrl] })
      .eq('id', user.id);

    if (updateError) {
      toast.error('Kon profiel niet bijwerken');
    } else {
      toast.success('Foto toegevoegd!');
      fetchProfile();
    }
    setUploadingFood(false);
  };

  const handleRemoveFoodPhoto = async (photoUrl: string) => {
    if (!user || !profile) return;

    const updatedPhotos = (profile.food_photos || []).filter(p => p !== photoUrl);
    
    const { error } = await supabase
      .from('profiles')
      .update({ food_photos: updatedPhotos })
      .eq('id', user.id);

    if (error) {
      toast.error('Kon foto niet verwijderen');
    } else {
      toast.success('Foto verwijderd');
      fetchProfile();
    }
  };

  const handleSave = async () => {
    if (!user) return;

    // Validate input
    const validation = validateWithErrors(profileSchema, formData);
    if (!validation.success) {
      for (const err of validation.errors) {
        toast.error(err);
      }
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        name: validation.data.name || null,
        bio: validation.data.bio || null,
        preferred_language: validation.data.preferred_language || 'nl',
        instagram_url: formData.instagram_url?.trim() || null,
        tiktok_url: formData.tiktok_url?.trim() || null,
        twitter_url: formData.twitter_url?.trim() || null,
        website_url: formData.website_url?.trim() || null,
      })
      .eq('id', user.id);

    if (error) {
      toast.error('Kon profiel niet opslaan');
    } else {
      toast.success('Profiel opgeslagen!');
      fetchProfile();
    }
    setSaving(false);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  if (!user) {
    return (
      <Layout>
        <div className="container py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-md mx-auto text-center"
          >
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <User className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold mb-4">Mijn Profiel</h1>
            <p className="text-muted-foreground mb-6">
              Log in om je profiel te bekijken en bewerken.
            </p>
            <Button asChild size="lg">
              <Link to="/login">Inloggen</Link>
            </Button>
          </motion.div>
        </div>
      </Layout>
    );
  }

  if (loading) {
    return (
      <Layout>
        <div className="container py-16">
          <div className="max-w-2xl mx-auto">
            <div className="h-8 w-48 bg-muted animate-pulse rounded mb-8" />
            <div className="space-y-6">
              <div className="h-32 bg-muted animate-pulse rounded-xl" />
              <div className="h-48 bg-muted animate-pulse rounded-xl" />
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  const userInitials = formData.name
    ? formData.name.slice(0, 2).toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() || 'U';

  return (
    <Layout>
      <SEOHead
        title="Mijn Profiel | Dishloopr"
        description="Beheer je profiel, voorkeuren en meldingen op Dishloopr."
        noindex={true}
      />
      <div className="container py-8 md:py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl mx-auto space-y-6"
        >
          <h1 className="text-3xl font-bold">Mijn Profiel</h1>

          {/* Avatar Section */}
          <div className="bg-card border border-border rounded-xl p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">Profielfoto</h2>
            <div className="flex items-center gap-6">
              <div className="relative">
                <Avatar className="w-24 h-24">
                  <AvatarImage src={profile?.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="absolute -bottom-1 -right-1 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center hover:bg-primary/90 transition-colors"
                >
                  <Camera className="w-4 h-4" />
                </button>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
              </div>
              <div>
                <p className="font-medium">{formData.name || 'Geen naam'}</p>
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>
            </div>
          </div>

          {/* Profile Details */}
          <div className="bg-card border border-border rounded-xl p-6 mb-6 space-y-4">
            <h2 className="text-lg font-semibold mb-4">Gegevens</h2>
            
            <div className="space-y-2">
              <Label htmlFor="name">Naam</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Je naam"
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  value={user.email || ''}
                  disabled
                  className="pl-10 bg-muted"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={formData.bio}
                onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                placeholder="Vertel iets over jezelf..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="language">Voorkeurstaal</Label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
                <Select
                  value={formData.preferred_language}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, preferred_language: value }))}
                >
                  <SelectTrigger className="pl-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {languages.map((lang) => (
                      <SelectItem key={lang.code} value={lang.code}>
                        {lang.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button onClick={handleSave} disabled={saving} className="w-full md:w-auto">
              {saving ? 'Opslaan...' : 'Wijzigingen opslaan'}
            </Button>
          </div>

          {/* Social Media */}
          <div className="bg-card border border-border rounded-xl p-6 mb-6 space-y-4">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <LinkIcon className="w-5 h-5" />
              Social Media
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Koppel je social media accounts zodat anderen je kunnen vinden.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="instagram">Instagram</Label>
                <div className="relative">
                  <Instagram className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="instagram"
                    value={formData.instagram_url}
                    onChange={(e) => setFormData(prev => ({ ...prev, instagram_url: e.target.value }))}
                    placeholder="https://instagram.com/jouw_naam"
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tiktok">TikTok</Label>
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.75a8.18 8.18 0 0 0 4.76 1.52V6.84a4.84 4.84 0 0 1-1-.15z"/></svg>
                  <Input
                    id="tiktok"
                    value={formData.tiktok_url}
                    onChange={(e) => setFormData(prev => ({ ...prev, tiktok_url: e.target.value }))}
                    placeholder="https://tiktok.com/@jouw_naam"
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="twitter">X / Twitter</Label>
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                  <Input
                    id="twitter"
                    value={formData.twitter_url}
                    onChange={(e) => setFormData(prev => ({ ...prev, twitter_url: e.target.value }))}
                    placeholder="https://x.com/jouw_naam"
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="website"
                    value={formData.website_url}
                    onChange={(e) => setFormData(prev => ({ ...prev, website_url: e.target.value }))}
                    placeholder="https://jouwwebsite.nl"
                    className="pl-10"
                  />
                </div>
              </div>
            </div>

            <Button onClick={handleSave} disabled={saving} className="w-full md:w-auto">
              {saving ? 'Opslaan...' : 'Social media opslaan'}
            </Button>
          </div>

          {/* Tag Preferences for Email Notifications */}
          <TagPreferences />

          {/* Food Photos */}
          <div className="bg-card border border-border rounded-xl p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">Mijn etenfoto's</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Deel foto's van gerechten die je hebt gegeten.
            </p>
            
            <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
              {(profile?.food_photos || []).map((photo, index) => (
                <div key={index} className="relative aspect-square rounded-lg overflow-hidden group">
                  <img
                    src={photo}
                    alt={`Food photo ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={() => handleRemoveFoodPhoto(photo)}
                    className="absolute top-2 right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              
              <button
                onClick={() => foodInputRef.current?.click()}
                disabled={uploadingFood}
                className="aspect-square rounded-lg border-2 border-dashed border-border hover:border-primary transition-colors flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-primary"
              >
                <Plus className="w-6 h-6" />
                <span className="text-xs">{uploadingFood ? 'Uploaden...' : 'Toevoegen'}</span>
              </button>
              <input
                ref={foodInputRef}
                type="file"
                accept="image/*"
                onChange={handleFoodPhotoUpload}
                className="hidden"
              />
            </div>
          </div>

          {/* Account Section */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4">Account</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Beheer je wachtwoord en account instellingen.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" asChild>
                <Link to="/account">Account instellingen</Link>
              </Button>
              <Button variant="destructive" onClick={handleSignOut}>
                Uitloggen
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </Layout>
  );
}
