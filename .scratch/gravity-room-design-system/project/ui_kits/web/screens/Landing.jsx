// Landing page — Hero, Features, HowItWorks, CTA, Footer

function Landing({ onNav }) {
  return (
    <>
      <Nav onNav={onNav} route="landing" />
      <section className="hero">
        <div className="hero__glow" />
        <div className="hero__rules hero__rules--l" />
        <div className="hero__rules hero__rules--r" />
        <div className="hero__eyebrow eyebrow">100% Free · Open Source · No Subscription</div>
        <h1 className="hero__title">
          <span>Train Smarter.</span>
          <span>Progress Faster.</span>
        </h1>
        <p className="hero__subtitle">
          Stop guessing at the gym. Follow proven programs that automatically
          adjust weight, sets, and reps — so every session moves you forward.
        </p>
        <div className="hero__cta">
          <Button size="lg" onClick={() => onNav('signin')}>Start Training Today →</Button>
          <Button variant="outline" size="lg" onClick={() => onNav('programs')}>See Programs</Button>
        </div>
        <div className="hero__meta">Syncs Across Devices · Web · iOS · Android</div>
      </section>

      <section className="section" id="features">
        <div className="section__head">
          <SectionLabel>Features</SectionLabel>
          <h2 className="section__title">Built For The Bar.</h2>
          <p className="section__sub">Real data — not guesses. Every feature is tuned for one thing: the next kilo.</p>
        </div>
        <div className="features-grid">
          <div className="feature">
            <img src="../../assets/feature-progression.webp" alt="" />
            <h3 className="feature__title">Smart Progression</h3>
            <p className="feature__body">The app decides when to add weight and how to handle failure. You just show up and train.</p>
          </div>
          <div className="feature">
            <img src="../../assets/feature-tracking.webp" alt="" />
            <h3 className="feature__title">Frictionless Tracking</h3>
            <p className="feature__body">Tap one cell. Done. The set grid is the input — no menus, no swipes, no clutter.</p>
          </div>
          <div className="feature">
            <img src="../../assets/feature-stats.webp" alt="" />
            <h3 className="feature__title">Honest Stats</h3>
            <p className="feature__body">Charts that show what's actually happening on the bar. PRs, volume, and the trend lines that matter.</p>
          </div>
          <div className="feature">
            <img src="../../assets/feature-sync.webp" alt="" />
            <h3 className="feature__title">Sync Across Devices</h3>
            <p className="feature__body">Plan from your laptop. Track on your phone. Same session, same data, no friction.</p>
          </div>
        </div>
      </section>

      <section className="section" id="how">
        <div className="section__head">
          <SectionLabel>How It Works</SectionLabel>
          <h2 className="section__title">Three Steps. That's It.</h2>
        </div>
        <div className="howit">
          <div className="howit__step">
            <div className="howit__num">01</div>
            <img src="../../assets/howit-choose.webp" alt="" />
            <h4>Choose Your Program</h4>
            <p>Pick from proven, battle-tested templates. GZCLP, 5/3/1, Starting Strength — or roll your own.</p>
          </div>
          <div className="howit__step">
            <div className="howit__num">02</div>
            <img src="../../assets/howit-train.webp" alt="" />
            <h4>Train Without Thinking</h4>
            <p>Open the app. Follow the prescribed sets. Tap each one done. The system handles the rest.</p>
          </div>
          <div className="howit__step">
            <div className="howit__num">03</div>
            <img src="../../assets/howit-progress.webp" alt="" />
            <h4>Watch The Numbers Climb</h4>
            <p>The bar gets heavier. Every week. Every session. Every kilo is gravity you've conquered.</p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="cta-block">
          <SectionLabel>The Gravity Room</SectionLabel>
          <h2 className="section__title">Ready to raise the gravity?</h2>
          <p className="section__sub" style={{ marginBottom: 32 }}>Enter the Gravity Room. Start training today.</p>
          <Button size="lg" onClick={() => onNav('signin')}>Get Started — It's Free →</Button>
        </div>
      </section>

      <Footer />
    </>
  );
}

window.Landing = Landing;
