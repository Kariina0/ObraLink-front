const API_BASE = (process.env.REACT_APP_API_URL || "http://localhost:5000/api").replace(/\/api\/?$/, "");

function upgradeToHttpsWhenNeeded(url) {
  if (typeof window === "undefined") return url;
  if (window.location.protocol !== "https:") return url;
  if (!/^http:\/\//i.test(url)) return url;
  return url.replace(/^http:\/\//i, "https://");
}

export function resolveImageUrl(value) {
  if (!value || typeof value !== "string") return null;

  const source = value.trim();
  if (!source) return null;

  if (/^data:/i.test(source) || /^blob:/i.test(source)) {
    return source;
  }

  if (/^\/\//.test(source)) {
    const protocol = typeof window !== "undefined" ? window.location.protocol : "https:";
    return `${protocol}${source}`;
  }

  if (/^https?:\/\//i.test(source)) {
    return upgradeToHttpsWhenNeeded(source);
  }

  const absolute = `${API_BASE}${source.startsWith("/") ? "" : "/"}${source}`;
  return upgradeToHttpsWhenNeeded(absolute);
}
