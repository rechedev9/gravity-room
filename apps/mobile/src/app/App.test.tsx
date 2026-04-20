import { render, screen } from '@testing-library/react-native';

import { App } from './App';

describe('App', () => {
  it('renders the Google sign-in CTA', () => {
    render(<App />);

    expect(screen.getByText('Continue with Google')).toBeTruthy();
  });
});
