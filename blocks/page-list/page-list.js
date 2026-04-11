/**
 * "YYYY/MM/DD HH:MI" → Date
 * 未定義・空・不正は null
 */
function parseDateTime(str) {
  if (!str || !str.trim()) return null;

  const iso = str
    .trim()
    .replace(/\//g, '-')
    .replace(' ', 'T') + ':00';

  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * エントリーの代表日時
 * startdate があればそれ、なければ lastmodified
 */
function getEntryDate(page) {
  return (
    parseDateTime(page.startdate) ||
    (page.lastmodified ? new Date(page.lastmodified) : null) ||
    new Date(0)
  );
}

/**
 * キャンペーン状態判定（修正版）
 * return: 'active' | 'upcoming' | 'ended'
 */
function getCampaignStatus(page, now = new Date()) {
  const start = parseDateTime(page.startdate);
  const end = parseDateTime(page.enddate);

  // 開始前
  if (start && now < start) return 'upcoming';

  // 終了後
  if (end && now > end) return 'ended';

  // それ以外はすべて開催中（常設含む）
  return 'active';
}

/**
 * 代表日時で新しい順
 */
function sortByEntryDateDesc(a, b) {
  return getEntryDate(b) - getEntryDate(a);
}

/**
 * "YYYY/MM/DD HH:MI" → "YYYY/MM/DD"
 */
function formatDateOnly(str) {
  if (!str) return '';
  return str.trim().split(' ')[0];
}

/**
 * 表示用日付レンジ（日付のみ）
 */
function formatDateRange(page) {
  const start = formatDateOnly(page.startdate);
  const end = formatDateOnly(page.enddate);

  if (!start && !end) return '';
  if (start && end) return `${start} – ${end}`;
  if (start) return `${start} 〜`;
  return `〜 ${end}`;
}

export default async function decorate(block) {
  const rows = [...block.querySelectorAll(':scope > div')];
  const config = {};

  // table → config
  rows.forEach((row) => {
    const key = row.children[0]?.textContent.trim();
    const value = row.children[1]?.textContent.trim();
    if (key && value) config[key] = value;
  });

  let { path, limit = 12, mode } = config;

  // mode 未指定 → active
  mode = mode || 'active';

  if (!path) {
    console.warn('page-list: path is required');
    return;
  }

  if (!path.endsWith('/')) path += '/';

  const resp = await fetch('/query-index.json');
  const json = await resp.json();

  const now = new Date();

  const pages = json.data
    // 対象パス配下
    .filter((item) => item.path.startsWith(path))
    // mode フィルタ（修正版）
    .filter((item) => {
      const status = getCampaignStatus(item, now);

      if (mode === 'active') return status === 'active';
      if (mode === 'upcoming') return status === 'upcoming';
      if (mode === 'ended') return status === 'ended';
      if (mode === 'all') return true;

      return status === 'active';
    })
    // 並び替え（startdate → lastmodified）
    .sort(sortByEntryDateDesc)
    // 件数制限
    .slice(0, Number(limit));

  const wrapper = document.createElement('div');
  wrapper.className = 'page-list';

  pages.forEach((page) => {
    const status = getCampaignStatus(page, now);
    const dateRange = formatDateRange(page);

    const badgeHtml = `
      <span class="campaign-badge campaign-badge--${status}">
        ${status === 'active' ? '開催中' : status === 'upcoming' ? '予告' : '終了'}
      </span>
    `;

    const card = document.createElement('a');
    card.className = 'page-card';
    card.href = page.path;

    card.innerHTML = `
      <div class="page-card-image">
        ${badgeHtml}
        ${page.image ? `<img src="${page.image}" alt="">` : ''}
      </div>
      <div class="page-card-body">
        <h3>${page.title || ''}</h3>
        <p>${page.description || ''}</p>
        ${dateRange ? `<p class="page-card-dates">${dateRange}</p>` : ''}
      </div>
    `;

    wrapper.appendChild(card);
  });

  block.replaceChildren(wrapper);
}
