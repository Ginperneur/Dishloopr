import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { SEOHead } from '@/components/seo/SEOHead';
import { supabase } from '@/integrations/supabase/client';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function UnsubscribePage() {
  const [params] = useSearchParams();
  const token = params.get('t') || '';
  const [state, setState] = useState<{ loading: boolean; name: string | null }>({ loading: true, name: null });

  useEffect(() => {
    if (!UUID.test(token)) { setState({ loading: false, name: null }); return; }
    supabase.rpc('unsubscribe_restaurant_contact', { p_token: token } as never).then(({ data, error }) => {
      setState({ loading: false, name: !error && typeof data === 'string' && data ? data : null });
    });
  }, [token]);

  return (
    <Layout>
      <SEOHead title="Afmelden | Dishloopr" description="Afmelden voor e-mails van Dishloopr." noindex />
      <div className="container py-16 max-w-xl text-center">
        <h1 className="text-3xl font-bold mb-4">Afmelden</h1>
        <p className="text-muted-foreground" role="status">
          {state.loading ? 'Even geduld…' : state.name
            ? `Je bent afgemeld voor e-mails over ${state.name}`
            : 'Deze link is niet (meer) geldig'}
        </p>
        <Link to="/voor-restaurants/afmelden" className="inline-block mt-6 text-primary hover:underline">Gegevens aanpassen of verwijderen</Link>
      </div>
    </Layout>
  );
}
