<script setup lang="ts">
// A ramen bowl floating full-viewport behind every page, fixed so it never
// scrolls with the content and lives for the whole app session (mounted once
// from app.vue, not per-page) so the WebGL context survives route changes.
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

// Resting pitch, used before the pointer has been anywhere and whenever motion
// is reduced: tipped back so the camera looks down into the open bowl, past the
// rim, to the noodles inside — a bowl viewed edge-on would just show its outside
// wall.
const BOWL_TILT_X = THREE.MathUtils.degToRad(50)
// Pushed off-center toward the right so the page's content column doesn't sit
// on top of the bowl. A fraction of the visible width rather than a fixed world
// offset, so it holds the same relative position at any viewport aspect.
const BOWL_X_RATIO = 0.26
// The bowl aims its mouth at the pointer projected onto this z plane. Nearer the
// camera (z = 5) means a wider swing of tilt across the same pointer travel.
const POINTER_PLANE_Z = 3
// Per-frame slerp factor toward the aim — low enough that the bowl eases after
// the pointer instead of snapping to it.
const AIM_EASING = 0.06
// The model's mouth opens along its own +Y, so that's the axis being aimed.
const MOUTH_AXIS = new THREE.Vector3(0, 1, 0)
const X_AXIS = new THREE.Vector3(1, 0, 0)

const canvasRef = ref<HTMLCanvasElement | null>(null)
const visibility = useDocumentVisibility()

let renderer: THREE.WebGLRenderer | undefined
let scene: THREE.Scene | undefined
let camera: THREE.PerspectiveCamera | undefined
let bowl: THREE.Object3D | undefined
let frameId: number | undefined
let reducedMotion = false

// Pointer in normalized device coords; (0, 0) — dead center — is the resting
// aim until the pointer first moves.
const pointer = new THREE.Vector2(0, 0)
// Scratch objects reused every frame so the render loop allocates nothing.
const aimPoint = new THREE.Vector3()
const aimDirection = new THREE.Vector3()
const aimQuaternion = new THREE.Quaternion()

function onPointerMove(event: PointerEvent) {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1
  pointer.y = 1 - (event.clientY / window.innerHeight) * 2
}

// Recomputed on load and on resize, since the visible width at z = 0 depends on
// the camera's aspect.
function placeBowl() {
  if (!bowl || !camera)
    return
  const visibleHeight = 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)
  bowl.position.x = visibleHeight * camera.aspect * BOWL_X_RATIO
}

function onResize() {
  if (!renderer || !camera)
    return
  renderer.setSize(window.innerWidth, window.innerHeight)
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  placeBowl()
}

function render() {
  frameId = requestAnimationFrame(render)

  if (visibility.value !== 'visible' || !renderer || !scene || !camera)
    return

  if (bowl && !reducedMotion) {
    // Walk the camera ray through the pointer out to the aim plane, then turn
    // the bowl's mouth axis to face that point. Aiming at a point rather than
    // just mapping pointer x/y to angles keeps the tilt honest for a bowl that
    // sits off-center: the same pointer position is a different direction from
    // over there than it would be from the middle of the screen.
    aimPoint.set(pointer.x, pointer.y, 0.5).unproject(camera)
    aimDirection.copy(aimPoint).sub(camera.position).normalize()
    aimPoint.copy(camera.position).addScaledVector(
      aimDirection,
      (POINTER_PLANE_Z - camera.position.z) / aimDirection.z,
    )

    aimDirection.copy(aimPoint).sub(bowl.position).normalize()
    aimQuaternion.setFromUnitVectors(MOUTH_AXIS, aimDirection)
    bowl.quaternion.slerp(aimQuaternion, AIM_EASING)
  }

  renderer.render(scene, camera)
}

onMounted(async () => {
  // The client-only wrapper mounts this component's real DOM a tick after its
  // own onMounted fires — reading the ref immediately here is too early.
  await nextTick()
  const canvas = canvasRef.value
  if (!canvas)
    return

  reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100)
  camera.position.set(0, 0, 5)

  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  }
  catch {
    return
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(window.innerWidth, window.innerHeight)

  // The glb ships no lights of its own, so its PBR materials need something
  // to reflect or they render flat black. A key light from near the camera
  // matters most here since the bowl mostly faces the camera.
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a97a6, 1.6))
  const key = new THREE.DirectionalLight(0xffffff, 2.2)
  key.position.set(0, 2, 6)
  scene.add(key)
  const fill = new THREE.DirectionalLight(0xffffff, 0.8)
  fill.position.set(-3, 1, 2)
  scene.add(fill)

  new GLTFLoader().load('/ramen.glb', (gltf) => {
    const model = gltf.scene

    // Recenter and normalize scale: the file's authored pivot/units are
    // unknown, so frame it to a consistent size instead of trusting them.
    const box = new THREE.Box3().setFromObject(model)
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    const targetSize = 3.4
    const scale = targetSize / Math.max(size.x, size.y, size.z, 0.0001)
    model.scale.setScalar(scale)
    // Offset in the parent's space, so the shift has to be scaled too — this
    // lands the model's bounding-box center on the wrapper's origin, which is
    // what makes it spin about itself rather than orbit its authored pivot.
    model.position.copy(center).multiplyScalar(-scale)

    bowl = new THREE.Group().add(model)
    bowl.rotateOnWorldAxis(X_AXIS, BOWL_TILT_X)
    scene!.add(bowl)
    placeBowl()
  })

  window.addEventListener('pointermove', onPointerMove, { passive: true })
  window.addEventListener('resize', onResize)
  frameId = requestAnimationFrame(render)
})

onUnmounted(() => {
  if (frameId !== undefined)
    cancelAnimationFrame(frameId)
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('resize', onResize)

  scene?.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.geometry.dispose()
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      materials.forEach(material => material.dispose())
    }
  })
  renderer?.dispose()
})
</script>

<template>
  <canvas ref="canvasRef" class="fixed inset-0 -z-10 size-full" aria-hidden="true" />
</template>
