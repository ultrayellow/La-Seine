// export interface SeineOption {
//   readonly hanging
//   readonly retryCount: number;
//   readonly verbose: boolean;
// }

import type { SeineError } from '../errors/SeineError.js';

export interface RateLimitConfig {
  readonly limitPerSec: number;
  readonly limitPerHour: number;
}

export interface ApiClientConfig extends Partial<RateLimitConfig> {
  readonly clientId: string;
  readonly clientSecret: string;
}

export interface FetchArg {
  readonly url: RequestInfo | URL;
  readonly init?: RequestInit;
}

export interface SeineFailedRequest {
  readonly url: RequestInfo | URL;
  readonly init?: RequestInit;
  readonly error: SeineError;
}

export interface SeineSuccess {
  readonly status: 'success';
  readonly responses: Response[];
}

export interface SeineFail {
  readonly status: 'fail';
  readonly responses?: Response[];
  readonly failedRequests: SeineFailedRequest[];
}

export type SeineResult = SeineSuccess | SeineFail;

export interface SeineInstance {
  /**
   *
   * @param apiClientConfig
   * ```ts
   * {
   *   clientId: string;
   *   clientSecret: string;
   * }
   * ```
   *
   * @example
   * ```ts
   * import seine from 'seine';
   *
   * const apiClientConfig = SeineUtil.generateFtClient();
   * seine.addApiClient(apiClientConfig);
   * ```
   */
  readonly addApiClient: (apiClientConfig: ApiClientConfig) => Promise<void>;

  /**
   *
   * @description
   * Adds request to seine instance without sending request. By calling
   * ```getResult```, user can send requests and get result of it.
   *
   * @param fecthArg
   * ```ts
   * {
   *   url: RequestInfo | URL,
   *   init?: RequestInit
   * }
   * ```
   *
   * @example
   * ```ts
   * import seine from 'seine';
   *
   * const apiClientConfig = SeineUtil.generateFtClient();
   * seine.addApiClient(apiClientConfig);
   *
   * for (let i = 0; i < 10; i++) {
   *  seine.addRequest({ `https://api.intra.42.fr/v2/users?page[number]=${i}`});
   * }
   *
   * const result = await seine.getResult();
   *
   * ```
   */
  readonly addRequest: (fecthArg: FetchArg) => void;

  /**
   *
   * @description
   * Sends requests in seine instance, returns result of it.
   *
   * @returns Upon successfully complete all requests, returns ```SeineSuccess```.
   * Otherwise, returns ```SeineFail```.
   *
   * @example
   * ```ts
   * import seine from 'seine';
   *
   * const apiClientConfig = SeineUtil.generateFtClient();
   * seine.addApiClient(apiClientConfig);
   *
   * for (let i = 0; i < 10; i++) {
   *   seine.addRequest({ `https://api.intra.42.fr/v2/users?page[number]=${i}`});
   * }
   *
   * const result = await getResult();
   *
   * if (result.status === 'success') {
   *   // now result narrowed to SeineSuccess.
   *   for (const response of result.responses) {
   *     const data = await response.json();
   *     console.log(data);
   *   }
   * } else {
   *   // result is SeineFail.
   *   if (result.responses) {
   *     // handle successful responses.
   *   }
   *
   *   for (const { url, init, error } of result.failedRequests) {
   *     if (error.cause === 'rateLimit') {
   *       seine.addRequest({ url, init });
   *     }
   *   }
   *
   *   const retryResult = await getResult();
   * }
   * ```
   */
  readonly getResult: () => Promise<SeineResult>;
}
