import type { Coords } from '~~/shared/geo'

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

const MESSAGES: Record<number, string> = {
  [PERMISSION_DENIED]: '你關閉了定位權限，清單改回依回報時間排序。',
  [POSITION_UNAVAILABLE]: '拿不到你的位置，請確認定位服務已開啟。',
  [TIMEOUT]: '定位等太久了，再試一次看看。',
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

  const coords = ref<Coords | null>(null)
  const status = ref<LocationStatus>('unsupported')
  const message = ref('')
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
    message.value = ''
  }

  function reject(error: GeolocationPositionError) {
    stopNudge()
    status.value = 'error'
    message.value = MESSAGES[error.code] ?? '定位失敗，清單改回依回報時間排序。'
    denied.value = error.code === PERMISSION_DENIED
  }

  /** Call this from a click — never on page load. */
  function locate() {
    if (!supported.value || status.value === 'locating')
      return

    status.value = 'locating'
    message.value = ''

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
    message.value = ''
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
