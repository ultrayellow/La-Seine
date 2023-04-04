import { RateLimitConfig } from '../types/Seine.js';
import { RateLimiter } from './RateLimiter.js';

export interface TokenDto {
  readonly access_token: string;
  readonly token_type: string;
  readonly expires_in: number;
  readonly scope: string;
  readonly created_at: number;
}

export class Token {
  readonly accessToken: string;
  // eslint-disable-next-line
  private readonly createdAt: number;
  private readonly expiredAt: number;
  private readonly rateLimiter: RateLimiter;

  constructor(tokenDto: TokenDto, rateLimitConfig: RateLimitConfig) {
    this.accessToken = tokenDto.access_token;
    this.createdAt = tokenDto.created_at;
    this.expiredAt = getExpiredDate(tokenDto.expires_in);
    this.rateLimiter = new RateLimiter(rateLimitConfig);

    // todo
    // console.log(`token expiresAt: ${new Date(this.expiredAt)}`);
  }

  public isExpired = (): boolean => {
    const currTime = new Date().getTime();
    return currTime >= this.expiredAt;
  };

  public isAvailable = (): boolean => {
    return !(this.isHourLimitReached() || this.isSecLimitReached());
  };

  public isHourLimitReached = (): boolean => {
    return this.rateLimiter.isHourLimitReached();
  };

  public isSecLimitReached = (): boolean => {
    return this.rateLimiter.isSecLimitReached();
  };

  public updateAtRequest = (): void => {
    this.rateLimiter.updateAtRequest();
  };
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
