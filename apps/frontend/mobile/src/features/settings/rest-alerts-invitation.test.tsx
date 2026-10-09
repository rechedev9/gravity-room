import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { readRestAlertsAccess, requestRestAlertsAccess } from '../../lib/rest/rest-alerts-access';
import {
  getRestAlertsPreference,
  restoreRestAlertsPreference,
} from '../../lib/rest/rest-alerts-preference';
import { RestAlertsInvitation } from './rest-alerts-invitation';

const readAccess = jest.mocked(readRestAlertsAccess);
const requestAccess = jest.mocked(requestRestAlertsAccess);

beforeEach(async () => {
  jest.clearAllMocks();
  await restoreRestAlertsPreference({ get: async () => null, set: async () => undefined });
});

it('stays out of the way when the system already decided', async () => {
  readAccess.mockResolvedValue('granted');
  render(<RestAlertsInvitation />);
  await waitFor(() => expect(readAccess).toHaveBeenCalled());
  expect(screen.queryByText('Get alerted when rest ends')).toBeNull();
});

it('explains the benefit before anything is requested, and Not now keeps it away', async () => {
  readAccess.mockResolvedValue('askable');
  render(<RestAlertsInvitation />);

  expect(await screen.findByText('Get alerted when rest ends')).toBeTruthy();
  expect(requestAccess).not.toHaveBeenCalled();

  fireEvent.press(screen.getByRole('button', { name: 'Not now' }));
  await waitFor(() => expect(screen.queryByText('Get alerted when rest ends')).toBeNull());
  expect(getRestAlertsPreference().promptSeen).toBe(true);
  expect(requestAccess).not.toHaveBeenCalled();
});

it('requests the permission only after the lifter agrees', async () => {
  readAccess.mockResolvedValue('askable');
  requestAccess.mockResolvedValue('granted');
  render(<RestAlertsInvitation />);

  fireEvent.press(await screen.findByRole('button', { name: 'Turn on alerts' }));
  await waitFor(() => expect(requestAccess).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(screen.queryByText('Get alerted when rest ends')).toBeNull());
});
