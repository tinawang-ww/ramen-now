import type { Coords } from '~~/shared/geo'
import type { MessageKey } from '~/i18n/messages'

export type LocationStatus = 'unsupported' | 'idle' | 'locating' | 'ready' | 'error'

/** Reusing a five-minute-old fix beats spinning the radio up again. */
const MAX_AGE_MS = 5 * 60 * 1000
const TIMEOUT_MS = 10_000

/** If the permission prompt goes unanswered this long, say something. */
const NUDGE_AFTER_MS = 5000

// Spelled out rather than read off GeolocationPositionError, which doesn't
// exist during SSR.
const PERMISSION_DENIED = 1
const POSITION_UNAVAILABLE = 2
const TIMEOUT = 3

// Keys, not strings: the message is translated where it's read, so it follows
// the language toggle even while already on screen.
const MESSAGES: Record<number, MessageKey> = {
  [PERMISSION_DENIED]: 'location.denied',
  [POSITION_UNAVAILABLE]: 'location.unavailable',
  [TIMEOUT]: 'location.timeout',
}

/**
 * Coarse location for distance sorting.
 *
 * Follows https://web.dev/articles/user-location: the prompt only fires from a
 * user gesture, high accuracy stays off (a few hundred metres is enough to rank
 * shops), and every failure has a way back to the un-located list.
 */
export function useUserLocation() {
  // Flipped after mount, not during setup: the server can't know, and guessing
  // either way would desync the markup it sent.
  const supported = ref(false)

  const { t } = useLocale()

  const coords = ref<Coords | null>(null)
  const status = ref<LocationStatus>('unsupported')
  const messageKey = ref<MessageKey | null>(null)
  const message = computed(() => (messageKey.value ? t(messageKey.value) : ''))
  const nudging = ref(false)

  /** Set once we know the user already said no, so we stop offering the button. */
  const denied = ref(false)

  let nudgeTimer: ReturnType<typeof setTimeout> | undefined

  function stopNudge() {
    clearTimeout(nudgeTimer)
    nudging.value = false
  }

  function resolve(position: GeolocationPosition) {
    stopNudge()
    coords.value = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
    }
    status.value = 'ready'
    messageKey.value = null
  }

  function reject(error: GeolocationPositionError) {
    stopNudge()
    status.value = 'error'
    messageKey.value = MESSAGES[error.code] ?? 'location.failed'
    denied.value = error.code === PERMISSION_DENIED
  }

  /** Call this from a click — never on page load. */
  function locate() {
    if (!supported.value || status.value === 'locating')
      return

    status.value = 'locating'
    messageKey.value = null

    nudgeTimer = setTimeout(() => (nudging.value = true), NUDGE_AFTER_MS)

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      maximumAge: MAX_AGE_MS,
      timeout: TIMEOUT_MS,
    })
  }

  function clear() {
    stopNudge()
    coords.value = null
    status.value = supported.value ? 'idle' : 'unsupported'
    messageKey.value = null
  }

  onMounted(async () => {
    supported.value = 'geolocation' in navigator
    if (!supported.value)
      return

    status.value = 'idle'

    if (!('permissions' in navigator))
      return

    try {
      const permission = await navigator.permissions.query({ name: 'geolocation' })

      // Already granted means no prompt, so honouring it on load costs the user
      // nothing. 'prompt' is left alone — that one waits for the gesture.
      if (permission.state === 'granted')
        locate()
      else if (permission.state === 'denied')
        denied.value = true

      permission.addEventListener('change', () => {
        denied.value = permission.state === 'denied'
        // Revoked from browser settings mid-session: drop back to the plain list.
        if (permission.state !== 'granted' && coords.value !== null)
          clear()
      })
    }
    catch {
      // Permissions API missing or blocked for geolocation: the button still works.
    }
  })

  onScopeDispose(stopNudge)

  return { coords, status, message, nudging, denied, supported, locate, clear }
}
