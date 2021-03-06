export const stringifyQueryParams = (queryParams: Record<string, string>) =>
  Object.entries(queryParams).reduce((acc, [k, v]) => {
    return `${acc}&${k}=${v}`;
  }, '');
