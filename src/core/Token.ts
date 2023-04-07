import { SeineInternalError } from '../errors/SeineError.js';
import type { ApiClientConfig, RateLimitConfig } from '../types/Seine.js';
import { RateLimiter } from './RateLimiter.js';
import { request, requestWithToken } from './request.js';
// eslint-disable-next-line
import type { Seine } from './Seine.js';

export interface TokenDto {
  readonly access_token: string;
  readonly token_type: string;
  readonly expires_in: number;
  readonly scope: string;
  readonly created_at: number;
}

// todo: scope support
export class Token {
  private readonly accessToken: string;
  // eslint-disable-next-line
  private readonly createdAt: number;
  private readonly expiredAt: number;
  private readonly rateLimiter: RateLimiter;

  constructor(tokenDto: TokenDto, rateLimitConfig: RateLimitConfig) {
    this.accessToken = tokenDto.access_token;
    this.createdAt = tokenDto.created_at;
    this.expiredAt = getExpiredDate(tokenDto.expires_in);
    this.rateLimiter = new RateLimiter(rateLimitConfig);
  }

  /**
   *
   * @see Seine.requestByChunk
   */
  public request: typeof fetch = (url, init) => {
    this.updateAtRequest();

    const response = requestWithToken(this.accessToken, url, init);
    return response;
  };

  public isExpired = (): boolean => {
    const currTime = new Date().getTime();
    return currTime >= this.expiredAt;
  };

  public isBusy = (): boolean => {
    return this.rateLimiter.isBusy();
  };

  private updateAtRequest = (): void => {
    this.rateLimiter.updateAtRequest();
  };
}

export const issueToken = async (
  apiClientConfig: Required<ApiClientConfig>,
): Promise<Token> => {
  const response = await request('https://api.intra.42.fr/v2/oauth/token', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: apiClientConfig.clientId,
      client_secret: apiClientConfig.clientSecret,
    }),
  });

  const tokenPayload: unknown = await response.json();
  assertIsTokenDto(tokenPayload);

  const token = new Token(tokenPayload, apiClientConfig);
  return token;
};

function assertIsTokenDto(
  tokenPayload: unknown,
): asserts tokenPayload is TokenDto {
  if (
    typeof tokenPayload === 'object' &&
    tokenPayload &&
    'access_token' in tokenPayload &&
    'token_type' in tokenPayload &&
    'expires_in' in tokenPayload &&
    'scope' in tokenPayload &&
    'created_at' in tokenPayload
  ) {
    return;
  }

  throw new SeineInternalError('Seine is outdated.');
}

const getExpiredDate = (expiresIn: number): number => {
  const currTime = new Date().getTime();
  return floorUnderSeconds(currTime + toMilliseconds(expiresIn));
};

const toMilliseconds = (seconds: number): number => {
  return seconds * 1000;
};

const floorUnderSeconds = (milliseconds: number): number => {
  return (milliseconds / 1000) * 1000;
};
