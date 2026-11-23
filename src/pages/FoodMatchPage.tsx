import { useParams } from 'react-router-dom';
import { SEOHead } from '@/components/seo/SEOHead';
import { FoodMatchFlow } from '@/components/finder/FoodMatchFlow';

export default function FoodMatchPage() {
  const { code } = useParams<{ code: string }>();
  return (
    <>
      <SEOHead title="Food Match | Dishloopr" description="Stem mee waar jullie gaan eten." noindex />
      <div className="container max-w-md mx-auto px-4 py-8">
        <p className="text-center font-display text-sm uppercase tracking-[0.25em] text-primary mb-6">Food Match</p>
        <div className="rounded-3xl border border-primary/20 bg-card p-6 shadow-xl">
          {code && <FoodMatchFlow guestCode={code} />}
        </div>
      </div>
    </>
  );
}
