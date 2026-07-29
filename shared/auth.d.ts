// In shared/ because both the Nitro and the app tsconfig project include
// shared/**/*.d.ts — under server/ the augmentation is invisible to the app
// project, which type-checks the server utils too and would drop these fields.
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
