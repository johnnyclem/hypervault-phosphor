import { chromium } from "playwright";

const url = process.argv[2] || "http://127.0.0.1:8080/";
const shot = process.argv[3] || "/workspace/screenshots/phosphor-playing.png";

const browser = await chromium.launch({
  headless: true,
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"],
});
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  permissions: ["midi", "microphone"],
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});

await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(800);

// Click enable audio
const boot = page.getByRole("button", { name: /Enable Audio/i });
await boot.click();
await page.waitForTimeout(600);

// Press some keys via pointer on piano and keyboard events
await page.keyboard.down("z");
await page.waitForTimeout(200);
await page.keyboard.down("x");
await page.waitForTimeout(200);
await page.keyboard.down("c");
await page.waitForTimeout(400);

// Change waveform
const square = page.getByRole("button", { name: /^square$/i });
if (await square.count()) await square.click();
await page.waitForTimeout(150);

// Change video mode
const glitch = page.getByRole("button", { name: /^GLITCH$/i });
if (await glitch.count()) await glitch.click();
await page.waitForTimeout(300);

// Octave up
const octUp = page.getByRole("button", { name: /Octave up/i });
if (await octUp.count()) await octUp.click();
await page.waitForTimeout(150);

await page.keyboard.up("z");
await page.keyboard.up("x");
await page.keyboard.up("c");
await page.waitForTimeout(200);

// Click a white key on piano
const pianoKeys = page.locator("section").filter({ hasText: "Keyboard" }).getByRole("button");
const count = await pianoKeys.count();
if (count > 2) {
  await pianoKeys.nth(2).dispatchEvent("pointerdown");
  await page.waitForTimeout(300);
  await pianoKeys.nth(2).dispatchEvent("pointerup");
}

await page.waitForTimeout(400);
await page.screenshot({ path: shot, fullPage: true });

// Mobile viewport
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(300);
await page.screenshot({ path: "/workspace/screenshots/phosphor-mobile.png", fullPage: true });

const bodyText = await page.locator("body").innerText();
const hasCanvas = (await page.locator("canvas").count()) > 0;
const bootGone = (await page.getByRole("button", { name: /Enable Audio/i }).count()) === 0;

console.log(JSON.stringify({
  bootGone,
  hasCanvas,
  bodyTextLen: bodyText.length,
  errors,
  pianoButtons: count,
  shot,
}, null, 2));

await browser.close();
