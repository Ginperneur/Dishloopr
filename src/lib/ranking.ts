/**
 * Dishloopr Ranking Engine v2
 * 
 * Optimized scoring formula based on:
 * - Bayesian average rating (prevents 1-review 5.0 from dominating)
 * - Dish-specific confidence weighting
 * - Review recency decay
 * - Newness boost for fresh restaurants
 * - Chain diversity enforcement
 * - Fair exposure rotation
 */

// === TUNING CONSTANTS ===
const BAYESIAN_PRIOR_RATING = 3.5;     // Prior mean (global average assumption)
const BAYESIAN_MIN_REVIEWS = 5;        // Minimum reviews before rating stabilizes
const DISH_MATCH_BASE = 100;           // Base score for any dish match
const DISH_MATCH_EXTRA = 20;           // Per additional matched dish
const SIGNATURE_BONUS = 50;            // Bonus per signature dish match
const CONFIDENCE_WEIGHT = 15;          // Max bonus from high confidence_score
const CUISINE_MATCH_SCORE = 5;         // Cuisine name match
const NAME_MATCH_SCORE = 3;            // Restaurant name match
const FEATURED_BOOST = 2;             
const TOP_LISTING_BOOST = 1;          
const SPONSORED_BOOST = 15;           
const NEWNESS_BOOST_MAX = 8;           // Max boost for restaurants < 30 days old
const NEWNESS_WINDOW_DAYS = 30;        // How long the newness boost applies
const MAX_SPONSORED_IN_TOP5 = 2;       // Cap sponsored in top 5
const MAX_SAME_CHAIN_IN_TOP10 = 2;     // Cap same chain in top 10
const RECENCY_HALF_LIFE_DAYS = 90;     // Reviews lose half their weight after this many days

export interface ScoringContext {
  queryLower: string;
  now: Date;
}

export interface DishMatchInfo {
  name: string;
  isSignature: boolean;
  confidenceScore: number;
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
  /** How many of the user's query terms this restaurant covers */
  queryTermsCovered?: number;
  /** Total number of query terms the user searched for */
  totalQueryTerms?: number;
}

export interface ScoredResult {
  matchScore: number;
  bayesianRating: number;
  matchedDishes: string[];
  hasDishMatch: boolean;
  isSponsored: boolean;
}

/**
 * Bayesian Average Rating
 * Prevents restaurants with few reviews from dominating.
 * Formula: (C * m + sum_of_ratings) / (C + n)
 * Where C = min reviews, m = prior mean, n = actual review count
 */
export function bayesianRating(rawRating: number, reviewCount: number): number {
  if (reviewCount === 0) return BAYESIAN_PRIOR_RATING;
  return (
    (BAYESIAN_MIN_REVIEWS * BAYESIAN_PRIOR_RATING + rawRating * reviewCount) /
    (BAYESIAN_MIN_REVIEWS + reviewCount)
  );
}

/**
 * Newness Boost
 * Gives new restaurants a temporary visibility boost so they aren't buried.
 * Decays linearly over NEWNESS_WINDOW_DAYS.
 */
function newnessBoost(createdAt: string, now: Date): number {
  const created = new Date(createdAt);
  const daysSinceCreation = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceCreation > NEWNESS_WINDOW_DAYS) return 0;
  return NEWNESS_BOOST_MAX * (1 - daysSinceCreation / NEWNESS_WINDOW_DAYS);
}

/**
 * Confidence Weight
 * Dishes with higher confidence_score (verified by owner/admin) get a boost.
 */
function confidenceBonus(dishes: DishMatchInfo[] | null): number {
  if (!dishes || dishes.length === 0) return 0;
  const avgConfidence = dishes.reduce((sum, d) => sum + d.confidenceScore, 0) / dishes.length;
  return avgConfidence * CONFIDENCE_WEIGHT; // confidence is 0-1, so max = CONFIDENCE_WEIGHT
}

/**
 * Score a single restaurant against a search query.
 */
export function scoreRestaurant(
  restaurant: RestaurantScoringInput,
  ctx: ScoringContext
): ScoredResult {
  let matchScore = 0;
  const matchedDishes: string[] = [];
  const hasDishMatch = !!(restaurant.linkedDishes && restaurant.linkedDishes.length > 0);

  // 1. Dish match scoring (PRIMARY)
  if (hasDishMatch && restaurant.linkedDishes) {
    matchScore += DISH_MATCH_BASE + (restaurant.linkedDishes.length - 1) * DISH_MATCH_EXTRA;

    // Signature bonus
    const signatureCount = restaurant.linkedDishes.filter(d => d.isSignature).length;
    matchScore += signatureCount * SIGNATURE_BONUS;

    // Confidence bonus (NEW)
    matchScore += confidenceBonus(restaurant.linkedDishes);

    matchedDishes.push(...restaurant.linkedDishes.map(d => d.name));
  }

  // 2. Cuisine match (secondary)
  if (ctx.queryLower && restaurant.cuisines?.some(c => c.toLowerCase().includes(ctx.queryLower))) {
    matchScore += CUISINE_MATCH_SCORE;
  }

  // 3. Name match (secondary)
  if (ctx.queryLower && restaurant.name.toLowerCase().includes(ctx.queryLower)) {
    matchScore += NAME_MATCH_SCORE;
  }

  // 4. Featured/top listing boost
  if (restaurant.is_featured) matchScore += FEATURED_BOOST;
  if (restaurant.is_top_listing) matchScore += TOP_LISTING_BOOST;

  // 5. Sponsored boost (only if dish match exists)
  if (restaurant.isSponsored && hasDishMatch) {
    matchScore += SPONSORED_BOOST;
  }

  // 6. Newness boost — fair exposure for new restaurants
  matchScore += newnessBoost(restaurant.created_at, ctx.now);

  // 7. Multi-query coverage bonus — reward restaurants matching multiple searched dishes
  const covered = restaurant.queryTermsCovered ?? 0;
  const total = restaurant.totalQueryTerms ?? 1;
  if (total > 1 && covered > 1) {
    // Partial bonus per extra term matched
    matchScore += (covered - 1) * MULTI_QUERY_PARTIAL_BONUS;
    // Full match bonus when ALL terms are covered
    if (covered >= total) {
      matchScore += MULTI_QUERY_FULL_MATCH_BONUS;
    }
  }

  // 7. Bayesian rating (NEW) — replaces raw rating for tie-breaking
  const bRating = bayesianRating(restaurant.rating, restaurant.review_count);

  return {
    matchScore,
    bayesianRating: bRating,
    matchedDishes,
    hasDishMatch,
    isSponsored: restaurant.isSponsored,
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
