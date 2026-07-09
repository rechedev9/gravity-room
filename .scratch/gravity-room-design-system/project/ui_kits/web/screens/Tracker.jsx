function Tracker({ onNav }) {
  // Five exercises with five-cell set state arrays.
  // states: done, fail (pass partial), todo, current
  const [exercises, setExercises] = React.useState([
    {
      name: 'Squat',
      tier: 'T1',
      target: 5,
      weight: '120 kg',
      sets: ['done', 'done', 'done', 'done', 'done'],
      reps: [5, 5, 5, 5, 5],
    },
    {
      name: 'Bench Press',
      tier: 'T2',
      target: 8,
      weight: '72.5 kg',
      sets: ['done', 'done', 'fail', 'todo', 'todo'],
      reps: [8, 8, 5, 0, 0],
      current: 3,
    },
    {
      name: 'Deadlift',
      tier: 'T3',
      target: 15,
      weight: '50 kg',
      sets: ['todo', 'todo', 'todo', 'todo', 'todo'],
      reps: [0, 0, 0, 0, 0],
    },
  ]);

  const tap = (eIdx, sIdx) => {
    setExercises((prev) =>
      prev.map((ex, i) => {
        if (i !== eIdx) return ex;
        const sets = [...ex.sets];
        const reps = [...ex.reps];
        const cur = sets[sIdx];
        if (cur === 'todo') {
          sets[sIdx] = 'done';
          reps[sIdx] = ex.target;
        } else if (cur === 'done') {
          sets[sIdx] = 'fail';
          reps[sIdx] = Math.max(0, ex.target - 2);
        } else if (cur === 'fail') {
          sets[sIdx] = 'todo';
          reps[sIdx] = 0;
        }
        return { ...ex, sets, reps };
      })
    );
  };

  const totalCells = exercises.reduce((n, e) => n + e.sets.length, 0);
  const doneCells = exercises.reduce(
    (n, e) => n + e.sets.filter((s) => s === 'done' || s === 'fail').length,
    0
  );
  const pct = Math.round((doneCells / totalCells) * 100);

  return (
    <AppShell route="tracker" onNav={onNav} title="Workout In Progress" crumbs="Train · GZCLP · A1">
      <div className="tracker-head">
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>
            Mon · 04 May · Session A1 · Week 4 / 12
          </div>
          <h1>GZCLP · A1.</h1>
          <div className="meta">
            <Badge dot>Live</Badge>
            <Badge>3 exercises · 15 sets</Badge>
            <Badge tone="ok">
              ✓ {doneCells} / {totalCells} done
            </Badge>
          </div>
        </div>
        <div style={{ minWidth: 280 }}>
          <ProgressBar value={pct} left={`Set ${doneCells} / ${totalCells}`} right={`${pct}%`} />
          <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="ghost" size="sm" onClick={() => onNav('dashboard')}>
              Pause
            </Button>
            <Button size="sm" onClick={() => onNav('dashboard')}>
              Finish →
            </Button>
          </div>
        </div>
      </div>

      {exercises.map((ex, eIdx) => (
        <div key={ex.name} className="exercise">
          <div className="exercise__head">
            <div>
              <h3 className="exercise__name">{ex.name}</h3>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <Badge>{ex.tier}</Badge>
                <Badge>5 × {ex.target} reps</Badge>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="exercise__target">Working Weight</div>
              <div className="exercise__weight">{ex.weight}</div>
            </div>
          </div>
          <div className="set-grid">
            {ex.sets.map((s, sIdx) => (
              <SetCell
                key={sIdx}
                state={s}
                target={ex.target}
                reps={ex.reps[sIdx]}
                current={ex.current === sIdx}
                onClick={() => tap(eIdx, sIdx)}
              />
            ))}
          </div>
          <div
            style={{
              marginTop: 12,
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: 'var(--color-muted)',
            }}
          >
            Tap a set to cycle: todo → done → fail → todo
          </div>
        </div>
      ))}
    </AppShell>
  );
}

window.Tracker = Tracker;
