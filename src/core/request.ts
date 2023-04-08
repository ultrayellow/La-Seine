import * as SeineError from '../errors/SeineError.js';
// eslint-disable-next-line
import type { Token } from './Token.js';

export const request = async (
  url: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response | null> => {
  // todo
  // console.log('sending', url);
  try {
    const response = await fetch(url, init);
    return response;
  } catch {
    return null;
  }
};

/**
 * @see Token.request
 */
export const requestWithToken = (
  accessToken: string,
  url: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response | null> => {
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

const OK_STATUS = [200, 201, 202, 203, 204, 205, 206, 207, 208, 226];
export const isOkStatus = (status: number): boolean => {
  return OK_STATUS.find((ok) => ok === status) !== undefined;
};

export const getSeineStautsError = (status: number): SeineError.SeineError => {
  if (status === 400) {
    return new SeineError.SeineBadRequestError();
  }

  if (status === 401) {
    return new SeineError.SeineUnauthorizedError();
  }

  if (status === 403) {
    return new SeineError.SeineNoPermissionError();
  }

  if (status === 404) {
    return new SeineError.SeineNotFoundError();
  }

  if (status === 429) {
    return new SeineError.SeineTooManyRequestsError();
  }

  if (status >= 500) {
    return new SeineError.SeineFtIntraError();
  }

  return new SeineError.SeineUnknownError();
};

export const assertsOkStatus = (status: number): void => {
  if (isOkStatus(status)) {
    return;
  }

  throw getSeineStautsError(status);
};

export function assertsFetchSuccess(
  response: Response | null,
): asserts response is Response {
  if (!response) {
    throw new SeineError.SeineFetchError();
  }
}
