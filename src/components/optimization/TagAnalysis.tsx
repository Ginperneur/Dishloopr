import { useTranslation } from 'react-i18next';
import { 
  CheckCircle, 
  AlertTriangle, 
  HelpCircle,
  Tag,
  Utensils,
  Sparkles
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface TagAnalysisData {
  tag: string;
  type: 'cuisine' | 'ambience';
  confirmedCount: number;
  disputedCount: number;
  status: 'confirmed' | 'disputed' | 'neutral';
  userSentiment: number;
}

interface TagAnalysisProps {
  tags: TagAnalysisData[];
}

export function TagAnalysis({ tags }: TagAnalysisProps) {
  const { t } = useTranslation();

  const cuisineTags = tags.filter(t => t.type === 'cuisine');
  const ambienceTags = tags.filter(t => t.type === 'ambience');

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'disputed':
        return <AlertTriangle className="h-4 w-4 text-amber-600" />;
      default:
        return <HelpCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <Badge variant="default" className="bg-green-600">Bevestigd</Badge>;
      case 'disputed':
        return <Badge variant="destructive">Betwist</Badge>;
      default:
        return <Badge variant="secondary">Neutraal</Badge>;
    }
  };

  const TagSection = ({ 
    title, 
    icon: Icon, 
    tagList 
  }: { 
    title: string; 
    icon: React.ElementType; 
    tagList: TagAnalysisData[] 
  }) => (
    <div>
      <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4" />
        {title}
      </h4>
      {tagList.length > 0 ? (
        <div className="space-y-3">
          {tagList.map((tag) => (
            <div 
              key={tag.tag}
              className="p-3 rounded-lg border bg-card"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {getStatusIcon(tag.status)}
                  <span className="font-medium capitalize">{tag.tag}</span>
                </div>
                {getStatusBadge(tag.status)}
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Gebruikersbevestiging</span>
                  <span>{tag.userSentiment.toFixed(0)}%</span>
                </div>
                <Progress 
                  value={tag.userSentiment} 
                  className={`h-1.5 ${
                    tag.status === 'confirmed' ? '[&>div]:bg-green-600' :
                    tag.status === 'disputed' ? '[&>div]:bg-amber-600' :
                    ''
                  }`}
                />
              </div>
              <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  {tag.confirmedCount} bevestigingen
                </span>
                {tag.disputedCount > 0 && (
                  <span className="flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {tag.disputedCount} betwistingen
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground py-4 text-center">
          Geen {title.toLowerCase()} tags geconfigureerd
        </p>
      )}
    </div>
  );

  if (tags.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Tag className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            Nog geen tags geconfigureerd voor je restaurant
          </p>
        </CardContent>
      </Card>
    );
  }

  // Calculate overall health
  const confirmedCount = tags.filter(t => t.status === 'confirmed').length;
  const disputedCount = tags.filter(t => t.status === 'disputed').length;
  const healthScore = Math.round((confirmedCount / tags.length) * 100);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Tag className="h-5 w-5 text-primary" />
          Tag Consistentie Analyse
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Health overview */}
        <div className="mb-6 p-4 rounded-lg bg-muted/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Tag Gezondheid</span>
            <span className={`text-lg font-bold ${
              healthScore >= 70 ? 'text-green-600' :
              healthScore >= 40 ? 'text-amber-600' :
              'text-red-600'
            }`}>
              {healthScore}%
            </span>
          </div>
          <Progress value={healthScore} className="h-2 mb-2" />
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-green-600" />
              {confirmedCount} bevestigd
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-600" />
              {disputedCount} betwist
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-muted-foreground" />
              {tags.length - confirmedCount - disputedCount} neutraal
            </span>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <TagSection 
            title="Keuken Tags" 
            icon={Utensils} 
            tagList={cuisineTags} 
          />
          <TagSection 
            title="Sfeer Tags" 
            icon={Sparkles} 
            tagList={ambienceTags} 
          />
        </div>

        {disputedCount > 0 && (
          <div className="mt-6 p-4 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4 inline mr-2" />
              <strong>Tip:</strong> Betwiste tags kunnen je zichtbaarheid in filters beïnvloeden. 
              Overweeg om tags die niet door bezoekers worden bevestigd aan te passen.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
