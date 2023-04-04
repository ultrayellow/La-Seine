export class ResponseStatusError extends Error {
  name = 'ResponseStautsError';
  status: number;

  // todo: fix ErrorOptions not found after build
  constructor(status: number, message?: string) {
    super(message);
    this.status = status;
  }
}

export const sendRequest: typeof fetch = async (url, init) => {
  console.log('sending', url);
  const response = await fetch(url, init);

  if (isErrorStatus(response.status)) {
    throw new ResponseStatusError(response.status);
  }

  return response;
};

export const sendRequestWithToken = (
  accessToken: string,
  url: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> => {
  const newInit: RequestInit = {
    ...init,
    headers: {
      ...init?.headers,
      Authorization: `Bearer ${accessToken}`,
    },
  };

  const responseData = sendRequest(url, newInit);
  return responseData;
};

const isErrorStatus = (status: number): boolean => {
  return status >= 400;
};
