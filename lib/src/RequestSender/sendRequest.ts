import { sleepMs } from '../util/sleepMs.js';

export interface FetchConfig {
  readonly retryCount: number;
  readonly retryInterval: number;
  readonly errorStatusFn: (status: number) => boolean;
}

export interface ApiRequstArg {
  readonly endPoint: string;
  readonly init?: RequestInit;
}

export class ResponseStatusError extends Error {
  name = 'ResponseStautsError';
  status: number;

  // todo: fix ErrorOptions not found after build
  constructor(status: number, message?: string) {
    super(message);
    this.status = status;
  }
}

const FT_API_EP = 'https://api.intra.42.fr/v2/';

export const sendRequest = async (
  config: FetchConfig,
  requestArg: ApiRequstArg,
): Promise<Response> => {
  const { endPoint: url, init } = requestArg;
  const finalUrl = `${FT_API_EP}${url}`;

  let error: unknown;

  for (let tryCount = 0; tryCount < config.retryCount; tryCount++) {
    try {
      const response = await sendSingleRun(config, finalUrl, init);
      return response;
    } catch (e) {
      error = e;

      if (!isRetryLimitReached(config, tryCount)) {
        await sleepMs(config.retryInterval);
      }
    }
  }

  return Promise.reject(error);
};

export const sendRequestWithToken = (
  config: FetchConfig,
  requestArg: ApiRequstArg,
  accessToken: string,
): Promise<Response> => {
  const { endPoint: url, init } = requestArg;

  const newInit: RequestInit = {
    ...init,
    headers: {
      ...init?.headers,
      Authorization: `Bearer ${accessToken}`,
    },
  } as const;

  const responseData = sendRequest(config, { endPoint: url, init: newInit });
  return responseData;
};

const sendSingleRun = async (
  config: FetchConfig,
  url: string,
  init?: RequestInit,
): Promise<Response> => {
  const response = await fetch(url, init);

  if (isErrorStatus(config, response.status)) {
    throw new ResponseStatusError(response.status);
  }

  return response;
};

const isErrorStatus = (config: FetchConfig, status: number): boolean => {
  return config.errorStatusFn(status);
};

const isRetryLimitReached = (config: FetchConfig, count: number): boolean => {
  return count + 1 === config.retryCount;
};
