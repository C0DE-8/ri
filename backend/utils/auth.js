function hasFullApiKey(value) {
  return typeof value === "string" && value.startsWith("dbms_") && value.length > 30;
}

function isAdminAuthorized(req) {
  const secret = process.env.TELEGRAM_ADMIN_SECRET;
  if (!secret) return true;
  return req.get("x-admin-secret") === secret || req.query.secret === secret;
}

module.exports = {
  hasFullApiKey,
  isAdminAuthorized
};
