/**
 * apply-template-config-md.ts
 *
 * Markdown config parser for `pnpm apply-template --config <file.md>` and the
 * `--init-config [path]` template generator.
 *
 * WHY this exists: the interactive Q&A flow is hard to correct (one wrong
 * answer = full rerun), and the --answers JSON array is positional (18 raw
 * strings whose order breaks on every upstream prompt change). This module
 * maps a NAMED-FIELD markdown file onto the SAME scripted-answer queue the
 * --answers mode already drives, so every downstream validation (locales must
 * include en, hex check, slugify, rerun enter-through defaults) runs
 * unchanged. No rewrite-layer code is touched — upstream merges stay clean.
 *
 * Contract:
 *   - Missing field  → "" (pressed enter) → the interactive default applies.
 *     On a re-run that means "keep the current value", exactly like
 *     enter-through, so "change one field, re-run" is a valid workflow.
 *   - Required fields are documented and WARNED when missing (with the
 *     default that will be used), never blocking — a rerun with only
 *     themeHex set is expected.
 *   - Unknown keys warn: a typo would otherwise silently fall back to the
 *     default (gameName → "Anvil Quest" must not happen unnoticed).
 *   - Booleans and the home preset are normalized HERE so the queue carries
 *     exactly what the prompt layer expects ('y'/'n', '1'/'2'/'3').
 *   - Only node builtins, matching repo conventions.
 */

// ---------------------------------------------------------------------------
// Field registry — the single source of truth for the 18 prompt answers.
// Order here is DOCUMENTATION order; queue order is fixed in buildAnswerQueue.
// ---------------------------------------------------------------------------

export interface MdFieldSpec {
  /** canonical key, lowercase, as written in the md file */
  key: string;
  /** missing key → loud warning naming the default that will apply */
  required: boolean;
  /** 'y'/'n' answer to an askBool prompt */
  bool?: boolean;
  /** maps raw md value → the scripted-queue string; identity when omitted */
  normalize?: (raw: string) => string;
  /** example shown in the generated template */
  example: string;
  /** zh description shown in the generated template */
  desc: string;
  /** template section heading */
  group: string;
}

const BOOL_YES = new Set(['y', 'yes', 'true', '1', 'on', '是']);
const BOOL_NO = new Set(['n', 'no', 'false', '0', 'off', '否']);

/** 'y'/'n' for askBool; throws on anything else (caller reports it). */
export function boolToAnswer(raw: string): 'y' | 'n' {
  const v = raw.trim().toLowerCase();
  if (BOOL_YES.has(v)) return 'y';
  if (BOOL_NO.has(v)) return 'n';
  throw new Error(
    `不是有效的布尔值 / not a boolean: "${raw}" (可用: y/yes/true/1/是 或 n/no/false/0/否)`,
  );
}

/** homePreset md value → prompt answer ('1'|'2'|'3'); the CLI maps those to codes/guides/keep. */
export function homePresetToAnswer(raw: string): string {
  const v = raw.trim().toLowerCase();
  if (v === 'codes' || v === '1') return '1';
  if (v === 'guides' || v === '2') return '2';
  if (v === 'keep' || v === '3') return '3';
  throw new Error(`不是有效的首页预设 / not a valid home preset: "${raw}" (可用: codes|guides|keep)`);
}

