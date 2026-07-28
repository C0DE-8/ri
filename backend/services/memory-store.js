function createMemoryStore({ db }) {
  const fallback = new Map();
  let dbReady = false;
  let dbChecked = false;

  async function ensureDb() {
    if (dbChecked) return dbReady;
    dbChecked = true;

    try {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS ri_chat_messages (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
          conversation_id VARCHAR(191) NOT NULL,
          role VARCHAR(20) NOT NULL,
          content TEXT NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_ri_chat_messages_conversation_id_id (conversation_id, id)
        )
      `);
      dbReady = true;
    } catch (error) {
      console.warn("RI memory database unavailable; using in-memory fallback:", error.message);
      dbReady = false;
    }

    return dbReady;
  }

  async function getMessages(conversationId, limit = 16) {
    if (await ensureDb()) {
      try {
        const rows = await db.query(
          `
            SELECT role, content
            FROM ri_chat_messages
            WHERE conversation_id = ?
            ORDER BY id DESC
            LIMIT ?
          `,
          [conversationId, limit]
        );
        return rows.reverse();
      } catch (error) {
        console.warn("RI memory read failed; using in-memory fallback:", error.message);
      }
    }

    return (fallback.get(conversationId) || []).slice(-limit);
  }

  async function appendMessage(conversationId, role, content) {
    const message = { role, content };

    if (await ensureDb()) {
      try {
        await db.execute(
          "INSERT INTO ri_chat_messages (conversation_id, role, content) VALUES (?, ?, ?)",
          [conversationId, role, content]
        );
        return;
      } catch (error) {
        console.warn("RI memory write failed; using in-memory fallback:", error.message);
      }
    }

    const messages = fallback.get(conversationId) || [];
    messages.push(message);
    fallback.set(conversationId, messages.slice(-40));
  }

  return {
    getMessages,
    appendMessage
  };
}

module.exports = {
  createMemoryStore
};
