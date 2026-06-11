// External (same-origin) boot script. Must NOT be inline: the apex CSP is
// `script-src 'self'` with no 'unsafe-inline', so an inline <script> is blocked.
Reveal.initialize({
  hash: true,
  slideNumber: 'c/t',
  transition: 'slide',
  controlsTutorial: false,
  plugins: [RevealNotes, RevealHighlight],
});
