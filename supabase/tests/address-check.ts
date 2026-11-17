// Checks when an owner's new address is applied automatically and when an admin must look.
// Usage from the repo root: deno run supabase/tests/address-check.ts
import { decideAddress, parseTyped, type PdokDoc } from "../functions/_shared/addressCheck.ts";
let ok = true;
const check = (l: string, p: boolean, g?: unknown) => { ok &&= p; console.log(p ? "PASS" : "FAIL", l, p ? "" : JSON.stringify(g)); };
const breda: PdokDoc = { weergavenaam: "Ginnekenweg 90, 4818JH Breda", straatnaam: "Ginnekenweg", huisnummer: 90, postcode: "4818JH",
  woonplaatsnaam: "Breda", gemeentenaam: "Breda", centroide_ll: "POINT(4.7816463 51.57597413)" };
const near = { lat: 51.58, lng: 4.78 };
const ok1 = decideAddress({ typed: "Ginnekenweg 90, Breda", doc: breda, cityNames: ["Breda"], current: near });
check("exact match in own city: applied, with postcode", ok1.auto && ok1.address === "Ginnekenweg 90, 4818 JH Breda" && !!ok1.lat, ok1);
check("typo-free but other number: admin", !decideAddress({ typed: "Ginnekenweg 92", doc: breda, cityNames: ["Breda"] }).auto);
check("other street: admin", !decideAddress({ typed: "Ginnekenstraat 90", doc: breda, cityNames: ["Breda"] }).auto);
check("other city: admin", !decideAddress({ typed: "Ginnekenweg 90", doc: breda, cityNames: ["Tilburg"] }).auto);
check("alias city (village belonging to the city) ok", decideAddress({ typed: "Ginnekenweg 90", doc: { ...breda, woonplaatsnaam: "Prinsenbeek", gemeentenaam: "Breda" }, cityNames: ["Breda"] }).auto);
const dh = { ...breda, weergavenaam: "Spui 70, 2511BT 's-Gravenhage", straatnaam: "Spui", huisnummer: 70, woonplaatsnaam: "'s-Gravenhage", gemeentenaam: "'s-Gravenhage" };
check("Den Haag equals 's-Gravenhage", decideAddress({ typed: "Spui 70", doc: dh, cityNames: ["Den Haag"] }).auto);
check("moved more than 10 km: admin", !decideAddress({ typed: "Ginnekenweg 90", doc: breda, cityNames: ["Breda"], current: { lat: 52.37, lng: 4.9 } }).auto);
check("not in register: admin", !decideAddress({ typed: "Nergensweg 1", doc: null, cityNames: ["Breda"] }).auto);
const add = { ...breda, weergavenaam: "Ginnekenweg 90-B1, 4818JH Breda", huisnummertoevoeging: "B1" };
check("addition must match when given", decideAddress({ typed: "Ginnekenweg 90-B1", doc: add, cityNames: ["Breda"] }).auto && !decideAddress({ typed: "Ginnekenweg 90 B2", doc: add, cityNames: ["Breda"] }).auto);
check("parse 'Laan van Meerdervoort 12A'", JSON.stringify(parseTyped("Laan van Meerdervoort 12A, Den Haag")) === '{"street":"Laan van Meerdervoort","number":12,"addition":"A"}', parseTyped("Laan van Meerdervoort 12A, Den Haag"));
Deno.exit(ok ? 0 : 1);
