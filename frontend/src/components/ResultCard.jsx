import VerifiedCard from './VerifiedCard'
import NotFoundCard from './NotFoundCard'
import MultipleMatchesCard from './MultipleMatchesCard'

export default function ResultCard({ result, mode }) {
  if (!result) return null

  if (result.status === 'VERIFIED') {
    return <VerifiedCard drug={result.drug} mode={mode} />
  }
  if (result.status === 'NOT_FOUND') {
    return <NotFoundCard summary={result.summary} closestMatches={result.closest_matches} />
  }
  if (result.status === 'MULTIPLE_MATCHES') {
    return <MultipleMatchesCard candidates={result.candidates} summary={result.summary} />
  }
  return null
}
