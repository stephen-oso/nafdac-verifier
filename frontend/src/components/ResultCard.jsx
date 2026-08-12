import VerifiedCard from './VerifiedCard'
import NotFoundCard from './NotFoundCard'
import MultipleMatchesCard from './MultipleMatchesCard'

export default function ResultCard({ result, mode, query }) {
  if (!result) return null

  if (result.status === 'VERIFIED') {
    return <VerifiedCard drug={result.drug} mode={mode} />
  }

  if (result.status === 'NOT_FOUND') {
    const top = result.closest_matches?.[0]
    const closestMatch = top
      ? `${top.drug_name}${top.manufacturer ? ' — ' + top.manufacturer : ''} — ${top.reg_number}`
      : null
    return (
      <NotFoundCard
        summary={result.summary}
        closestMatches={result.closest_matches}
        mode={mode}
        query={query}
        closestMatch={closestMatch}
      />
    )
  }

  if (result.status === 'MULTIPLE_MATCHES') {
    return <MultipleMatchesCard candidates={result.candidates} summary={result.summary} mode={mode} />
  }

  return null
}
