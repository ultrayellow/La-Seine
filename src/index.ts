import { ApiClientStore } from './core/ApiClientStore.js';
import { Seine } from './core/Seine.js';
import { SeineInstance } from './types/Seine.js';

const seine: SeineInstance = new Seine(new ApiClientStore());

export default seine;
export type {
  RateLimitConfig,
  ApiClientConfig,
  SeineFailedRequest,
  SeineFail,
  SeineSuccess,
  SeineResult,
  SeineInstance,
} from './types/Seine.js';
