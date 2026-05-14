/**
 * Blackboard.js
 * Primary Inter-Process Communication (IPC) mechanism for the AI Workforce OS.
 * Uses Supabase for storage and real-time notifications.
 */

class Blackboard {
  constructor(supabaseClient) {
    this.db = supabaseClient;
    this.subscriptions = new Map();
  }

  /**
   * Post an entry to the blackboard.
   */
  async post(entry) {
    const { session_id, agent_id, type, layer, payload, parent_id, confidence, tags } = entry;
    
    console.log(`[Blackboard] Posting ${type} from ${agent_id} in layer ${layer}`);

    const { data, error } = await this.db
      .from('blackboard_entries')
      .insert([{
        session_id,
        agent_id,
        type,
        layer,
        payload,
        parent_id,
        confidence,
        tags,
        status: 'active'
      }])
      .select()
      .single();

    if (error) {
      console.error('[Blackboard] Error posting entry:', error.message);
      throw error;
    }

    return data;
  }

  /**
   * Subscribe to entries matching specific filters.
   */
  subscribe(filters, callback) {
    let filterString = '';
    if (filters) {
      filterString = Object.entries(filters)
        .map(([key, value]) => `${key}=eq.${value}`)
        .join(',');
    }

    const subscription = this.db
      .channel('blackboard_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'blackboard_entries',
          filter: filterString
        },
        (payload) => {
          callback(payload.new);
        }
      )
      .subscribe();

    const subId = Math.random().toString(36).substring(7);
    this.subscriptions.set(subId, subscription);
    return subId;
  }

  /**
   * Unsubscribe from the blackboard.
   */
  unsubscribe(subId) {
    const subscription = this.subscriptions.get(subId);
    if (subscription) {
      subscription.unsubscribe();
      this.subscriptions.delete(subId);
    }
  }

  /**
   * Retrieve historical entries for a session.
   */
  async getHistory(sessionId, limit = 50) {
    const { data, error } = await this.db
      .from('blackboard_entries')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) {
      console.error('[Blackboard] Error fetching history:', error.message);
      throw error;
    }

    return data;
  }

  /**
   * Update the status of an entry (e.g., claiming a plan).
   */
  async updateStatus(entryId, status) {
    const { data, error } = await this.db
      .from('blackboard_entries')
      .update({ status })
      .eq('id', entryId)
      .select()
      .single();

    if (error) {
      console.error('[Blackboard] Error updating status:', error.message);
      throw error;
    }

    return data;
  }
}

module.exports = Blackboard;
