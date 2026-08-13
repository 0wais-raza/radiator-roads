import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ==========================================
// 1. SCENE & CAMERA SETUP
// ==========================================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb); // Blue sky
scene.fog = new THREE.FogExp2(0x87ceeb, 0.02);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
dirLight.position.set(50, 100, 50);
dirLight.castShadow = true;
scene.add(dirLight);

// ==========================================
// 2. PHYSICS WORLD (CANNON-ES)
// ==========================================
const world = new CANNON.World({
  gravity: new CANNON.Vec3(0, -9.82, 0)
});

// Ground Materials
const groundMat = new CANNON.Material();
const wheelMat = new CANNON.Material();
const contactMat = new CANNON.ContactMaterial(wheelMat, groundMat, {
  friction: 0.8,
  restitution: 0.1
});
world.addContactMaterial(contactMat);

// ==========================================
// 3. CREATE THE GROUND
// ==========================================
// Physics Floor
const groundBody = new CANNON.Body({
  type: CANNON.Body.STATIC,
  shape: new CANNON.Plane(),
  material: groundMat
});
groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
world.addBody(groundBody);

// Visual Floor
const groundMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(1000, 1000),
  new THREE.MeshStandardMaterial({ color: 0x2e8b57 }) // Grass green
);
groundMesh.rotation.x = -Math.PI / 2;
groundMesh.receiveShadow = true;
scene.add(groundMesh);

// ==========================================
// 4. VEHICLE PHYSICS (CHASSIS & WHEELS)
// ==========================================
// The Invisible Hitbox for the car
const chassisBody = new CANNON.Body({ mass: 150 });
const chassisShape = new CANNON.Box(new CANNON.Vec3(1, 0.5, 2.5)); 
chassisBody.addShape(chassisShape);
chassisBody.position.set(0, 2, 0);

// The Raycast Vehicle Engine
const vehicle = new CANNON.RaycastVehicle({
  chassisBody: chassisBody,
  indexRightAxis: 0, // X
  indexUpAxis: 1,    // Y
  indexForwardAxis: 2 // Z
});

// Add 4 Wheels
const wheelOptions = {
  radius: 0.4,
  directionLocal: new CANNON.Vec3(0, -1, 0),
  suspensionStiffness: 30,
  suspensionRestLength: 0.3,
  frictionSlip: 1.5,
  dampingRelaxation: 2.3,
  dampingCompression: 4.4,
  maxSuspensionForce: 100000,
  rollInfluence: 0.01,
  axleLocal: new CANNON.Vec3(1, 0, 0),
  maxSuspensionTravel: 0.3,
  customSlidingRotationalSpeed: -30,
  useCustomSlidingRotationalSpeed: true
};

const wheelPositions = [
  new CANNON.Vec3(-1, 0, 1.5),  // Front Left
  new CANNON.Vec3(1, 0, 1.5),   // Front Right
  new CANNON.Vec3(-1, 0, -1.5), // Back Left
  new CANNON.Vec3(1, 0, -1.5)   // Back Right
];

wheelPositions.forEach((pos) => {
  wheelOptions.chassisConnectionPointLocal = pos;
  vehicle.addWheel(wheelOptions);
});
vehicle.addToWorld(world);

// ==========================================
// 5. LOAD MCQUEEN 3D MODEL
// ==========================================
const chassisMesh = new THREE.Group();
scene.add(chassisMesh);

const loader = new GLTFLoader();
// IMPORTANT: Make sure your file is named exactly mcqueen.glb
loader.load('./mcqueen.glb', (gltf) => {
  const mcqueen = gltf.scene;
  
  mcqueen.position.set(0, -0.5, 0); // Center it on the physics box
  mcqueen.scale.set(1, 1, 1);       // Adjust size if your model is too big
  mcqueen.rotation.y = Math.PI;     // Flip 180 if facing backwards

  mcqueen.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  chassisMesh.add(mcqueen);
  console.log("Kachow! McQueen is ready.");
});

// ==========================================
// 6. CONTROLS & GAME LOOP
// ==========================================
const keys = { w: false, s: false, a: false, d: false };

window.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();
  if (key === 'w' || key === 'arrowup') keys.w = true;
  if (key === 's' || key === 'arrowdown') keys.s = true;
  if (key === 'a' || key === 'arrowleft') keys.a = true;
  if (key === 'd' || key === 'arrowright') keys.d = true;
});

window.addEventListener('keyup', (e) => {
  const key = e.key.toLowerCase();
  if (key === 'w' || key === 'arrowup') keys.w = false;
  if (key === 's' || key === 'arrowdown') keys.s = false;
  if (key === 'a' || key === 'arrowleft') keys.a = false;
  if (key === 'd' || key === 'arrowright') keys.d = false;
});

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.1);
  
  // 1. Run Physics Engine
  world.step(1 / 60, delta, 3);

  // 2. Apply Driving Controls
  const maxForce = 1200;
  const maxSteer = 0.5;

  if (keys.w) {
    vehicle.applyEngineForce(-maxForce, 2);
    vehicle.applyEngineForce(-maxForce, 3);
  } else if (keys.s) {
    vehicle.applyEngineForce(maxForce, 2);
    vehicle.applyEngineForce(maxForce, 3);
  } else {
    vehicle.applyEngineForce(0, 2);
    vehicle.applyEngineForce(0, 3);
  }

  if (keys.a) {
    vehicle.setSteeringValue(maxSteer, 0);
    vehicle.setSteeringValue(maxSteer, 1);
  } else if (keys.d) {
    vehicle.setSteeringValue(-maxSteer, 0);
    vehicle.setSteeringValue(-maxSteer, 1);
  } else {
    vehicle.setSteeringValue(0, 0);
    vehicle.setSteeringValue(0, 1);
  }

  // 3. Move McQueen visual to match Physics Box
  chassisMesh.position.copy(chassisBody.position);
  chassisMesh.quaternion.copy(chassisBody.quaternion);

  // 4. Smooth Camera Follow
  const cameraOffset = new THREE.Vector3(0, 4, -9);
  cameraOffset.applyQuaternion(chassisMesh.quaternion);
  const targetCamPos = chassisMesh.position.clone().add(cameraOffset);
  
  camera.position.lerp(targetCamPos, 0.1); // 0.1 controls camera smoothness
  camera.lookAt(chassisMesh.position);

  // 5. Draw Everything!
  renderer.render(scene, camera);
}

animate();

// Handle Window Resizing
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});