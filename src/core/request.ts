import {
  SeineBadRequestError,
  SeineFtIntraError,
  SeineNoPermissionError,
  SeineNotFoundError,
  SeineTooManyRequestsError,
  SeineUnauthorizedError,
} from '../errors/SeineError.js';

export const request: typeof fetch = async (url, init) => {
  // todo
  // console.log('sending', url);
  const response = await fetch(url, init);

  assertsStatusOk(response.status);

  return response;
};

export const requestWithToken = (
  accessToken: string,
  url: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> => {
  const newInit: RequestInit = {
    ...init,
    headers: {
      ...init?.headers,
      Authorization: `Bearer ${accessToken}`,
    },
  };

  const responseData = request(url, newInit);
  return responseData;
};

const assertsStatusOk = (status: number): void => {
  if (status === 400) {
    throw new SeineBadRequestError();
  }

  if (status === 401) {
    throw new SeineUnauthorizedError();
  }

  if (status === 403) {
    throw new SeineNoPermissionError();
  }

  if (status === 404) {
    throw new SeineNotFoundError();
  }

  if (status === 429) {
    throw new SeineTooManyRequestsError();
  }

  if (status >= 500) {
    throw new SeineFtIntraError();
  }
};
