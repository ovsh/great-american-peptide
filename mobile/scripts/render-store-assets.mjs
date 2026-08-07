// Builds the App Store slides: a caption over the real simulator capture.
//
// Sources live in store-assets/app-store/captures/<device>/, taken on the
// simulators Apple accepts for each size class — iPhone 17 Pro Max (6.9",
// 1320x2868) and iPad Pro 13" M4 (2064x2752). The canvas is the same size as
// the capture, so no resampling happens on the phone pixels themselves.
//
// Run: node scripts/render-store-assets.mjs

import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import chromeLauncher from 'chrome-launcher';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'store-assets', 'app-store');
const CAPTURES = path.join(OUT, 'captures');
const FONTS = path.join(ROOT, 'node_modules', '@expo-google-fonts', 'inter');

// The app's own palette, so the frame around a screenshot never fights it.
const brand = {
  bg: '#FAFAF8',
  ink: '#111418',
  // A step darker than the app's inkMuted: this text is read at thumbnail size
  // in the store, not at arm's length on a phone.
  inkMuted: '#4B5563',
  accent: '#2FB47C',
  accentSoft: '#E7F6EF',
};

// `copyH` is the band reserved for the caption; the capture takes whatever
// height is left, so both devices keep their own aspect exactly. `radius` is a
// fraction of the capture width and has to match the real hardware — a phone
// corner on an iPad would eat the status bar.
const devices = [
  { key: 'iphone-6.9', width: 1320, height: 2868, top: 120, copyH: 470, gutter: 80, radius: 0.075 },
  { key: 'ipad-13', width: 2064, height: 2752, top: 140, copyH: 450, gutter: 90, radius: 0.02 },
];

