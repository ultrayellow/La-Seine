import { Token, TokenStore } from './TokenStore.js';
import {
  ApiRequstArg,
  FetchConfig,
  sendRequestWithToken,
} from './sendRequest.js';
import { sleepMs } from '../util/sleepMs.js';

const DEFAULT_FETCH_CONFIG = {
  retryCount: 1,
  retryInterval: 1000,
  errorStatusFn: (status: number): boolean => status >= 400,
} satisfies FetchConfig;

const REQUEST_CHUNK_SIZE = 10;

export class RequestSender {
  private readonly tokenStores: TokenStore[];
  private readonly requestPool: ApiRequstArg[];

  private readonly fetchConfig = DEFAULT_FETCH_CONFIG;

  constructor() {
    this.tokenStores = [];
    this.requestPool = [];
  }

  addTokenStore = async (tokenStore: TokenStore): Promise<void> => {
    if (this.isDuplicatedTokenStore(tokenStore)) {
      throw Error('duplicated tokenStore');
    }

    await this.initializeTokenStore(tokenStore);
  };

  addRequestPool = (endPoint: string, init?: RequestInit): void => {
    this.requestPool.push({ endPoint, init });
  };

  awaitResponses = async (): Promise<PromiseSettledResult<Response>[]> => {
    const results: PromiseSettledResult<Response>[] = [];

    while (this.requestPool.length > 0) {
      const currRequestPool = this.requestPool.splice(0, REQUEST_CHUNK_SIZE);
      const currResults = await this.sendRequests(currRequestPool);

      await this.retryRejected(currRequestPool, currResults);

      results.push(...currResults);

      if (this.hourlyLimitReached(currRequestPool, currResults)) {
        console.error(
          `hourly limit reached. aborting request from ${
            currRequestPool[currResults.length].endPoint
          }`,
        );

        this.requestPool.splice(0, this.requestPool.length);

        break;
      }
    }

    return results;
  };

  retryRejected = async (
    requestPool: ApiRequstArg[],
    results: PromiseSettledResult<Response>[],
  ): Promise<void> => {
    const retryIndexes = results.reduce((acc, curr, index) => {
      if (curr.status === 'rejected') {
        acc.push(index);
      }

      return acc;
    }, Array<number>());

    const retryPromises = await this.sendRequests(
      retryIndexes.map((curr) => {
        return requestPool[curr];
      }),
    );

    const retryResults = retryPromises;

    retryIndexes.forEach((retryIndex, index) => {
      results[retryIndex] = retryResults[index];
    });
  };

  private isDuplicatedTokenStore = (tokenStore: TokenStore): boolean => {
    const currApiClientId = tokenStore.getApiClientId();
    const findResult = this.tokenStores.find(
      (curr) => curr.getApiClientId() === currApiClientId,
    );
    return findResult !== undefined;
  };

  private initializeTokenStore = async (
    tokenStore: TokenStore,
  ): Promise<void> => {
    try {
      // todo
      // try to get access token for checking valid client
      await tokenStore.getToken();
      this.tokenStores.push(tokenStore);
    } catch (e) {
      console.error('initialize fail, error:', e);
      throw Error('initialize token store fail');
    }
  };

  private selectToken = async (): Promise<Token | null> => {
    for (let i = 0; i < 10 * 3; i++) {
      for (const tokenStore of this.tokenStores) {
        const token = await tokenStore.getToken();

        if (!token.rateLimiter.isLimitReaced()) {
          return token;
        }
      }

      await sleepMs(100);
    }

    return null;
  };

  private sendRequests = async (
    requestPool: ApiRequstArg[],
  ): Promise<PromiseSettledResult<Response>[]> => {
    const promisePool: Promise<Response>[] = [];

    for (const currRequest of requestPool) {
      const token = await this.selectToken();
      if (!token) {
        // todo
        console.error('no api client available.');
        break;
      }

      token.rateLimiter.updateAtRequest();

      const promise = sendRequestWithToken(
        this.fetchConfig,
        currRequest,
        token.accessToken,
      );

      promisePool.push(promise);

      // todo: verbose
      console.log(`request sent, url: ${currRequest.endPoint}`);
    }

    const results = await Promise.allSettled(promisePool);
    return results;
  };

  private hourlyLimitReached = (
    requestPool: ApiRequstArg[],
    resultPool: PromiseSettledResult<Response>[],
  ): boolean => {
    return requestPool.length > resultPool.length;
  };
}
