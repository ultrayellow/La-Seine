import { RequestArg } from '../types/Seine.js';

export class ResponseStatusError extends Error {
  name = 'ResponseStautsError';
  status: number;

  // todo: fix ErrorOptions not found after build
  constructor(status: number, message?: string) {
    super(message);
    this.status = status;
  }
}

const FT_API_EP = 'https://api.intra.42.fr/v2/';

export const sendRequest = async (
  requestArg: RequestArg,
): Promise<Response> => {
  const { url, init } = requestArg;
  const finalUrl = `${FT_API_EP}${url}`;

  const response = await fetch(finalUrl, init);

  if (isErrorStatus(response.status)) {
    throw new ResponseStatusError(response.status);
  }

  return response;
};

export const sendRequestWithToken = (
  requestArg: RequestArg,
  accessToken: string,
): Promise<Response> => {
  const { url, init } = requestArg;

  const newInit: RequestInit = {
    ...init,
    headers: {
      ...init?.headers,
      Authorization: `Bearer ${accessToken}`,
    },
  };

  const responseData = sendRequest({ url, init: newInit });
  return responseData;
};

const isErrorStatus = (status: number): boolean => {
  return status >= 400;
};
