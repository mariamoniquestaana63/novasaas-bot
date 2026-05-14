/**
 * ContextBroker.js
 * 
 * Manages the "working memory" (short-term context) and "long-term memory" (pgvector).
 * Handles session persistence via Supabase and implements "context paging" to 
 * move older messages into vector storage.
 */

class ContextBroker {
  constructor(supabaseClient, options = {}) {
    this.db = supabaseClient;
    this.maxContextMessages = options.maxContextMessages || 10;
    this.embeddingModel = options.embeddingModel || 'text-embedding-3-small';
  }

  /**
   * Loads the current context for a session.
   * Fetches recent messages from chat_logs and optionally retrieves
   * relevant memories from pgvector.
   */
  async getContext(sessionId, queryText = null) {
    console.log(`[ContextBroker] Fetching context for session: ${sessionId}`);

    // 1. Fetch recent messages (Short-term memory)
    const { data: recentMessages, error } = await this.db
      .from('chat_logs')
      .select('role, content, created_at')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(this.maxContextMessages);

    if (error) {
      console.error('[ContextBroker] Error fetching recent messages:', error.message);
      return [];
    }

    // Messages are fetched newest first, so reverse for chronological order
    const context = recentMessages.reverse().map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    // 2. If queryText is provided, retrieve relevant long-term memories
    if (queryText) {
      const longTermMemories = await this.searchMemories(sessionId, queryText);
      if (longTermMemories && longTermMemories.length > 0) {
        // Inject long-term memory as a system hint or special context
        const memoryContext = {
          role: 'system',
          content: `Relevant past context: ${longTermMemories.join('\n')}`
        };
        return [memoryContext, ...context];
      }
    }

    return context;
  }

  /**
   * Saves a new message and checks if paging is required.
   */
  async saveMessage(sessionId, role, content) {
    console.log(`[ContextBroker] Saving ${role} message for session: ${sessionId}`);
    
    const { error } = await this.db
      .from('chat_logs')
      .insert([{ session_id: sessionId, role, content }]);

    if (error) {
      console.error('[ContextBroker] Error saving message:', error.message);
      throw error;
    }

    // Check if we need to page old messages to vector memory
    await this.checkPaging(sessionId);
  }

  /**
   * Checks if the number of messages exceeds the threshold and pages if necessary.
   */
  async checkPaging(sessionId) {
    const { count, error } = await this.db
      .from('chat_logs')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', sessionId);

    if (error) return;

    if (count > this.maxContextMessages + 5) {
      console.log(`[ContextBroker] Paging required for session: ${sessionId} (Count: ${count})`);
      await this.pageContext(sessionId);
    }
  }

  /**
   * Moves older messages to pgvector storage.
   */
  async pageContext(sessionId) {
    // 1. Identify messages to page (all but the most recent N)
    const { data: oldMessages, error } = await this.db
      .from('chat_logs')
      .select('id, content, role')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(5); // Page 5 oldest messages

    if (error || !oldMessages || oldMessages.length === 0) return;

    for (const msg of oldMessages) {
      // 2. Generate embedding (Placeholder for now)
      const embedding = await this.generateEmbedding(msg.content);

      // 3. Store in agent_memory (pgvector table)
      const { error: memError } = await this.db
        .from('agent_memory')
        .insert([{
          session_id: sessionId,
          content: `[${msg.role}] ${msg.content}`,
          embedding: embedding
        }]);

      if (!memError) {
        // 4. Optionally delete from chat_logs or mark as paged
        // For now, we'll keep them but they won't be fetched by getContext due to the limit
      } else {
        console.error('[ContextBroker] Error storing memory:', memError.message);
      }
    }
  }

  /**
   * Searches for relevant memories using vector similarity.
   */
  async searchMemories(sessionId, queryText, matchCount = 3) {
    try {
      const embedding = await this.generateEmbedding(queryText);
      
      // Call a RPC function in Supabase for vector similarity search
      // Assuming a function 'match_memories' exists
      const { data, error } = await this.db.rpc('match_memories', {
        query_embedding: embedding,
        match_threshold: 0.5,
        match_count: matchCount,
        filter_session_id: sessionId
      });

      if (error) throw error;
      return data.map(m => m.content);
    } catch (err) {
      console.warn('[ContextBroker] Memory search failed or not configured:', err.message);
      return [];
    }
  }

  /**
   * Placeholder for embedding generation.
   * In production, this would call OpenAI or another embedding provider.
   */
  async generateEmbedding(text) {
    // This is a placeholder. A real implementation would use an API.
    // For the sake of the OS simulation, we'll return a dummy vector if no API is available.
    return new Array(1536).fill(0).map(() => Math.random());
  }
}

module.exports = ContextBroker;
