function Programs({ onNav }) {
  const programs = [
    {
      category: 'strength',
      name: 'GZCLP',
      by: 'Cody Lefever',
      description:
        'Linear progression with tier-based exercises and smart staged failure handling.',
      schedule: '3 days/week',
      length: '12 weeks',
    },
    {
      category: 'strength',
      name: 'Starting Strength',
      by: 'Mark Rippetoe',
      description: "Three lifts, three sets of five, every session. Add weight until you can't.",
      schedule: '3 days/week',
      length: 'Ongoing',
    },
    {
      category: 'power',
      name: '5/3/1',
      by: 'Jim Wendler',
      description:
        'Four-week wave loading on the big four. Conservative, sustainable, and a classic for a reason.',
      schedule: '4 days/week',
      length: '4-week cycles',
    },
    {
      category: 'hyper',
      name: 'PHUL',
      by: 'Brandon Campbell',
      description:
        'Two power days plus two hypertrophy days. Strength and size on the same calendar.',
      schedule: '4 days/week',
      length: '8 weeks',
    },
    {
      category: 'hyper',
      name: 'PPL',
      by: 'Community',
      description:
        'Push, Pull, Legs. The classic 6-day split with tons of volume and exercise variety.',
      schedule: '6 days/week',
      length: 'Ongoing',
    },
    {
      category: 'power',
      name: 'Texas Method',
      by: 'Glenn Pendlay',
      description: 'Volume Monday, light Wednesday, intensity Friday. Brutal, but it works.',
      schedule: '3 days/week',
      length: 'Ongoing',
    },
  ];

  return (
    <AppShell route="programs" onNav={onNav} title="Programs" crumbs="Train · Catalog">
      <div className="eyebrow" style={{ marginBottom: 8 }}>
        7 programs · sorted by popularity
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          marginBottom: 24,
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              color: 'var(--color-title)',
              fontSize: 56,
              letterSpacing: '0.02em',
              lineHeight: 1,
              margin: 0,
            }}
          >
            Pick Your Program.
          </h2>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              color: 'var(--color-muted)',
              maxWidth: 560,
              marginTop: 12,
            }}
          >
            Battle-tested templates with built-in progression. The system handles weight changes,
            deload weeks, and failure protocol — you just train.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Badge>All</Badge>
          <Badge tone="strength">Strength</Badge>
          <Badge tone="hyper">Hypertrophy</Badge>
          <Badge tone="power">Powerlifting</Badge>
        </div>
      </div>

      <div className="cat-grid">
        {programs.map((p) => (
          <ProgramCard key={p.name} {...p} onClick={() => onNav('tracker')} />
        ))}
      </div>
    </AppShell>
  );
}

window.Programs = Programs;
