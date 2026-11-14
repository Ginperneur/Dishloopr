import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { SEOHead } from '@/components/seo/SEOHead';
import { supabase } from '@/integrations/supabase/client';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Target of the personal "Afmelden" link in every Dishloopr newsletter. */
export default function NewsletterUnsubscribePage() {
  const [params] = useSearchParams();
  const id = params.get('id') || '';
  const [state, setState] = useState<'loading' | 'done' | 'invalid'>('loading');

  useEffect(() => {
    if (!UUID.test(id)) { setState('invalid'); return; }
    supabase.rpc('unsubscribe_newsletter' as never, { p_id: id } as never).then(({ data, error }) => {
      setState(!error && data === true ? 'done' : 'invalid');
    });
  }, [id]);

  return (
    <Layout>
      <SEOHead title="Afmelden nieuwsbrief | Dishloopr" description="Afmelden voor de nieuwsbrief van Dishloopr." noindex />
      <div className="container py-16 max-w-xl text-center">
        <h1 className="text-3xl font-bold mb-4">Afmelden nieuwsbrief</h1>
        <p className="text-muted-foreground" role="status">
          {state === 'loading' ? 'Even geduld…' : state === 'done'
            ? 'Je bent afgemeld. Je krijgt de nieuwsbrief van Dishloopr niet meer.'
            : 'Deze link is niet (meer) geldig.'}
        </p>
        <Link to="/" className="inline-block mt-6 text-primary hover:underline">Naar Dishloopr</Link>
      </div>
    </Layout>
  );
}
