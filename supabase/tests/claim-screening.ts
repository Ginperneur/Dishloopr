// Decision rules of the AI claim pre-check (auto-approve only on a full KvK match).
// Usage from the repo root: deno run -A --config supabase/tests/deno.json supabase/tests/claim-screening.ts
import { addressParts, claimantListed, decide, namesMatch } from "../functions/_shared/claimScreening.ts";

let failures = 0;
const check = (name: string, ok: boolean) => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}`); if (!ok) failures++; };

const restaurant = { name: "Trattoria da Marco", address: "Oudegracht 123, 3511 AB Utrecht" };
const kvk = {
  doc_type: "kvk_extract" as const, business_names: ["Da Marco B.V.", "Trattoria da Marco"], persons: ["Marco de Rossi", "Anna Jansen"],
  postal_code: "3511 ab", house_number: "123", city: "Utrecht", kvk_number: "12345678", confidence: 0.93, notes: "",
};

check("address parts from a Dutch address", JSON.stringify(addressParts(restaurant.address)) === JSON.stringify({ postal: "3511AB", house: "123" }));
check("house number with letter suffix", addressParts("Kerkstraat 12a, 1011 AA Amsterdam").house === "12");
check("name match ignores legal form and noise words", namesMatch("Restaurant De Gouden Lepel", ["Gouden Lepel V.O.F."]));
check("different business does not match", !namesMatch("Trattoria da Marco", ["Pizzeria Napoli B.V."]));
check("claimant listed despite particles", claimantListed("Marco Rossi", ["Marco de Rossi"]));
check("claimant needs first and last name", !claimantListed("Marco", ["Marco de Rossi"]));
check("other person is not the claimant", !claimantListed("Peter Bakker", kvk.persons));

check("full KvK match is auto-approved", decide(kvk, restaurant, "Marco Rossi").verdict === "auto_approve");
check("bought KvK extract by a stranger goes to review", decide(kvk, restaurant, "Peter Bakker").verdict === "review");
check("invoice always goes to review", decide({ ...kvk, doc_type: "invoice" }, restaurant, "Marco Rossi").verdict === "review");
check("wrong house number goes to review", decide({ ...kvk, house_number: "125" }, restaurant, "Marco Rossi").verdict === "review");
check("wrong postcode goes to review", decide({ ...kvk, postal_code: "3512AB" }, restaurant, "Marco Rossi").verdict === "review");
check("low confidence goes to review", decide({ ...kvk, confidence: 0.6 }, restaurant, "Marco Rossi").verdict === "review");
check("missing restaurant address goes to review", decide(kvk, { ...restaurant, address: null }, "Marco Rossi").verdict === "review");
const r = decide({ ...kvk, doc_type: "menu", house_number: null }, restaurant, "Peter Bakker");
check("review lists every reason", r.reasons.length === 3 && r.reasons.includes("Geen KvK-uittreksel"));

console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
Deno.exit(failures ? 1 : 0);
