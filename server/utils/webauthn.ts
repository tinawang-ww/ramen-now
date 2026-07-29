import type { H3Event } from 'h3'

/**
 * The challenge lives in the session's `secure` block rather than a table: it is
 * only ever meaningful to the browser that asked for it, and `secure` never
 * reaches the client. Nitro's `useStorage()` would be per-isolate on Workers,
 * so a challenge written by one isolate would be missing from the next.
 */
export async function storeChallenge(event: H3Event, challenge: string, attemptId: string) {
  await setUserSession(event, { secure: { webauthn: { attemptId, challenge } } })
}

export async function getChallenge(event: H3Event, attemptId: string) {
  const { id: _id, secure, ...rest } = await getUserSession(event)

  if (secure?.webauthn?.attemptId !== attemptId)
    throw createError({ statusCode: 400, statusMessage: '驗證已逾時，請再試一次' })

  const { challenge } = secure.webauthn

  // Single use. setUserSession is a defu merge, so setting the value to undefined
  // does not clear it — the old challenge would silently survive and let a replay
  // through. Clearing has to go through replaceUserSession.
  await replaceUserSession(event, { ...rest, secure: { ...secure, webauthn: undefined } })

  return challenge
}
