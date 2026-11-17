"""Website check for Overture discovery candidates (no Google data).

Fetches only the homepage of the venue's own website and reads simple signals:
reachable or not, closed for good, parked/spam domain, dine-in, menu, and
takeaway/delivery-only wording. `decide` turns those signals plus the
category-based triage into the final status. Results are cached per city.
"""
from __future__ import annotations

import html
import re
import socket
import ssl
import urllib.error
import urllib.request
import math
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from concurrent.futures import TimeoutError as PoolTimeout
from urllib.parse import urlparse

USER_AGENT = "Mozilla/5.0 (compatible; restaurant-website-check/1.0)"
TIMEOUT = 12
MAX_BYTES = 600_000

# Pages that are not the venue's own site: we cannot learn anything from them.
NOT_OWN_SITE = re.compile(
    r"(facebook|instagram|tiktok|linktr\.ee|tripadvisor|google|yelp|eet\.nu|iens|thefork)\.",
    re.I,
)
DELIVERY_PLATFORM = re.compile(r"(thuisbezorgd|ubereats|deliveroo|just-eat|takeaway)\.", re.I)

# Closed for good. Deliberately excludes plain "gesloten" (opening hours say "maandag gesloten").
CLOSED = re.compile(
    r"definitief gesloten|permanent gesloten|voorgoed gesloten|blijvend gesloten|"
    r"we (zijn )?gestopt|wij (zijn )?gestopt|hebben besloten te stoppen|"
    r"(sluiten|sloten) (wij |we )?(definitief |voorgoed )?(de|onze) deuren|deuren (zijn )?definitief|"
    r"sluiten (wij|we) (ons restaurant|onze zaak|de zaak)|na \d+ (mooie |prachtige |fijne )?jaren? sluiten|"
    r"afscheid (nemen|genomen) van (ons restaurant|onze gasten|jullie)|"
    r"permanently closed|closed for good|has closed|we have closed|"
    r"bedankt voor (alle|de afgelopen) (mooie )?jaren",
    re.I,
)
SPAM = re.compile(
    r"\bcasino\b|online gokken|\bslot(s| gacor)\b|\bsportsbook\b|domain (is )?for sale|"
    r"domein (is )?te koop|this domain (may be|is) for sale|buy this domain|parked (free|domain)|"
    r"\bviagra\b|\bbetting\b|\btogel\b|judi online",
    re.I,
)
DINE_IN = re.compile(
    r"reserv(eer|eren|ering|ation|ieren)|tafel (boeken|reserveren)|book a table|"
    r"zenchef|formitable|thefork|opentable|resengo|tablebooker|"
    r"\bdiner\b|\bdineren\b|\bterras\b|zitplaatsen|à la carte|a la carte|"
    r"chef'?s? (menu|table)|proeverij|degustation|wijnarrangement",
    re.I,
)
MENU = re.compile(
    r"\bmenu\b|\bmenukaart\b|\bkaart\b|\bgerechten\b|voorgerecht|hoofdgerecht|nagerecht|"
    r"\bstarters?\b|\bmains?\b|\bdesserts?\b|lunchkaart|dinerkaart",
    re.I,
)
TAKEAWAY = re.compile(
    r"alleen (afhalen|bezorgen|bezorging)|uitsluitend (afhalen|bezorgen)|"
    r"(nu )?online bestellen|bestel (nu )?online|in winkelmand|winkelwagen|afhaalmenu|bezorgmenu|"
    r"take ?away only|delivery only",
    re.I,
)


# How the venue describes itself in its title / opening text. Only demotes to review:
# a hotel or club can still run a real restaurant.
SELF_NOT_RESTAURANT = re.compile(
    r"broodjes?zaak|cafetaria|snackbar|\bsnacks?\b|lunchroom|\bhostel\b|\bhotel\b|watersport|"
    r"vereniging|sportclub|gyros|\bpitas?\b|d[oö]ner|shoarma|kebab|frituur|friet|"
    r"kinderkleding|kringloop|\bbakkerij\b|ijssalon",
    re.I,
)


FETCH_DEADLINE = 40  # seconds per page from request to last byte; slow-drip sites count as down


def _read_limited(r, deadline: float) -> str:
    chunks, size = [], 0
    while size < MAX_BYTES:
        if time.monotonic() > deadline:
            raise TimeoutError("website te traag")
        chunk = r.read(min(65536, MAX_BYTES - size))
        if not chunk:
            break
        chunks.append(chunk)
        size += len(chunk)
    return b"".join(chunks).decode(r.headers.get_content_charset() or "utf-8", "replace")


