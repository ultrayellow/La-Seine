import type { ApiClientConfig } from '../types/Seine.js';
// eslint-disable-next-line
import type { ApiClientStore } from './ApiClientStore.js';
import { issueToken, Token } from './Token.js';

/**
 * @see ApiClientStore
 */
export class ApiClient {
  private readonly config: Required<ApiClientConfig>;
  private token: Token;

  constructor(config: Required<ApiClientConfig>, token: Token) {
    this.config = config;
    this.token = token;
  }

  public getToken: () => Promise<Token> = async () => {
    if (this.token.isExpired()) {
      this.token = await issueToken(this.config);
    }

    return this.token;
  };

  get id(): string {
    return this.config.clientId;
  }
}
