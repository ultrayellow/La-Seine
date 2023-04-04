export class SeineRateLimitError extends Error {
  readonly reason = 'ratelimit';

  constructor() {
    super('SeineError');
  }
}

export class SeineAbortError extends Error {
  readonly reason = 'aborted';

  constructor() {
    super('SeineError');
  }
}

export class SeineInternalError extends Error {
  readonly reason = 'SeineInternal';

  constructor() {
    super('SeineError');
  }
}

/*

1. fetch network error
2. fetch status error (401, 403, 404, 429, 500 >=)
3. hourly limit
4. too much fail

*/
