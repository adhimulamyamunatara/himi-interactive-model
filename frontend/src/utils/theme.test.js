import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { applyTheme, DARK_QUERY, oppositeTheme, resolveTheme, systemPrefersDark, THEME_COLORS } from './theme.js';

const fakeDocument = () => {
  const attributes = {};
  const meta = { content: '', setAttribute(name, value) { if (name === 'content') this.content = value; } };
  return {
    attributes,
    meta,
    documentElement: { style: {}, setAttribute: (name, value) => { attributes[name] = value; } },
    querySelector: (selector) => (selector === 'meta[name="theme-color"]' ? meta : null)
  };
};

describe('resolveTheme', () => {
  it('an explicit choice wins over the device setting', () => {
    assert.equal(resolveTheme('dark', false), 'dark');
    assert.equal(resolveTheme('light', true), 'light');
  });

  it('"system" follows the device', () => {
    assert.equal(resolveTheme('system', true), 'dark');
    assert.equal(resolveTheme('system', false), 'light');
  });

  it('treats anything unknown like "system"', () => {
    assert.equal(resolveTheme(undefined, true), 'dark');
    assert.equal(resolveTheme('neon', false), 'light');
  });
});

describe('systemPrefersDark', () => {
  it('reads the media query', () => {
    let asked = null;
    const win = { matchMedia: (query) => { asked = query; return { matches: true }; } };
    assert.equal(systemPrefersDark(win), true);
    assert.equal(asked, DARK_QUERY);
  });

  it('is false when matchMedia is missing or throws', () => {
    assert.equal(systemPrefersDark({}), false);
    assert.equal(systemPrefersDark(undefined), false);
    assert.equal(systemPrefersDark({ matchMedia: () => { throw new Error('nope'); } }), false);
  });
});

describe('applyTheme', () => {
  it('sets the attribute, the native colour scheme and the browser chrome colour', () => {
    const doc = fakeDocument();
    assert.equal(applyTheme('dark', doc), true);
    assert.equal(doc.attributes['data-theme'], 'dark');
    assert.equal(doc.documentElement.style.colorScheme, 'dark');
    assert.equal(doc.meta.content, THEME_COLORS.dark);
    applyTheme('light', doc);
    assert.equal(doc.attributes['data-theme'], 'light');
    assert.equal(doc.meta.content, THEME_COLORS.light);
  });

  it('ignores an unknown theme and a missing document', () => {
    const doc = fakeDocument();
    assert.equal(applyTheme('neon', doc), false);
    assert.equal(doc.attributes['data-theme'], undefined);
    assert.equal(applyTheme('dark', null), false);
  });

  it('opposite flips between the two', () => {
    assert.equal(oppositeTheme('dark'), 'light');
    assert.equal(oppositeTheme('light'), 'dark');
  });
});
