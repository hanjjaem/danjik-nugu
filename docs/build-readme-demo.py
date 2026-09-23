"""Capture the real search flow as a README GIF.

Run from the repository root after installing playwright and Pillow:
    python -m pip install playwright pillow
    python docs/build-readme-demo.py
"""

from __future__ import annotations

from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from io import BytesIO
from pathlib import Path
from threading import Thread

from PIL import Image, ImageDraw, ImageFont
from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "readme-demo.gif"
WIDTH = 1100
HEADER = 106
SCREEN_WIDTH = 1080
SCREEN_HEIGHT = 608
HEIGHT = HEADER + SCREEN_HEIGHT + 20
NAME = "한재림"


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


def font(size: int, bold: bool = False):
    file = "malgunbd.ttf" if bold else "malgun.ttf"
    return ImageFont.truetype(str(Path("C:/Windows/Fonts") / file), size)


def make_frame(screenshot: bytes, stage: str, title: str, count: str) -> Image.Image:
    frame = Image.new("RGB", (WIDTH, HEIGHT), "#eef0fa")
    draw = ImageDraw.Draw(frame)
    draw.rectangle((0, 0, WIDTH, HEADER), fill="#17203a")
    draw.rounded_rectangle((23, 19, 137, 47), radius=14, fill="#9b42e7")
    draw.text((39, 23), "당직 누구?", font=font(15, True), fill="white")
    draw.text((23, 58), title, font=font(28, True), fill="white")
    draw.text((925, 24), f"{stage}  /  {count}", font=font(17, True), fill="#cbbdf1")
    image = Image.open(BytesIO(screenshot)).convert("RGB")
    image = image.resize((SCREEN_WIDTH, SCREEN_HEIGHT), Image.Resampling.LANCZOS)
    frame.paste(image, (10, HEADER + 4))
    draw.rounded_rectangle((9, HEADER + 3, WIDTH - 9, HEIGHT - 15), radius=9, outline="#d5daea", width=2)
    return frame


def capture(page, frames: list, title: str, stage: str, duration: int):
    frames.append((make_frame(page.screenshot(type="png"), stage, title, "05"), duration))


def scroll_to(page, selector: str, offset: int = 85):
    page.evaluate(
        """([selector, offset]) => {
            const node = document.querySelector(selector);
            window.scrollTo({top: node.getBoundingClientRect().top + scrollY - offset, behavior: 'instant'});
        }""",
        [selector, offset],
    )
    page.wait_for_timeout(100)


def scroll_between(page, selector: str, frames: list, title: str, stage: str, offset: int = 85):
    start = page.evaluate("scrollY")
    end = page.evaluate(
        """([selector, offset]) => {
            const node = document.querySelector(selector);
            return Math.max(0, node.getBoundingClientRect().top + scrollY - offset);
        }""",
        [selector, offset],
    )
    for fraction in (0.25, 0.5, 0.75, 1):
        page.evaluate("y => window.scrollTo({top: y, behavior: 'instant'})", start + (end - start) * fraction)
        page.wait_for_timeout(60)
        capture(page, frames, title, stage, 100)


def main():
    server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=str(ROOT / "app")))
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    frames = []
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(channel="chrome", headless=True)
            page = browser.new_page(viewport={"width": 1280, "height": 720}, device_scale_factor=1, reduced_motion="reduce")
            page.goto(f"http://127.0.0.1:{server.server_port}/", wait_until="load")
            page.wait_for_function("window.focusCalendarOnPerson !== undefined")
            page.wait_for_selector("#stats tbody tr")

            capture(page, frames, "오늘 당직부터 한눈에", "01", 1400)
            field = page.locator("#name-input")
            field.click()
            capture(page, frames, "이름 검색: 한재림", "02", 500)
            for part in ("한", "한재", NAME):
                field.fill(part)
                page.wait_for_timeout(100)
                capture(page, frames, "이름 검색: 한재림", "02", 500 if part != NAME else 1000)

            assert page.locator("#cal-label").inner_text()
            assert page.locator(".cal-cell--latest").count() == 1
            assert NAME in page.locator("#history-section").inner_text()
            scroll_between(page, "#calendar", frames, "한재림 일정이 캘린더에 강조돼요", "03")
            capture(page, frames, "한재림 일정이 캘린더에 강조돼요", "03", 1500)

            scroll_between(page, "#my-duty", frames, "한재림의 당직 횟수와 월별 통계", "04")
            capture(page, frames, "한재림의 당직 횟수와 월별 통계", "04", 1600)
            scroll_between(page, "#history-section", frames, "한재림의 당직 이력도 바로 확인", "04")
            capture(page, frames, "한재림의 당직 이력도 바로 확인", "04", 1500)

            assert NAME in page.locator("#stats tr.row--selected").inner_text()
            scroll_between(page, "#stats", frames, "전체 통계에서도 한재림 행 강조", "05")
            capture(page, frames, "전체 통계에서도 한재림 행 강조", "05", 700)
            scroll_between(page, "#stats tr.row--selected", frames, "전체 통계에서도 한재림 행 강조", "05", 310)
            capture(page, frames, "전체 통계에서도 한재림 행 강조", "05", 1800)
            browser.close()

        images, durations = zip(*frames)
        images[0].save(
            OUTPUT,
            save_all=True,
            append_images=list(images[1:]),
            duration=list(durations),
            loop=0,
            optimize=True,
            disposal=2,
        )
        print(f"Created {OUTPUT} ({OUTPUT.stat().st_size:,} bytes, {len(images)} frames)")
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    main()
