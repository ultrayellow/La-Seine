import type { SeineFailedRequest, SeineResult } from '../types/Seine.js';
import type { RequestArg, ResponseSettled } from './Seine.js';
import * as helper from './Seine.helper.js';
import * as SeineError from '../errors/SeineError.js';
import {
  assertsFetchSuccess,
  getSeineStautsError,
  isOkStatus,
} from './request.js';

// todo: id disappears in generated result's type, which should exist for retry
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
export const generateSeineResult = (
  requests: RequestArg[],
  responsesSettled: ResponseSettled[],
): SeineResult => {
  const responses: Response[] = [];
  const failedRequests: SeineFailedRequest[] = [];

  helper.assertsResponsesFulfilled(responsesSettled);

  responsesSettled.forEach((responseSettled) => {
    if (isFetchFail(responseSettled)) {
      failedRequests.push(
        generateFailedResult(
          requests,
          responseSettled,
          new SeineError.SeineFetchError(),
        ),
      );

      return;
    }

    assertsFetchSuccess(responseSettled.value);

    const response = responseSettled.value;

    if (isResponseBadStatus(response)) {
      failedRequests.push(
        generateFailedResult(
          requests,
          responseSettled,
          getSeineStautsError(response.status),
        ),
      );

      return;
    }

    // all clear
    responses.push(responseSettled.value);
  });

  // todo: add type for this
  const resultStatus = failedRequests.length === 0 ? 'success' : 'fail';

  // todo: add result for 0 request?

  if (resultStatus === 'success') {
    return {
      status: resultStatus,
      responses: responses,
    };
  }

  return {
    status: 'fail',
    responses: responses.length !== 0 ? responses : undefined,
    failedRequests,
  };
};

const isFetchFail = (
  responseSettled: PromiseFulfilledResult<Response | null>,
): responseSettled is PromiseFulfilledResult<null> => {
  return responseSettled.value === null;
};

const isResponseBadStatus = (responseSettled: Response): boolean => {
  return !isOkStatus(responseSettled.status);
};

const generateFailedResult = (
  requests: RequestArg[],
  responseSettled: ResponseSettled,
  error: SeineError.SeineError,
): SeineFailedRequest => {
  return {
    ...requests[responseSettled.id],
    error,
  };
};
