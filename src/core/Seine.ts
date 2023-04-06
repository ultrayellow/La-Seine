import * as SeineError from '../errors/SeineError.js';
import type {
  ApiClientConfig,
  FetchArg,
  SeineFailedRequest,
  SeineInstance,
  SeineResult,
} from '../types/Seine.js';
import type { ApiClientStore } from './ApiClientStore.js';
import * as helper from './Seine.helper.js';
import { groupBy } from './util.js';

interface Id {
  id: number;
}
export type RequestArg = Id & FetchArg;
export type ResponseSettled = Id & PromiseSettledResult<Response>;
export type ResponseFulfilled = Id & PromiseFulfilledResult<Response>;
export type ResponseRejected = Id & PromiseRejectedResult;

/**
 * @see helper.chunkRequests
 */
const REQUEST_CHUNK_SIZE = 20;
// todo
// eslint-disable-next-line
const MAX_TRY_COUNT = 3;
/**
 * @see helper.isAbortCondition
 */
const MAX_FAIL_LIMIT = 50;

export class Seine implements SeineInstance {
  private readonly apiClientStore: ApiClientStore;
  private readonly requestPool: RequestArg[];

  constructor(apiClientManager: ApiClientStore) {
    this.apiClientStore = apiClientManager;
    this.requestPool = [];
  }

  public addApiClient = async (
    apiClientConfig: ApiClientConfig,
  ): Promise<void> => {
    await this.apiClientStore.addClient(apiClientConfig);
  };

  public addRequest = ( url: RequestInfo | URL, init?: RequestInit): void => {
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
   * @returns Upon successfully complete all requests, returns ```SeineSuccess```.
   * Otherwise, returns ```SeineFail```.
   *
   * @see Seine.getResult
   *
   */
  private flushRequests = async (
    requests: RequestArg[],
  ): Promise<SeineResult> => {
    const requestChunks = helper.chunkRequests(requests, REQUEST_CHUNK_SIZE);

    const responsesSettled: ResponseSettled[] = [];

    for (const requestChunk of requestChunks) {
      const responseChunk = await this.requestByChunk(requestChunk);
      responsesSettled.push(...responseChunk);

      if (helper.isAbortCondition(responsesSettled, MAX_FAIL_LIMIT)) {
        break;
      }
    }

    const result = generateSeineResult(requests, responsesSettled);
    return result;
  };

  /**
   *
   * @description
   * Wrapper function of request logic. Get available Token and send request.
   * If no Token is available, Seine stops sending requests and treats pending
   * requests is aborted.
   *
   * @example
   * ```ts
   * const requestChunks = chunkRequests(requests);
   *
   * for (const requestChunk of requestChunks) {
   *   const responseChunk = await this.requestByChunk(requestChunk);
   * }
   * ```
   *
   * @see Seine.flushRequests
   *
   */
  private requestByChunk = async (
    requestChunk: RequestArg[],
  ): Promise<ResponseSettled[]> => {
    const responsePromises: Promise<Response>[] = [];

    for (const request of requestChunk) {
      try {
        const token = await this.apiClientStore.getAvailableToken();

        const { url, init } = request;
        const promise = token.request(url, init);

        responsePromises.push(promise);
      } catch (error) {
        if (error instanceof SeineError.SeineRateLimitError) {
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
}

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
 *
 * @see Seine.flushRequests
 *
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
    helper.assertsResponsesFulfilled(fulfilled);
  }

  if (rejected) {
    helper.assertsResponsesRejected(rejected);
  }

  const responses = fulfilled
    ?.sort((a, b) => a.id - b.id)
    .map(extractPromiseValue);

  const failedRequests: SeineFailedRequest[] = [];

  if (responsesSettled.length < requests.length) {
    failedRequests.push(
      ...requests
        .slice(responsesSettled.length, requests.length)
        .map((request) => ({
          ...request,
          error: new SeineError.SeineAbortError(),
        })),
    );
  }

  if (rejected) {
    failedRequests.push(
      ...rejected.map(({ id, reason }) => {
        if (reason instanceof SeineError.SeineErrorBase) {
          return { ...requests[id], error: reason };
        }

        return { ...requests[id], error: new SeineError.SeineInternalError() };
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

/**
 * @see generateSeineResult
 */
export const extractPromiseValue = <T>(
  fulfilledPromise: PromiseFulfilledResult<T>,
): T => {
  return fulfilledPromise.value;
};
