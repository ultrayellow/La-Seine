import {
  SeineInternalError,
  SeineRateLimitError,
} from '../errors/SeineError.js';
import type {
  RequestArg,
  ResponseFulfilled,
  ResponseRejected,
  ResponseSettled,
  Seine,
} from './Seine.js';

/**
 * @see Seine.requestByChunk
 */
export const chunkRequests = (
  requests: RequestArg[],
  requestChunkSize: number,
): RequestArg[][] => {
  const chunked: RequestArg[][] = [];

  for (let i = 0; i < requests.length; i += requestChunkSize) {
    chunked.push(requests.slice(i, i + requestChunkSize));
  }

  return chunked;
};

/**
 * @see Seine.flushRequests
 */
export const isAbortCondition = (
  responseSettled: ResponseSettled[],
  maxFailLimit: number,
): boolean => {
  return (
    responseSettled.find(isHourLimitReached) !== undefined ||
    maxFailLimitReached(responseSettled, maxFailLimit)
  );
};

/**
 * @see isAbortCondition
 */
const isHourLimitReached = (response: ResponseSettled): boolean => {
  return (
    response.status === 'rejected' &&
    response.reason instanceof SeineRateLimitError
  );
};

/**
 * @see isAbortCondition
 */
const maxFailLimitReached = <T>(
  resPromises: PromiseSettledResult<T>[],
  maxFailLimit: number,
): boolean => {
  return resPromises.filter(isRejected).length >= maxFailLimit;
};

/**
 * @see generateSeineResult
 */
export function assertsResponsesFulfilled(
  results: ResponseSettled[],
): asserts results is ResponseFulfilled[] {
  if (results.find(isRejected)) {
    throw new SeineInternalError();
  }
}

/**
 * @see generateSeineResult
 */
export function assertsResponsesRejected(
  results: ResponseSettled[],
): asserts results is ResponseRejected[] {
  if (results.find(isFulfilled)) {
    throw new SeineInternalError();
  }
}

/**
 * @see assertsResponsesRejected
 */
const isFulfilled = <T>(
  result: PromiseSettledResult<T>,
): result is PromiseFulfilledResult<T> => {
  return result.status === 'fulfilled';
};

/**
 * @see assertsResponsesFulfilled
 */
const isRejected = <T>(
  result: PromiseSettledResult<T>,
): result is PromiseRejectedResult => {
  return result.status === 'rejected';
};
