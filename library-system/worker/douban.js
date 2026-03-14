/**
 * 豆瓣读书 ISBN 查询代理
 *
 * GET /douban/:isbn
 *
 * 流程：
 *   1. 先查 D1 book_cache（毫秒级返回）
 *   2. Cache miss → 抓取豆瓣网页（公开页面，无 API 费用）
 *   3. 解析 HTML → 书名、作者、出版社、年份、封面、简介
 *   4. 写入 book_cache（后续请求直接命中缓存）
 *   5. 返回结构化数据
 *
 * 成本：无 API 费用，仅 Worker CPU（约 5-15ms/次）
 * 礼貌性限制：20 req/min（接 checkRateLimit 控制）
 */

/** Strip HTML tags and decode common entities */
function stripTags(s) {
  return s
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, ' ')
    .trim();
}

/** Extract a substring between two string markers */
function between(html, start, end, fromIdx = 0) {
  const si = html.indexOf(start, fromIdx);
  if (si === -1) return '';
  const ei = html.indexOf(end, si + start.length);
  if (ei === -1) return '';
  return html.slice(si + start.length, ei);
}

/**
 * Parse a Douban book page HTML string.
 * Returns partial data — missing fields will be empty strings.
 */
function parseDoubanHtml(html) {
  // ── Title ──
  let title = '';
  const titleM = html.match(/property="v:itemreviewed"[^>]*>([^<]+)<\/span>/);
  if (titleM) title = titleM[1].trim();
  if (!title) {
    const h1M = html.match(/<h1[^>]*>\s*(?:<span[^>]*>)?([^<]+)(?:<\/span>)?<\/h1>/);
    if (h1M) title = h1M[1].trim();
  }

  // ── #info block ──
  const infoStart = html.indexOf('id="info"');
  const infoBlock = infoStart !== -1 ? html.slice(infoStart, infoStart + 4000) : '';

  // ── Author ──
  let author = '';
  // Douban's info block uses <span class="pl">作者</span> followed by links
  const authorM = infoBlock.match(/作者[^<]*<\/span>([\s\S]{0,600}?)(?:<span class="pl">|<br\s*\/>|\n\n)/);
  if (authorM) {
    const raw = authorM[1];
    const links = [...raw.matchAll(/<a[^>]*>([^<]+)<\/a>/g)];
    if (links.length) {
      author = links.map(m => m[1].trim()).filter(Boolean).join(' / ');
    } else {
      author = stripTags(raw).replace(/\s*\/\s*/g, ' / ').trim();
    }
    // Remove leading/trailing punctuation
    author = author.replace(/^[\s\/,，]+|[\s\/,，]+$/g, '').trim();
  }

  // ── Publisher ──
  let publisher = '';
  const pubM = infoBlock.match(/出版社[:：][^<]*<\/span>\s*<a[^>]*>([^<]+)<\/a>/);
  if (pubM) {
    publisher = pubM[1].trim();
  } else {
    const pubM2 = infoBlock.match(/出版社[:：][^<]*<\/span>([^\n<]{1,60})/);
    if (pubM2) publisher = stripTags(pubM2[1]).trim();
  }

  // ── Published year ──
  let publishedYear = '';
  let isbnNote = '';
  const yearM = infoBlock.match(/出版年[:：][^<]*<\/span>\s*([\d]{4})/);
  if (yearM) publishedYear = yearM[1];
  if (!publishedYear) {
    const yearM2 = html.match(/(\d{4})-\d{1,2}(?:-\d{1,2})?\s*(?:出版|第\d+版)/);
    if (yearM2) publishedYear = yearM2[1];
  }
  const isbnM = infoBlock.match(/ISBN[:：][^<]*<\/span>\s*([0-9\-Xx]{10,20})/);
  if (isbnM) isbnNote = isbnM[1].trim();

  // ── Cover URL ──
  let coverUrl = '';
  // Look for mainpic container
  const mainpicM = html.match(/id="mainpic"[\s\S]{0,400}?<img[^>]+src="([^"]+)"/);
  if (mainpicM) {
    coverUrl = mainpicM[1];
    // Upgrade small/medium to large
    coverUrl = coverUrl.replace(/\/s\/|\/m\/|\/spic\/|\/mpic\//, '/lpic/');
    // Some Douban covers use private.doubanio.com
    if (coverUrl.startsWith('//')) coverUrl = 'https:' + coverUrl;
  }

  // ── Description ──
  let description = '';
  let subjectUrl = '';
  const canonicalM = html.match(/<link rel="canonical" href="([^"]+)"/);
  if (canonicalM) subjectUrl = canonicalM[1].trim();
  // 内容简介 section
  const introStart = html.indexOf('内容简介');
  if (introStart !== -1) {
    const introBlock = html.slice(introStart, introStart + 5000);
    const intros = [...introBlock.matchAll(/<div[^>]+class="[^"]*intro[^"]*"[^>]*>([\s\S]{0,2400}?)<\/div>/g)];
    if (intros.length) {
      const pick = intros.sort((a, b) => b[1].length - a[1].length)[0];
      description = stripTags(pick[1]).slice(0, 1200);
    }
  }
  // Fallback: Open Graph description
  if (!description) {
    const ogM = html.match(/property="og:description"\s+content="([^"]{0,600})"/);
    if (ogM) description = ogM[1].replace(/\\n/g, '\n').trim();
  }

  // ── Language guess ──
  // Chinese mainland publishers: contains common keywords
  const bookLang = (
    /人民|出版社|文艺|中华|北京|上海|广东|四川|浙江|江苏|湖南|天津|商务印书|三联|中信|中国/
    .test(publisher + title + author)
  ) ? 'zh-CN' : 'zh';

  return { title, author, publisher, publishedYear, coverUrl, description, bookLang, isbnNote, subjectUrl };
}