export const CONFIG_MD_FIELDS: MdFieldSpec[] = [
  {
    key: 'gamename',
    required: true,
    example: 'Sword of Legends',
    desc: '游戏全名（站点标题、SEO、manifest 都用它）',
    group: '基本信息',
  },
  {
    key: 'shortname',
    required: false,
    example: 'SOL Wiki',
    desc: '站点短名（PWA/浏览器标签；留空 = 自动取首字母缩写 + " Wiki"）',
    group: '基本信息',
  },
  {
    key: 'domain',
    required: true,
    example: 'swordoflegends.com',
    desc: '生产域名（写进 site.ts 和 wrangler.toml；没有自定义域名就填 pages.dev 子域）',
    group: '基本信息',
  },
  {
    key: 'tagline',
    required: false,
    example: 'Your home for everything Sword of Legends',
    desc: '首页口号（留空 = 自动生成）',
    group: '文案',
  },
  {
    key: 'description',
    required: true,
    example: 'Complete Sword of Legends wiki with guides, codes, tier lists, and tips. Every page carries a last-verified date.',
    desc: 'SEO 描述（manifest + 元数据；建议 40-165 字符）',
    group: '文案',
  },
  {
    key: 'legalnotice',
    required: false,
    example: 'Sword of Legends Wiki is a fan-made community site. Not affiliated with or endorsed by the game developer.',
    desc: '页脚法律声明（留空 = 默认 fan-made 声明）',
    group: '文案',
  },
  {
    key: 'officialurl',
    required: false,
    example: 'https://play.example.com',
    desc: '游戏官网链接（留空 = https://example.com，建议改成真实地址）',
    group: '文案',
  },
  {
    key: 'themehex',
    required: true,
    example: '#3b82f6',
    desc: '主题色 hex（网站主色 + PWA theme_color；也接受别名 themeColor）',
    group: '游戏元数据',
  },
  {
    key: 'platform',
    required: true,
    example: 'Roblox',
    desc: '游戏平台（Roblox / Steam / Mobile…）',
    group: '游戏元数据',
  },
  {
    key: 'developer',
    required: true,
    example: 'Astral Games',
    desc: '开发商',
    group: '游戏元数据',
  },
  {
    key: 'genre',
    required: true,
    example: 'Anime RPG',
    desc: '游戏类型',
    group: '游戏元数据',
  },
  {
    key: 'releasedate',
    required: false,
    example: '2026-05-01',
    desc: '发布日期（留空 = 不写）',
    group: '游戏元数据',
  },
  {
    key: 'locales',
    required: false,
    example: 'en, zh',
    desc: '语言列表，逗号分隔（en 必须在内，会被自动补上；支持 zh-tw / pt-br 等连字符代码）',
    group: '语言与栏目',
  },
  {
    key: 'categories',
    required: false,
    example: 'codes, guides, tier-list, characters',
    desc: '栏目列表，逗号分隔（会自动 slugify；已知栏目自动配图标，其余用通用图标）',
    group: '语言与栏目',
  },
  {
    key: 'clearcontent',
    required: false,
    bool: true,
    example: 'no',
    desc: '是否清空 demo 文章内容（内容感知删除，只删 demo 身份的文件；重跑且有自己文章时慎开）',
    group: '执行选项',
  },
  {
    key: 'homepreset',
    required: false,
    example: 'codes',
    desc: '首页预设：codes（兑换码优先）/ guides（攻略优先）/ keep（保持现状）',
    group: '执行选项',
  },
  {
    key: 'clearlanding',
    required: false,
    bool: true,
    example: 'yes',
    desc: '是否移除模板自带的 /landing 演示页（fork 用户一般移除）',
    group: '执行选项',
  },
  {
    key: 'confirm',
    required: false,
    bool: true,
    example: 'yes',
    desc: '确认执行写入；no = 只打印计划不写任何文件（等价 --dry-run）',
    group: '执行选项',
  },
];

/** alias keys accepted on top of the canonical lowercase key */
const KEY_ALIASES: Record<string, string> = {
  themecolor: 'themehex',
  theme: 'themehex',
  color: 'themehex',
  game: 'gamename',
  name: 'gamename',
  url: 'officialurl',
  preset: 'homepreset',
};

const REQUIRED_KEYS = CONFIG_MD_FIELDS.filter((f) => f.required).map((f) => f.key);

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

export interface ParsedConfigMd {
  /** raw string values keyed by canonical lowercase key (only provided keys) */
  values: Record<string, string>;
  /** keys present in the md but not in the registry (typo guard) */
  unknownKeys: string[];
  /** duplicate-key and invalid-value problems, each a printable message */
  errors: string[];
}

/**
 * Parse an apply-template config md into named values. Tolerant of:
 *   - `**key**: value` / `- key: value` / `key：value` (中文冒号)
 *   - trailing `<!-- comments -->`
 *   - quoted values ("..." / '...')
 * Ignores headings, code fences and HTML comment blocks. Values are NOT
 * type-converted here except bool/homePreset — those throw (collected into
 * errors) because a bad enum would silently pick the wrong preset.
 */
