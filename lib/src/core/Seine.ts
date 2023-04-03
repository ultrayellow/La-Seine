import { TokenStore } from './TokenStore.js';
import { sendRequestWithToken } from './sendRequest.js';
import { sleepMs } from '../util/sleepMs.js';
import { ApiClientConfig } from '../types/ApiClientConfig.js';
import { SeineInstance } from '../index.js';
import { RequestArg, SeineResult } from '../types/Seine.js';
import { Token } from './Token.js';

interface RequestArgWithId extends RequestArg {
  index: number;
}

const REQUEST_CHUNK_SIZE = 20;
const MAX_TRY_COUNT = 3;
const MAX_FAIL_LIMIT = 50;

export class Seine implements SeineInstance {
  private readonly tokenStores: TokenStore[];
  private readonly requestPool: RequestArgWithId[];

  constructor() {
    this.tokenStores = [];
    this.requestPool = [];
  }

  public addApiClient = async (
    apiClientConfig: ApiClientConfig,
  ): Promise<void> => {
    if (this.isDuplicatedApiClient(apiClientConfig)) {
      throw Error('duplicated ApiClient');
    }

    const tokenStore = new TokenStore(apiClientConfig);
    await tokenStore.initialize();

    this.tokenStores.push(tokenStore);
  };

  public addRequest = (url: string, init?: RequestInit): void => {
    this.requestPool.push({ url, init, index: this.requestPool.length });
  };

  // side effect: clears this.requestPool
  public awaitResponses = async (): Promise<SeineResult> => {
    const requestPool = this.requestPool.splice(0, this.requestPool.length);
    const requestChunks = chunkRequests(requestPool);

    for (const requestChunk of requestChunks) {
      const responseChunk = await this.requestByChunk(requestChunk);
    }

    const resFulfilled: PromiseFulfilledResult<Response>[] = [];

    // for (let i = 0; i < MAX_TRY_COUNT; i++) {

    const currResPromises = await this.requestSingleRun(requestPool);
    resFulfilled.push(...currResPromises.filter(isFulfilled));

    // if (isRequestAborted(requestPool)) {
    //   return { ...groupResPromises(resFulfilled), isAborted: true };
    // }

    // update here
    // }

    return {
      responses: resFulfilled.map(extractPromiseValue),
      rejected: currResPromises.filter(isRejected),
      aborted: requestPool,
      // todo: 긍정형으로 바꾸기?
      // todo: 전부 성공했음을 나타내는 플래그?
      // todo: 보내지 않은 요청들 배열 반환?
      isAborted: false,
    };
  };

  private requestByChunk = (requestChunk: RequestArgWithId[]) => {
    const responsePromises: Promise<Response>[] = [];

    for (const request of requestChunk) {
      const promise = this.sendRequest(request);
      if (!promise) {
      }
    }
  };

  // todo
  private sendRequest = async (
    request: RequestArgWithId,
  ): Promise<Response | null> => {
    const token = await this.selectToken();
    if (!token) {
      return null;
    }

    token.updateAtRequest();
    const promise = sendRequestWithToken(request, token.accessToken);

    return promise;
  };

  // todo: request?
  private requestSingleRun = async (
    requestPool: RequestArgWithId[],
  ): Promise<PromiseSettledResult<Response>[]> => {
    const resPromises: PromiseSettledResult<Response>[] = [];

    for (let i = 0; i < requestPool.length; i += REQUEST_CHUNK_SIZE) {
      const requests = requestPool.slice(i, REQUEST_CHUNK_SIZE);
      const currResPromises = await this.sendRequests(requests);

      resPromises.push(...currResPromises);

      if (this.maxFailLimitReached(resPromises)) {
        break;
      }
    }

    return resPromises;
  };

  retryRejected = async (
    requestPool: RequestArgWithId[],
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

  private isDuplicatedApiClient = (
    apiClientConfig: ApiClientConfig,
  ): boolean => {
    const findResult = this.tokenStores.find(
      (curr) => curr.getApiClientId() === apiClientConfig.clientId,
    );
    return findResult !== undefined;
  };

  private selectToken = async (): Promise<Token | null> => {
    // todo
    for (let i = 0; i < 10 * 3; i++) {
      for (const tokenStore of this.tokenStores) {
        const token = await tokenStore.getToken();

        // todo
        if (!token.isRateLimitReached()) {
          return token;
        }
      }

      await sleepMs(100);
    }

    return null;
  };

  private sendRequests = async (
    requests: RequestArgWithId[],
  ): Promise<PromiseSettledResult<Response>[]> => {
    const promisePool: Promise<Response>[] = [];

    for (const currRequest of requests) {
      const token = await this.selectToken();
      if (!token) {
        break;
      }

      // todo
      token.updateAtRequest();

      const promise = sendRequestWithToken(currRequest, token.accessToken);

      promisePool.push(promise);
    }

    const results = await Promise.allSettled(promisePool);
    return results;
  };

  private maxFailLimitReached = <T>(
    resPromises: PromiseSettledResult<T>[],
  ): boolean => {
    return resPromises.filter(isRejected).length >= MAX_FAIL_LIMIT;
  };
}

const isRequestAborted = (requestPool: RequestArgWithId[]) => {
  return requestPool.length;
};

const isRateLimitReached = (
  token: Token | Promise<Response> | null,
): token is null => {
  return token === null;
};

// const groupResPromises = (
//   resPromises: PromiseSettledResult<Response>[],
// ): Omit<SeineResult, 'isAborted'> => {
//   return {
//     responses: resPromises.filter(isFulfilled).map(extractPromiseValue),
//     rejected: resPromises.filter(isRejected),
//   };
// };

const chunkRequests = (
  requestPool: RequestArgWithId[],
): Array<RequestArgWithId[]> => {
  const chunked: Array<RequestArgWithId[]> = [];

  for (let i = 0; i < requestPool.length; i += REQUEST_CHUNK_SIZE) {
    chunked.push(requestPool.splice(i, REQUEST_CHUNK_SIZE));
  }

  return chunked;
};

const isFulfilled = <T>(
  result: PromiseSettledResult<T>,
): result is PromiseFulfilledResult<T> => {
  return result.status === 'fulfilled';
};

const extractPromiseValue = <T>(
  fulfilledResponsePromise: PromiseFulfilledResult<T>,
): T => {
  return fulfilledResponsePromise.value;
};

const isRejected = <T>(
  result: PromiseSettledResult<T>,
): result is PromiseRejectedResult => {
  return result.status === 'rejected';
};