def run_pool(fn, jobs: list, workers: int, on_result, per_job_seconds: int) -> None:
    """Run fn(*args) for (key, args) jobs; on_result(key, result_or_exception) per job.

    The whole batch has a time limit, so a few hung sockets (slow DNS, endless responses)
    cannot stall the run: unfinished jobs are reported as TimeoutError and abandoned.
    """
    if not jobs:
        return
    ex = ThreadPoolExecutor(max_workers=workers)
    futures = {ex.submit(fn, *args): key for key, args in jobs}
    budget = math.ceil(len(jobs) / workers) * per_job_seconds + 300
    try:
        for fut in as_completed(futures, timeout=budget):
            try:
                on_result(futures[fut], fut.result())
            except Exception as e:
                on_result(futures[fut], e)
    except PoolTimeout:
        for fut, key in futures.items():
            if not fut.done():
                on_result(key, TimeoutError("hangt"))
    finally:
        ex.shutdown(wait=False, cancel_futures=True)


def _visible_text(raw: str) -> str:
    raw = re.sub(r"(?is)<(script|style|noscript|svg)\b.*?</\1>", " ", raw)
    title = re.search(r"(?is)<title[^>]*>(.*?)</title>", raw)
    meta = re.findall(r'(?is)<meta[^>]+(?:name|property)="(?:description|og:description)"[^>]+content="([^"]*)"', raw)
    body = re.sub(r"(?s)<[^>]+>", " ", raw)
    text = " ".join([title.group(1) if title else "", *meta, body])
    return re.sub(r"\s+", " ", html.unescape(text)).strip()


def fetch(url: str, timeout: int = TIMEOUT) -> dict:
    """Fetch one homepage. Returns {'state': 'ok'|'unreachable'|'not_own_site'|'delivery_platform', ...}."""
    if not url:
        return {"state": "no_website"}
    if not re.match(r"^https?://", url, re.I):
        url = "https://" + url
    host = urlparse(url).hostname or ""
    if DELIVERY_PLATFORM.search(host):
        return {"state": "delivery_platform", "host": host}
    if NOT_OWN_SITE.search(host):
        return {"state": "not_own_site", "host": host}
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept-Language": "nl,en;q=0.8"})
    try:
        deadline = time.monotonic() + FETCH_DEADLINE
        with urllib.request.urlopen(req, timeout=timeout) as r:
            final = r.geturl()
            raw = _read_limited(r, deadline)
    except urllib.error.HTTPError as e:
        # 401/403/429 usually mean bot protection on a live site, not a dead one.
        if e.code in (401, 403, 429, 503):
            return {"state": "blocked", "code": e.code}
        return {"state": "unreachable", "detail": f"HTTP {e.code}"}
    except (urllib.error.URLError, socket.timeout, ssl.SSLError, ConnectionError, ValueError) as e:
        reason = getattr(e, "reason", e)
        return {"state": "unreachable", "detail": type(reason).__name__ if not isinstance(reason, str) else reason}
    except Exception as e:  # broken chunked responses, odd encodings: never let one site stop the run
        return {"state": "unreachable", "detail": type(e).__name__}
    final_host = urlparse(final).hostname or ""
    resolved = final
    if DELIVERY_PLATFORM.search(final_host):
        return {"state": "delivery_platform", "host": final_host}
    text = _visible_text(raw)
    if len(text) < 40:
        return {"state": "empty"}
    def hit(rx):
        m = rx.search(text)
        return m.group(0).lower() if m else ""
    return {
        "state": "ok",
        "url": resolved,
        "closed": hit(CLOSED),
        "spam": hit(SPAM),
        "dine_in": hit(DINE_IN),
        "menu": hit(MENU),
        "takeaway": hit(TAKEAWAY),
        "self": (lambda m: m.group(0).lower() if m else "")(SELF_NOT_RESTAURANT.search(text[:400])),
    }


def url_variants(url: str) -> list[str]:
    """The given URL, then its site root, http/https swapped and with/without www."""
    if not re.match(r"^https?://", url, re.I):
        url = "https://" + url
    u = urlparse(url)
    host = u.hostname or ""
    other_host = host[4:] if host.startswith("www.") else f"www.{host}"
    other_scheme = "http" if u.scheme == "https" else "https"
    out = [url, f"{u.scheme}://{host}/", f"{other_scheme}://{host}/", f"https://{other_host}/", f"http://{other_host}/"]
    return list(dict.fromkeys(out))


def fetch_variants(url: str, timeout: int = TIMEOUT) -> dict:
    last = {"state": "unreachable", "detail": "geen variant"}
    for v in url_variants(url):
        res = fetch(v, timeout)
        if res["state"] != "unreachable":
            return res
        last = res
    return last


