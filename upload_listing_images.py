"""
Upload images to Cloudinary for the 4 new eBay listing HTML files.
Uses ScraperAPI to find real Amazon products, then uploads images to Cloudinary.
"""
import json, time, hashlib, base64, re, ssl, sys
import urllib.request, urllib.parse, http.client

SCRAPER_KEY  = "d9a789db0998e3f682943c803f9e8bf1"
CLOUD_NAME   = "dil2ttxah"
CLOUD_KEY    = "316169511951178"
CLOUD_SECRET = "cU8EE59jYIXi_Vr9ZiVabmodE30"

PRODUCTS = [
    {
        "slug":  "bamboo-cutting-board",
        "query": "bamboo cutting board with juice groove",
    },
    {
        "slug":  "silicone-food-bags",
        "query": "reusable silicone food storage bags set airtight",
    },
    {
        "slug":  "pantry-door-organizer",
        "query": "over door pantry organizer shelf rack no drill",
    },
    {
        "slug":  "nonstick-baking-sheet",
        "query": "non stick baking sheet pan set carbon steel",
    },
]

CTX = ssl.create_default_context()
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0 Safari/537.36"
}


def http_get_json(url, timeout=40):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=timeout, context=CTX) as r:
        return json.loads(r.read().decode("utf-8"))


def scraper_search(query):
    url = (
        "https://api.scraperapi.com/structured/amazon/search/v1"
        f"?api_key={SCRAPER_KEY}&query={urllib.parse.quote(query)}&country=us"
    )
    try:
        data = http_get_json(url)
        return (
            data.get("results")
            or data.get("organic_results")
            or data.get("products")
            or []
        )
    except Exception as e:
        print(f"  [search] {e}")
        return []


def scraper_product(asin):
    url = (
        "https://api.scraperapi.com/structured/amazon/product/v1"
        f"?api_key={SCRAPER_KEY}&asin={asin}&country=us"
    )
    try:
        return http_get_json(url)
    except Exception as e:
        print(f"  [product] {e}")
        return {}


def upgrade_url(url):
    """Remove Amazon size qualifiers to get full-res image."""
    if not url or "m.media-amazon.com/images/I/" not in url:
        return url
    return re.sub(r"\._[A-Z0-9_]+_(?=\.jpg)", "", url, flags=re.IGNORECASE)


def download(url):
    for attempt_url in [upgrade_url(url), url]:
        try:
            req = urllib.request.Request(attempt_url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=20, context=CTX) as r:
                ct = r.headers.get("Content-Type", "image/jpeg").split(";")[0].strip()
                data = r.read()
                if len(data) > 2000:           # skip tiny/broken images
                    return data, ct
        except Exception:
            pass
    return None, None


def cloudinary_upload(img_bytes, content_type, folder, public_id):
    """Signed Cloudinary upload using base64 data URI (same as autoList.js)."""
    ts = str(int(time.time()))
    to_sign = f"folder={folder}&public_id={public_id}&timestamp={ts}{CLOUD_SECRET}"
    sig = hashlib.sha1(to_sign.encode()).hexdigest()

    b64 = base64.b64encode(img_bytes).decode()
    data_uri = f"data:{content_type};base64,{b64}"

    body = urllib.parse.urlencode({
        "file":       data_uri,
        "api_key":    CLOUD_KEY,
        "timestamp":  ts,
        "signature":  sig,
        "folder":     folder,
        "public_id":  public_id,
    }).encode("utf-8")

    try:
        req = urllib.request.Request(
            f"https://api.cloudinary.com/v1_1/{CLOUD_NAME}/image/upload",
            data=body,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=60, context=CTX) as r:
            resp = json.loads(r.read().decode("utf-8"))
            return resp.get("secure_url")
    except urllib.error.HTTPError as e:
        err_body = e.read().decode()
        print(f"  [cloudinary] HTTP {e.code}: {err_body[:200]}")
        return None
    except Exception as e:
        print(f"  [cloudinary] {e}")
        return None


