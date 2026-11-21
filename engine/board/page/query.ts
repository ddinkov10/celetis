import { QueryClient, type QueryFunctionContext } from '@tanstack/react-query';
import type { Board } from '../types.ts';

export const queryClient = new QueryClient({
  defaultOptions: {
    // The board server is local, so a read also runs while the browser reports no network.
    queries: { retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false, networkMode: 'always' },
  },
});

export const boardKey = ['board'] as const;

export const readBoard = async ({ signal }: QueryFunctionContext<typeof boardKey>): Promise<Board> => {
  const isLocal = document.hidden && queryClient.getQueryData(boardKey) !== undefined;
  const response = await fetch(`/api/board${isLocal ? '?local=1' : ''}`, { signal });
  if (!response.ok) throw new Error(response.statusText);
  return (await response.json()) as Board;
};

export const pollOptions = {
  queryKey: boardKey,
  queryFn: readBoard,
  refetchInterval: () => (document.hidden ? 15_000 : 5000),
  refetchIntervalInBackground: true,
};

export const viewOptions = { queryKey: boardKey, queryFn: readBoard, enabled: false };
