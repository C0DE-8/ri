function getPublicUrl(req) {
  const configuredUrl = process.env.PUBLIC_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (configuredUrl) return normalizeUrl(configuredUrl);
  return `${req.protocol}://${req.get("host")}`;
}

function normalizeUrl(url) {
  const value = String(url || "").replace(/\/$/, "");
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

function maskSecret(value) {
  if (!value) return null;
  if (value.length <= 10) return "***";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

module.exports = {
  getPublicUrl,
  maskSecret,
  normalizeUrl
};
