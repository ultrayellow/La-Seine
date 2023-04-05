import { Seine } from './core/Seine.js';
import { SeineInstance } from './types/Seine.js';

const seine: SeineInstance = new Seine();

export default seine;
export type {
  SeineInstance,
  ApiClientConfig,
  FetchArg,
  SeineSuccess,
  SeineFail,
  SeineResult,
} from './types/Seine.js';