// Order and wording match the caption list in copy/app-store-listing.md.
// Nothing here promises an outcome or tells anyone what to take: the level and
// trend slides say "estimate" and "not for dosing" in the shot itself.
const slides = [
  {
    id: '01-today',
    file: '01-today.png',
    kicker: 'TODAY',
    title: 'Know what is due today.',
    sub: 'One card holds the next shot, the day of the week and the dose you logged last time.',
  },
  {
    id: '02-log',
    file: '02-log.png',
    kicker: 'LOG A SHOT',
    title: 'Log a shot in seconds.',
    sub: 'Medication, dose and site in one sheet. The next site is suggested, and you can override it.',
  },
  {
    id: '03-level',
    file: '03-level.png',
    kicker: 'LEVEL',
    title: 'Watch the level fall between shots.',
    sub: 'A half-life estimate built only from the shots you logged. Peak, trough and average, on one curve.',
  },
  {
    id: '04-progress',
    file: '04-progress.png',
    kicker: 'PROGRESS',
    title: 'See what moved, and when.',
    sub: 'Weight, streaks and the side effects you told us to watch, on the same timeline.',
  },
  {
    id: '05-history',
    file: '05-history.png',
    kicker: 'HISTORY',
    title: 'Every shot, every site, on record.',
    sub: 'A list or a calendar of what you took, when you took it and where. Export it for your doctor.',
  },
  {
    id: '06-medications',
    file: '06-medications.png',
    kicker: 'YOUR STACK',
    title: 'Keep the whole stack, not one item.',
    sub: 'Add each medication with its own schedule, dose and half-life. Pause one without losing its log.',
    // Two rows of cards on a 13" screen leaves the slide mostly empty.
    skip: ['ipad-13'],
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

function fileUrl(filePath) {
  return pathToFileURL(filePath).href;
}

/**
 * Inter as a data URL. Headless Chrome only sees fonts installed on the host,
 * and Inter is not one of them, so the slides would silently fall back to
 * Helvetica and stop matching the app.
 */
async function interFaces() {
  const weights = [
    ['400', '400Regular'],
    ['500', '500Medium'],
    ['600', '600SemiBold'],
    ['700', '700Bold'],
  ];
  const faces = await Promise.all(
    weights.map(async ([weight, dir]) => {
      const ttf = await fs.readFile(path.join(FONTS, dir, `Inter_${dir}.ttf`));
      return `@font-face {
        font-family: Inter;
        font-weight: ${weight};
        font-style: normal;
        src: url(data:font/ttf;base64,${ttf.toString('base64')}) format('truetype');
      }`;
    }),
  );
  return faces.join('\n');
}

function slideHtml(slide, device, shotUrl, fontFaces) {
  const isPad = device.key === 'ipad-13';
  // Whatever the caption leaves over, minus the bottom margin.
  const shotH = device.height - device.top - device.copyH - device.gutter;
  const shotW = Math.round((shotH * device.width) / device.height);
  const scale = isPad ? 1.32 : 1;

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    ${fontFaces}
    * { box-sizing: border-box; }
    body {
      margin: 0;
      width: ${device.width}px;
      height: ${device.height}px;
      overflow: hidden;
      background: ${brand.bg};
      color: ${brand.ink};
      font-family: Inter, -apple-system, BlinkMacSystemFont, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    .art {
      position: relative;
      width: 100%;
      height: 100%;
      overflow: hidden;
      /* A single soft wash of the accent, so the slide reads as one family
         without putting colour behind the screenshot itself. */
      background:
        radial-gradient(120% 62% at 50% -12%, ${brand.accentSoft} 0%, rgba(231,246,239,0) 62%),
        ${brand.bg};
    }
    .copy {
      position: absolute;
      left: ${device.gutter}px;
      right: ${device.gutter}px;
      top: ${device.top}px;
      height: ${device.copyH}px;
      text-align: center;
    }
    .kicker {
      margin: 0 0 ${Math.round(26 * scale)}px;
      color: ${brand.accent};
      font-size: ${Math.round(30 * scale)}px;
      line-height: 1;
      letter-spacing: ${Math.round(5 * scale)}px;
      font-weight: 700;
    }
    h1 {
      margin: 0;
      font-size: ${Math.round(82 * scale)}px;
      line-height: 1.06;
      letter-spacing: -${Math.round(2 * scale)}px;
      font-weight: 700;
      text-wrap: balance;
    }
    .sub {
      margin: ${Math.round(26 * scale)}px auto 0;
      max-width: ${Math.round(940 * scale)}px;
      color: ${brand.inkMuted};
      font-size: ${Math.round(34 * scale)}px;
      line-height: 1.35;
      font-weight: 400;
      text-wrap: balance;
    }
    .device {
      position: absolute;
      left: 50%;
      transform: translateX(-50%);
      top: ${device.top + device.copyH}px;
      width: ${shotW}px;
      height: ${shotH}px;
      border-radius: ${Math.round(shotW * device.radius)}px;
      overflow: hidden;
      background: #FFFFFF;
      box-shadow:
        0 ${Math.round(40 * scale)}px ${Math.round(90 * scale)}px rgba(17,20,24,.16),
        0 0 0 1px rgba(17,20,24,.07);
    }
    .device img {
      display: block;
      width: 100%;
      height: 100%;
    }
  </style>
</head>
<body>
  <main class="art">
    <section class="copy">
      <p class="kicker">${esc(slide.kicker)}</p>
      <h1>${esc(slide.title)}</h1>
      <p class="sub">${esc(slide.sub)}</p>
    </section>
    <div class="device"><img src="${shotUrl}" alt=""></div>
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

async function renderDevice(device, fontFaces) {
  const screenshotDir = path.join(OUT, 'screenshots', device.key);
  const htmlDir = path.join(OUT, 'html', device.key);
  await fs.rm(screenshotDir, { recursive: true, force: true });
  await fs.mkdir(screenshotDir, { recursive: true });
  await fs.mkdir(htmlDir, { recursive: true });

  const chrome = await chromeLauncher.launch({
    chromeFlags: ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run'],
  });
  const client = await cdp(chrome.port);
  let count = 0;

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
      if (slide.skip?.includes(device.key)) continue;
      const shotUrl = fileUrl(path.join(CAPTURES, device.key, slide.file));
      const htmlPath = path.join(htmlDir, `${slide.id}.html`);
      await fs.writeFile(htmlPath, slideHtml(slide, device, shotUrl, fontFaces), 'utf8');
      const loaded = client.waitEvent('Page.loadEventFired');
      await client.send('Page.navigate', { url: fileUrl(htmlPath) });
      await loaded;
      // The fonts are inline, but Chrome still needs a frame to lay them out.
      await client.send('Runtime.evaluate', {
        expression: 'new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))',
        awaitPromise: true,
      });
      const shot = await client.send('Page.captureScreenshot', {
        format: 'png',
        fromSurface: true,
        captureBeyondViewport: false,
      });
      await fs.writeFile(path.join(screenshotDir, `${slide.id}.png`), Buffer.from(shot.data, 'base64'));
      count += 1;
    }
  } finally {
    client.close();
    await chrome.kill();
  }
  return count;
}

const fontFaces = await interFaces();

for (const device of devices) {
  for (const slide of slides) {
    if (slide.skip?.includes(device.key)) continue;
    await fs.access(path.join(CAPTURES, device.key, slide.file));
  }
}

let total = 0;
for (const device of devices) {
  total += await renderDevice(device, fontFaces);
}

console.log(`Rendered ${total} App Store images to ${path.join(OUT, 'screenshots')}`);
