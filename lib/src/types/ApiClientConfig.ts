export interface RateLimitConfig {
  readonly limitPerSec: number;
  readonly limitPerHour: number;
}

export interface ApiClientConfig extends Partial<RateLimitConfig> {
  readonly clientName: string;
  readonly clientId: string;
  readonly clientSecret: string;
}
