import { ApiClientConfig } from './ApiClientConfig.js';

// export interface SeineOption {
//   readonly retryCount: number;
//   readonly verbose: boolean;
// }

export interface RequestArg {
  readonly url: string;
  readonly init?: RequestInit;
}

export interface SeineResult {
  readonly responses: Response[];
  // todo: add request info in Error
  readonly rejected: PromiseRejectedResult[];
  readonly aborted: RequestArg[];
  isAborted: boolean;
}

export interface SeineInstance {
  readonly addApiClient: (apiClientConfig: ApiClientConfig) => Promise<void>;
  readonly addRequest: (endPoint: string, init?: RequestInit) => void;
  readonly awaitResponses: () => Promise<SeineResult>;
}