def check_many(urls: list[str], cache: dict, workers: int = 24, save=None, every: int = 500,
               retry_unreachable: bool = False) -> dict:
    """Fetch every uncached URL; `save(cache)` is called every `every` results so a crash loses little.

    With retry_unreachable, URLs that failed before get one more, slower attempt (longer timeout,
    fewer parallel requests); `attempts` records how often a site has been tried.
    """
    if retry_unreachable:
        todo = sorted({u for u in urls if u and cache.get(u, {}).get("state") == "unreachable"
                       and cache[u].get("attempts", 1) < 2})
        timeout, workers = 25, 64
    else:
        todo = sorted({u for u in urls if u and u not in cache})
        timeout = TIMEOUT
    fn = fetch_variants if retry_unreachable else fetch
    done = [0]

    def on_result(u, res):
        if isinstance(res, BaseException):
            res = {"state": "unreachable", "detail": type(res).__name__}
        res["attempts"] = (cache.get(u, {}).get("attempts", 1) + 1) if retry_unreachable else 1
        res["checked_at"] = int(time.time())
        cache[u] = res
        done[0] += 1
        if save and done[0] % every == 0:
            save(cache)
            print(f"  websitecheck {done[0]}/{len(todo)}", flush=True)

    run_pool(fn, [(u, (u, timeout)) for u in todo], workers, on_result,
             per_job_seconds=(5 if retry_unreachable else 1) * (FETCH_DEADLINE + 5))
    if save:
        save(cache)
    return cache


DRINKS_FIRST = {"bar", "pub", "cafe", "lounge", "cocktail_bar", "wine_bar", "beer_bar", "coffee_shop"}


def decide(status: str, reason: str, category: str, w: dict | None) -> tuple[str, str]:
    """Combine the category triage with the website signals."""
    if status not in ("approve", "review", "reject"):
        return status, reason
    w = w or {"state": "no_website"}
    state = w["state"]

    if state == "ok" and w.get("spam"):
        return ("reject", f"website: spam/geparkeerd ({w['spam']})") if status != "reject" else (status, reason)
    if state == "ok" and w.get("closed"):
        return ("reject", f"website: gesloten ({w['closed']})") if status != "reject" else (status, reason)

    if status == "reject":
        # Rescue drinks-first venues whose own site clearly runs a restaurant (e.g. "Noon").
        if category in DRINKS_FIRST and state == "ok" and w.get("dine_in") and w.get("menu") and not w.get("takeaway"):
            return "review", f"website toont restaurant ({w['dine_in']}, {w['menu']})"
        return status, reason

    if state == "delivery_platform":
        return "review", f"website is bezorgplatform ({w['host']})"
    if state in ("no_website", "not_own_site"):
        # Without its own website the menu scraper has nothing to read, so the restaurant
        # could never show dishes on Dishloopr: skip it.
        return "reject", "geen eigen website" + (f" (alleen {w.get('host')})" if state == "not_own_site" else "")
    if state == "unreachable":
        if w.get("attempts", 1) >= 2:
            return "reject", f"website 2x onbereikbaar ({w.get('detail', '')})"
        return "review", f"website onbereikbaar ({w.get('detail', '')})"
    if state in ("blocked", "empty"):
        return "review", {"blocked": "website blokkeert check", "empty": "website leeg"}[state]
    if w.get("self"):
        return "review", f"website noemt zich {w['self']}"
    if w.get("takeaway") and not w.get("dine_in"):
        return "review", f"website wijst op afhalen ({w['takeaway']})"
    if status == "approve":
        if w.get("dine_in") or w.get("menu"):
            return "approve", f"{reason}; website: {w.get('dine_in') or w.get('menu')}"
        return "review", "website zonder menu of reservering"
    return status, reason


# --- "Zeker goed": stricter check for strong candidates ----------------------------

# Lunch/coffee/high-tea places: can be fine, but not "zeker" dish-first.
NOT_DISH_FIRST = re.compile(r"high[- ]?tea|lunchcaf[eé]|lunchroom|koffie(bar|huis)?|coffee|espresso|brunch|patisserie|bakery|taart", re.I)

PRICE = re.compile(r"€\s?\d{1,3}(?:[.,]\d{2}|,-)|\b\d{1,3}[.,]\d{2}\s?(?:€|eur\b)|\b\d{1,2},(?:\d{2}|-)(?=\s|$)", re.I)
SUBPAGE_HINT = re.compile(r"menu|kaart|gerecht|eten|food|dish|lunch|diner|dinner|contact|route|over-ons|about", re.I)


