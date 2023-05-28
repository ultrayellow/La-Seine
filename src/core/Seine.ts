import {
  SeineAbortError,
  SeineErrorBase,
  SeineFetchError,
} from '../errors/SeineError.js';
import type {
  ApiClientConfig,
  FetchArg,
  SeineFailedRequest,
  SeineResult,
} from '../types/Seine.js';
import type { ApiClientStore } from './ApiClientStore.js';
import { getSeineStautsError, isOkStatus } from './request.js';

type SeineRequest = {
  index: number;
  status: 'request';
  fetchArg: FetchArg;
  tryCount: number;
  failReason?: SeineErrorBase;
};
type SeineResponse = { index: number; status: 'response'; response: Response };
type SeineElement = SeineRequest | SeineResponse;

const MAX_TRY_COUNT = 3;
const DEFAULT_CHUNK_SIZE = 10;

export class Seine {
  private readonly apiClientStore: ApiClientStore;
  private readonly requestPool: SeineRequest[];

  constructor(apiClientManager: ApiClientStore) {
    this.apiClientStore = apiClientManager;
    this.requestPool = [];
  }

  public addApiClient = async (
    apiClientConfig: ApiClientConfig,
  ): Promise<void> => {
    await this.apiClientStore.addClient(apiClientConfig);
  };

  public updateApiClient = async (
    apiClientConfig: ApiClientConfig,
  ): Promise<void> => {
    await this.apiClientStore.updateClient(apiClientConfig);
  };

  public addRequest = (url: RequestInfo | URL, init?: RequestInit): void => {
    this.requestPool.push({
      status: 'request',
      index: this.requestPool.length,
      fetchArg: { url, init },
      tryCount: 0,
    });
  };

  public getResult = async (): Promise<SeineResult> => {
    const seineRequests = this.requestPool.splice(0, this.requestPool.length);
    const resultElements = await this.flushRequests(seineRequests);

    return generateSeineResult(resultElements);
  };

  /**
   *
   * @description
   * To prevent spamming too many requests in short time, Seine sends requests
   * by chunk and await responses of it. This can also prevent unnecessary requests.
   * (e.g. Hour rate limit reached, Too many fails occurred.)
   */
  private flushRequests = async (
    seineRequests: SeineRequest[],
  ): Promise<SeineElement[]> => {
    const resultElements: SeineElement[] = [...seineRequests];

    while (true) {
      const tryableElements = resultElements
        .filter(isTryable)
        .slice(0, DEFAULT_CHUNK_SIZE);

      if (!tryableElements.length) {
        break;
      }

      try {
        const tryableResults = await this.requestTryable(tryableElements);

        tryableResults.forEach((result) => {
          resultElements[result.index] = result;
        });
      } catch {
        break;
      }
    }

    return resultElements;
  };

  /**
   *
   * @description
   * Send requests and convert to ```SeineElement``` with fetch result.
   */
  private requestTryable = async (
    requests: SeineRequest[],
  ): Promise<SeineElement[]> => {
    const promises: Promise<SeineElement>[] = [];

    for (const request of requests) {
      request.tryCount++;

      const token = await this.apiClientStore.getAvailableToken();

      const promise = token
        .request(request.fetchArg.url, request.fetchArg.init)
        .then((response): SeineElement => {
          if (isFetchFail(response)) {
            return {
              ...request,
              failReason: new SeineFetchError(),
            } satisfies SeineRequest;
          }

          if (isBadHttpStatus(response)) {
            return {
              ...request,
              failReason: getSeineStautsError(response.status),
            } satisfies SeineRequest;
          }

          return {
            status: 'response',
            index: request.index,
            response: response,
          } satisfies SeineResponse;
        });

      promises.push(promise);
    }

    const seineElements = await Promise.all(promises);
    return seineElements;
  };
}

/**
 *
 * @description
 * generate ```SeineResult``` with ```SeineElement```.
 */
const generateSeineResult = (seineElements: SeineElement[]): SeineResult => {
  const responses = seineElements
    .filter(isResponse)
    .map((seineResponse) => seineResponse.response);

  const failedRequests = seineElements.filter(isRequest).map(
    (seineRequest): SeineFailedRequest => ({
      ...seineRequest.fetchArg,
      error: seineRequest.failReason ?? new SeineAbortError(),
    }),
  );

  const status = responses.length === seineElements.length ? 'success' : 'fail';

  return {
    status,
    responses,
    failedRequests,
  };
};

const isRequest = (seineElement: SeineElement): seineElement is SeineRequest =>
  seineElement.status === 'request';

const isResponse = (
  seineElement: SeineElement,
): seineElement is SeineResponse => seineElement.status === 'response';

const isTryable = (seineElement: SeineElement): seineElement is SeineRequest =>
  isRequest(seineElement) && seineElement.tryCount < MAX_TRY_COUNT;

const isFetchFail = (responseOrNull: Response | null): responseOrNull is null =>
  responseOrNull === null;

const isBadHttpStatus = (response: Response): boolean => {
  return !isOkStatus(response.status);
};
