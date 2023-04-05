import {
  SeineErrorBase,
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

type RequsetToResponseFn = (
  requests: RequestArg[],
) => Promise<ResponseSettled[]>;

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
  // todo: when request pool is empty. currently returns fail with empty arrays.
  // todo: retry logic
  public getResult = async (): Promise<SeineResult> => {
    const requests = this.requestPool.splice(0, this.requestPool.length);

    const currResult = await this.flushRequests(requests);

    return currResult;
  };

  /**
   *
   * @description
   * To prevent spamming too many requests in short time, Seine sends requests
   * by chunk and await responses of it. This can also prevent unnecessarilly
   * sending requests. (e.g. Hour rate limit reached, Too many fails occurred.)
   *
   * @param requests
   *
   * @returns Upon successfully complete all requests, returns ```SeineSuccess```.
   * Otherwise, returns ```SeineFail```.
   *
   */
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

    const result = generateSeineResult(requests, responsesSettled);
    return result;
  };

  /**
   *
   * @description
   * Wrapper function of request logic. Selects available Token and updates
   * Token's rate limit status. If no Token is available, Seine stops sending
   * requests and treats pending requests is aborted.
   *
   * @param requestChunk
   *
   * @returns ```Promise<Response>```.
   *
   * @example
   * ```ts
   * const requestChunks = chunkRequests(requests);
   *
   * for (const requestChunk of requestChunks) {
   *   const responseChunk = await this.requestByChunk(requestChunk);
   * }
   * ```
   */
  private requestByChunk: RequsetToResponseFn = async (requestChunk) => {
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

  /**
   *
   * @description
   * Tries to find available Token in Seine. If no Token is available, wait for
   * Token's second rate limit refresh, and try again. Although enough time has
   * passed and still Seine doesn't have any available Token, Treats all Tokens
   * has reached to hour rate limit and abort request.
   *
   * @returns If Seine has available token, returns ```Token```.
   * Otherwise, throws ```SeineRateLimitError```.
   */
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

/**
 *
 * @param requests
 *
 * @returns Requests chunked by ```REQUEST_CHUNK_SIZE```.
 *
 * @example
 * ```ts
 * const requestChunks = chunkRequests(requests);
 *
 * for (const requestChunk of requestChunks) {
 *   const responseChunk = await this.requestByChunk(requestChunk);
 * }
 * ```
 */
const chunkRequests = (requests: RequestArg[]): RequestArg[][] => {
  const chunked: RequestArg[][] = [];

  for (let i = 0; i < requests.length; i += REQUEST_CHUNK_SIZE) {
    chunked.push(requests.slice(i, i + REQUEST_CHUNK_SIZE));
  }

  return chunked;
};

// todo: id disappears in generated result, which should exist for retry...
/**
 *
 * @description
 * Extract responses from fulfilled promises, failedRequests from rejected
 * promises and pending requests.
 *
 * @param requests Original requests for abort pending requests.
 * @param responsesSettled Responses of sent requests either success or fail.
 *
 * @returns Upon successfully complete all requests, returns ```SeineSuccess```.
 * Otherwise, returns ```SeineFail```.
 */
const generateSeineResult = (
  requests: RequestArg[],
  responsesSettled: ResponseSettled[],
): SeineResult => {
  const { fulfilled, rejected } = groupBy(
    responsesSettled,
    (response) => response.status,
  );

  // groupBy can't narrow types.

  if (fulfilled) {
    assertsResponsesFulfilled(fulfilled);
  }

  if (rejected) {
    assertsResponsesRejected(rejected);
  }

  const responses = fulfilled
    ?.sort((a, b) => a.id - b.id)
    .map(extractPromiseValue);

  const failedRequests: SeineFailedRequest[] = [];

  if (responsesSettled.length < requests.length) {
    failedRequests.push(
      ...requests
        .slice(responsesSettled.length, requests.length)
        .map((request) => ({ ...request, error: new SeineAbortError() })),
    );
  }

  if (rejected) {
    failedRequests.push(
      ...rejected.map(({ id, reason }) => {
        if (reason instanceof SeineErrorBase) {
          return { ...requests[id], error: reason };
        }

        return { ...requests[id], error: new SeineInternalError() };
      }),
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
