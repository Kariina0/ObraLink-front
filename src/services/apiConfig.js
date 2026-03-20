const LOCAL_API_PORT = "5001";

function trimTrailingSlashes(value) {
  return String(value || "").replace(/\/+$/, "");
}

function isLocalHostname(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

export function resolveApiBaseUrl() {
  const envBaseUrl = trimTrailingSlashes(process.env.REACT_APP_API_URL);
  if (envBaseUrl) {
    return envBaseUrl;
  }

  if (typeof window !== "undefined") {
    const { hostname, protocol, origin } = window.location;

    if (isLocalHostname(hostname)) {
      return `${protocol}//${hostname}:${LOCAL_API_PORT}/api`;
    }

    return `${trimTrailingSlashes(origin)}/api`;
  }

  return `http://localhost:${LOCAL_API_PORT}/api`;
}

export const API_BASE_URL = resolveApiBaseUrl();
export const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "");