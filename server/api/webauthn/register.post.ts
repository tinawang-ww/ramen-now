import { eq } from 'drizzle-orm'

/** Shown when the generated tag somehow arrives empty — never asked for. */
const FALLBACK_LABEL = '拉麵Now 使用者'

export default defineWebAuthnRegisterEventHandler({
  getOptions: () => ({
    authenticatorSelection: {
      // A discoverable credential is what makes signing in take no input at all:
      // the browser hands back the credential ID, so nobody has to say who they are.
      residentKey: 'required',
      // This is a queue board, not a bank — worth a face check, not worth demanding one.
      userVerification: 'preferred',
    },
  }),

  // userName is only the caption on the OS passkey picker: not unique, not an
  // identifier, never looked up by. So it gets tidied, not validated.
  validateUser: (userBody) => {
    const label = userBody.userName.trim().replace(/\s+/g, ' ').slice(0, 40)

    return { ...userBody, userName: label || FALLBACK_LABEL }
  },

  // Keeps one authenticator from registering twice for the same person: without
  // it, tapping "add a passkey" again on a device that already has one yields a
  // second row pointing at the same physical key.
  async excludeCredentials(event) {
    // The userName the module passes in is a picker caption, so it can't identify
    // anyone — the session is the only thing here that can.
    const { user } = await getUserSession(event)

    // Signed out there is no identifier at all, so the only thing left to allow
    // is a brand-new account. That does mean one device can hold several separate
    // accounts, which is unavoidable when nothing identifies a person.
    if (!user)
      return []

    const rows = await useDb(event)
      .select({ id: schema.credentials.id, transports: schema.credentials.transports })
      .from(schema.credentials)
      .where(eq(schema.credentials.userId, user.id))
      .all()

    return rows.map(row => ({
      id: row.id,
      transports: JSON.parse(row.transports ?? '[]'),
    }))
  },

  storeChallenge,
  getChallenge,

  async onSuccess(event, { credential, user }) {
    const db = useDb(event)
    const session = await getUserSession(event)

    // Already signed in means the same person is adding a passkey on another
    // device. It hangs on the existing account: two accounts would split their
    // report count in two, and the count is the whole point of signing in.
    // The stored label stays as it was — it is what the first passkey is filed
    // under in the OS picker, and renaming it would stop matching their memory.
    const person = session.user ?? await db
      .insert(schema.users)
      .values({ label: user.userName })
      .returning({ id: schema.users.id, label: schema.users.label })
      .get()

    if (!person)
      throw createError({ statusCode: 500, statusMessage: '建立失敗，請再試一次' })

    await db.insert(schema.credentials).values({
      id: credential.id,
      userId: person.id,
      publicKey: credential.publicKey,
      counter: credential.counter,
      backedUp: credential.backedUp,
      transports: JSON.stringify(credential.transports ?? []),
    })

    await setUserSession(event, { user: { id: person.id, label: person.label } })
  },
})
