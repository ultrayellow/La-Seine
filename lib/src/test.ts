import dotenv from 'dotenv';
import { mkdir } from 'fs/promises';
import seine, { ApiClientConfig } from './index.js';
import { writeFile } from './util/Files.js';

dotenv.config();

const getApiClientConfig = (): ApiClientConfig => {
  const envValues = {
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    rateLimitPerSec: 2,
    rateLimitPerHour: 1200,
  };

  assertHasEnv(envValues);

  console.log(envValues);

  return envValues;
};

function assertHasEnv(
  envValues: Partial<ApiClientConfig>,
): asserts envValues is ApiClientConfig {
  if (!(envValues.clientId && envValues.clientSecret)) {
    throw Error('env not exist');
  }
}

const main = async (): Promise<void> => {
  const startDate = new Date();

  await seine.addApiClient(getApiClientConfig());

  for (let i = 1; i <= 100; i++) {
    seine.addRequest(
      {
        url: 'https://api.intra.42.fr/v2/users?page[number]=' + i,
      },
      // `scale_teams?filter[filled]=true&filter[cursus_id]=21&filter[campus_id]=29&range[begin_at]=2010-01-01T00:00:00.000Z,2023-02-28T15:00:00.000Z&page[size]=100&page[number]=${i}`,
      // url: `https://api.intra.42.fr/v2/scale_teams?filter[filled]=true&filter[cursus_id]=21&filter[campus_id]=29&range[begin_at]=2010-01-01T00:00:00.000Z,2023-02-28T15:00:00.000Z&page[size]=100&page[number]=${i}`,
    );
  }

  const seineResult = await seine.getResult();

  if (seineResult.status === 'fail') {
    for (const { url, init, error: reason } of seineResult.failedRequests) {
      if (reason.cause === 'aborted' || reason.cause === 'rateLimit') {
        seine.addRequest({ url, init });
      }
    }
  }

  if (seineResult.status === 'success') {
    let i = 1;
    await mkdir('./data', { recursive: true });
    for (const response of seineResult.responses) {
      try {
        const data = await response.json();
        await writeFile(`./data/${i}.json`, data);
      } catch {
        console.error('save fail');
      }
      i++;
    }
  }

  const endDate = new Date();
  console.log(`time: ${endDate.getTime() - startDate.getTime()}ms`);
};

void main().catch();
