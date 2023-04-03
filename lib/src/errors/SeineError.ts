export const enum SeineErrorCode {
  FETCH_ERROR,
  FT_SERVER_ERROR,
  HOURLY_LIMIT_REACHED,
  MAX_FAIL_LIMIT_REACHED,
}

const seineErrorMessage = [
  'Fetch error occurred.',
  '42 intra server is currently unavailable.',
  "All 42 api client's hourly rate limit reached.",
  'Too many request failure.',
];

export class SeineError extends Error {
  reason: SeineErrorCode;

  constructor(name: string, reason: SeineErrorCode) {
    super(name);
    this.reason = reason;
  }
}

/*

1. fetch network error
2. fetch status error (401, 403, 404, 429, 500 >=)
3. hourly limit
4. too much fail

*/
