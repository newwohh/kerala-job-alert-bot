import fs from 'node:fs';
import path from 'node:path';

const defaultQuery = '("Software Tester" OR "QA Analyst" OR "QA Engineer" OR "Manual Tester" OR "IT Support") ("Sharjah" OR "Dubai")';

const roles = [
  'Software Tester',
  'QA Analyst',
  'QA Engineer',
  'Manual Tester',
  'API Tester',
  'IT Support Engineer',
  'Technical Support Engineer'
];

// Combined query first, then one query per role: each surfaces different listings once the previous is exhausted.
export const searchQueries = [
  process.env.JOB_SEARCH_QUERY || defaultQuery,
  ...roles.map(r => `${r} UAE`)
];

export async function searchJobs({ query, roleByRole = false, pageToken } = {}) {
  if (!process.env.SERPAPI_KEY) throw new Error('SERPAPI_KEY is missing. Add it to .env before searching.');

  const queries = roleByRole
    ? roles.map(r => `${r} UAE`)
    : [query || process.env.JOB_SEARCH_QUERY || defaultQuery];

  const all = [];
  let nextPageToken = null;

  for (const q of queries) {
    const params = new URLSearchParams({
      engine: 'google_jobs',
      q,
      location: 'United Arab Emirates',
      hl: 'en',
      api_key: process.env.SERPAPI_KEY
    });
    if (pageToken) params.set('next_page_token', pageToken);

    const response = await fetch(`https://serpapi.com/search.json?${params}`);
    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Search API returned ${response.status}: ${errText.slice(0, 200)}`);
    }

    const data = await response.json();
    if (!roleByRole) nextPageToken = data.serpapi_pagination?.next_page_token || null;
    for (const item of data.jobs_results || []) {
      const title = item.title || 'Untitled';
      const company = item.company_name || 'Unknown company';
      const location = item.location || 'Sharjah / Dubai, UAE';
      const description = item.description || '';
      const options = item.apply_options || [];
      const url = item.share_link || options.find(o => o.link)?.link || item.related_links?.[0]?.link;

      if (!url || (!/(sharjah|dubai|uae|united arab emirates|remote)/i.test(location) && !/(sharjah|dubai)/i.test(`${title} ${description}`))) continue;
      const externalId = item.job_id || null;
      all.push({ externalId, title, company, location, description, jobUrl: url, postedAt: item.detected_extensions?.posted_at || null });
    }

    // If we got results from the primary query, avoid making redundant calls
    if (all.length > 0 && !roleByRole) break;
  }

  return { jobs: [...new Map(all.map(j => [j.externalId || j.jobUrl, j])).values()], nextPageToken };
}

// Fallback when the listing has no email: use an address the company itself publishes on its own website.
// Never guesses an address; the Telegram preview labels the source so the human can judge it before approving.
const cachePath = path.resolve('data/company-emails.json');
const NOT_COMPANY_SITE = /(linkedin|indeed|bayt|naukri|glassdoor|jobrapido|bebee|trabajo|jobaaj|expertini|jooble|talentmate|facebook|instagram|wikipedia|youtube|dubizzle|gulftalent|zawya|yellowpages|2gis|tiktok|twitter|x\.com|careerjet|monster|whatjobs|jobleads|zoominfo|crunchbase|dnb\.com|opencorporates|google)/i;
const GENERIC_WORDS = new Set(['llc', 'l.l.c', 'fz', 'fze', 'fzc', 'fzco', 'co', 'company', 'uae', 'dubai', 'sharjah', 'ajman', 'abu', 'dhabi', 'emirates', 'middle', 'east', 'services', 'service', 'solutions', 'group', 'international', 'management', 'consult', 'consulting', 'trading', 'general', 'technical', 'technology', 'technologies', 'the', 'and']);
const EMAIL_RANK = [/^(hr|careers?|jobs?|recruit\w*|talent|cv|hiring|vacanc\w*)@/, /^(info|contact|enquir\w*|inquir\w*|admin|office)@/];

function readCache() {
  try { return JSON.parse(fs.readFileSync(cachePath, 'utf8')); } catch { return {}; }
}

export async function findCompanyEmail(company) {
  const key = String(company || '').trim().toLowerCase();
  if (!key || /confidential|unknown|client of|undisclosed/.test(key)) return null;
  const cache = readCache();
  if (key in cache) return cache[key];

  let result = null;
  try {
    const params = new URLSearchParams({ engine: 'google', q: `"${company}" UAE`, gl: 'ae', hl: 'en', api_key: process.env.SERPAPI_KEY });
    const data = await (await fetch(`https://serpapi.com/search.json?${params}`)).json();
    if (data.error) throw new Error(data.error);
    const tokens = key.replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(t => t.length >= 4 && !GENERIC_WORDS.has(t));
    // ponytail: name-token-in-domain check rejects directories/wrong companies; misses sites whose domain is an acronym.
    const site = [data.knowledge_graph?.website, ...(data.organic_results || []).map(r => r.link)]
      .filter(Boolean)
      .find(link => { const host = new URL(link).hostname; return !NOT_COMPANY_SITE.test(host) && tokens.some(t => host.includes(t.replace(/s$/, ''))); });
    if (site) {
      const host = new URL(site).hostname.replace(/^www\./, '');
      const emails = new Set();
      for (const page of ['/', '/contact', '/contact-us', '/careers']) {
        try {
          const html = await (await fetch(new URL(page, site), { headers: { 'user-agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000) })).text();
          for (const m of html.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)) emails.add(m[0].toLowerCase());
        } catch {}
      }
      const own = [...emails].filter(e => { const d = e.split('@')[1]; return d === host || d.endsWith(`.${host}`); })
        .filter(e => !/noreply|no-reply|donotreply|privacy|abuse|webmaster|postmaster/.test(e));
      const rank = e => { const i = EMAIL_RANK.findIndex(r => r.test(e)); return i === -1 ? EMAIL_RANK.length : i; };
      const email = own.sort((a, b) => rank(a) - rank(b))[0];
      if (email) result = { email, source: `company website (${host})` };
    }
  } catch (e) {
    console.error('Company email lookup failed:', company, e.message);
    return null; // don't cache failures so a transient error is retried next run
  }
  fs.writeFileSync(cachePath, JSON.stringify({ ...readCache(), [key]: result }, null, 2));
  return result;
}

export function extractEmail(text) {
  const matches = [...String(text || '').matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)].map(m => m[0].toLowerCase());
  const blocked = /(example\.com|email\.com|domain\.com|sentry\.io|wixpress\.com)$/i;
  return matches.find(email => !blocked.test(email) && !/noreply|no-reply|donotreply/i.test(email)) || null;
}
