type HeaderReader = {
  get: (name: string) => string | null;
};

const LOCAL_HOST_PATTERN = /^(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$/i;

const cleanListHeaderValue = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  const first = value.split(",")[0]?.trim();
  return first || null;
};

const normalizeOrigin = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return new URL(trimmed).origin;
  } catch {
    return null;
  }
};

const normalizeConfiguredOrigin = (): string | null => {
  const configured =
    process.env.AUTH_REDIRECT_BASE_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim() || "";

  if (!configured) {
    return null;
  }

  const asOrigin = normalizeOrigin(configured);
  if (asOrigin) {
    return asOrigin;
  }

  const withProtocol = configured.startsWith("http://") || configured.startsWith("https://")
    ? configured
    : `https://${configured}`;

  return normalizeOrigin(withProtocol);
};

const inferProtoFromHost = (host: string, protoHint: string | null): string => {
  if (protoHint === "http" || protoHint === "https") {
    return protoHint;
  }

  return LOCAL_HOST_PATTERN.test(host) ? "http" : "https";
};

const originFromHost = (host: string, protoHint: string | null): string => {
  const proto = inferProtoFromHost(host, protoHint);
  return `${proto}://${host}`;
};

export const resolveAppOrigin = (headers: HeaderReader, fallbackUrl?: string): string => {
  const configuredOrigin = normalizeConfiguredOrigin();
  if (configuredOrigin) {
    return configuredOrigin;
  }

  const originHeader = normalizeOrigin(cleanListHeaderValue(headers.get("origin")) ?? "");
  if (originHeader) {
    return originHeader;
  }

  const forwardedHost = cleanListHeaderValue(headers.get("x-forwarded-host"));
  const forwardedProto = cleanListHeaderValue(headers.get("x-forwarded-proto"));
  if (forwardedHost) {
    return originFromHost(forwardedHost, forwardedProto);
  }

  const host = cleanListHeaderValue(headers.get("host"));
  if (host) {
    return originFromHost(host, forwardedProto);
  }

  if (fallbackUrl) {
    const fromFallback = normalizeOrigin(fallbackUrl);
    if (fromFallback) {
      return fromFallback;
    }
  }

  return "http://localhost:3000";
};
