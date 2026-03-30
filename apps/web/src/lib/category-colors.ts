const CATEGORY_COLORS: Record<string, { readonly badge: string; readonly gradient: string }> = {
  strength: { badge: '#4a90d9', gradient: 'rgba(74,144,217,0.08)' },
  hypertrophy: { badge: '#9b59b6', gradient: 'rgba(155,89,182,0.08)' },
  powerlifting: { badge: '#e05050', gradient: 'rgba(224,80,80,0.08)' },
};

const FALLBACK_CATEGORY_COLOR: { readonly badge: string; readonly gradient: string } = {
  badge: '#e8aa20',
  gradient: 'rgba(232,170,32,0.08)',
};

export function getCategoryColor(category: string): {
  readonly badge: string;
  readonly gradient: string;
} {
  return CATEGORY_COLORS[category] ?? FALLBACK_CATEGORY_COLOR;
}

export function categoryLabel(category: string): string {
  switch (category) {
    case 'strength':
      return 'Fuerza';
    case 'hypertrophy':
      return 'Hipertrofia';
    case 'powerlifting':
      return 'Powerlifting';
    default:
      return category.charAt(0).toUpperCase() + category.slice(1);
  }
}
