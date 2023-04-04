import { RateLimitConfig } from '../types/Seine.js';

export class RateLimiter {
  private readonly config: RateLimitConfig;

  private secondLimitResetAt: number;
  private secondSendCount: number;
  private hourLimtResetAt: number;
  private hourSendCount: number;

  constructor(rateLimitConfig: RateLimitConfig) {
    this.config = rateLimitConfig;

    this.secondLimitResetAt = 0;
    this.secondSendCount = 0;
    this.hourLimtResetAt = 0;
    this.hourSendCount = 0;
  }

  public isHourLimitReached = (): boolean => {
    const currTime = new Date().getTime();

    return (
      this.hourSendCount >= this.config.limitPerHour &&
      !this.isNewHour(currTime)
    );
  };

  public isSecLimitReached = (): boolean => {
    const currTime = new Date().getTime();

    return (
      this.secondSendCount >= this.config.limitPerSec &&
      !this.isNewSec(currTime)
    );
  };

  public updateAtRequest = (): void => {
    const currTime = new Date().getTime();

    if (this.isNewHour(currTime)) {
      this.refreshHourLimit();
    }

    if (this.isNewSec(currTime)) {
      this.refreshSecondLimit();
    }

    this.secondSendCount++;
    this.hourSendCount++;
  };

  private isNewHour = (currTime: number): boolean => {
    return this.hourLimtResetAt < currTime;
  };

  private refreshHourLimit = (): void => {
    this.hourLimtResetAt = getHourLimitResetAt();
    this.hourSendCount = 0;
  };

  private isNewSec = (currTime: number): boolean => {
    // todo
    return this.secondLimitResetAt + 1000 < currTime;
  };

  private refreshSecondLimit = (): void => {
    this.secondLimitResetAt = getSecondLimitResetAt();
    this.secondSendCount = 0;
  };
}

const getHourLimitResetAt = (): number => {
  const currTime = new Date();
  return currTime.setHours(currTime.getHours() + 1, 0, 0, 0);
};

const getSecondLimitResetAt = (): number => {
  const currTime = new Date();
  return currTime.setSeconds(currTime.getSeconds() + 1);
};
