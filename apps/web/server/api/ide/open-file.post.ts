export default defineEventHandler(async (event) => {
  const ideCallbackUrl = getIdeCallbackUrl()
  if (!ideCallbackUrl) return { ok: false, message: 'No IDE callback configured' }

  const body = await readBody(event)
  const res = await fetch(`${ideCallbackUrl}/ide/open-file`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
})
