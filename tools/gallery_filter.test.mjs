import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const html = read('../site/index.html');
const js = read('../site/assets/filter.js');

function session() {
  const sources = [...html.matchAll(/data-card data-fields="([^"]+)"[^>]*href="([^"]+)"[^>]*aria-label="([^"]+)"/g)];
  assert.equal(sources.length, 10, 'Must exercise the actual ten published card records');
  const cards = sources.map(([, fields, href, label]) => {
    const c = {
      dataset: {fields}, href, textContent: label + ' ' + fields, hidden: false,
      classList: { toggle: (_name, hidden) => {c.hidden = hidden;} }
    };
    return c;
  });
  let searchHandler;
  const search = {
    value: '',
    addEventListener: (kind, callback) => {
      assert.equal(kind, 'input');
      searchHandler = callback;
    },
  };
  const filters = ['All', 'Python', 'Backend', 'Java', 'Mobile'].map(value => {
    const button = {
      dataset: {filter: value}, handler: null, pressed: value === 'All' ? 'true' : 'false',
      addEventListener: (kind, cb) => {
        assert.equal(kind, 'click');
        button.handler = cb;
      },
      setAttribute: (_name, newValue) => {button.pressed = newValue;},
      click: () => button.handler(),
    };
    return button;
  });
  const found = {textContent: ''};
  const doc = {
    querySelectorAll: (sel) => sel === '[data-card]' ? cards : sel === '[data-filter]' ? filters : [],
    querySelector: (sel) => sel === '#search' ? search : sel === '#found' ? found : null,
  };
  runInNewContext(js, {document: doc});
  return {
    cards, filters, found,
    filter: (label) => filters.find(x => x.dataset.filter === label).click(),
    query: (s) => {search.value = s;searchHandler();},
    shown: () => cards.filter(x => !x.hidden).map(x => x.href),
  };
}

test('Java filter selects Java, not JavaScript, and is keyboard-readable', () => {
  const ui = session();
  assert.equal(ui.shown().length, 10);
  ui.filter('Java');
  assert.deepEqual(ui.shown(), ['apps/forgeenterprise/index.html']);
  assert.equal(ui.found.textContent, '1 project shown');
  assert.equal(ui.filters.find(x => x.dataset.filter === 'Java').pressed, 'true');
  assert.equal(ui.filters.find(x => x.dataset.filter === 'All').pressed, 'false');
});

test('Kotlin search and reset show only the correct app and then all ten', () => {
  const ui = session();
  ui.query('kotlin');
  assert.deepEqual(ui.shown(), ['apps/forgemobile/index.html']);
  ui.query('');
  assert.equal(ui.shown().length, 10);
});

test('filter category and search intersect instead of overriding each other', () => {
  const ui = session();
  ui.filter('Python');
  assert.ok(ui.shown().length >= 1);
  ui.query('no-match');
  assert.equal(ui.shown().length, 0);
  ui.filter('All');
  ui.query('');
  assert.equal(ui.shown().length, 10);
});