export function parseConfigMd(md: string): ParsedConfigMd {
  const values: Record<string, string> = {};
  const unknownKeys: string[] = [];
  const errors: string[] = [];

  // Line matcher: optional list marker, optional bold, key, colon (en/zh), value.
  // The key charset INCLUDES -/_ on purpose: a kebab-case typo (game-nmae)
  // must land in unknownKeys and warn — a charset without '-' would skip the
  // whole line silently and defeat the typo guard.
  // The value capture keeps trailing inline comments for stripping below.
  const FIELD_RE = /^\s*(?:[-*+]\s+)?\*{0,2}([A-Za-z][A-Za-z0-9_-]*)\*{0,2}\s*[:：]\s*(.*)$/;

  let inCodeFence = false;
  let inHtmlComment = false;

  for (const rawLine of md.split(/\r?\n/)) {
    const line = rawLine.trim();

    // HTML comment blocks may span lines.
    if (inHtmlComment) {
      if (line.includes('-->')) inHtmlComment = false;
      continue;
    }
    if (line.startsWith('<!--')) {
      if (!line.includes('-->')) inHtmlComment = true;
      continue;
    }

    // Code fences: config examples inside ``` blocks must not be parsed.
    if (line.startsWith('```')) {
      inCodeFence = !inCodeFence;
      continue;
    }
    if (inCodeFence || line === '' || line.startsWith('#')) continue;

    const match = FIELD_RE.exec(line);
    if (!match) continue;

    const rawKey = match[1].toLowerCase();
    const key = KEY_ALIASES[rawKey] ?? rawKey;
    // Strip trailing md comment, then surrounding quotes.
    let value = match[2].replace(/<!--[\s\S]*?-->/g, '').trim();
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      value = value.slice(1, -1).trim();
    }

    const spec = CONFIG_MD_FIELDS.find((f) => f.key === key);
    if (!spec) {
      unknownKeys.push(key);
      continue;
    }
    if (key in values) {
      errors.push(`字段重复 / duplicate field: "${key}" — 以后一次出现的值为准（请删掉多余的一行）`);
    }

    if (spec.bool) {
      if (value === '') continue; // empty = enter = prompt default
      try {
        values[key] = boolToAnswer(value);
      } catch (err) {
        errors.push(err instanceof Error ? err.message : String(err));
      }
      continue;
    }
    if (key === 'homepreset') {
      if (value === '') continue;
      try {
        values[key] = homePresetToAnswer(value);
      } catch (err) {
        errors.push(err instanceof Error ? err.message : String(err));
      }
      continue;
    }
    values[key] = value;
  }

  return { values, unknownKeys, errors };
}

// ---------------------------------------------------------------------------
// Validation + queue building
// ---------------------------------------------------------------------------

export interface ConfigMdChecks {
  missingRequired: string[];
  /** defaults that will apply for missing required keys (for the warning) */
  requiredDefaults: Record<string, string>;
}

/**
 * First-run defaults for the REQUIRED keys (mirrors the interactive prompts'
 * fallbacks). A rerun would instead fall back to the site's current values —
 * the CLI handles that via rerunDefaults; this table is only for warnings.
 */
const REQUIRED_FALLBACK_LABELS: Record<string, string> = {
  gamename: 'Anvil Quest',
  domain: 'anvilwiki.pages.dev',
  themehex: '#f97316',
  platform: 'Roblox',
  developer: 'Forge Studios',
  genre: 'Fantasy RPG',
  description: '（自动生成句式 / auto-generated sentence）',
};

export function checkRequired(values: Record<string, string>): ConfigMdChecks {
  const missingRequired = REQUIRED_KEYS.filter((k) => !(k in values) || values[k] === '');
  const requiredDefaults: Record<string, string> = {};
  for (const k of missingRequired) requiredDefaults[k] = REQUIRED_FALLBACK_LABELS[k] ?? '';
  return { missingRequired, requiredDefaults };
}

export interface QueueOptions {
  values: Record<string, string>;
  /** !KEEP_CONTENT — the clear-content question is asked */
  askClearContent: boolean;
  /** !KEEP_LANDING — the remove-landing question is asked */
  askClearLanding: boolean;
  /** !DRY_RUN — the final proceed question is asked */
  askProceed: boolean;
}

