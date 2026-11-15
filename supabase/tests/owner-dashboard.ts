// Checks the owner dashboard helpers: old tab ids still land in the right section, the single page
// score, the greeting name, and that percentages never come out as NaN.
// Usage from the repo root: deno run supabase/tests/owner-dashboard.ts
import { resolveOwnerTab } from "../../src/lib/ownerTabs.ts";
import { pageTasks, pageScore } from "../../src/lib/pageScore.ts";
import { ownerFirstName, topPercent, safePercent } from "../../src/lib/ownerFormat.ts";
let ok = true;
const check = (l: string, p: boolean, g?: unknown) => { ok &&= p; console.log(p ? "PASS" : "FAIL", l, p ? "" : JSON.stringify(g)); };
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

check("content opens Profiel", eq(resolveOwnerTab("content"), { tab: "profile" }));
check("market opens Inzichten, sub Markt", eq(resolveOwnerTab("market"), { tab: "insights", sub: "market" }));
check("invoices opens Instellingen, sub facturen", eq(resolveOwnerTab("invoices"), { tab: "settings", sub: "billing" }));
check("integrations opens Reserveringen", eq(resolveOwnerTab("integrations"), { tab: "reservations" }));
check("marketing opens Promoties", eq(resolveOwnerTab("marketing"), { tab: "promotions" }));
check("new id kept", eq(resolveOwnerTab("reviews"), { tab: "reviews" }));
check("unknown and empty go to Overzicht", eq(resolveOwnerTab("sponsoring"), { tab: "overview" }) && eq(resolveOwnerTab(null), { tab: "overview" }));

const base = { isVerified: true, description: "Indonesische huiskeuken met verse sambal van oma.", images: ["a", "b", "c"],
  openingHours: { mon: "12:00 - 22:00" }, phone: "020 1234567", websiteUrl: "https://x.nl", instagramUrl: "https://instagram.com/x",
  tiktokUrl: null, approvedDishes: 6, suggestedDishes: 0, menuMinimum: 5, unansweredReviews: 0 };
check("complete page scores 100", pageScore(pageTasks(base)) === 100);
const half = pageTasks({ ...base, isVerified: false, images: ["a"], phone: "", approvedDishes: 2, unansweredReviews: 2 });
check("missing items lower the score", pageScore(half) < 100 && pageScore(half) > 0, pageScore(half));
check("dish task counts what is left", half.find(t => t.id === "dishes")?.label === "Voeg nog 3 gerechten toe", half.find(t => t.id === "dishes"));
check("photo task counts what is left", half.find(t => t.id === "photos")?.label === "Voeg nog 2 foto's toe", half.find(t => t.id === "photos"));
check("empty opening hours are not done", !pageTasks({ ...base, openingHours: { mon: "" } }).find(t => t.id === "hours")!.done);
check("website_url counts for contact (was website)", pageTasks(base).find(t => t.id === "contact")!.done);
check("every task links to a section", half.every(t => ["verify", "profile", "menu", "reviews"].includes(t.tab)));

check("first name from profile", ownerFirstName({ profileName: "Ginuwine Ayanne" }) === "Ginuwine");
check("falls back to metadata", ownerFirstName({ profileName: " ", metaName: "Sanne de Vries" }) === "Sanne");
check("falls back to e-mail", ownerFirstName({ email: "mehmet.k@x.nl" }) === "Mehmet");
check("no name from numeric e-mail", ownerFirstName({ email: "info123@x.nl" }) === null);

check("no comparison data gives null, not NaN", topPercent(4.5, []) === null);
check("rating 0 gives null, not Top 100%", topPercent(0, [4, 4.5]) === null);
check("best in city is top 1x%", topPercent(4.9, [4, 4.2, 4.5, 3.9]) === 20, topPercent(4.9, [4, 4.2, 4.5, 3.9]));
check("never above 100", (topPercent(1, [4, 4.5, 5]) ?? 0) <= 100);
check("percent with zero base is null", safePercent(3, 0) === null);
check("percent rounds", safePercent(1, 3) === 33.3);
Deno.exit(ok ? 0 : 1);
