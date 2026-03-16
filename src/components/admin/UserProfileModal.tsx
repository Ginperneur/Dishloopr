import { useState, useEffect } from 'react';
import { X, Mail, Globe, Instagram, MessageSquare, Heart, Award, Calendar, ExternalLink } from 'lucide-react';
import { TikTokIcon } from '@/components/icons/TikTokIcon';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';

interface UserProfileModalProps {
  user: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const LEVEL_CONFIG: Record<string, { color: string; label: string }> = {
  bronze: { color: 'bg-amber-700/10 text-amber-700 border-amber-700/30', label: 'Bronze' },
  silver: { color: 'bg-slate-400/10 text-slate-500 border-slate-400/30', label: 'Silver' },
  gold: { color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30', label: 'Gold' },
  platinum: { color: 'bg-purple-500/10 text-purple-600 border-purple-500/30', label: 'Platinum' },
};

export function UserProfileModal({ user, open, onOpenChange }: UserProfileModalProps) {
  const [recentReviews, setRecentReviews] = useState<any[]>([]);
  const [favoriteCount, setFavoriteCount] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && user) {
      fetchUserDetails();
    }
  }, [open, user]);

  const fetchUserDetails = async () => {
    if (!user) return;
    setLoading(true);

    const [reviewsRes, favRes] = await Promise.all([
      supabase
        .from('reviews')
        .select('id, rating, title, created_at, restaurants:restaurant_id(name)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('favorites')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id),
    ]);

    setRecentReviews(reviewsRes.data || []);
    setFavoriteCount(favRes.count || 0);
    setLoading(false);
  };

  if (!user) return null;

  const level = user.reviewer_level || 'bronze';
  const levelConfig = LEVEL_CONFIG[level] || LEVEL_CONFIG.bronze;
  const initials = (user.name || user.email || '?').slice(0, 2).toUpperCase();
  const daysSinceCreation = Math.floor((Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24));
  const socialLinks = [
    user.instagram_url && { icon: Instagram, url: user.instagram_url, label: 'Instagram' },
    user.tiktok_url && { icon: TikTokIcon, url: user.tiktok_url, label: 'TikTok' },
    user.twitter_url && { icon: ExternalLink, url: user.twitter_url, label: 'X/Twitter' },
    user.website_url && { icon: Globe, url: user.website_url, label: 'Website' },
  ].filter(Boolean) as { icon: any; url: string; label: string }[];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden">
        {/* Header with gradient */}
        <div className="relative bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6 pb-4">
          <div className="flex items-start gap-4">
            <Avatar className="h-16 w-16 border-2 border-background shadow-md">
              <AvatarImage src={user.avatar_url} />
              <AvatarFallback className="text-lg font-bold bg-primary/10 text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg truncate">{user.name || '(Geen naam)'}</DialogTitle>
              <p className="text-sm text-muted-foreground truncate">{user.email}</p>
              <div className="flex items-center gap-2 mt-2">
                <Badge className={`${levelConfig.color} border`}>
                  <Award className="h-3 w-3 mr-1" />
                  {levelConfig.label}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Lid sinds {new Date(user.created_at).toLocaleDateString('nl-NL', { month: 'short', year: 'numeric' })}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 pb-6 space-y-5">
          {/* Stats grid */}
          <div className="grid grid-cols-4 gap-3">
            <div className="text-center p-2 rounded-lg bg-muted/50">
              <p className="text-xl font-bold">{user.total_reviews || 0}</p>
              <p className="text-[10px] text-muted-foreground">Reviews</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-muted/50">
              <p className="text-xl font-bold">{user.helpful_votes || 0}</p>
              <p className="text-[10px] text-muted-foreground">Helpful</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-muted/50">
              <p className="text-xl font-bold">{favoriteCount}</p>
              <p className="text-[10px] text-muted-foreground">Favorieten</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-muted/50">
              <p className="text-xl font-bold">{daysSinceCreation}</p>
              <p className="text-[10px] text-muted-foreground">Dagen lid</p>
            </div>
          </div>

          {/* Bio */}
          {user.bio && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">Bio</p>
              <p className="text-sm">{user.bio}</p>
            </div>
          )}

          {/* Social links */}
          {socialLinks.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">Socials</p>
              <div className="flex gap-2">
                {socialLinks.map(({ icon: Icon, url, label }) => (
                  <a
                    key={label}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted hover:bg-muted/80 text-xs font-medium transition-colors"
                    aria-label={label}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </a>
                ))}
              </div>
            </div>
          )}

          <Separator />

          {/* Recent reviews */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">
              Recente reviews ({recentReviews.length})
            </p>
            {loading ? (
              <div className="py-4 text-center text-sm text-muted-foreground">Laden...</div>
            ) : recentReviews.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">Nog geen reviews geschreven</p>
            ) : (
              <ScrollArea className="h-[160px]">
                <div className="space-y-2">
                  {recentReviews.map(review => (
                    <div key={review.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">
                          {(review.restaurants as any)?.name || 'Onbekend'}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {review.title || 'Geen titel'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-3">
                        <div className="flex items-center gap-0.5">
                          {[...Array(5)].map((_, i) => (
                            <span key={i} className={`text-xs ${i < review.rating ? 'text-yellow-500' : 'text-muted-foreground/30'}`}>
                              ★
                            </span>
                          ))}
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(review.created_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
