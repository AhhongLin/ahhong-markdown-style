const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { JSDOM } = require('jsdom');

const previewScript = fs.readFileSync(path.join(__dirname, '..', 'preview.js'), 'utf8');

function createPreview(markup) {
  const dom = new JSDOM(`<!doctype html><body>${markup}</body>`, {
    runScripts: 'outside-only',
    url: 'https://example.test/preview',
  });

  dom.window.scrollTo = () => {};
  dom.window.requestAnimationFrame = (callback) => dom.window.setTimeout(callback, 0);
  dom.window.cancelAnimationFrame = (id) => dom.window.clearTimeout(id);
  dom.window.eval(previewScript);
  dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));

  return dom;
}

function waitForRefresh(dom) {
  return new Promise((resolve) => dom.window.setTimeout(resolve, 130));
}

function dispatchPointer(dom, target, type, options = {}) {
  const event = new dom.window.MouseEvent(type, {
    bubbles: true,
    button: options.button ?? 0,
    clientX: options.clientX ?? 0,
    clientY: options.clientY ?? 0,
  });
  Object.defineProperties(event, {
    pointerId: { value: options.pointerId ?? 1 },
    isPrimary: { value: options.isPrimary ?? true },
  });
  target.dispatchEvent(event);
}

test('refreshes headings without rebuilding the Floating TOC shell', async (t) => {
  const dom = createPreview('<main><h1>First</h1></main>');
  t.after(() => dom.window.close());

  const { document } = dom.window;
  const toc = document.getElementById('ahhong-floating-toc');
  const list = toc.querySelector('.ahhong-floating-toc__list');
  const toggle = toc.querySelector('.ahhong-floating-toc__toggle');

  toggle.click();
  toc.style.right = '42px';
  toc.style.top = '96px';
  toc.style.maxHeight = '280px';
  document.querySelector('main').insertAdjacentHTML('beforeend', '<h2>Second</h2>');

  await waitForRefresh(dom);

  assert.strictEqual(document.getElementById('ahhong-floating-toc'), toc);
  assert.strictEqual(toc.querySelector('.ahhong-floating-toc__list'), list);
  assert.strictEqual(toc.querySelector('.ahhong-floating-toc__toggle'), toggle);
  assert.equal(toc.classList.contains('is-collapsed'), false);
  assert.equal(toc.style.right, '42px');
  assert.equal(toc.style.top, '96px');
  assert.equal(toc.style.maxHeight, '280px');
  assert.equal(list.querySelectorAll('.ahhong-floating-toc__link').length, 2);

  const secondLink = list.querySelector('[data-target-id="second"]');
  secondLink.click();
  assert.equal(dom.window.location.hash, '#second');
  assert.equal(secondLink.classList.contains('is-active'), true);
});

test('keeps list items when a mutation does not change headings', async (t) => {
  const dom = createPreview('<main><h1>First</h1></main>');
  t.after(() => dom.window.close());

  const { document } = dom.window;
  const firstLink = document.querySelector('.ahhong-floating-toc__link');
  document.querySelector('main').insertAdjacentHTML('beforeend', '<p>Body copy</p>');

  await waitForRefresh(dom);

  assert.strictEqual(document.querySelector('.ahhong-floating-toc__link'), firstLink);
});

test('stops observing document changes after pagehide', async (t) => {
  const dom = createPreview('<main><h1>First</h1></main>');
  t.after(() => dom.window.close());

  const { document } = dom.window;
  dom.window.dispatchEvent(new dom.window.Event('pagehide'));
  document.querySelector('main').insertAdjacentHTML('beforeend', '<h2>Second</h2>');

  await waitForRefresh(dom);

  assert.equal(document.querySelectorAll('.ahhong-floating-toc__link').length, 1);
});

test('keeps a toggle gesture as a click until it crosses the drag threshold', (t) => {
  const dom = createPreview('<main><h1>First</h1></main>');
  t.after(() => dom.window.close());

  const { document } = dom.window;
  const toc = document.getElementById('ahhong-floating-toc');
  const toggle = toc.querySelector('.ahhong-floating-toc__toggle');
  toc.getBoundingClientRect = () => ({ left: 900, top: 80, right: 936, bottom: 116, width: 36, height: 36 });

  dispatchPointer(dom, toggle, 'pointerdown', { clientX: 918, clientY: 98 });
  dispatchPointer(dom, toggle, 'pointermove', { clientX: 928, clientY: 98 });
  dispatchPointer(dom, toggle, 'pointerup', { clientX: 928, clientY: 98 });
  toggle.click();

  assert.equal(toc.style.top, '');
  assert.equal(toc.style.right, '');
  assert.equal(toc.classList.contains('is-collapsed'), false);
});

