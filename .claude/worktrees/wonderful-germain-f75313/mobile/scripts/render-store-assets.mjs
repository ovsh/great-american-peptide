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
  calc: 'WhatsApp Image 2026-04-30 at 01.25.15 (4).jpeg',
};

const slides = [
  {
    id: '01-today',
    kicker: 'TODAY',
    title: "Never miss today's shot.",
    sub: 'Dose, timing, level, weight, and goal in one focused home view.',
    image: real.today,
    chips: ['Next step', 'Level trend', 'Weight goal'],
  },
  {
    id: '02-log-shot',
    kicker: 'LOG SHOT',
    title: 'Log in seconds.',
    sub: 'Medication, dose, date, time, and site stay together.',
    image: real.logShot,
    chips: ['0.1 dose ticks', 'Date & time', 'Site rotation'],
  },
  {
    id: '03-site-map',
    kicker: 'BODY SITES',
    title: 'See every injection site.',
    sub: 'Tap front or back and keep rotation visible while you log.',
    image: real.siteMap,
    chips: ['Front & back', 'All sites', 'Rotation context'],
  },
  {
    id: '04-calendar',
    kicker: 'CALENDAR',
    title: 'Keep the routine visible.',
    sub: 'Review shot days, doses, and timing without digging.',
    image: real.calendar,
    chips: ['Monthly view', 'Shot history', 'Dose notes'],
  },
  {
    id: '05-reconstitution',
    kicker: 'CALCULATOR',
    title: 'Built-in reconstitution math.',
    sub: 'Calculate BAC water and syringe units before you draw.',
    image: real.calc,
    chips: ['U-100 / U-40', 'Units to draw', 'Dose planning'],
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

function slideHtml(slide, device) {
  const isPad = device.key === 'ipad-13';
  const shotPath = path.join(REAL, slide.image);
  const bgUrl = cssUrl(BG);
  const shotUrl = cssUrl(shotPath);
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
      <img src="${shotUrl}" alt="">
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

for (const file of Object.values(real)) {
  await fs.access(path.join(REAL, file));
}

for (const device of devices) {
  await renderDevice(device);
}

console.log(`Rendered ${slides.length * devices.length} real-screenshot App Store images to ${path.join(OUT, 'screenshots')}`);
