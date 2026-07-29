declare module '#auth-utils' {
  interface User {
    id: number
    label: string
  }
  interface SecureSessionData {
    webauthn?: { attemptId: string, challenge: string }
  }
}

export {}