test('moves only after the threshold and suppresses the following toggle click', (t) => {
  const dom = createPreview('<main><h1>First</h1></main>');
  t.after(() => dom.window.close());

  const { document } = dom.window;
  const toc = document.getElementById('ahhong-floating-toc');
  const toggle = toc.querySelector('.ahhong-floating-toc__toggle');
  toc.getBoundingClientRect = () => ({ left: 900, top: 80, right: 936, bottom: 116, width: 36, height: 36 });

  dispatchPointer(dom, toggle, 'pointerdown', { clientX: 918, clientY: 98 });
  dispatchPointer(dom, toggle, 'pointermove', { clientX: 948, clientY: 128 });
  dispatchPointer(dom, toggle, 'pointerup', { clientX: 948, clientY: 128 });
  toggle.click();

  assert.equal(toc.style.top, '110px');
  assert.equal(toc.style.right, '58px');
  assert.equal(toc.getAttribute('data-position-overridden'), 'true');
  assert.equal(toc.classList.contains('is-collapsed'), true);

  toggle.click();
  assert.equal(toc.classList.contains('is-collapsed'), false);
});

test('resizes through pointer movement without going below the minimum height', (t) => {
  const dom = createPreview('<main><h1>First</h1></main>');
  t.after(() => dom.window.close());

  const { document } = dom.window;
  const toc = document.getElementById('ahhong-floating-toc');
  const resizeHandle = toc.querySelector('.ahhong-floating-toc__resize-handle');
  Object.defineProperty(toc, 'offsetHeight', { value: 200, configurable: true });

  dispatchPointer(dom, resizeHandle, 'pointerdown', { clientY: 100 });
  dispatchPointer(dom, resizeHandle, 'pointermove', { clientY: 150 });
  dispatchPointer(dom, resizeHandle, 'pointerup', { clientY: 150 });
  assert.equal(toc.style.maxHeight, '250px');

  dispatchPointer(dom, resizeHandle, 'pointerdown', { clientY: 100 });
  dispatchPointer(dom, resizeHandle, 'pointermove', { clientY: -100 });
  dispatchPointer(dom, resizeHandle, 'pointerup', { clientY: -100 });
  assert.equal(toc.style.maxHeight, '100px');
});

test('ignores secondary pointers and stops movement after pointer cancellation', (t) => {
  const dom = createPreview('<main><h1>First</h1></main>');
  t.after(() => dom.window.close());

  const { document } = dom.window;
  const toc = document.getElementById('ahhong-floating-toc');
  const toggle = toc.querySelector('.ahhong-floating-toc__toggle');
  toc.getBoundingClientRect = () => ({ left: 900, top: 80, right: 936, bottom: 116, width: 36, height: 36 });

  dispatchPointer(dom, toggle, 'pointerdown', { clientX: 918, clientY: 98, isPrimary: false });
  dispatchPointer(dom, toggle, 'pointermove', { clientX: 958, clientY: 138, isPrimary: false });
  assert.equal(toc.style.top, '');

  dispatchPointer(dom, toggle, 'pointerdown', { clientX: 918, clientY: 98 });
  dispatchPointer(dom, toggle, 'pointercancel', { clientX: 918, clientY: 98 });
  dispatchPointer(dom, toggle, 'pointermove', { clientX: 958, clientY: 138 });
  assert.equal(toc.style.top, '');
});

test('indexes Chinese, duplicate, authored, and blank headings consistently', (t) => {
  const dom = createPreview(`
    <main>
      <h1>中文 標題</h1>
      <h2>Repeat</h2>
      <h3>Repeat</h3>
      <h4 id="given">Authored First</h4>
      <h5 id="given">Authored Second</h5>
      <h6>   </h6>
    </main>
  `);
  t.after(() => dom.window.close());

  const links = Array.from(dom.window.document.querySelectorAll('.ahhong-floating-toc__link'));
  assert.deepEqual(
    links.map((link) => link.getAttribute('data-target-id')),
    ['中文-標題', 'repeat', 'repeat-2', 'given', 'given-2']
  );
  assert.deepEqual(
    links.map((link) => link.textContent),
    ['中文 標題', 'Repeat', 'Repeat', 'Authored First', 'Authored Second']
  );
});

test('updates heading element references without replacing an unchanged list', async (t) => {
  const markup = '<h1>First</h1><h2>Second</h2><h3>Third</h3>';
  const dom = createPreview(`<main>${markup}</main>`);
  t.after(() => dom.window.close());

  const { document } = dom.window;
  const list = document.querySelector('.ahhong-floating-toc__list');
  const firstLink = list.firstElementChild;
  document.querySelector('main').innerHTML = markup;

  await waitForRefresh(dom);

  const [first, second, third] = document.querySelectorAll('main h1, main h2, main h3');
  first.getBoundingClientRect = () => ({ top: -200 });
  second.getBoundingClientRect = () => ({ top: -100 });
  third.getBoundingClientRect = () => ({ top: 20 });
  dom.window.dispatchEvent(new dom.window.Event('scroll'));
  await new Promise((resolve) => dom.window.setTimeout(resolve, 10));

  assert.strictEqual(list.firstElementChild, firstLink);
  assert.equal(list.querySelector('[data-target-id="third"]').classList.contains('is-active'), true);
});
