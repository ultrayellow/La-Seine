export type SeineErrorCause =
  | 'rateLimit'
  | 'aborted'
  | 'seineInternal'
  | 'notFound'
  | 'noPermission'
  | 'fetchError'
  | 'ftIntraError';

export abstract class SeineErrorBase extends Error {
  readonly cause: SeineErrorCause;

  constructor(message: string, cause: SeineErrorCause) {
    super(message);
    this.cause = cause;
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
  constructor() {
    super('Seine Internal Error.', 'seineInternal');
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

export type SeineError =
  | SeineRateLimitError
  | SeineAbortError
  | SeineInternalError
  | SeineNotFoundError
  | SeineNoPermissionError
  | SeineFetchError
  | SeineFtIntraError;
