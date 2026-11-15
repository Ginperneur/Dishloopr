// Turns a run_owner_simulation result into plain Dutch for the owner.

export interface SimulationQuota { unlimited: boolean; free_left: number; credits: number; price_cents: number }

export type SimulationResult =
  | { kind: 'add_dish'; dish: string; position: number; total: number; searches_per_month: number; extra_visitors_per_month: number; data_points: number; quota: SimulationQuota }
  | { kind: 'change_price'; from: number | null; to: number; price_filter_searches_per_month: number; gain_per_month: number; lose_per_month: number; data_points: number; quota: SimulationQuota }
  | { kind: 'remove_tag'; tag: string; filter_searches_per_month: number; data_points: number; quota: SimulationQuota };

const n = (v: number) => Math.round(Number(v)).toLocaleString('nl-NL');
const PRICE = ['', '€', '€€', '€€€', '€€€€'];

/** How much the numbers can be trusted, from the number of searches behind them (last 90 days). */
export function confidenceLabel(dataPoints: number): string {
  if (dataPoints >= 300) return 'Betrouwbaar: gebaseerd op veel zoekopdrachten in je stad (laatste 90 dagen).';
  if (dataPoints >= 50) return 'Redelijk betrouwbaar: gebaseerd op een gemiddeld aantal zoekopdrachten (laatste 90 dagen).';
  return 'Indicatie: nog weinig zoekopdrachten in je stad, dus de cijfers kunnen flink afwijken.';
}

export function simulationSummary(r: SimulationResult, currentPrice?: number | null): { headline: string; lines: string[]; confidence: string } {
  if (r.kind === 'add_dish') {
    return {
      headline: `Met ${r.dish.toLowerCase()} sta je op plek ${r.position} van ${r.total}`,
      lines: [
        `Zo'n ${n(r.searches_per_month)} bezoekers per maand zoeken in je stad naar ${r.dish.toLowerCase()}.`,
        r.extra_visitors_per_month > 0
          ? `Op die plek levert dat naar schatting ${n(r.extra_visitors_per_month)} extra bezoekers per maand op je pagina op.`
          : 'Op die plek levert dat nog weinig extra bezoekers op; hogere reviews brengen je hoger.',
      ],
      confidence: confidenceLabel(r.data_points),
    };
  }
  if (r.kind === 'change_price') {
    const net = r.gain_per_month - r.lose_per_month;
    return {
      headline: net === 0 ? 'Dit verandert weinig aan je zichtbaarheid'
        : net > 0 ? `Je komt in zo'n ${n(net)} meer zoekopdrachten per maand voor`
        : `Je komt in zo'n ${n(-net)} minder zoekopdrachten per maand voor`,
      lines: [
        `${n(r.price_filter_searches_per_month)} zoekopdrachten per maand in je stad filteren op prijs.`,
        `Van ${PRICE[currentPrice ?? r.from ?? 0] || 'je huidige prijsklasse'} naar ${PRICE[r.to]}: je wint er ${n(r.gain_per_month)} en verliest er ${n(r.lose_per_month)} per maand.`,
      ],
      confidence: confidenceLabel(r.data_points),
    };
  }
  return {
    headline: r.filter_searches_per_month > 0
      ? `Zonder ${r.tag} kom je in zo'n ${n(r.filter_searches_per_month)} zoekopdrachten per maand niet meer voor`
      : `Er wordt in je stad (bijna) niet op ${r.tag} gefilterd`,
    lines: ['Gasten die op deze tag filteren, zien je dan niet meer. Wie zonder filter zoekt, ziet je nog wel.'],
    confidence: confidenceLabel(r.data_points),
  };
}
