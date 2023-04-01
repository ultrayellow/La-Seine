import { ApiClientConfig } from '../types/ApiClientConfig.js';

export class RateLimiter {
  private readonly config: Required<ApiClientConfig>;

  private secondlyLimitResetAt: number;
  private secondlySendCount: number;
  private hourlyLimtResetAt: number;
  private hourlySendCount: number;

  constructor(apiClientConfig: Required<ApiClientConfig>) {
    this.config = apiClientConfig;

    this.secondlyLimitResetAt = 0;
    this.secondlySendCount = 0;
    this.hourlyLimtResetAt = 0;
    this.hourlySendCount = 0;
  }

  public isLimitReaced = (): boolean => {
    const currTime = new Date().getTime();

    if (
      this.hourlySendCount >= this.config.rateLimitPerHour &&
      !this.isNewHour(currTime)
    ) {
      return true;
    }

    if (
      this.secondlySendCount >= this.config.rateLimitPerSec &&
      !this.isNewSec(currTime)
    ) {
      return true;
    }

    return false;
  };

  public updateAtRequest = (): void => {
    const currTime = new Date().getTime();

    if (this.isNewHour(currTime)) {
      this.refreshHourlyLimit();
    }

    if (this.isNewSec(currTime)) {
      this.refreshSecondlyLimit();
    }

    this.secondlySendCount++;
    this.hourlySendCount++;
  };

  private isNewHour = (currTime: number): boolean => {
    return this.hourlyLimtResetAt < currTime;
  };

  private refreshHourlyLimit = (): void => {
    this.hourlyLimtResetAt = getHourlyLimitResetAt();
    this.hourlySendCount = 0;
  };

  private isNewSec = (currTime: number): boolean => {
    // todo
    return this.secondlyLimitResetAt + 1000 < currTime;
  };

  private refreshSecondlyLimit = (): void => {
    this.secondlyLimitResetAt = getSecondlyLimitResetAt();
    this.secondlySendCount = 0;
  };
}

const getHourlyLimitResetAt = (): number => {
  const currTime = new Date();
  return currTime.setHours(currTime.getHours() + 1, 0, 0, 0);
};

const getSecondlyLimitResetAt = (): number => {
  const currTime = new Date();
  return currTime.setSeconds(currTime.getSeconds() + 1);
};
