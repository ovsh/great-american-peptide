import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import chromeLauncher from 'chrome-launcher';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'store-assets', 'app-store');
const BG = path.join(OUT, 'backdrops', 'gpt-image-2-clinical-ledger-backdrop.png');
const REAL = path.join(OUT, 'screenshots', 'real-scerenshots');

const devices = [
  { key: 'iphone-6.7', width: 1284, height: 2778, shotW: 1128 },
  { key: 'ipad-13', width: 2064, height: 2752, shotW: 1120 },
];

const real = {
  today: 'WhatsApp Image 2026-04-30 at 01.25.14.jpeg',
  logShot: 'WhatsApp Image 2026-04-30 at 01.25.14 (1).jpeg',
  siteMap: 'WhatsApp Image 2026-04-30 at 01.25.15.jpeg',
  calendar: 'WhatsApp Image 2026-04-30 at 01.25.15 (1).jpeg',
};

const slides = [
  {
    id: '01-today',
    kicker: 'TODAY',
    title: "Keep today's plan visible.",
    sub: 'Timing, trends, weight, and goals in one focused home view.',
    image: real.today,
    chips: ['Next entry', 'Trend view', 'Weight goal'],
  },
  {
    id: '02-log-shot',
    kicker: 'LOG SHOT',
    title: 'Log in seconds.',
    sub: 'Item, amount, date, time, and site stay together.',
    image: real.logShot,
    chips: ['Amount steps', 'Date & time', 'Site rotation'],
  },
  {
    id: '03-site-map',
    kicker: 'BODY SITES',
    title: 'See every body site.',
    sub: 'Tap front or back and keep rotation visible while you log.',
    image: real.siteMap,
    chips: ['Front & back', 'All sites', 'Rotation context'],
  },
  {
    id: '04-calendar',
    kicker: 'CALENDAR',
    title: 'Keep the routine visible.',
    sub: 'Review logged days, amounts, and timing without digging.',
    image: real.calendar,
    chips: ['Monthly view', 'Entry history', 'Amount notes'],
  },
  {
    id: '05-reconstitution',
    kicker: 'LAB CALC',
    title: 'Research reconstitution math.',
    sub: 'Convert vial mass and diluent volume into concentration values.',
    mock: 'reconstitution',
    chips: ['mcg/mL', 'mg/mL', 'Aliquot volume'],
  },
];

function esc(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[ch]);
}

function cssUrl(filePath) {
  return pathToFileURL(filePath).href;
}

function deviceContent(slide, shotUrl) {
  if (slide.mock === 'reconstitution') {
    return `<div class="mock-screen">
      <div class="mock-status">
        <span>1:24</span>
        <span class="status-icons">LTE 100%</span>
      </div>
      <div class="mock-nav">
        <span class="close">x</span>
        <strong>Reconstitution</strong>
      </div>
      <div class="mock-content">
        <div class="mock-title-row">
          <h2>Lab Calc</h2>
          <p>RECONSTITUTION MATH</p>
        </div>
        <p class="mock-sub">For laboratory researchers and scientists. Convert vial mass and diluent volume into concentration values.</p>

        <div class="mock-card">
          <div class="mock-field">
            <label>VIAL MATERIAL</label>
            <div><strong>5</strong><span>mg</span></div>
          </div>
          <div class="mock-field">
            <label>DILUENT VOLUME</label>
            <div><strong>2</strong><span>mL</span></div>
          </div>
          <div class="mock-field last">
            <label>OPTIONAL ALIQUOT AMOUNT</label>
            <div><strong>250</strong><span>mcg</span></div>
            <em>Optional research sample amount for mL conversion.</em>
          </div>
        </div>

        <div class="mock-card muted">
          <label class="accent">CALCULATED CONCENTRATION</label>
          <div class="mock-result"><strong>2500</strong><span>mcg/mL</span></div>
          <div class="mock-grid">
            <div><label>MG / ML</label><p>2.500 mg/mL</p></div>
            <div><label>VIAL TOTAL</label><p>5000 mcg</p></div>
          </div>
          <div class="mock-volume-meter">
            <div class="meter-plunger"></div>
            <div class="meter-barrel">
              <div class="meter-fill"></div>
              <div class="meter-ticks">
                <span style="left: 0%">0</span>
                <span style="left: 25%">0.25</span>
                <span style="left: 50%">0.5</span>
                <span style="left: 75%">0.75</span>
                <span style="left: 100%">1.0</span>
              </div>
              <b>0.10 mL</b>
            </div>
            <div class="meter-tip"></div>
          </div>
          <div class="mock-grid">
            <div><label>ALIQUOT VOLUME</label><p>0.100 mL</p></div>
            <div><label>DILUENT</label><p>2.00 mL</p></div>
          </div>
          <div class="mock-note">Research calculation only. No administration instructions, clinical guidance, or use recommendations.</div>
        </div>
      </div>
    </div>`;
  }

  return `<img src="${shotUrl}" alt="">`;
}

