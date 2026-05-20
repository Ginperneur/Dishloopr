/**
 * Dishloopr Ranking Engine v3
 *
 * Modular dish-first ranking pipeline:
 *   relevance → quality → engagement → commercial → fairness → final
 *
 * Every component is weighted via the `WEIGHTS` config so weights can be tuned,
 * A/B tested, or replaced by an ML model later. Every scored restaurant returns
 * a full `scoreBreakdown` for debugging, admin tools, and analytics.
 */

// ───────────────────────────────────────────────────────────────────────────
// CONFIGURABLE WEIGHTS  (single source of truth — safe to A/B test)
// ───────────────────────────────────────────────────────────────────────────
export const WEIGHTS = {
  relevance: {
    exactDishMatch: 100,
    signatureDish: 80,
    verifiedSignatureBonus: 40,
    confidenceMax: 15,
    extraDishStops: [10, 6, 4] as number[], // diminishing returns
    extraDishCap: 20,
    cuisineSupport: 2,
    nameSupport: 1,
    multiDishMultiplier: { full: 1.4, high: 1.2, partial: 1.0 },
  },
  quality: {
    bayesianPriorRating: 3.5,
    bayesianPriorWeight: 5,
    bayesianMax: 50,
  },
  engagement: {
    dishEngagementMax: 30,
    saveRateMax: 15,
    repeatCtrMax: 10,
    lowBounceMax: 8,
  },
  commercial: {
    sponsoredMin: 5,
    sponsoredMax: 8,
    sponsoredMinRating: 3.8,
    sponsoredMinEngagement: 0.1, // 0..1 normalized
    featuredBoost: 2,
    newnessMax: 3,
    newnessWindowDays: 30,
  },
  fairness: {
    maxSponsoredInTop5: 2,
    maxSameChainInTop10: 2,
    inactiveDecayDays: 180,
    inactiveDecayPenalty: 15,
    lowQualityMinRating: 3.0,
    lowQualityPenalty: 10,
  },
} as const;

// Back-compat constants (still used by older call sites)
const MAX_SPONSORED_IN_TOP5 = WEIGHTS.fairness.maxSponsoredInTop5;
const MAX_SAME_CHAIN_IN_TOP10 = WEIGHTS.fairness.maxSameChainInTop10;

// ───────────────────────────────────────────────────────────────────────────
// TYPES
// ───────────────────────────────────────────────────────────────────────────
export interface ScoringContext {
  queryLower: string;
  now: Date;
}

export interface DishMatchInfo {
  name: string;
  isSignature: boolean;
  confidenceScore: number;
  /** Signature flag verified by owner/admin/trusted moderator */
  verifiedSignature?: boolean;
}

export interface EngagementMetrics {
  /** Dish-specific clicks / saves / reservations etc. — normalize 0..1 */
  dishEngagement?: number;
  /** saves / impressions ratio — 0..1 */
  saveRate?: number;
  /** repeat click-through rate — 0..1 */
  repeatCtr?: number;
  /** 1 - bounceRate — 0..1 (higher = better) */
  lowBounce?: number;
}

export interface RestaurantScoringInput {
  id: string;
  name: string;
  rating: number;
  review_count: number;
  cuisines: string[] | null;
  is_featured: boolean;
  is_top_listing: boolean;
  chain_id: string | null;
  created_at: string;
  linkedDishes: DishMatchInfo[] | null;
  isSponsored: boolean;
  queryTermsCovered?: number;
  totalQueryTerms?: number;
  /** Optional engagement signals (future-ready, default 0) */
  engagement?: EngagementMetrics;
  /** Last meaningful update — used for inactive decay */
  last_active_at?: string | null;
}

export interface ScoreBreakdown {
  relevance: {
    dishMatch: number;
    signature: number;
    verifiedSignature: number;
    confidence: number;
    extraDishes: number;
    cuisine: number;
    name: number;
    multiDishMultiplier: number;
    subtotal: number;
  };
  quality: { bayesianPoints: number; bayesianRaw: number };
  engagement: { dish: number; save: number; repeat: number; lowBounce: number; subtotal: number };
  commercial: { sponsored: number; featured: number; newness: number; subtotal: number };
  fairness: { inactivePenalty: number; lowQualityPenalty: number; subtotal: number };
  finalScore: number;
  explanation: string[];
}

export interface ScoredResult {
  /** Backward-compatible alias for finalScore */
  matchScore: number;
  finalScore: number;
  bayesianRating: number;
  matchedDishes: string[];
  hasDishMatch: boolean;
  isSponsored: boolean;
  scoreBreakdown: ScoreBreakdown;
}

