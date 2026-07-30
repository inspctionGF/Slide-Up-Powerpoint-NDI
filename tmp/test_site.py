from pathlib import Path
from tempfile import gettempdir
from playwright.sync_api import sync_playwright


ROOT = Path(gettempdir()) / "slide-up-site-tests"
ROOT.mkdir(parents=True, exist_ok=True)


def assert_no_horizontal_overflow(page, label):
    dimensions = page.evaluate(
        """() => ({
            scrollWidth: document.documentElement.scrollWidth,
            clientWidth: document.documentElement.clientWidth
        })"""
    )
    assert dimensions["scrollWidth"] <= dimensions["clientWidth"] + 1, (
        f"Débordement horizontal {label}: {dimensions}"
    )


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)

    desktop = browser.new_page(viewport={"width": 1440, "height": 1000})
    desktop_errors = []
    desktop.on("console", lambda msg: desktop_errors.append(msg.text) if msg.type == "error" else None)
    desktop.goto("http://127.0.0.1:5173", wait_until="networkidle")

    assert desktop.title() == "Slide-up — PowerPoint vers NDI"
    assert desktop.get_by_role("heading", name="Vos slides. Sur le réseau.").is_visible()
    assert desktop.get_by_role("link", name="Télécharger pour Windows").get_attribute("href").endswith(
        "Slide-up.Setup.0.0.0.exe"
    )
    assert desktop.locator(".broadcast-window").is_visible()
    assert desktop.locator("details").count() == 4
    desktop.screenshot(path=str(ROOT / "site-desktop-hero.png"))
    for element in desktop.locator("[data-reveal]").all():
        element.scroll_into_view_if_needed()
        desktop.wait_for_timeout(80)
    desktop.locator("#accueil").scroll_into_view_if_needed()
    desktop.locator("details").first.click()
    assert desktop.locator("details").first.get_attribute("open") is not None
    assert_no_horizontal_overflow(desktop, "desktop")
    desktop.screenshot(path=str(ROOT / "site-desktop.png"), full_page=True)

    mobile = browser.new_page(viewport={"width": 390, "height": 844})
    mobile_errors = []
    mobile.on("console", lambda msg: mobile_errors.append(msg.text) if msg.type == "error" else None)
    mobile.goto("http://127.0.0.1:5173", wait_until="networkidle")

    toggle = mobile.locator("[data-nav-toggle]")
    assert toggle.is_visible()
    toggle.click()
    assert toggle.get_attribute("aria-expanded") == "true"
    assert mobile.locator("[data-nav]").evaluate("el => el.classList.contains('is-open')")
    mobile.get_by_role("link", name="Fonctionnalités").click()
    assert toggle.get_attribute("aria-expanded") == "false"
    for element in mobile.locator("[data-reveal]").all():
        element.scroll_into_view_if_needed()
        mobile.wait_for_timeout(50)
    mobile.locator("#accueil").scroll_into_view_if_needed()
    assert_no_horizontal_overflow(mobile, "mobile")
    mobile.screenshot(path=str(ROOT / "site-mobile-hero.png"))
    mobile.screenshot(path=str(ROOT / "site-mobile.png"), full_page=True)

    errors = desktop_errors + mobile_errors
    assert not errors, f"Erreurs console: {errors}"

    print("OK: desktop, mobile, navigation, FAQ, CTA et débordement")
    browser.close()
