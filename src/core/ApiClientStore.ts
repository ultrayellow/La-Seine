import { SeineRateLimitError } from '../errors/SeineError.js';
import type { ApiClientConfig, RateLimitConfig } from '../types/Seine.js';
import { ApiClient } from './ApiClient.js';
// eslint-disable-next-line
import type { Seine } from './Seine.js';
import { issueToken, Token } from './Token.js';
import { sleepMs } from './util.js';

/**
 * @see ApiClientStore.addClient
 */
const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  limitPerHour: 1200,
  limitPerSec: 2,
};

/**
 * @see Seine
 */
export class ApiClientStore {
  private readonly apiClients: ApiClient[] = [];

  // todo: custom error
  /**
   * @see Seine.addApiClient
   */
  public addClient = async (
    apiClientConfig: ApiClientConfig,
  ): Promise<void> => {
    const config: Required<ApiClientConfig> = {
      ...DEFAULT_RATE_LIMIT_CONFIG,
      ...apiClientConfig,
    };

    if (hasDuplicatedClient(this.apiClients, config)) {
      throw Error('Has duplicated client.');
    }

    try {
      const token = await issueToken(config);
      const apiClient = new ApiClient(config, token);

      this.apiClients.push(apiClient);
    } catch {
      throw Error('Wrong Api Client.');
    }
  };

  // todo: const numbers
  /**
   *
   * @description
   * Tries to find available Token in Seine. If no Token is available, wait for
   * Token's second rate limit get refreshed, and try again. Although enough
   * time has passed and still Seine doesn't have any available Token, Treats
   * all Tokens has reached to hour rate limit and abort request.
   *
   * @returns If Seine has available token, returns ```Token```.
   * Otherwise, throws ```SeineRateLimitError```.
   *
   * @see Seine.requestByChunk
   *
   */
  public getAvailableToken = async (): Promise<Token> => {
    for (let i = 0; i < 10 * 3; i++) {
      for (const apiClient of this.apiClients) {
        const token = await apiClient.getToken();

        if (token.isBusy()) {
          continue;
        }

        return token;
      }

      await sleepMs(100);
    }

    throw new SeineRateLimitError();
  };
}

/**
 * @see addClient
 */
const hasDuplicatedClient = (
  apiClients: ApiClient[],
  { clientId }: ApiClientConfig,
): boolean => {
  return apiClients.find((client) => client.id === clientId) !== undefined;
};
