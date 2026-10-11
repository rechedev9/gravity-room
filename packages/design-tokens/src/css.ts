import { colors, radii, spacing, typeScale, type FontKey } from './tokens';

type ColorKey = keyof typeof colors;

interface Group {
  title: string;
  vars: readonly (readonly [name: string, key: ColorKey])[];
}

/** Web variable names stay as they were before the palette moved here, so no component changes. */
const colorGroups: readonly Group[] = [
  {
    title: 'SURFACES',
    vars: [
      ['body', 'canvas'],
      ['card', 'card'],
      ['surface-2', 'surface2'],
      ['header', 'header'],
      ['ink', 'ink'],
      ['th', 'surface2'],
      ['hover-row', 'surface2'],
      ['progress-track', 'surface2'],
      ['error-bg', 'errorBg'],
      ['tooltip-bg', 'header'],
    ],
  },
  {
    title: 'TEXT',
    vars: [
      ['main', 'textPrimary'],
      ['title', 'textPrimary'],
      ['heading', 'textPrimary'],
      ['muted', 'textSecondary'],
      ['label', 'textMuted'],
      ['info', 'textMuted'],
      ['error', 'textError'],
      ['tooltip-text', 'textPrimary'],
    ],
  },
  {
    title: 'BORDERS',
    vars: [
      ['rule', 'rule'],
      ['rule-light', 'ruleStrong'],
      ['error-line', 'errorLine'],
    ],
  },
  {
    title: 'ACCENT',
    vars: [
      ['accent', 'accent'],
      ['accent-hover', 'accentHover'],
      ['accent-deep', 'accentDeep'],
      ['accent-dim', 'accentDim'],
      ['on-accent', 'onAccent'],
      ['btn-ring', 'accent'],
      ['btn', 'card'],
      ['btn-text', 'accent'],
      ['btn-active', 'accent'],
      ['btn-active-text', 'onAccent'],
      ['victory', 'accent'],
      ['victory-on', 'onAccent'],
    ],
  },
  {
    title: 'SEMANTIC / STATE',
    vars: [
      ['online', 'ok'],
      ['ok', 'ok'],
      ['ok-bg', 'okBg'],
      ['fail', 'fail'],
      ['fail-bg', 'failBg'],
      ['warn', 'warn'],
    ],
  },
];

const spacingVars = [
  ['screen-x', spacing.screenX],
  ['stack', spacing.stack],
  ['stack-large', spacing.stackLarge],
  ['card', spacing.card],
  ['control-y', spacing.controlY],
  ['control-x', spacing.controlX],
] as const;

/** New names: --radius-base and --radius-pill already exist on web with other values. */
const radiusVars = [
  ['control', radii.base],
  ['card', radii.card],
  ['chip', radii.pill],
] as const;

/** The mobile faces carry their weight in the name; on web each one is a family plus a weight. */
const webFonts: Record<FontKey, { family: string; weight: number }> = {
  display: { family: "'Bebas Neue', system-ui", weight: 400 },
  body: { family: "'Barlow', system-ui, sans-serif", weight: 400 },
  bodySemi: { family: "'Barlow', system-ui, sans-serif", weight: 600 },
  bodyBold: { family: "'Barlow', system-ui, sans-serif", weight: 700 },
  mono: { family: "'JetBrains Mono', monospace", weight: 400 },
  monoBold: { family: "'JetBrains Mono', monospace", weight: 700 },
};

type TypeKey = keyof typeof typeScale;

/** Utility names for the type scale. displayData is left out: web keeps Bebas for hero numbers. */
const typeUtilityNames = {
  kicker: 'type-kicker',
  display: 'type-display',
  displaySm: 'type-display-sm',
  title: 'type-title',
  body: 'type-body',
  meta: 'type-meta',
  button: 'type-button',
} as const satisfies Partial<Record<TypeKey, string>>;

type WebTypeKey = keyof typeof typeUtilityNames;

const typeKeys = [
  'kicker',
  'display',
  'displaySm',
  'title',
  'body',
  'meta',
  'button',
] as const satisfies readonly WebTypeKey[];

function renderTypeUtility(key: WebTypeKey): string[] {
  const entry: {
    font: FontKey;
    fontSize: number;
    letterSpacing?: number;
    lineHeight?: number;
  } = typeScale[key];
  const face = webFonts[entry.font];
  const lines = [
    `@utility ${typeUtilityNames[key]} {`,
    `  font-family: ${face.family};`,
    `  font-weight: ${face.weight};`,
    `  font-size: ${entry.fontSize}px;`,
  ];
  if (entry.lineHeight !== undefined) lines.push(`  line-height: ${entry.lineHeight}px;`);
  if (entry.letterSpacing !== undefined) lines.push(`  letter-spacing: ${entry.letterSpacing}px;`);
  if (key === 'kicker') lines.push('  text-transform: uppercase;');
  lines.push('}');
  return lines;
}

export function renderTokensCss(): string {
  const lines: string[] = [
    '/* Generated from @gzclp/design-tokens by pnpm --filter web tokens:css. Do not edit. */',
    '',
    '@theme {',
  ];
  for (const group of colorGroups) {
    lines.push(`  /* ${group.title} */`);
    for (const [name, key] of group.vars)
      lines.push(`  --color-${name}: ${colors[key].toLowerCase()};`);
    lines.push('');
  }
  lines.push('  /* RADII (shared with mobile) */');
  for (const [name, px] of radiusVars) lines.push(`  --radius-${name}: ${px}px;`);
  lines.push('');
  lines.push('  /* SPACING (shared with mobile) */');
  for (const [name, px] of spacingVars) lines.push(`  --space-${name}: ${px}px;`);
  lines.push('}');
  for (const key of typeKeys) {
    lines.push('');
    lines.push(...renderTypeUtility(key));
  }
  return `${lines.join('\n')}\n`;
}
