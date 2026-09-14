export default function handler(_req, res) {
  res.status(410).json({
    error: 'The legacy country-best-for API is retired. Use /api/content-documents with canonical country-best-for content documents.',
  });
}