def _get(url: str, timeout: int = TIMEOUT) -> str | None:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept-Language": "nl,en;q=0.8"})
    try:
        deadline = time.monotonic() + FETCH_DEADLINE
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return _read_limited(r, deadline)
    except Exception:
        return None


def _subpages(base: str, raw: str, limit: int = 3) -> list[str]:
    from urllib.parse import urljoin
    host = urlparse(base).hostname
    seen, out = set(), []
    for href, label in re.findall(r'(?is)<a[^>]+href="([^"#]+)"[^>]*>(.*?)</a>', raw):
        url = urljoin(base, href.strip())
        if urlparse(url).hostname != host or url in seen or re.search(r"\.(pdf|jpe?g|png)$", url, re.I):
            continue
        if SUBPAGE_HINT.search(href) or SUBPAGE_HINT.search(re.sub(r"<[^>]+>", " ", label)):
            seen.add(url)
            out.append(url)
        if len(out) >= limit:
            break
    return out


def _location_tokens(street: str | None, postcode: str | None) -> tuple[str, str | None]:
    pc = re.sub(r"\s+", "", postcode or "").upper()
    m = re.match(r"^(.*?)(\d{1,5})\s*[a-zA-Z]?\b", (street or "").split(",")[0].strip())
    street_rx = None
    if m and len(m.group(1).strip()) >= 3:
        name = re.escape(m.group(1).strip().lower()).replace("\\ ", "\\s*")
        street_rx = rf"{name}\s*{m.group(2)}\b"
    return pc, street_rx


def verify(url: str, street: str | None, postcode: str | None) -> dict:
    """Fetch the homepage plus up to 3 menu/contact pages and look for proof."""
    if not re.match(r"^https?://", url or "", re.I):
        url = "https://" + (url or "")
    home = _get(url)
    if home is None:
        return {"verified": False, "why": "website niet opnieuw bereikbaar"}
    pages = [home] + [p for p in (_get(u) for u in _subpages(url, home)) if p]
    text = " ".join(_visible_text(p) for p in pages)
    compact = re.sub(r"\s+", "", text).upper()
    pc, street_rx = _location_tokens(street, postcode)
    location = bool(pc and len(pc) == 6 and pc in compact) or bool(street_rx and re.search(street_rx, text.lower()))
    prices = len(PRICE.findall(text))
    dine_in = bool(DINE_IN.search(text))
    bad = CLOSED.search(text) or SPAM.search(text)
    head = _visible_text(home)[:400]
    self_desc = SELF_NOT_RESTAURANT.search(head) or NOT_DISH_FIRST.search(head)
    ok = location and (prices >= 5 or dine_in) and not bad and not self_desc
    why = []
    why.append("adres op site" if location else "adres niet op site")
    why.append(f"{prices} prijzen")
    if dine_in:
        why.append("reserveren/diner")
    if bad:
        why.append(f"signaal: {bad.group(0).lower()}")
    if self_desc:
        why.append(f"noemt zich {self_desc.group(0).lower()}")
    return {"verified": ok, "why": ", ".join(why), "pages": len(pages)}


def verify_many(rows: list[dict], cache: dict, workers: int = 120, save=None) -> dict:
    todo = [r for r in rows if r["website"] and r["overture_id"] not in cache]
    done = [0]

    def on_result(key, res):
        if isinstance(res, BaseException):
            res = {"verified": False, "why": f"fout: {type(res).__name__}"}
        cache[key] = res
        done[0] += 1
        if save and done[0] % 500 == 0:
            save(cache)
            print(f"  verificatie {done[0]}/{len(todo)}", flush=True)

    run_pool(verify, [(r["overture_id"], (r["website"], r["street"], r["postcode"])) for r in todo],
             workers, on_result, per_job_seconds=4 * (FETCH_DEADLINE + 5))
    if save:
        save(cache)
    return cache


def site_text(url: str, max_chars: int = 12000) -> dict:
    """Visible text of the homepage plus up to 3 menu/contact pages, for an LLM check."""
    if not re.match(r"^https?://", url or "", re.I):
        url = "https://" + (url or "")
    home = _get(url)
    if home is None:
        return {"ok": False, "text": ""}
    parts = [f"[home] {_visible_text(home)[:5000]}"]
    for sub in _subpages(url, home):
        raw = _get(sub)
        if raw:
            parts.append(f"[{urlparse(sub).path or '/'}] {_visible_text(raw)[:3000]}")
    return {"ok": True, "text": "\n\n".join(parts)[:max_chars]}
