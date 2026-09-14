export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(410).json({
    error: 'This legacy content endpoint has been retired.',
    code: 'LEGACY_CONTENT_ENDPOINT_RETIRED',
  });
}
