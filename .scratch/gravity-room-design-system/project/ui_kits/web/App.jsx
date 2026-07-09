// App — top-level router. URL hash drives `route`.

const ROUTES = ['landing', 'signin', 'dashboard', 'programs', 'tracker'];

function App() {
  const [route, setRoute] = React.useState(() => {
    const h = (window.location.hash || '').replace('#', '');
    return ROUTES.includes(h) ? h : 'landing';
  });
  React.useEffect(() => {
    const sync = () => {
      const h = (window.location.hash || '').replace('#', '');
      if (ROUTES.includes(h)) setRoute(h);
    };
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);
  const onNav = (key) => {
    if (!ROUTES.includes(key)) { setRoute('dashboard'); window.location.hash = 'dashboard'; window.scrollTo(0, 0); return; }
    setRoute(key); window.location.hash = key; window.scrollTo(0, 0);
  };

  switch (route) {
    case 'signin': return <SignIn onNav={onNav} />;
    case 'dashboard': return <Dashboard onNav={onNav} />;
    case 'programs': return <Programs onNav={onNav} />;
    case 'tracker': return <Tracker onNav={onNav} />;
    case 'landing':
    default: return <Landing onNav={onNav} />;
  }
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
