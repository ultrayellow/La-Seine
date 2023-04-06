import { ApiClientStore } from './core/ApiClientStore.js';
import { Seine } from './core/Seine.js';
import { SeineInstance } from './types/Seine.js';

const seine: SeineInstance = new Seine(new ApiClientStore());

export default seine;
export type {
  ApiClientConfig,
  FetchArg,
  SeineFail,
  SeineInstance,
  SeineResult,
  SeineSuccess,
} from './types/Seine.js';
