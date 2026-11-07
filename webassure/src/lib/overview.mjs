export const ASSESSMENTS = [
  ['Low Risk', 'low', '#3ba982'],
  ['Suspicious', 'suspicious', '#d6a344'],
  ['High Risk', 'high', '#e48b54'],
  ['Confirmed Malicious', 'malicious', '#d9626b'],
  ['Inconclusive', 'inconclusive', '#8190a7'],
]

export function summarize(scans, now = new Date()) {
  const distribution = ASSESSMENTS.map(([label, key, color]) => ({ label, key, color,
    count: scans.filter((scan) => scan.risk_classification === label).length }))
  const unknown = scans.length - distribution.reduce((sum, item) => sum + item.count, 0)
  if (unknown) distribution.push({ label: 'Unclassified', key: 'unknown', color: '#a1a1aa', count: unknown })
  const days = Array.from({ length: 7 }, (_, index) => {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6 + index)
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1)
    return { date: start, count: scans.filter((scan) => {
      const timestamp = new Date(scan.created_at)
      return timestamp >= start && timestamp < end
    }).length }
  })
  return { distribution, days }
}
