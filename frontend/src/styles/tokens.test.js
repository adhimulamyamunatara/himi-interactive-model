import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildCssVariables,
  contrastRatio,
  gradients,
  hexToChannels,
  palette,
  semantic,
  tailwindScale
} from './tokens.js';

const SHADES = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];

describe('design tokens', () => {
  it('keeps the logo-sampled anchor colours', () => {
    assert.equal(palette.slate[900], '#0b2955', 'wordmark navy');
    assert.equal(palette.violet[500], '#675bf9', 'robot violet');
    assert.equal(palette.cyan[500], '#14bbea', 'book cyan');
    assert.equal(palette.emerald[400], '#38cd93', 'book green');
    assert.equal(palette.teal[400], '#25bfb7', 'teal spark');
  });

  it('defines a full, valid scale for every colour family', () => {
    for (const [family, scale] of Object.entries(palette)) {
      assert.deepEqual(Object.keys(scale).sort(), [...SHADES].sort(), family);

      for (const hex of Object.values(scale)) {
        assert.match(hex, /^#[0-9a-f]{6}$/i, `${family} ${hex}`);
      }
    }
  });

  it('orders every scale from light to dark', () => {
    for (const [family, scale] of Object.entries(palette)) {
      const luminance = SHADES.map((shade) => contrastRatio(scale[shade], '#ffffff'));

      for (let i = 1; i < luminance.length; i += 1) {
        assert.ok(luminance[i] >= luminance[i - 1] - 0.01, `${family} shade ${SHADES[i]} should not be lighter than ${SHADES[i - 1]}`);
      }
    }
  });

  it('converts hex to the channel form Tailwind needs', () => {
    assert.equal(hexToChannels('#0b2955'), '11 41 85');
    assert.throws(() => hexToChannels('blue'));
  });

  it('emits a CSS variable for every colour, gradient, shadow, radius and duration', () => {
    const vars = buildCssVariables();
    assert.equal(vars['--himi-slate-900'], '11 41 85');
    assert.equal(vars['--himi-primary'], hexToChannels(semantic.primary));
    assert.equal(vars['--himi-gradient-brand'], gradients.brand);
    assert.ok(vars['--himi-shadow-glow']);
    assert.ok(vars['--himi-radius-card']);
    assert.ok(vars['--himi-duration-base']);
    assert.ok(vars['--himi-ease']);
  });

  it('builds Tailwind scales that keep opacity modifiers working', () => {
    assert.equal(tailwindScale('blue')[600], 'rgb(var(--himi-blue-600) / <alpha-value>)');
  });
});

describe('colour contrast (WCAG AA)', () => {
  const white = '#ffffff';
  const AA = 4.5;

  it('keeps body and muted text readable on white and on pale surfaces', () => {
    assert.ok(contrastRatio(palette.slate[900], white) >= 7, 'ink on white');
    assert.ok(contrastRatio(palette.slate[600], white) >= AA, 'muted on white');
    assert.ok(contrastRatio(palette.slate[500], white) >= AA, 'subtle on white');
    assert.ok(contrastRatio(palette.slate[600], palette.slate[50]) >= AA, 'muted on surface');
  });

  it('keeps white text readable on every stop of the primary button gradient', () => {
    for (const hex of [palette.blue[600], palette.indigo[600], palette.violet[600]]) {
      assert.ok(contrastRatio(white, hex) >= AA, `white on ${hex}`);
    }
  });

  it('keeps white text readable on the dark navy surfaces', () => {
    assert.ok(contrastRatio(white, palette.slate[900]) >= 7);
    assert.ok(contrastRatio(palette.slate[300], palette.slate[950]) >= AA, 'light copy on the dark band');
  });

  it('keeps badge text readable on its tinted background', () => {
    const pairs = [
      [palette.blue[700], palette.blue[50]],
      [palette.violet[700], palette.violet[50]],
      [palette.cyan[700], palette.cyan[50]],
      [palette.emerald[700], palette.emerald[50]],
      [palette.slate[700], palette.slate[100]],
      ['#92400e', '#fffbeb'],
      ['#be123c', '#fff1f2']
    ];

    for (const [foreground, background] of pairs) {
      assert.ok(contrastRatio(foreground, background) >= AA, `${foreground} on ${background}`);
    }
  });

  it('keeps the focus ring visible against white', () => {
    assert.ok(contrastRatio(semantic.focus, white) >= 3);
  });
});
