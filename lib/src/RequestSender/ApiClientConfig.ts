export interface ApiClientConfig {
  readonly clientName: string;
  readonly clientId: string;
  readonly clientSecret: string;
  readonly rateLimitPerSec?: number;
  readonly rateLimitPerHour?: number;
}

// todo remove?
export const logClientConfig = (config: Required<ApiClientConfig>): void => {
  console.log(`
  -------------
  |-clientName: ${config.clientName}
  |-clientId: ${config.clientId}
  |-clientSecret: ${config.clientSecret}
  |-request per sec: ${config.rateLimitPerSec}
  |-request per hour: ${config.rateLimitPerHour}
  --------------------`);
};
