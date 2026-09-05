import { act, renderHook, waitFor } from '@testing-library/react-native';
import { ProgramQueryProvider } from '../../shell/program-query-provider';
import { useProgramSummaries } from './program-queries';
import { listProgramSummaries, upsertProgramSummaries } from './program-repository';
import { fetchProgramSummaries } from './program-service';

jest.mock('./program-repository', () => ({
  listProgramSummaries: jest.fn(async () => []),
  upsertProgramSummaries: jest.fn(async () => undefined),
}));
jest.mock('./program-service', () => ({ fetchProgramSummaries: jest.fn() }));

beforeEach(() => {
  jest.clearAllMocks();
});

it('shares one request between the workout and program-list consumers', async () => {
  jest.mocked(fetchProgramSummaries).mockResolvedValue([]);
  const { result } = renderHook(() => [useProgramSummaries(), useProgramSummaries()], {
    wrapper: ProgramQueryProvider,
  });
  await waitFor(() => expect(result.current.every((query) => query.isSuccess)).toBe(true));
  expect(fetchProgramSummaries).toHaveBeenCalledTimes(1);
  expect(upsertProgramSummaries).toHaveBeenCalledTimes(1);
});

it('does not persist a late response after the authenticated query owner unmounts', async () => {
  let release: ((value: []) => void) | undefined;
  jest.mocked(fetchProgramSummaries).mockImplementation(
    () =>
      new Promise((resolve) => {
        release = resolve;
      })
  );
  const { unmount } = renderHook(() => useProgramSummaries(), { wrapper: ProgramQueryProvider });
  await waitFor(() => expect(fetchProgramSummaries).toHaveBeenCalledTimes(1));
  unmount();
  await act(async () => {
    release?.([]);
  });
  expect(upsertProgramSummaries).not.toHaveBeenCalled();
  expect(listProgramSummaries).toHaveBeenCalledTimes(1);
});
