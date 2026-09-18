import supabase from './_lib/db-client.js';
import { requireRole } from './_lib/admin-guard.js';

const CONTENT_WRITE = ['super_admin', 'admin', 'content_admin'];

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://piprank.com');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const country = String(req.query?.country || '');
    if (!country) return res.status(400).json({ error: 'country is required' });

    const { data: countryRow, error: countryError } = await supabase
      .from('countries').select('id,slug,name').eq('slug', country).maybeSingle();
    if (countryError) throw countryError;
    if (!countryRow) return res.status(404).json({ error: 'Country not found' });

    const isAdmin = String(req.query?.admin || '') === 'true';
    if (isAdmin && !(await requireRole(req, res, CONTENT_WRITE))) return;

    if (req.method === 'GET') {
      const [{ data: setting, error: settingError }, { data: rows, error: rowsError }, { data: brokers, error: brokerError }] = await Promise.all([
        supabase.from('country_broker_ranking_settings').select('ranking_mode').eq('country_id', countryRow.id).maybeSingle(),
        supabase.from('country_broker_final_rankings').select('*').eq('country_id', countryRow.id).order('final_rank', { ascending: true }),
        supabase.from('brokers').select('id,name,slug,rating,trust_score,brand_color,logo_url').order('trust_score', { ascending: false }),
      ]);
      if (settingError) throw settingError;
      if (rowsError) throw rowsError;
      if (brokerError) throw brokerError;

      const brokerMap = new Map((brokers || []).map((broker) => [Number(broker.id), broker]));
      const hydrated = (rows || []).map((row) => ({
        ...row,
        broker: brokerMap.get(Number(row.broker_id)) || null,
      })).filter((row) => row.broker);

      const rankingMode = setting?.ranking_mode === 'manual' ? 'manual' : 'automatic';

      if (isAdmin) return res.status(200).json({ ranking_mode: rankingMode, rows: hydrated });

      if (rankingMode === 'manual') {
        const manual = hydrated.filter((row) => Number.isInteger(Number(row.manual_rank)) && Number(row.manual_rank) >= 1 && Number(row.manual_rank) <= 9);
        const rest = hydrated.filter((row) => !manual.some((item) => item.broker_id === row.broker_id));
        return res.status(200).json([...manual, ...rest].slice(0, 9).map((row, index) => ({ ...row, final_rank: index + 1 })));
      }

      return res.status(200).json(
        hydrated.slice(0, 9).map((row, index) => ({ ...row, final_rank: index + 1 }))
      );
    }

    if (!(await requireRole(req, res, CONTENT_WRITE))) return;

    if (req.method === 'PUT' && req.body?.ranking_mode !== undefined && req.body?.broker_id === undefined) {
      const rankingMode = String(req.body.ranking_mode);
      if (!['automatic', 'manual'].includes(rankingMode)) {
        return res.status(400).json({ error: 'ranking_mode must be automatic or manual' });
      }
      const { data, error } = await supabase
        .from('country_broker_ranking_settings')
        .upsert({ country_id: countryRow.id, ranking_mode: rankingMode, updated_at: new Date().toISOString() }, { onConflict: 'country_id' })
        .select().single();
      if (error) throw error;
      return res.status(200).json(data);
    }

    const brokerId = Number(req.body?.broker_id);
    if (!brokerId) return res.status(400).json({ error: 'broker_id is required' });

    if (req.method === 'PUT') {
      const manualRank = req.body?.manual_rank === null || req.body?.manual_rank === ''
        ? null : Number(req.body.manual_rank);
      if (manualRank !== null && (!Number.isInteger(manualRank) || manualRank < 1 || manualRank > 9)) {
        return res.status(400).json({ error: 'manual_rank must be between 1 and 9' });
      }

      if (manualRank !== null) {
        await supabase.from('country_broker_overrides')
          .update({ manual_rank: null, updated_at: new Date().toISOString() })
          .eq('country_id', countryRow.id).eq('manual_rank', manualRank).neq('broker_id', brokerId);
      }

      const payload = {
        country_id: countryRow.id,
        broker_id: brokerId,
        force_include: Boolean(req.body?.force_include),
        force_exclude: Boolean(req.body?.force_exclude),
        manual_rank: manualRank,
        score_adjustment: Number(req.body?.score_adjustment || 0),
        featured_override: req.body?.featured_override === null || req.body?.featured_override === '' ? null : Boolean(req.body?.featured_override),
        editorial_note: req.body?.editorial_note ? String(req.body.editorial_note).slice(0, 2000) : null,
        updated_at: new Date().toISOString(),
      };
      if (payload.force_include && payload.force_exclude) {
        return res.status(400).json({ error: 'A broker cannot be both force included and force excluded' });
      }

      const { data, error } = await supabase.from('country_broker_overrides')
        .upsert(payload, { onConflict: 'country_id,broker_id' }).select().single();
      if (error) throw error;
      return res.status(200).json(data);
    }

    if (req.method === 'DELETE') {
      const { error } = await supabase.from('country_broker_overrides')
        .delete().match({ country_id: countryRow.id, broker_id: brokerId });
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('country broker ranking API error:', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
  }
}