// ───────────────────────────────────────────────────────────────────────────
// SHARED UTILITIES
// ───────────────────────────────────────────────────────────────────────────
const clamp01 = (n: number) => Math.max(0, Math.min(1, n || 0));
const daysBetween = (a: Date, b: Date) =>
  (b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24);

/**
 * Bayesian Average Rating — prevents 1-review 5.0 from beating 500-review 4.7.
 * Formula: (C * m + rating * n) / (C + n)
 */
export function bayesianRating(rawRating: number, reviewCount: number): number {
  const { bayesianPriorRating: m, bayesianPriorWeight: C } = WEIGHTS.quality;
  if (!reviewCount || reviewCount <= 0) return m;
  return (C * m + rawRating * reviewCount) / (C + reviewCount);
}

// ───────────────────────────────────────────────────────────────────────────
// PHASE 1 — RELEVANCE
// ───────────────────────────────────────────────────────────────────────────
function scoreRelevance(
  r: RestaurantScoringInput,
  ctx: ScoringContext
): ScoreBreakdown['relevance'] {
  const W = WEIGHTS.relevance;
  const linked = r.linkedDishes ?? [];
  const hasDish = linked.length > 0;

  let dishMatch = 0;
  let signature = 0;
  let verifiedSignature = 0;
  let confidence = 0;
  let extraDishes = 0;

  if (hasDish) {
    dishMatch = W.exactDishMatch;

    // Signature & verified-signature (pick the strongest matched dish)
    const sigDishes = linked.filter(d => d.isSignature);
    if (sigDishes.length > 0) {
      signature = W.signatureDish;
      if (sigDishes.some(d => d.verifiedSignature)) {
        verifiedSignature = W.verifiedSignatureBonus;
      }
    }

    // Confidence — average confidence of matched dishes, scaled to 0..confidenceMax
    const avgConf =
      linked.reduce((s, d) => s + clamp01(d.confidenceScore), 0) / linked.length;
    confidence = avgConf * W.confidenceMax;

    // Extra related dish matches — diminishing returns, hard cap
    const extras = Math.max(0, linked.length - 1);
    for (let i = 0; i < extras && i < W.extraDishStops.length; i++) {
      extraDishes += W.extraDishStops[i];
    }
    extraDishes = Math.min(extraDishes, W.extraDishCap);
  }

  // Supportive signals
  const q = ctx.queryLower;
  const cuisine =
    q && r.cuisines?.some(c => c.toLowerCase().includes(q)) ? W.cuisineSupport : 0;
  const name = q && r.name.toLowerCase().includes(q) ? W.nameSupport : 0;

  const rawSubtotal =
    dishMatch + signature + verifiedSignature + confidence + extraDishes + cuisine + name;

  // Multi-dish completeness multiplier (applies to relevance subtotal only)
  const covered = r.queryTermsCovered ?? (hasDish ? 1 : 0);
  const total = r.totalQueryTerms ?? 1;
  let multiDishMultiplier = 1.0;
  if (total > 1 && covered > 0) {
    const ratio = covered / total;
    if (ratio >= 1) multiDishMultiplier = W.multiDishMultiplier.full;
    else if (ratio >= 0.75) multiDishMultiplier = W.multiDishMultiplier.high;
    else multiDishMultiplier = W.multiDishMultiplier.partial;
  }

  return {
    dishMatch,
    signature,
    verifiedSignature,
    confidence,
    extraDishes,
    cuisine,
    name,
    multiDishMultiplier,
    subtotal: rawSubtotal * multiDishMultiplier,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// PHASE 2 — QUALITY (Bayesian rating normalized 0..50)
// ───────────────────────────────────────────────────────────────────────────
function scoreQuality(r: RestaurantScoringInput): ScoreBreakdown['quality'] {
  const bRaw = bayesianRating(Number(r.rating) || 0, r.review_count || 0);
  // Map a 0..5 rating to 0..bayesianMax
  const bayesianPoints = (bRaw / 5) * WEIGHTS.quality.bayesianMax;
  return { bayesianPoints, bayesianRaw: bRaw };
}

// ───────────────────────────────────────────────────────────────────────────
// PHASE 2b — ENGAGEMENT (future moat; defaults to 0 until tracked)
// ───────────────────────────────────────────────────────────────────────────
function scoreEngagement(r: RestaurantScoringInput): ScoreBreakdown['engagement'] {
  const W = WEIGHTS.engagement;
  const e = r.engagement ?? {};
  const dish = clamp01(e.dishEngagement) * W.dishEngagementMax;
  const save = clamp01(e.saveRate) * W.saveRateMax;
  const repeat = clamp01(e.repeatCtr) * W.repeatCtrMax;
  const lowBounce = clamp01(e.lowBounce) * W.lowBounceMax;
  return { dish, save, repeat, lowBounce, subtotal: dish + save + repeat + lowBounce };
}

// ───────────────────────────────────────────────────────────────────────────
// PHASE 3 — COMMERCIAL (gated by relevance & quality)
// ───────────────────────────────────────────────────────────────────────────
function scoreCommercial(
  r: RestaurantScoringInput,
  ctx: ScoringContext,
  relevanceSubtotal: number,
  qualityRaw: number,
  engagementSubtotal: number
): ScoreBreakdown['commercial'] {
  const W = WEIGHTS.commercial;

  // Sponsored: only when restaurant already has dish relevance + meets thresholds
  let sponsored = 0;
  const hasDishRelevance = (r.linkedDishes?.length ?? 0) > 0;
  const meetsRatingThreshold = qualityRaw >= W.sponsoredMinRating;
  const normalizedEngagement = clamp01(
    engagementSubtotal /
      (WEIGHTS.engagement.dishEngagementMax +
        WEIGHTS.engagement.saveRateMax +
        WEIGHTS.engagement.repeatCtrMax +
        WEIGHTS.engagement.lowBounceMax)
  );
  if (r.isSponsored && hasDishRelevance && meetsRatingThreshold) {
    // Scale between sponsoredMin..sponsoredMax based on engagement
    const t = normalizedEngagement >= W.sponsoredMinEngagement ? normalizedEngagement : 0;
    sponsored = W.sponsoredMin + (W.sponsoredMax - W.sponsoredMin) * t;
  }

  const featured = r.is_featured ? W.featuredBoost : 0;

  // Newness — linear decay within window
  let newness = 0;
  if (r.created_at) {
    const days = daysBetween(new Date(r.created_at), ctx.now);
    if (days >= 0 && days <= W.newnessWindowDays) {
      newness = W.newnessMax * (1 - days / W.newnessWindowDays);
    }
  }

  return { sponsored, featured, newness, subtotal: sponsored + featured + newness };
}

// ───────────────────────────────────────────────────────────────────────────
// PHASE 4 — FAIRNESS PENALTIES (per-restaurant; chain/sponsored caps live in
//                              the post-processing helpers further down)
// ───────────────────────────────────────────────────────────────────────────
function scoreFairnessPenalties(
  r: RestaurantScoringInput,
  ctx: ScoringContext,
  qualityRaw: number
): ScoreBreakdown['fairness'] {
  const W = WEIGHTS.fairness;

  let inactivePenalty = 0;
  if (r.last_active_at) {
    const days = daysBetween(new Date(r.last_active_at), ctx.now);
    if (days > W.inactiveDecayDays) {
      // Beyond the window: full penalty, capped at penalty value
      const over = Math.min(days - W.inactiveDecayDays, W.inactiveDecayDays);
      inactivePenalty = -(W.inactiveDecayPenalty * (over / W.inactiveDecayDays));
    }
  }

  const lowQualityPenalty =
    qualityRaw > 0 && qualityRaw < W.lowQualityMinRating ? -W.lowQualityPenalty : 0;

  return {
    inactivePenalty,
    lowQualityPenalty,
    subtotal: inactivePenalty + lowQualityPenalty,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// MAIN SCORING ENTRY POINT
// ───────────────────────────────────────────────────────────────────────────
export function scoreRestaurant(
  r: RestaurantScoringInput,
  ctx: ScoringContext
): ScoredResult {
  const relevance = scoreRelevance(r, ctx);
  const quality = scoreQuality(r);
  const engagement = scoreEngagement(r);
  const commercial = scoreCommercial(
    r,
    ctx,
    relevance.subtotal,
    quality.bayesianRaw,
    engagement.subtotal
  );
  const fairness = scoreFairnessPenalties(r, ctx, quality.bayesianRaw);

  const finalScore =
    relevance.subtotal +
    quality.bayesianPoints +
    engagement.subtotal +
    commercial.subtotal +
    fairness.subtotal;

  const explanation: string[] = [];
  if (relevance.dishMatch) explanation.push(`dish match +${relevance.dishMatch}`);
  if (relevance.signature) explanation.push(`signature +${relevance.signature}`);
  if (relevance.verifiedSignature)
    explanation.push(`verified signature +${relevance.verifiedSignature}`);
  if (relevance.confidence)
    explanation.push(`confidence +${relevance.confidence.toFixed(1)}`);
  if (relevance.extraDishes) explanation.push(`extra dishes +${relevance.extraDishes}`);
  if (relevance.multiDishMultiplier !== 1)
    explanation.push(`multi-dish x${relevance.multiDishMultiplier}`);
  if (quality.bayesianPoints)
    explanation.push(`quality +${quality.bayesianPoints.toFixed(1)}`);
  if (engagement.subtotal)
    explanation.push(`engagement +${engagement.subtotal.toFixed(1)}`);
  if (commercial.sponsored)
    explanation.push(`sponsored +${commercial.sponsored.toFixed(1)}`);
  if (commercial.featured) explanation.push(`featured +${commercial.featured}`);
  if (commercial.newness) explanation.push(`newness +${commercial.newness.toFixed(1)}`);
  if (fairness.inactivePenalty)
    explanation.push(`inactive ${fairness.inactivePenalty.toFixed(1)}`);
  if (fairness.lowQualityPenalty)
    explanation.push(`low-quality ${fairness.lowQualityPenalty}`);

  const breakdown: ScoreBreakdown = {
    relevance,
    quality,
    engagement,
    commercial,
    fairness,
    finalScore,
    explanation,
  };

  return {
    matchScore: finalScore, // back-compat
    finalScore,
    bayesianRating: quality.bayesianRaw,
    matchedDishes: (r.linkedDishes ?? []).map(d => d.name),
    hasDishMatch: (r.linkedDishes?.length ?? 0) > 0,
    isSponsored: r.isSponsored,
    scoreBreakdown: breakdown,
  };
}

/**
 * Sort results with Bayesian rating as tie-breaker instead of raw rating.
 */
export function sortResults<T extends { matchScore: number; bayesianRating: number }>(
  results: T[]
): T[] {
  return results.sort((a, b) => {
    if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
    return b.bayesianRating - a.bayesianRating;
  });
}

/**
 * Chain Diversity Enforcement
 * Prevents a single chain from dominating the top results.
 * Max MAX_SAME_CHAIN_IN_TOP10 restaurants from the same chain in positions 1-10.
 */
export function enforceChainDiversity<T extends { chain_id?: string | null }>(
  results: T[]
): T[] {
  if (results.length <= 3) return results;

  const reordered: T[] = [];
  const deferred: T[] = [];
  const chainCount = new Map<string, number>();

  for (let i = 0; i < results.length; i++) {
    const item = results[i];
    const chainId = item.chain_id;

    if (i < 10 && chainId) {
      const count = chainCount.get(chainId) || 0;
      if (count >= MAX_SAME_CHAIN_IN_TOP10) {
        deferred.push(item);
        continue;
      }
      chainCount.set(chainId, count + 1);
    }

    reordered.push(item);
  }

  // Insert deferred items after position 10
  if (deferred.length > 0) {
    const insertAt = Math.min(10, reordered.length);
    reordered.splice(insertAt, 0, ...deferred);
  }

  return reordered;
}

/**
 * Rebalance sponsored results — max MAX_SPONSORED_IN_TOP5 in top 5.
 * Enhanced version with chain diversity applied after.
 */
export function rebalanceSponsoredResults<
  T extends { isSponsored?: boolean; matchScore: number; chain_id?: string | null }
>(results: T[]): T[] {
  if (results.length <= 5) return enforceChainDiversity(results);

  const sponsored = results.filter(r => r.isSponsored);
  const organic = results.filter(r => !r.isSponsored);

  const finalResults: T[] = [];
  let sponsoredCount = 0;
  let organicIndex = 0;
  let sponsoredIndex = 0;

  for (let i = 0; i < results.length; i++) {
    if (i < 5) {
      if (sponsoredCount < MAX_SPONSORED_IN_TOP5 && sponsoredIndex < sponsored.length) {
        const nextSponsored = sponsored[sponsoredIndex];
        const nextOrganic = organic[organicIndex];

        if (!nextOrganic || (nextSponsored && nextSponsored.matchScore >= nextOrganic.matchScore)) {
          finalResults.push(nextSponsored);
          sponsoredIndex++;
          sponsoredCount++;
          continue;
        }
      }

      if (organicIndex < organic.length) {
        finalResults.push(organic[organicIndex]);
        organicIndex++;
      } else if (sponsoredIndex < sponsored.length) {
        finalResults.push(sponsored[sponsoredIndex]);
        sponsoredIndex++;
      }
    } else {
      const remaining = [...sponsored.slice(sponsoredIndex), ...organic.slice(organicIndex)];
      remaining.sort((a, b) => b.matchScore - a.matchScore);
      finalResults.push(...remaining);
      break;
    }
  }

  return enforceChainDiversity(finalResults);
}
