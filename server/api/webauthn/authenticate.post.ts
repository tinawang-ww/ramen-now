import { eq } from 'drizzle-orm'

// No getOptions and no allowCredentials, deliberately: the module narrows the
// credential list only when both a list and a userName arrive, so leaving them
// out is exactly what lets the browser offer every passkey on this site — which
// is what makes signing in take no input at all.
export default defineWebAuthnAuthenticateEventHandler({
  storeChallenge,
  getChallenge,

  async getCredential(event, credentialId) {
    const db = useDb(event)

    const record = await db
      .select({
        id: schema.credentials.id,
        publicKey: schema.credentials.publicKey,
        counter: schema.credentials.counter,
        transports: schema.credentials.transports,
        backedUp: schema.credentials.backedUp,
        userId: schema.credentials.userId,
        label: schema.users.label,
      })
      .from(schema.credentials)
      .innerJoin(schema.users, eq(schema.users.id, schema.credentials.userId))
      .where(eq(schema.credentials.id, credentialId))
      .get()

    if (!record)
      throw createError({ statusCode: 400, statusMessage: '找不到這把 Passkey' })

    // userId and label are along for the ride: the module hands this whole
    // object back to onSuccess untouched.
    return {
      ...record,
      // Stored as a JSON string, but it goes straight into
      // verifyAuthenticationResponse, which wants the array.
      transports: JSON.parse(record.transports ?? '[]'),
    }
  },

  async onSuccess(event, { credential, authenticationInfo }) {
    const db = useDb(event)

    // Without this the counter never moves, and a replayed signature would
    // look just as fresh as the real one.
    await db
      .update(schema.credentials)
      .set({ counter: authenticationInfo.newCounter })
      .where(eq(schema.credentials.id, credential.id))

    await setUserSession(event, { user: { id: credential.userId, label: credential.label } })
  },
})
