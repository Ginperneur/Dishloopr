import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { SEOHead } from '@/components/seo/SEOHead';
import { Button } from '@/components/ui/button';

export default function ThanksPage() {
  return (
    <Layout>
      <SEOHead title="Bedankt | Dishloopr" description="Bedankt voor je bestelling bij Dishloopr." noindex />
      <div className="container max-w-xl py-16 text-center space-y-6">
        <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
        <h1 className="text-3xl font-bold">Bedankt!</h1>
        <p className="text-lg text-muted-foreground">We zetten je plek binnen 1 werkdag live en sturen je een bevestiging.</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild className="min-h-11"><Link to="/dashboard">Naar je dashboard</Link></Button>
          <Button asChild variant="outline" className="min-h-11"><Link to="/">Naar de homepage</Link></Button>
        </div>
      </div>
    </Layout>
  );
}
