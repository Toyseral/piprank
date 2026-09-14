export default function handler(_req, res) {
  res.status(410).json({
    error: 'The legacy localized-seo-pages API is retired. Use /api/content-documents with localized-guide or localized-best-for content documents.',
  });
}
