function SignIn({ onNav }) {
  const [email, setEmail] = React.useState('lifter@example.com');
  const [pw, setPw] = React.useState('•••••••••');
  return (
    <div className="signin-wrap">
      <div className="signin-card">
        <div className="eyebrow" style={{ marginBottom: 12, position: 'relative' }}>
          Welcome Back
        </div>
        <h2>Enter The Room.</h2>
        <p className="sub">Pick up where the last session left off.</p>
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            onNav('dashboard');
          }}
        >
          <Field label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Field
            label="Password"
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
          />
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 4,
            }}
          >
            <span className="eyebrow">
              No password?{' '}
              <a
                href="#"
                style={{ color: 'var(--color-accent)' }}
                onClick={(e) => e.preventDefault()}
              >
                Magic link →
              </a>
            </span>
          </div>
          <Button size="lg" type="submit">
            Sign In →
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onNav('landing')}>
            ← Back to home
          </Button>
        </form>
      </div>
    </div>
  );
}

window.SignIn = SignIn;
