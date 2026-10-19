"""Run with python3 e2e/search_return_test.py."""
import asyncio
from urllib.parse import parse_qs, urlparse
from playwright.async_api import async_playwright


async def check_search_return():
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1280, "height": 1800})
        await page.goto("http://localhost:8080/search?dish=Poke%20bowl")
        cards = page.locator("a.restaurant-card")
        await cards.first.wait_for(timeout=60000)
        original_urls = await cards.evaluate_all("links => links.map(link => link.getAttribute('href'))")
        await cards.first.click()
        back = page.get_by_role("link", name="Terug", exact=True)
        await back.wait_for(timeout=30000)
        await back.click()
        await cards.first.wait_for(timeout=60000)
        assert parse_qs(urlparse(page.url).query).get("dish") == ["poke bowl"], page.url
        assert await cards.evaluate_all("links => links.map(link => link.getAttribute('href'))") == original_urls
        print("PASS: restaurant back returns to the same poke bowl selection")
        await browser.close()


if __name__ == "__main__":
    asyncio.run(check_search_return())
