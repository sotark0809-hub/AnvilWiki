/**
 * Tests for the --config markdown mode (scripts/lib/apply-template-config-md.ts).
 *
 * The queue contract is the load-bearing part: buildAnswerQueue() output must
 * match main()'s question order EXACTLY (14 identity/meta/copy answers, then
 * clearContent only when !KEEP_CONTENT, homePreset always, clearLanding only
 * when !KEEP_LANDING, proceed only when !DRY_RUN). A drift here desyncs the
 * scripted loop — the failure mode --config exists to prevent. The e2e script
 * (scripts/e2e-apply-template.mjs) covers the CLI itself for real.
 */
import { describe, expect, test } from 'vitest';
import {
  boolToAnswer,
  buildAnswerQueue,
  checkRequired,
  generateConfigTemplateMd,
  homePresetToAnswer,
  parseConfigMd,
} from '../scripts/lib/apply-template-config-md';

describe('parseConfigMd', () => {
  test('parses all named fields, bold or plain, en or zh colon, list marker or none', () => {
    const md = `
# 换皮配置
## 基本信息
- **gameName**: Sword of Legends
* shortName：SOL Wiki
domain: sword.example.com
## 游戏元数据
- **themeColor**: #3b82f6
`;
    const { values, unknownKeys, errors } = parseConfigMd(md);
    expect(errors).toEqual([]);
    expect(unknownKeys).toEqual([]);
    expect(values.gamename).toBe('Sword of Legends');
    expect(values.shortname).toBe('SOL Wiki');
    expect(values.domain).toBe('sword.example.com');
    expect(values.themehex).toBe('#3b82f6'); // alias themeColor → themehex
  });

  test('strips quotes and trailing md comments', () => {
    const md = '- **gameName**: "My Game"  <!-- 【必填】游戏全名 -->\n- **platform**: \'Roblox\'';
    const { values, errors } = parseConfigMd(md);
    expect(errors).toEqual([]);
    expect(values.gamename).toBe('My Game');
    expect(values.platform).toBe('Roblox');
  });

  test('ignores headings, html comment blocks and code fences', () => {
    const md = `
<!-- this is a comment: gameName: NotAField -->
\`\`\`
gameName: InCodeBlock
\`\`\`
# gameName: InHeading
gameName: Real
`;
    const { values, errors } = parseConfigMd(md);
    expect(errors).toEqual([]);
    expect(values.gamename).toBe('Real');
  });

  test('reports unknown keys as typo guard', () => {
    const { values, unknownKeys } = parseConfigMd('gameName: A\ngame-nmae: typo\ncolour: #123456');
    expect(values.gamename).toBe('A');
    expect(unknownKeys).toEqual(['game-nmae', 'colour']);
  });

  test('reports duplicate keys without aborting the rest', () => {
    const { values, errors } = parseConfigMd('gameName: First\ngameName: Second');
    expect(values.gamename).toBe('Second');
    expect(errors.some((e) => e.includes('duplicate'))).toBe(true);
  });

  test('normalizes booleans to y/n and rejects junk', () => {
    expect(parseConfigMd('clearContent: 是').values.clearcontent).toBe('y');
    expect(parseConfigMd('clearLanding: No').values.clearlanding).toBe('n');
    expect(parseConfigMd('confirm: TRUE').values.confirm).toBe('y');
    const bad = parseConfigMd('confirm: maybe');
    expect(bad.errors.length).toBe(1);
    expect(bad.values.confirm).toBeUndefined();
  });

  test('normalizes homePreset words to the 1/2/3 prompt alphabet', () => {
    expect(parseConfigMd('homePreset: guides').values.homepreset).toBe('2');
    expect(parseConfigMd('homePreset: KEEP').values.homepreset).toBe('3');
    expect(parseConfigMd('homePreset: 1').values.homepreset).toBe('1');
    expect(parseConfigMd('homePreset: banana').errors.length).toBe(1);
  });

  test('keeps list values raw (locales/categories are split downstream)', () => {
    const { values } = parseConfigMd('locales: en, zh-tw, ja\ncategories: Codes, Tier List');
    expect(values.locales).toBe('en, zh-tw, ja');
    expect(values.categories).toBe('Codes, Tier List');
  });
});

