import {
  SeineAbortError,
  SeineInternalError,
  SeineRateLimitError,
} from '../errors/SeineError.js';
import { ApiClientConfig, SeineInstance } from '../index.js';
import { FetchArg, SeineFailedRequest, SeineResult } from '../types/Seine.js';
import { sleepMs } from './util.js';
import { sendRequestWithToken } from './sendRequest.js';
import { Token } from './Token.js';
import { TokenStore } from './TokenStore.js';
import { groupBy } from './util.js';

interface Id {
  id: number;
}
type RequestArg = Id & FetchArg;
type ResponseSettled = Id & PromiseSettledResult<Response>;
type ResponseFulfilled = Id & PromiseFulfilledResult<Response>;
type ResponseRejected = Id & PromiseRejectedResult;
type RequsetToResponse = (requests: RequestArg[]) => Promise<ResponseSettled[]>;

const REQUEST_CHUNK_SIZE = 20;
// todo
// eslint-disable-next-line
const MAX_TRY_COUNT = 3;
const MAX_FAIL_LIMIT = 50;

export class Seine implements SeineInstance {
  private readonly tokenStores: TokenStore[];
  private readonly requestPool: RequestArg[];

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
    this.tokenStores.push(tokenStore);

    try {
      await tokenStore.initialize();
    } catch (e) {
      this.tokenStores.pop();
      throw e;
    }
  };

  public addRequest = ({ url, init }: FetchArg): void => {
    this.requestPool.push({ url, init, id: this.requestPool.length });
  };

  // todo: test length is correct
  public awaitResponses = async (): Promise<SeineResult> => {
    const requests = this.requestPool.splice(0, this.requestPool.length);

    const currResult = await this.flushRequests(requests);
    if (currResult.status === 'success') {
      return currResult;
    }

    return {
      status: 'fail',
      responses: [],
      failedRequests: [],
    };
  };

  private flushRequests = async (
    requests: RequestArg[],
  ): Promise<SeineResult> => {
    const requestChunks = chunkRequests(requests);

    const responsesSettled: ResponseSettled[] = [];

    for (const requestChunk of requestChunks) {
      const responseChunk = await this.requestByChunk(requestChunk);
      responsesSettled.push(...responseChunk);

      if (isAbortCondition(responsesSettled)) {
        break;
      }
    }

    const { fulfilled, rejected } = groupBy(
      responsesSettled,
      (response) => response.status,
    );

    if (fulfilled) {
      assertsResponsesFulfilled(fulfilled);
    }

    if (rejected) {
      assertsResponsesRejected(rejected);
    }

    const result = getSeineResult(requests, fulfilled, rejected);
    return result;
  };

  private requestByChunk: RequsetToResponse = async (requestChunk) => {
    const responsePromises: Promise<Response>[] = [];

    for (const request of requestChunk) {
      try {
        const token = await this.selectToken();
        token.updateAtRequest();

        const { url, init } = request;
        const promise = sendRequestWithToken(token.accessToken, url, init);

        responsePromises.push(promise);
      } catch (error) {
        if (error instanceof SeineRateLimitError) {
          break;
        }

        // todo: select token error
        throw error;
      }
    }

    const responsesSettled = await Promise.allSettled(responsePromises);
    const responsesSettledWithId = responsesSettled.map((promise, index) => ({
      id: requestChunk[index].id,
      ...promise,
    }));

    return responsesSettledWithId;
  };

  private isDuplicatedApiClient = (
    apiClientConfig: ApiClientConfig,
  ): boolean => {
    const findResult = this.tokenStores.find(
      (curr) => curr.getApiClientId() === apiClientConfig.clientId,
    );

    return findResult !== undefined;
  };

  private selectToken = async (): Promise<Token> => {
    // todo define i
    for (let i = 0; i < 10 * 3; i++) {
      for (const tokenStore of this.tokenStores) {
        // todo: handle error here
        const token = await tokenStore.getToken();

        if (token.isAvailable()) {
          return token;
        }
      }

      await sleepMs(100);
    }

    // todo
    throw new SeineRateLimitError();
  };
}

const chunkRequests = (requestPool: RequestArg[]): RequestArg[][] => {
  const chunked: RequestArg[][] = [];

  for (let i = 0; i < requestPool.length; i += REQUEST_CHUNK_SIZE) {
    chunked.push(requestPool.slice(i, i + REQUEST_CHUNK_SIZE));
  }

  return chunked;
};

const getSeineResult = (
  requests: RequestArg[],
  fulfilled?: ResponseFulfilled[],
  rejected?: ResponseRejected[],
): SeineResult => {
  const responses = fulfilled
    ?.sort((a, b) => a.id - b.id)
    .map(extractPromiseValue);
  const failedRequests: SeineFailedRequest[] = [];

  if (fulfilled && fulfilled.length < requests.length) {
    failedRequests.push(
      ...requests
        .slice(fulfilled.length, requests.length)
        .map((request) => ({ ...request, reason: new SeineAbortError() })),
    );
  }

  if (rejected) {
    failedRequests.push(
      ...rejected.map(({ id, reason }) => ({ ...requests[id], reason })),
    );
  }

  if (responses && failedRequests.length === 0) {
    return {
      status: 'success',
      responses,
    };
  }

  return {
    status: 'fail',
    responses,
    failedRequests: failedRequests,
  };
};

const isAbortCondition = (responseSettled: ResponseSettled[]): boolean => {
  return (
    responseSettled.find(isHourLimitReached) !== undefined ||
    maxFailLimitReached(responseSettled)
  );
};

const isHourLimitReached = (response: ResponseSettled): boolean => {
  return (
    response.status === 'rejected' &&
    response.reason instanceof SeineRateLimitError
  );
};

const maxFailLimitReached = <T>(
  resPromises: PromiseSettledResult<T>[],
): boolean => {
  return resPromises.filter(isRejected).length >= MAX_FAIL_LIMIT;
};

const isFulfilled = <T>(
  result: PromiseSettledResult<T>,
): result is PromiseFulfilledResult<T> => {
  return result.status === 'fulfilled';
};

function assertsResponsesFulfilled(
  results: ResponseSettled[],
): asserts results is ResponseFulfilled[] {
  if (results.find(isRejected)) {
    throw new SeineInternalError();
  }
}

const isRejected = <T>(
  result: PromiseSettledResult<T>,
): result is PromiseRejectedResult => {
  return result.status === 'rejected';
};

function assertsResponsesRejected(
  results: ResponseSettled[],
): asserts results is ResponseRejected[] {
  if (results.find(isFulfilled)) {
    throw new SeineInternalError();
  }
}

const extractPromiseValue = <T>(
  fulfilledPromise: PromiseFulfilledResult<T>,
): T => {
  return fulfilledPromise.value;
};
