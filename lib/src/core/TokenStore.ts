import { ApiClientConfig, RateLimitConfig } from '../types/Seine.js';
import { sendRequest } from './sendRequest.js';
import { Token, TokenDto } from './Token.js';

const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  limitPerHour: 1200,
  limitPerSec: 2,
};

export class TokenStore {
  private readonly apiClientConfig: Required<ApiClientConfig>;

  private token: Token | null = null;

  constructor(apiClientConfig: ApiClientConfig) {
    this.apiClientConfig = {
      ...DEFAULT_RATE_LIMIT_CONFIG,
      ...apiClientConfig,
    };
  }

  public initialize = async (): Promise<Token> => {
    try {
      const tokenPayload = await this.issueToken();
      this.token = new Token(tokenPayload, this.apiClientConfig);
      return this.token;
    } catch (e) {
      throw Error('initialize token store fail');
    }
  };

  public getApiClientId = (): string => {
    return this.apiClientConfig.clientId;
  };

  public getToken = async (): Promise<Token> => {
    const currToken = this.token;

    if (isEmpty(currToken) || currToken.isExpired()) {
      const newToken = await this.initialize();
      return newToken;
    }

    return currToken;
  };

  private issueToken = async (): Promise<Readonly<TokenDto>> => {
    const response = await sendRequest(
      'https://api.intra.42.fr/v2/oauth/token',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.apiClientConfig.clientId,
          client_secret: this.apiClientConfig.clientSecret,
        }),
      },
    );

    const tokenPayload: unknown = await response.json();
    assertIsTokenDto(tokenPayload);

    // todo: verbose
    // console.log(`token issued: ${tokenPayload.access_token}`);

    return tokenPayload;
  };
}

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

  throw Error('library outdated');
}

const isEmpty = (token: Token | null): token is null => {
  return token === null;
};
