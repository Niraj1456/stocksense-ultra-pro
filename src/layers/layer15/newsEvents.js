const Parser = require("rss-parser");
const { scrapeBseAnnouncements } = require("../../scrapers/bse");

const rssParser = new Parser();

async function supplyChainNews() {
  const feed = await rssParser.parseURL(
    "https://news.google.com/rss/search?q=india+supply+chain+disruption+stocks&hl=en-IN&gl=IN&ceid=IN:en"
  );
  const items = (feed.items || []).slice(0, 20).map((x) => ({
    title: x.title,
    link: x.link,
    pubDate: x.pubDate
  }));
  return {
    ok: true,
    data: { count: items.length, items },
    meta: { fetchedAt: new Date().toISOString(), source: "rss:google_news" }
  };
}

async function announcements(symbol) {
  const out = await scrapeBseAnnouncements(symbol);
  return {
    ok: true,
    data: out.data,
    meta: { fetchedAt: new Date().toISOString(), source: "scrape:bse_announcements" }
  };
}

module.exports = { supplyChainNews, announcements };

