function hasFullApiKey(value) {
  return typeof value === "string" && value.startsWith("dbms_") && value.length > 30;
}

module.exports = {
  hasFullApiKey
};
