const { createClient } = require('@supabase/supabase-js');
const Anthropic = require('@anthropic-ai/sdk');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

class KnowledgeCommons {
  async embed(text) {
    // Use Claude's embedding via a lightweight prompt trick or use a text-embedding model
    // For now generate a placeholder - in production wire to text-embedding-3-small
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 10,
      messages: [{ role: 'user', content: `embedding:${text}` }]
    });
    // Return null to skip vector search when embeddings aren't configured
    return null;
  }

  async contribute(tenantId, { category, question, answer, isPublic = true }) {
    const { data, error } = await supabase
      .from('knowledge_commons')
      .insert({
        tenant_id: tenantId,
        category,
        question_text: question,
        answer_text: answer,
        is_public: isPublic
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async search(query, { category, limit = 5 } = {}) {
    // Full-text fallback when embeddings not available
    let q = supabase
      .from('knowledge_commons')
      .select('id, category, question_text, answer_text, helpful_votes')
      .eq('is_public', true)
      .textSearch('question_text', query, { type: 'websearch' })
      .order('helpful_votes', { ascending: false })
      .limit(limit);

    if (category) q = q.eq('category', category);
    const { data, error } = await q;
    if (error) return [];
    return data;
  }

  async upvote(entryId) {
    const { data, error } = await supabase.rpc('increment_helpful_votes', { entry_id: entryId });
    if (error) throw error;
    return data;
  }

  async getTopEntries({ category, limit = 10 } = {}) {
    let q = supabase
      .from('knowledge_commons')
      .select('id, category, question_text, answer_text, helpful_votes, total_views')
      .eq('is_public', true)
      .order('helpful_votes', { ascending: false })
      .limit(limit);
    if (category) q = q.eq('category', category);
    const { data } = await q;
    return data || [];
  }
}

const commons = new KnowledgeCommons();

module.exports = { KnowledgeCommons, commons };
