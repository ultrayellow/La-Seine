// export interface SeineOption {
//   readonly hanging
//   readonly retryCount: number;
//   readonly verbose: boolean;
// }

export interface RateLimitConfig {
  readonly limitPerSec: number;
  readonly limitPerHour: number;
}

export interface ApiClientConfig extends Partial<RateLimitConfig> {
  readonly clientName: string;
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
  readonly reason: unknown;
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
  readonly addApiClient: (apiClientConfig: ApiClientConfig) => Promise<void>;
  readonly addRequest: (fecthArg: FetchArg) => void;
  readonly awaitResponses: () => Promise<SeineResult>;
}