def pick_best(results):
    """Return the first result with ASIN that meets discovery criteria."""
    for r in results[:15]:
        asin = r.get("asin", "")
        if len(asin) != 10:
            continue
        rating  = float(r.get("rating") or r.get("average_rating") or 0)
        reviews = int(r.get("reviews_count") or r.get("total_ratings") or r.get("ratings_total") or 0)
        price_raw = str(r.get("price") or "0").replace("$", "").replace(",", "").split("-")[0].strip()
        try:
            price = float(price_raw)
        except ValueError:
            price = 0
        ok_rating  = rating == 0 or rating >= 4.0
        ok_reviews = reviews == 0 or reviews >= 50
        ok_price   = price == 0 or price < 50
        if ok_rating and ok_reviews and ok_price:
            return r
    # fallback: first with valid ASIN
    for r in results[:5]:
        if len(r.get("asin", "")) == 10:
            return r
    return None


def collect_image_urls(product_data, search_result):
    """Gather all image URLs from product page and search result thumbnail."""
    urls = []
    # Main image
    for key in ("main_image", "image", "thumbnail", "image_url"):
        v = product_data.get(key) or search_result.get(key) or ""
        if isinstance(v, dict):
            v = v.get("url") or v.get("src") or ""
        if v and v not in urls:
            urls.append(v)
    # Image arrays
    for key in ("images", "gallery", "image_urls", "alt_images", "product_photos"):
        imgs = product_data.get(key) or []
        if isinstance(imgs, list):
            for img in imgs:
                url = (img.get("url") or img.get("src") or img.get("link") or "") \
                      if isinstance(img, dict) else str(img)
                if url and url not in urls:
                    urls.append(url)
    return [u for u in urls if u.startswith("http")]


# ── Main ──────────────────────────────────────────────────────────────
all_results = {}

for product in PRODUCTS:
    slug  = product["slug"]
    query = product["query"]

    print(f"\n{'=' * 62}")
    print(f"LISTING : {slug}")
    print(f"Query   : {query}")

    results = scraper_search(query)
    if not results:
        print("  [!] No search results — skipping")
        continue

    best = pick_best(results)
    if not best:
        print("  [!] No qualifying product found — skipping")
        continue

    asin    = best["asin"]
    title   = best.get("title", "")[:80]
    rating  = best.get("rating") or best.get("average_rating") or "?"
    reviews = best.get("reviews_count") or best.get("total_ratings") or "?"
    price   = best.get("price") or "?"
    print(f"  ASIN    : {asin}")
    print(f"  Title   : {title}")
    print(f"  Rating  : {rating}  Reviews: {reviews}  Price: {price}")

    print("  Fetching full product page for images...")
    product_data = scraper_product(asin)
    time.sleep(1)

    image_urls = collect_image_urls(product_data, best)
    print(f"  Found {len(image_urls)} image URL(s) — uploading up to 7")

    if not image_urls:
        print("  [!] No images — skipping")
        continue

    folder   = f"ebay-listings/{slug}"
    uploaded = []

    for i, img_url in enumerate(image_urls[:7]):
        public_id = f"{slug}-{str(i + 1).zfill(2)}"
        print(f"  [{i+1}] {img_url[:72]}")
        print(f"       Downloading...", end=" ", flush=True)

        img_bytes, ct = download(img_url)
        if not img_bytes:
            print("SKIP (download failed)")
            continue
        print(f"{len(img_bytes) // 1024} KB  Uploading...", end=" ", flush=True)

        secure_url = cloudinary_upload(img_bytes, ct, folder, public_id)
        if secure_url:
            uploaded.append(secure_url)
            print(f"OK")
        else:
            print("FAILED")

        time.sleep(0.8)

    all_results[slug] = uploaded
    print(f"\n  Uploaded {len(uploaded)}/{min(len(image_urls), 7)} images")
    for u in uploaded:
        print(f"    {u}")

# ── Summary ───────────────────────────────────────────────────────────
print(f"\n{'=' * 62}")
print("SUMMARY")
for slug, urls in all_results.items():
    status = "OK" if urls else "MISSING"
    print(f"  [{status}] {slug}: {len(urls)} image(s)")

print("\nDone.")