/**
 * Build the positional answer queue for the scripted prompt loop, in EXACTLY
 * the order main() asks its questions. Missing fields become "" (enter), so
 * the interactive defaults / rerun keep-current behavior apply unchanged.
 */
export function buildAnswerQueue(opts: QueueOptions): string[] {
  const v = opts.values;
  const get = (key: string) => (key in v ? v[key] : '');
  const queue: string[] = [
    get('gamename'),
    get('shortname'),
    get('domain'),
    get('tagline'),
    get('description'),
    get('legalnotice'),
    get('officialurl'),
    get('themehex'),
    get('platform'),
    get('developer'),
    get('genre'),
    get('releasedate'),
    get('locales'),
    get('categories'),
  ];
  if (opts.askClearContent) queue.push(get('clearcontent') || 'n');
  queue.push(get('homepreset') || '1');
  if (opts.askClearLanding) queue.push(get('clearlanding') || 'y');
  if (opts.askProceed) queue.push(get('confirm') || 'y');
  return queue;
}

// ---------------------------------------------------------------------------
// Template generation (--init-config)
// ---------------------------------------------------------------------------

/** Section order for the generated template. */
const GROUP_ORDER = ['基本信息', '文案', '游戏元数据', '语言与栏目', '执行选项'];

/**
 * Generate the annotated config template. Bilingual comments (zh first, the
 * primary audience of this fork), every field listed with its example and
 * default semantics, so the file itself is the documentation.
 */
export function generateConfigTemplateMd(): string {
  const lines: string[] = [
    '<!--',
    '  AnvilWiki 换皮配置（--config 模式）',
    '  用法 / usage:',
    '    pnpm apply-template --config apply-template.config.md              # 按此文件执行',
    '    pnpm apply-template --config apply-template.config.md --dry-run   # 只打印计划，不写文件',
    '    pnpm apply-template --init-config [path]                          # 重新生成本模板',
    '',
    '  规则 / rules:',
    '    - 字段格式: - **字段名**: 值 （冒号可用中文；值可加引号；行尾可写 <!-- 注释 -->）',
    '    - 未填写的字段 = 回车 = 使用默认值（重跑时默认值 = 当前站点现值）',
    '    - 必填字段缺失会警告但不阻塞；未知字段名会警告（防拼写错误）',
    '    - 布尔值可用: y / yes / true / 1 / 是 或 n / no / false / 0 / 否',
    '-->',
    '',
  ];

  for (const group of GROUP_ORDER) {
    const fields = CONFIG_MD_FIELDS.filter((f) => f.group === group);
    if (fields.length === 0) continue;
    lines.push(`## ${group}`);
    lines.push('');
    for (const f of fields) {
      const mark = f.required ? '【必填】' : '【可选】';
      lines.push(`- **${camelKey(f.key)}**: ${f.example}  <!-- ${mark}${f.desc} -->`);
    }
    lines.push('');
  }

  lines.push(
    '<!--',
    '  执行选项默认值: clearContent=no, homePreset=codes, clearLanding=yes, confirm=yes。',
    '  confirm=yes 时脚本会在打印计划后直接写入；想先预览用 --dry-run 或把 confirm 写成 no。',
    '-->',
    '',
  );
  return lines.join('\n');
}

/** canonical lowercase key → camelCase as shown in docs/prompts (themehex → themeHex). */
function camelKey(key: string): string {
  const map: Record<string, string> = {
    gamename: 'gameName',
    shortname: 'shortName',
    tagline: 'tagline',
    description: 'description',
    legalnotice: 'legalNotice',
    officialurl: 'officialUrl',
    themehex: 'themeHex',
    platform: 'platform',
    developer: 'developer',
    genre: 'genre',
    releasedate: 'releaseDate',
    locales: 'locales',
    categories: 'categories',
    clearcontent: 'clearContent',
    homepreset: 'homePreset',
    clearlanding: 'clearLanding',
    confirm: 'confirm',
    domain: 'domain',
  };
  return map[key] ?? key;
}
