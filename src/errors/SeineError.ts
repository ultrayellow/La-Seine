export type SeineErrorCause =
  | 'invalidClient'
  | 'badRequest'
  | 'unauthorized'
  | 'tooManyRequests'
  | 'rateLimit'
  | 'aborted'
  | 'seineInternal'
  | 'notFound'
  | 'noPermission'
  | 'fetchError'
  | 'ftIntraError'
  | 'unknown';

export abstract class SeineErrorBase extends Error {
  readonly cause: SeineErrorCause;

  constructor(message: string, cause: SeineErrorCause) {
    super(message);
    this.cause = cause;
  }
}

export class SeineInvalidApiClientError extends SeineErrorBase {
  constructor() {
    super('Invalid Client Provided', 'invalidClient');
  }
}

export class SeineBadRequestError extends SeineErrorBase {
  constructor() {
    super('Bad request', 'badRequest');
  }
}

export class SeineUnauthorizedError extends SeineErrorBase {
  constructor() {
    super('Unauthorized', 'unauthorized');
  }
}

export class SeineTooManyRequestsError extends SeineErrorBase {
  constructor() {
    super('Too many requests', 'tooManyRequests');
  }
}

export class SeineRateLimitError extends SeineErrorBase {
  constructor() {
    super('Rate Limit Reached.', 'rateLimit');
  }
}

export class SeineAbortError extends SeineErrorBase {
  constructor() {
    super('Aborted before Request.', 'aborted');
  }
}

export class SeineInternalError extends SeineErrorBase {
  constructor(message?: string) {
    super(message ?? 'Seine Internal Error.', 'seineInternal');
  }
}

export class SeineNotFoundError extends SeineErrorBase {
  constructor() {
    super('Invalid Url of Request.', 'notFound');
  }
}

export class SeineNoPermissionError extends SeineErrorBase {
  constructor() {
    super('Need higher level of permission to do this.', 'noPermission');
  }
}

export class SeineFetchError extends SeineErrorBase {
  constructor() {
    super('Fetch failed.', 'fetchError');
  }
}

export class SeineFtIntraError extends SeineErrorBase {
  constructor() {
    super('42 Intra is down.', 'ftIntraError');
  }
}

/**
 * @description Report to developer if this error occurres
 */
export class SeineUnknownError extends SeineErrorBase {
  constructor() {
    super('unknown', 'unknown');
  }
}

export type SeineError =
  | SeineRateLimitError
  | SeineTooManyRequestsError
  | SeineAbortError
  | SeineInternalError
  | SeineNotFoundError
  | SeineNoPermissionError
  | SeineFetchError
  | SeineFtIntraError;