describe('boolToAnswer / homePresetToAnswer', () => {
  test('accepts the zh/en boolean alphabets', () => {
    for (const y of ['y', 'yes', 'true', '1', '是', 'ON']) expect(boolToAnswer(y)).toBe('y');
    for (const n of ['n', 'no', 'false', '0', '否', 'Off']) expect(boolToAnswer(n)).toBe('n');
    expect(() => boolToAnswer('2')).toThrow();
    expect(() => boolToAnswer('')).toThrow();
  });

  test('maps presets and rejects junk', () => {
    expect(homePresetToAnswer('codes')).toBe('1');
    expect(homePresetToAnswer('guides')).toBe('2');
    expect(homePresetToAnswer('keep')).toBe('3');
    expect(homePresetToAnswer('2')).toBe('2');
    expect(() => homePresetToAnswer('codes!')).toThrow();
  });
});

describe('buildAnswerQueue', () => {
  const full = {
    values: {
      gamename: 'G',
      shortname: 'S',
      domain: 'd',
      tagline: 't',
      description: 'de',
      legalnotice: 'l',
      officialurl: 'o',
      themehex: '#000000',
      platform: 'p',
      developer: 'dev',
      genre: 'g',
      releasedate: 'r',
      locales: 'en, zh',
      categories: 'codes',
      clearcontent: 'y',
      homepreset: '2',
      clearlanding: 'n',
      confirm: 'n',
    },
  };

  test('emits 18 answers in prompt order for a plain interactive run', () => {
    const q = buildAnswerQueue({ ...full, askClearContent: true, askClearLanding: true, askProceed: true });
    expect(q).toEqual([
      'G', 'S', 'd', 't', 'de', 'l', 'o', '#000000', 'p', 'dev', 'g', 'r', 'en, zh', 'codes',
      'y', // clearContent
      '2', // homePreset
      'n', // clearLanding
      'n', // proceed
    ]);
  });

  test('drops flag-suppressed questions and defaults the rest (mirrors main() flow)', () => {
    // --no-clear-content --keep-landing --dry-run: only 14 + homePreset
    const q = buildAnswerQueue({ values: {}, askClearContent: false, askClearLanding: false, askProceed: false });
    expect(q).toEqual(['', '', '', '', '', '', '', '', '', '', '', '', '', '', '1']);
    // default run flags (no suppression): booleans default to the prompt fallbacks
    const q2 = buildAnswerQueue({ values: {}, askClearContent: true, askClearLanding: true, askProceed: true });
    expect(q2).toEqual(['', '', '', '', '', '', '', '', '', '', '', '', '', '', 'n', '1', 'y', 'y']);
  });
});

describe('checkRequired', () => {
  test('lists missing required keys with their first-run defaults', () => {
    const { missingRequired, requiredDefaults } = checkRequired({ gamename: 'G', themehex: '#123456' });
    expect(missingRequired).toContain('domain');
    expect(missingRequired).toContain('platform');
    expect(missingRequired).not.toContain('gamename');
    expect(missingRequired).not.toContain('themehex');
    expect(requiredDefaults.domain).toBe('anvilwiki.pages.dev');
    expect(missingRequired).not.toContain('shortname'); // optional fields never listed
  });
});

describe('generateConfigTemplateMd', () => {
  test('template round-trips through the parser with zero unknown keys and no errors', () => {
    const md = generateConfigTemplateMd();
    const { values, unknownKeys, errors } = parseConfigMd(md);
    expect(errors).toEqual([]);
    expect(unknownKeys).toEqual([]);
    // Every registry field appears exactly once in the template (examples are values).
    expect(Object.keys(values).length).toBeGreaterThanOrEqual(18);
    // Round-trip produces a full interactive-length queue.
    const q = buildAnswerQueue({ values, askClearContent: true, askClearLanding: true, askProceed: true });
    expect(q.length).toBe(18);
  });

  test('template documents required vs optional for every field', () => {
    const md = generateConfigTemplateMd();
    expect(md).toContain('【必填】');
    expect(md).toContain('【可选】');
    expect(md).toContain('gameName');
    expect(md).toContain('themeHex');
  });
});
