import { makeAgoricChainStorageWatcher } from '../src/chainStorageWatcher';
import { expect, it, describe, beforeEach, vi, afterEach } from 'vitest';
import { AgoricChainStoragePathKind } from '../src/types';

const fetch = vi.fn();
global.fetch = fetch;
global.harden = val => val;

const fakeRpcAddr = 'https://agoric-rpc.vitest-nodes.com:443';
const fakeChainId = 'agoric-unit-test-1';
const serialize = (val: unknown) => val;
const unserialize = (val: unknown) => val;

let watcher: ReturnType<typeof makeAgoricChainStorageWatcher>;

describe('makeAgoricChainStorageWatcher', () => {
  beforeEach(() => {
    watcher = makeAgoricChainStorageWatcher(
      fakeRpcAddr,
      fakeChainId,
      unserialize,
    );
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('can handle multiple paths at once', async () => {
    const expected1 = 'test result';
    const expected2 = ['child1', 'child2'];
    const path = 'published.vitest.fakePath';

    fetch.mockResolvedValue(
      createFetchResponse([
        { value: expected1, kind: AgoricChainStoragePathKind.Data },
        { value: expected2, kind: AgoricChainStoragePathKind.Children },
      ]),
    );

    const value1 = new Promise(res => {
      watcher.watchLatest<string>(
        [AgoricChainStoragePathKind.Data, path],
        value => res(value),
      );
    });
    vi.advanceTimersByTime(15);
    const value2 = new Promise(res => {
      watcher.watchLatest<string[]>(
        [AgoricChainStoragePathKind.Children, path],
        value => res(value),
      );
    });
    vi.advanceTimersByTime(5);

    expect(await value1).toEqual(expected1);
    expect(await value2).toEqual(expected2);
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith(fakeRpcAddr, {
      method: 'POST',
      body: JSON.stringify([
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'abci_query',
          params: { path: `/custom/vstorage/data/${path}` },
        },
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'abci_query',
          params: { path: `/custom/vstorage/children/${path}` },
        },
      ]),
    });
  });

  it('notifies for changed data values', async () => {
    const expected1 = 'test result';
    const path = 'published.vitest.fakePath';

    fetch.mockResolvedValue(
      createFetchResponse([
        {
          value: expected1,
          kind: AgoricChainStoragePathKind.Data,
          blockHeight: 123,
        },
      ]),
    );

    const values = [future(), future()];
    watcher.watchLatest<string>(
      [AgoricChainStoragePathKind.Data, path],
      value => {
        if (values[0].isComplete()) {
          values[1].resolve(value);
        } else {
          values[0].resolve(value);
        }
      },
    );
    vi.advanceTimersToNextTimer();
    expect(await values[0].value).toEqual(expected1);
    expect(fetch).toHaveBeenCalledOnce();

    const expected2 = expected1 + 'foo';
    fetch.mockResolvedValue(
      createFetchResponse([
        {
          value: expected2,
          kind: AgoricChainStoragePathKind.Data,
          blockHeight: 456,
        },
      ]),
    );

    vi.advanceTimersToNextTimer();
    expect(await values[1].value).toEqual(expected2);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('notifies for changed children values', async () => {
    const expected1 = ['child1', 'child2'];
    const path = 'published.vitest.fakePath';

    fetch.mockResolvedValue(
      createFetchResponse([
        {
          value: expected1,
          kind: AgoricChainStoragePathKind.Children,
        },
      ]),
    );

    const values = [future<string[]>(), future<string[]>()];
    watcher.watchLatest<string[]>(
      [AgoricChainStoragePathKind.Children, path],
      value => {
        if (values[0].isComplete()) {
          values[1].resolve(value);
        } else {
          values[0].resolve(value);
        }
      },
    );
    vi.advanceTimersToNextTimer();
    expect(await values[0].value).toEqual(expected1);
    expect(fetch).toHaveBeenCalledOnce();

    const expected2 = [...expected1, 'child3'];
    fetch.mockResolvedValue(
      createFetchResponse([
        {
          value: expected2,
          kind: AgoricChainStoragePathKind.Children,
        },
      ]),
    );

    vi.advanceTimersToNextTimer();
    expect(await values[1].value).toEqual(expected2);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('handles errors', async () => {
    const expected = 'test error log';
    const path = 'published.vitest.fakePath';

    fetch.mockResolvedValue(
      createFetchResponse([
        {
          value: null,
          kind: AgoricChainStoragePathKind.Children,
          code: 6,
          log: expected,
        },
      ]),
    );

    const result = future<string>();
    watcher.watchLatest<string>(
      [AgoricChainStoragePathKind.Children, path],
      _value => {
        /* noop */
      },
      result.resolve,
    );
    vi.advanceTimersToNextTimer();
    expect(await result.value).toEqual(expected);
  });

  it('can unsubscribe from paths', async () => {
    const expected1 = ['child1', 'child2'];
    const path = 'published.vitest.fakePath';

    fetch.mockResolvedValue(
      createFetchResponse([
        {
          value: expected1,
          kind: AgoricChainStoragePathKind.Children,
        },
      ]),
    );

    const values = [future<string[]>(), future<string[]>()];
    const unsub = watcher.watchLatest<string[]>(
      [AgoricChainStoragePathKind.Children, path],
      value => {
        if (values[0].isComplete()) {
          values[1].resolve(value);
        } else {
          values[0].resolve(value);
        }
      },
    );
    vi.advanceTimersToNextTimer();
    expect(await values[0].value).toEqual(expected1);
    expect(fetch).toHaveBeenCalledOnce();

    unsub();

    vi.advanceTimersToNextTimer();
    expect(fetch).toHaveBeenCalledOnce();
  });
});

const createFetchResponse = (
  values: {
    kind?: AgoricChainStoragePathKind;
    value: unknown;
    blockHeight?: number;
    code?: number;
    log?: string;
  }[],
) => ({
  json: () =>
    new Promise(res =>
      res(
        values.map(({ kind, value, blockHeight, code = 0, log }) => {
          const data =
            kind === AgoricChainStoragePathKind.Children
              ? { children: value }
              : {
                  value: JSON.stringify({
                    values: [JSON.stringify(serialize(value))],
                    blockHeight: String(blockHeight ?? 0),
                  }),
                };

          return {
            result: {
              response: {
                value: window.btoa(JSON.stringify(data)),
                code,
                log,
              },
            },
          };
        }),
      ),
    ),
});

const future = <T>() => {
  let resolve: (value: T) => void;
  let isComplete = false;
  const value = new Promise(res => {
    resolve = (value: T) => {
      isComplete = true;
      res(value);
    };
  });

  // @ts-expect-error defined in promise constructor
  return { resolve, value, isComplete: () => isComplete };
};