export async function handleDouban(request, env, isbn, corsHeaders) {
  const respond = (data, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  // ── 1. D1 cache lookup ──
  try {
    const cached = await env.DB.prepare(
      'SELECT * FROM book_cache WHERE isbn = ?'
    ).bind(isbn).first();

    if (cached?.title) {
      // Non-blocking hit count update
      env.DB.prepare('UPDATE book_cache SET hit_count = hit_count + 1 WHERE isbn = ?')
        .bind(isbn).run().catch(() => {});

      return respond({
        source: 'cache',
        isbn,
        title: cached.title,
        author: cached.author,
        category: cached.category || '',
        publishedYear: cached.published_year || '',
        coverUrl: cached.cover_url || '',
        description: cached.description || '',
        publisher: cached.publisher || '',
        isbnNote: cached.isbn_note || '',
        subjectUrl: cached.subject_url || '',
        sourcePriority: Number(cached.source_priority || 120),
        bookLang: cached.book_lang || 'zh-CN',
      });
    }
  } catch {
    // DB error — fall through to live fetch
  }

  // ── 2. Fetch Douban book page ──
  const doubanUrl = `https://book.douban.com/isbn/${isbn}`;
  let html = '';

  try {
    const resp = await fetch(doubanUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': 'https://book.douban.com/',
        'Cache-Control': 'no-cache',
      },
      redirect: 'follow',
    });

    if (resp.status === 404) {
      return respond({ error: 'NOT_FOUND', message: '豆瓣未收录此书' }, 404);
    }
    if (resp.status === 403 || resp.status === 429) {
      return respond({ error: 'RATE_LIMITED', message: '豆瓣暂时限制访问，请稍后重试' }, 503);
    }
    if (!resp.ok) {
      return respond({ error: 'UPSTREAM_ERROR', message: `豆瓣返回 ${resp.status}` }, 502);
    }

    html = await resp.text();
  } catch (e) {
    return respond({ error: 'FETCH_FAILED', message: '连接豆瓣失败，请检查网络' }, 502);
  }

  // ── 3. Anti-block checks ──
  if (
    html.length < 500 ||
    html.includes('机器人') ||
    html.includes('robot') ||
    (html.includes('登录') && !html.includes('v:itemreviewed'))
  ) {
    return respond({ error: 'BLOCKED', message: '豆瓣要求验证，暂时无法访问' }, 503);
  }

  // ── 4. Parse ──
  const parsed = parseDoubanHtml(html);

  if (!parsed.title) {
    return respond({ error: 'PARSE_FAILED', message: '豆瓣页面解析失败，可能页面结构已变化' }, 404);
  }

  // ── 5. Write to D1 cache ──
  const now = new Date().toISOString();
  try {
    await env.DB.prepare(`
      INSERT OR REPLACE INTO book_cache
        (isbn, title, author, category, published_year, book_lang, cover_url, description,
         publisher, isbn_note, subject_url, metadata_sources, source_priority, contributed_by, hit_count, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `).bind(
      isbn,
      parsed.title,
      parsed.author,
      '',
      parsed.publishedYear,
      parsed.bookLang,
      parsed.coverUrl,
      parsed.description,
      parsed.publisher,
      parsed.isbnNote,
      parsed.subjectUrl,
      JSON.stringify(['豆瓣读书']),
      120,
      'system:douban-scraper',
      now,
      now,
    ).run();
  } catch {
    // Cache write failed — still return parsed data
  }

  // ── 6. Return ──
  return respond({
    source: 'douban',
    isbn,
    title: parsed.title,
    author: parsed.author,
    publisher: parsed.publisher,
    isbnNote: parsed.isbnNote,
    subjectUrl: parsed.subjectUrl,
    sourcePriority: 120,
    publishedYear: parsed.publishedYear,
    coverUrl: parsed.coverUrl,
    description: parsed.description,
    bookLang: parsed.bookLang,
  });
}
