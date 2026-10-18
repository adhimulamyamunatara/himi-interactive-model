import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildCssVariables,
  buildSolidVariables,
  chartColors,
  contrastRatio,
  darkPalette,
  darkSemantic,
  gradients,
  hexToChannels,
  palette,
  semantic,
  SOLID_FROM,
  tailwindScale,
  tailwindSolidScale
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

describe('dark theme tokens', () => {
  const surface = darkSemantic.surface;
  const raised = darkPalette.slate[50];
  const AA = 4.5;

  it('has the same families and shades as the light palette', () => {
    assert.deepEqual(Object.keys(darkPalette), Object.keys(palette));

    for (const [family, scale] of Object.entries(darkPalette)) {
      assert.deepEqual(Object.keys(scale).sort(), [...SHADES].sort(), family);

      for (const hex of Object.values(scale)) {
        assert.match(hex, /^#[0-9a-f]{6}$/i, `${family} ${hex}`);
      }
    }
  });

  it('orders every scale from dark to light (the light theme runs the other way)', () => {
    for (const [family, scale] of Object.entries(darkPalette)) {
      const contrast = SHADES.map((shade) => contrastRatio(scale[shade], '#000000'));

      for (let i = 1; i < contrast.length; i += 1) {
        assert.ok(contrast[i] >= contrast[i - 1] - 0.01, `${family} shade ${SHADES[i]} should not be darker than ${SHADES[i - 1]}`);
      }
    }
  });

  it('keeps body, muted and subtle text readable on the dark surfaces', () => {
    for (const background of [surface, raised, darkSemantic.canvas]) {
      assert.ok(contrastRatio(darkPalette.slate[900], background) >= 7, `ink on ${background}`);
      assert.ok(contrastRatio(darkPalette.slate[600], background) >= AA, `muted on ${background}`);
      assert.ok(contrastRatio(darkPalette.slate[500], background) >= AA, `subtle on ${background}`);
    }
  });

  it('keeps links, focus rings and status colours readable on the dark surface', () => {
    assert.ok(contrastRatio(darkSemantic.primary, surface) >= AA, 'primary');
    assert.ok(contrastRatio(darkPalette.blue[600], surface) >= AA, 'blue-600 text');
    assert.ok(contrastRatio(darkSemantic.focus, surface) >= 3, 'focus ring');

    for (const name of ['success', 'warning', 'danger', 'info']) {
      assert.ok(contrastRatio(darkSemantic[name], surface) >= AA, name);
    }
  });

  it('keeps badge text readable on its tinted background', () => {
    for (const family of ['blue', 'violet', 'cyan', 'emerald', 'amber', 'rose']) {
      assert.ok(contrastRatio(darkPalette[family][700], darkPalette[family][50]) >= AA, `${family} 700 on 50`);
      assert.ok(contrastRatio(darkPalette[family][800], darkPalette[family][100]) >= AA, `${family} 800 on 100`);
    }

    assert.ok(contrastRatio(darkPalette.slate[700], darkPalette.slate[100]) >= AA, 'slate chip');
  });

  it('keeps the primary button readable: solid fills use the light values in both themes', () => {
    assert.equal(buildSolidVariables()['--himi-solid-blue-600'], hexToChannels(palette.blue[600]));
    assert.ok(contrastRatio('#ffffff', palette.blue[600]) >= AA);
    assert.equal(tailwindSolidScale('blue')[600], 'rgb(var(--himi-solid-blue-600) / <alpha-value>)');
    assert.equal(tailwindSolidScale('blue')[SOLID_FROM], 'rgb(var(--himi-solid-blue-400) / <alpha-value>)');
    assert.equal(tailwindSolidScale('blue')[200], 'rgb(var(--himi-blue-200) / <alpha-value>)', 'pale tints follow the theme');
  });

  it('emits dark colour and shadow variables, but leaves gradients, radii and motion to the root set', () => {
    const vars = buildCssVariables('dark');
    assert.equal(vars['--himi-slate-900'], hexToChannels(darkPalette.slate[900]));
    assert.equal(vars['--himi-surface'], hexToChannels(darkSemantic.surface));
    assert.ok(vars['--himi-shadow-card']);
    assert.equal(vars['--himi-gradient-brand'], undefined);
    assert.equal(vars['--himi-radius-card'], undefined);
    assert.notEqual(buildCssVariables('light')['--himi-slate-900'], vars['--himi-slate-900']);
  });

  it('draws charts with theme variables instead of fixed hex colours', () => {
    for (const key of ['line', 'grid', 'axis', 'label', 'threshold', 'thresholdLabel', 'ringTrack', 'surface']) {
      assert.match(chartColors[key], /^rgb\(var\(--himi-[a-z0-9-]+\)\)$/, key);
    }
  });
});
