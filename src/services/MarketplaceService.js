const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

class MarketplaceService {
  async listPlugins({ category, search, page = 1, limit = 20 } = {}) {
    let query = supabase
      .from('marketplace_plugins')
      .select('id, slug, name, description, category, is_verified, install_count, rating, author_tenant_id')
      .eq('is_public', true)
      .order('install_count', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (category) query = query.eq('category', category);
    if (search) query = query.ilike('name', `%${search}%`);

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  async getPlugin(slug) {
    const { data, error } = await supabase
      .from('marketplace_plugins')
      .select('*')
      .eq('slug', slug)
      .eq('is_public', true)
      .single();
    if (error) throw error;
    return data;
  }

  async installPlugin(tenantId, pluginSlug, config = {}) {
    const plugin = await this.getPlugin(pluginSlug);
    if (!plugin) throw new Error('Plugin not found');

    const { data, error } = await supabase
      .from('tenant_plugins')
      .upsert({ tenant_id: tenantId, plugin_id: plugin.id, config, is_active: true })
      .select()
      .single();
    if (error) throw error;

    // Increment install count
    await supabase.rpc('increment_install_count', { plugin_id: plugin.id });

    return data;
  }

  async uninstallPlugin(tenantId, pluginSlug) {
    const plugin = await this.getPlugin(pluginSlug);
    const { error } = await supabase
      .from('tenant_plugins')
      .update({ is_active: false })
      .match({ tenant_id: tenantId, plugin_id: plugin.id });
    if (error) throw error;
    return { success: true };
  }

  async getTenantPlugins(tenantId) {
    const { data, error } = await supabase
      .from('tenant_plugins')
      .select('*, marketplace_plugins(*)')
      .eq('tenant_id', tenantId)
      .eq('is_active', true);
    if (error) throw error;
    return data;
  }

  async publishPlugin(tenantId, pluginData) {
    const { data, error } = await supabase
      .from('marketplace_plugins')
      .insert({ ...pluginData, author_tenant_id: tenantId, is_verified: false })
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}

const marketplace = new MarketplaceService();

module.exports = { MarketplaceService, marketplace };
