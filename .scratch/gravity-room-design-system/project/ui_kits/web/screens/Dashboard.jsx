function Dashboard({ onNav }) {
  return (
    <AppShell route="dashboard" onNav={onNav} title="Dashboard" crumbs="Train · Overview">
      <div className="kpi-row">
        <KpiCard label="Current Streak" value="14" sub="days" trend={3} accent gold />
        <KpiCard label="Success Rate" value="87%" sub="last 30 days" trend={4} />
        <KpiCard label="Total Volume" value="42.3K" sub="kg · all time" />
        <KpiCard label="Next PR Window" value="3" sub="sessions away" />
      </div>

      <div className="dash-grid">
        <div className="l-card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
            <div>
              <div className="eyebrow" style={{ marginBottom: 6 }}>Recent Sessions</div>
              <h3 style={{ fontFamily: 'var(--font-display)', color: 'var(--color-title)', fontSize: 26, letterSpacing: '0.04em', margin: 0 }}>Last 7 Days</h3>
            </div>
            <a href="#" onClick={(e) => { e.preventDefault(); onNav('history'); }} className="eyebrow" style={{ color: 'var(--color-accent)' }}>View all →</a>
          </div>
          <table className="table">
            <thead><tr><th>Date</th><th>Program</th><th>Lifts</th><th>Volume</th><th>Status</th></tr></thead>
            <tbody>
              <tr><td className="num">Mon · 04 May</td><td>GZCLP · A1</td><td>SQ · BP · DL</td><td className="num">3,420 kg</td><td><Badge tone="ok">✓ Complete</Badge></td></tr>
              <tr><td className="num">Sat · 02 May</td><td>GZCLP · B2</td><td>OHP · DL · BP</td><td className="num">2,890 kg</td><td><Badge tone="ok">✓ Complete</Badge></td></tr>
              <tr><td className="num">Thu · 30 Apr</td><td>GZCLP · A2</td><td>SQ · OHP · LAT</td><td className="num">3,180 kg</td><td><Badge tone="fail">3/5 last set</Badge></td></tr>
              <tr><td className="num">Tue · 28 Apr</td><td>GZCLP · B1</td><td>OHP · DL · BP</td><td className="num">2,740 kg</td><td><Badge tone="ok">✓ Complete</Badge></td></tr>
              <tr><td className="num">Mon · 27 Apr</td><td>GZCLP · A1</td><td>SQ · BP · DL</td><td className="num">3,360 kg</td><td><Badge tone="ok">✓ Complete</Badge></td></tr>
            </tbody>
          </table>
        </div>

        <div className="l-card" style={{ padding: 24 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Up Next</div>
          <h3 style={{ fontFamily: 'var(--font-display)', color: 'var(--color-title)', fontSize: 32, letterSpacing: '0.04em', margin: '0 0 4px', lineHeight: 1.05 }}>GZCLP · A1</h3>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--color-muted)', margin: '0 0 20px' }}>Squat · Bench · Deadlift</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="eyebrow">T1 · Squat</span>
              <span style={{ fontFamily: 'var(--font-display)', color: 'var(--color-stage-1)', fontSize: 24, letterSpacing: '0.02em' }}>120 kg</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="eyebrow">T2 · Bench</span>
              <span style={{ fontFamily: 'var(--font-display)', color: 'var(--color-stage-2)', fontSize: 24, letterSpacing: '0.02em' }}>72.5 kg</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="eyebrow">T3 · Deadlift</span>
              <span style={{ fontFamily: 'var(--font-display)', color: 'var(--color-stage-3)', fontSize: 24, letterSpacing: '0.02em' }}>50 kg</span>
            </div>
          </div>
          <ProgressBar value={33} left="Week 4 of 12" right="33%" />
          <div style={{ marginTop: 24 }}>
            <Button size="lg" onClick={() => onNav('tracker')} style={{ width: '100%' }}>Start Workout →</Button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

window.Dashboard = Dashboard;