function slideHtml(slide, device) {
  const isPad = device.key === 'ipad-13';
  const shotPath = slide.image ? path.join(REAL, slide.image) : null;
  const bgUrl = cssUrl(BG);
  const shotUrl = shotPath ? cssUrl(shotPath) : '';
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    :root {
      --bg: #F2E9D8;
      --ink: #0F1B2D;
      --red: #B0202E;
      --green: #5C8264;
      --gold: #C9A961;
      --muted: #626B78;
      --border: #E5DDC8;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      width: ${device.width}px;
      height: ${device.height}px;
      overflow: hidden;
      color: var(--ink);
      background: var(--bg);
      font-family: Inter, -apple-system, BlinkMacSystemFont, "SF Pro Display", Arial, sans-serif;
    }
    .art {
      position: relative;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background:
        linear-gradient(180deg, rgba(242,233,216,.70), rgba(242,233,216,.94)),
        url("${bgUrl}");
      background-size: cover;
      background-position: center;
    }
    .art::before {
      content: "";
      position: absolute;
      left: ${isPad ? 104 : 70}px;
      right: ${isPad ? 104 : 70}px;
      top: ${isPad ? 58 : 42}px;
      height: 3px;
      background: linear-gradient(90deg, transparent, var(--red), var(--ink), var(--red), transparent);
      opacity: .55;
      z-index: 2;
    }
    .copy {
      position: absolute;
      z-index: 4;
      ${isPad
        ? 'left: 112px; top: 126px; width: 720px; text-align: left;'
        : 'left: 74px; right: 74px; top: 66px; text-align: center;'}
    }
    .kicker {
      margin: 0 0 ${isPad ? 18 : 12}px;
      color: var(--red);
      font-size: ${isPad ? 34 : 28}px;
      line-height: 1;
      letter-spacing: ${isPad ? 8 : 7}px;
      font-weight: 900;
    }
    h1 {
      margin: 0;
      color: var(--ink);
      font-family: Georgia, "Times New Roman", serif;
      font-size: ${isPad ? 98 : 78}px;
      line-height: .98;
      letter-spacing: 0;
      text-wrap: balance;
    }
    .sub {
      margin: ${isPad ? 24 : 14}px 0 0;
      color: var(--muted);
      font-size: ${isPad ? 38 : 31}px;
      line-height: 1.18;
      font-weight: 800;
      text-wrap: balance;
    }
    .chips {
      display: ${isPad ? 'flex' : 'none'};
      flex-wrap: wrap;
      gap: 12px;
      margin-top: 32px;
    }
    .chips span {
      display: inline-flex;
      align-items: center;
      gap: 9px;
      padding: 13px 17px;
      border: 1px solid rgba(15,27,45,.13);
      border-radius: 999px;
      background: rgba(255,255,255,.62);
      color: var(--ink);
      font-size: 22px;
      font-weight: 800;
      box-shadow: 0 8px 24px rgba(15,27,45,.05);
    }
    .chips span::before {
      content: "";
      width: 9px;
      height: 9px;
      border-radius: 50%;
      background: var(--red);
    }
    .device {
      position: absolute;
      z-index: 3;
      width: ${device.shotW}px;
      ${isPad
        ? 'right: 96px; bottom: 74px;'
        : 'left: 50%; bottom: 38px; transform: translateX(-50%);'}
      border-radius: ${isPad ? 72 : 78}px;
      border: ${isPad ? 8 : 7}px solid rgba(15,27,45,.96);
      overflow: hidden;
      background: #FFFDF6;
      box-shadow:
        0 ${isPad ? 42 : 38}px ${isPad ? 90 : 74}px rgba(15,27,45,.25),
        0 0 0 2px rgba(255,255,255,.8) inset;
    }
	    .device img {
	      display: block;
	      width: 100%;
	      height: auto;
	    }
	    .mock-screen {
	      width: 100%;
	      height: ${isPad ? 2140 : 2360}px;
	      background: #F2E9D8;
	      color: var(--ink);
	      overflow: hidden;
	      font-family: Inter, -apple-system, BlinkMacSystemFont, "SF Pro Display", Arial, sans-serif;
	    }
	    .mock-status {
	      display: flex;
	      justify-content: space-between;
	      align-items: center;
	      padding: 64px 92px 36px;
	      color: #05070B;
	      font-size: 42px;
	      font-weight: 900;
	    }
	    .status-icons {
	      font-size: 31px;
	      letter-spacing: 0;
	    }
	    .mock-nav {
	      position: relative;
	      display: flex;
	      justify-content: center;
	      align-items: center;
	      padding: 58px 72px 42px;
	      color: var(--ink);
	    }
	    .mock-nav .close {
	      position: absolute;
	      left: 72px;
	      top: 54px;
	      font-size: 56px;
	      line-height: 1;
	      font-weight: 400;
	    }
	    .mock-nav strong {
	      font-family: Georgia, "Times New Roman", serif;
	      font-size: 55px;
	      line-height: 1;
	    }
	    .mock-content {
	      padding: 26px 70px 120px;
	    }
	    .mock-title-row {
	      display: flex;
	      align-items: baseline;
	      justify-content: space-between;
	      gap: 28px;
	    }
	    .mock-title-row h2 {
	      margin: 0;
	      font-family: Georgia, "Times New Roman", serif;
	      font-size: 72px;
	      line-height: 1;
	      letter-spacing: 0;
	    }
	    .mock-title-row p {
	      margin: 0;
	      max-width: 360px;
	      color: var(--muted);
	      font-size: 24px;
	      line-height: 1.2;
	      font-weight: 900;
	      letter-spacing: 3px;
	      text-align: right;
	    }
	    .mock-sub {
	      margin: 24px 0 44px;
	      color: var(--muted);
	      font-size: 32px;
	      line-height: 1.28;
	      font-weight: 700;
	    }
	    .mock-card {
	      margin-top: 34px;
	      padding: 38px 42px;
	      border-radius: 30px;
	      border: 1px solid rgba(15,27,45,.10);
	      background: #FFFDF8;
	    }
	    .mock-card.muted {
	      background: #F7F0E2;
	    }
	    .mock-field {
	      padding: 0 0 30px;
	      margin-bottom: 30px;
	      border-bottom: 1px solid rgba(15,27,45,.09);
	    }
	    .mock-field.last {
	      padding-bottom: 0;
	      margin-bottom: 0;
	      border-bottom: 0;
	    }
	    .mock-field label,
	    .mock-card label {
	      display: block;
	      margin-bottom: 20px;
	      color: #69717E;
	      font-size: 25px;
	      line-height: 1;
	      letter-spacing: 6px;
	      font-weight: 900;
	    }
	    .mock-field .accent,
	    .mock-card .accent {
	      color: var(--red);
	    }
	    .mock-field div {
	      display: flex;
	      align-items: baseline;
	      justify-content: space-between;
	      gap: 24px;
	    }
	    .mock-field strong {
	      font-size: 64px;
	      line-height: .95;
	      font-weight: 700;
	    }
	    .mock-field span {
	      color: var(--muted);
	      font-size: 42px;
	      font-weight: 800;
	    }
	    .mock-field em {
	      display: block;
	      margin-top: 18px;
	      color: #7E8794;
	      font-size: 25px;
	      line-height: 1.2;
	      font-style: normal;
	      font-weight: 700;
	    }
	    .mock-result {
	      display: flex;
	      align-items: baseline;
	      gap: 22px;
	      margin-top: 16px;
	    }
	    .mock-result strong {
	      color: var(--red);
	      font-family: Georgia, "Times New Roman", serif;
	      font-size: 94px;
	      line-height: .95;
	    }
	    .mock-result span {
	      color: var(--muted);
	      font-family: Georgia, "Times New Roman", serif;
	      font-size: 40px;
	      font-weight: 800;
	    }
	    .mock-grid {
	      display: grid;
	      grid-template-columns: 1fr 1fr;
	      gap: 34px;
	      margin-top: 44px;
	      padding-top: 32px;
	      border-top: 1px solid rgba(15,27,45,.10);
	    }
	    .mock-grid label {
	      font-size: 21px;
	      letter-spacing: 4px;
	      margin-bottom: 10px;
	    }
	    .mock-grid p {
	      margin: 0;
	      color: var(--ink);
	      font-size: 31px;
	      line-height: 1.15;
	      font-weight: 900;
	    }
	    .mock-note {
	      margin-top: 36px;
	      padding: 28px;
	      border-radius: 18px;
	      border: 1px solid rgba(15,27,45,.10);
	      background: #FFFDF8;
	      color: var(--muted);
	      font-size: 27px;
	      line-height: 1.25;
	      font-weight: 700;
	    }
	    .mock-volume-meter {
	      display: flex;
	      align-items: center;
	      gap: 0;
	      margin-top: 38px;
	      padding: 22px 0 8px;
	    }
	    .meter-plunger {
	      width: 36px;
	      height: 18px;
	      background: #D7CEB9;
	    }
	    .meter-barrel {
	      position: relative;
	      flex: 1;
	      height: 36px;
	      border: 2px solid var(--ink);
	      border-radius: 4px;
	      background: #FFFDF8;
	    }
	    .meter-fill {
	      position: absolute;
	      left: 0;
	      top: 0;
	      bottom: 0;
	      width: 10%;
	      background: rgba(176,32,46,.60);
	    }
	    .meter-ticks {
	      position: absolute;
	      left: 0;
	      right: 0;
	      top: -32px;
	      height: 28px;
	    }
	    .meter-ticks::before {
	      content: "";
	      position: absolute;
	      left: 0;
	      right: 0;
	      bottom: 0;
	      height: 14px;
	      background: repeating-linear-gradient(90deg, var(--ink) 0 1px, transparent 1px 5%);
	      opacity: .65;
	    }
	    .meter-ticks span {
	      position: absolute;
	      top: -2px;
	      transform: translateX(-50%);
	      color: var(--muted);
	      font-size: 18px;
	      line-height: 1;
	      font-weight: 800;
	    }
	    .meter-barrel b {
	      position: absolute;
	      left: 10%;
	      top: 48px;
	      transform: translateX(-50%);
	      color: var(--red);
	      font-size: 22px;
	      line-height: 1;
	      font-weight: 900;
	    }
	    .meter-barrel b::before {
	      content: "";
	      position: absolute;
	      left: 50%;
	      top: -16px;
	      width: 2px;
	      height: 14px;
	      background: var(--red);
	    }
	    .meter-tip {
	      width: 48px;
	      height: 2px;
	      background: var(--ink);
	    }
	    .device::after {
	      content: "";
      position: absolute;
      inset: 0;
      border-radius: inherit;
      box-shadow: inset 0 0 0 1px rgba(255,255,255,.72);
      pointer-events: none;
    }
    .badge {
      position: absolute;
      z-index: 5;
      ${isPad
        ? 'left: 112px; bottom: 150px; width: 610px;'
        : 'left: 104px; right: 104px; bottom: 118px;'}
      display: ${isPad ? 'block' : 'none'};
      padding: 30px 34px;
      border: 1px solid rgba(15,27,45,.12);
      border-radius: 28px;
      background: rgba(255,255,255,.66);
      box-shadow: 0 24px 60px rgba(15,27,45,.10);
      backdrop-filter: blur(8px);
    }
    .badge strong {
      display: block;
      margin-bottom: 8px;
      color: var(--ink);
      font-family: Georgia, "Times New Roman", serif;
      font-size: 34px;
      line-height: 1.08;
    }
    .badge p {
      margin: 0;
      color: var(--muted);
      font-size: 23px;
      line-height: 1.25;
      font-weight: 700;
    }
  </style>
</head>
<body>
  <main class="art">
    <section class="copy">
      <p class="kicker">${esc(slide.kicker)}</p>
      <h1>${esc(slide.title)}</h1>
      <p class="sub">${esc(slide.sub)}</p>
      <div class="chips">${slide.chips.map((chip) => `<span>${esc(chip)}</span>`).join('')}</div>
    </section>
    <section class="badge">
      <strong>Made for repeat routines.</strong>
      <p>Clear logs, calm charts, and less context switching.</p>
    </section>
	    <div class="device">
	      ${deviceContent(slide, shotUrl)}
	    </div>
	  </main>
</body>
</html>`;
}

async function cdp(port) {
  const endpoint = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' }).then((r) => r.json());
  const ws = new WebSocket(endpoint.webSocketDebuggerUrl);
  let id = 0;
  const calls = new Map();
  const eventWaiters = new Map();
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && calls.has(msg.id)) {
      const { resolve, reject } = calls.get(msg.id);
      calls.delete(msg.id);
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
    } else if (msg.method && eventWaiters.has(msg.method)) {
      const waiters = eventWaiters.get(msg.method);
      eventWaiters.delete(msg.method);
      waiters.forEach((resolve) => resolve(msg.params));
    }
  });
  await new Promise((resolve) => ws.addEventListener('open', resolve, { once: true }));
  async function send(method, params = {}) {
    const callId = ++id;
    ws.send(JSON.stringify({ id: callId, method, params }));
    return new Promise((resolve, reject) => calls.set(callId, { resolve, reject }));
  }
  function waitEvent(method) {
    return new Promise((resolve) => {
      const waiters = eventWaiters.get(method) ?? [];
      waiters.push(resolve);
      eventWaiters.set(method, waiters);
    });
  }
  return { send, waitEvent, close: () => ws.close() };
}

async function renderDevice(device) {
  const screenshotDir = path.join(OUT, 'screenshots', device.key);
  const htmlDir = path.join(OUT, 'html', device.key);
  await fs.mkdir(screenshotDir, { recursive: true });
  await fs.mkdir(htmlDir, { recursive: true });

  const chrome = await chromeLauncher.launch({
    chromeFlags: ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run'],
  });
  const client = await cdp(chrome.port);

  try {
    await client.send('Page.enable');
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: device.width,
      height: device.height,
      deviceScaleFactor: 1,
      mobile: true,
      screenWidth: device.width,
      screenHeight: device.height,
    });

    for (const slide of slides) {
      const htmlPath = path.join(htmlDir, `${slide.id}.html`);
      await fs.writeFile(htmlPath, slideHtml(slide, device), 'utf8');
      const loaded = client.waitEvent('Page.loadEventFired');
      await client.send('Page.navigate', { url: cssUrl(htmlPath) });
      await loaded;
      const shot = await client.send('Page.captureScreenshot', {
        format: 'png',
        fromSurface: true,
        captureBeyondViewport: false,
      });
      await fs.writeFile(path.join(screenshotDir, `${slide.id}.png`), Buffer.from(shot.data, 'base64'));
    }
  } finally {
    client.close();
    await chrome.kill();
  }
}

for (const slide of slides) {
  if (slide.image) await fs.access(path.join(REAL, slide.image));
}

for (const device of devices) {
  await renderDevice(device);
}

console.log(`Rendered ${slides.length * devices.length} App Store images to ${path.join(OUT, 'screenshots')}`);
