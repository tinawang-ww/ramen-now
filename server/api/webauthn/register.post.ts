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

  storeChallenge,
  getChallenge,

  async onSuccess(event, { credential, user }) {
    const db = useDb(event)

    // Always a new person: there is no way to reach this handler while signed in yet.
    const created = await db
      .insert(schema.users)
      .values({ label: user.userName })
      .returning({ id: schema.users.id, label: schema.users.label })
      .get()

    if (!created)
      throw createError({ statusCode: 500, statusMessage: '建立失敗，請再試一次' })

    await db.insert(schema.credentials).values({
      id: credential.id,
      userId: created.id,
      publicKey: credential.publicKey,
      counter: credential.counter,
      backedUp: credential.backedUp,
      transports: JSON.stringify(credential.transports ?? []),
    })

    await setUserSession(event, { user: { id: created.id, label: created.label } })
  },
})
