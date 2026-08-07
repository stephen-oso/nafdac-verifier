const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000

export default function Footer({ scrapeDate }) {
  const isStale = scrapeDate
    ? Date.now() - new Date(scrapeDate).getTime() > NINETY_DAYS_MS
    : false

  return (
    <footer style={{ padding: '16px 20px', textAlign: 'center' }}>
      {scrapeDate && (
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          DB last updated: {scrapeDate}
        </p>
      )}
      {isStale && (
        <p style={{ fontSize: '0.75rem', color: 'var(--amber)', marginTop: 4 }}>
          ⚠ Data may be outdated — verify with NAFDAC directly
        </p>
      )}
    </footer>
  )
}
