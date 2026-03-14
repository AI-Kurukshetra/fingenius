type ApiSuccess<T> = {
  success: true;
  data: T;
};

type ApiFailure = {
  success: false;
  error?: {
    code?: string;
    message?: string;
  };
};

const getDefaultErrorMessage = (response: Response): string => {
  return `Request failed (${response.status})`;
};

export const parseApiResponse = async <T>(response: Response): Promise<T> => {
  const payload = (await response.json().catch(() => null)) as ApiSuccess<T> | ApiFailure | null;

  if (!response.ok || !payload || payload.success !== true) {
    const message =
      payload && payload.success === false ? payload.error?.message : getDefaultErrorMessage(response);
    throw new Error(message ?? getDefaultErrorMessage(response));
  }

  return payload.data;
};
