
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000000, 0.012);

const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 60;

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 0);
document.body.appendChild(renderer.domElement);

const renderScene = new THREE.RenderPass(scene, camera);
const bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 2.0, 0.4, 0.85);
bloomPass.threshold = 0.1;
bloomPass.strength = 1.8;
bloomPass.radius = 0.5;

const composer = new THREE.EffectComposer(renderer);
composer.addPass(renderScene);
composer.addPass(bloomPass);

const count = 40000;
const geometry = new THREE.BufferGeometry();
const positions = new Float32Array(count * 3);
const randoms = new Float32Array(count * 3);

for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    const r = 25 * Math.cbrt(Math.random());
    const theta = Math.random() * 2 * Math.PI;
    const phi = Math.acos(2 * Math.random() - 1);

    positions[i3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i3 + 2] = r * Math.cos(phi);

    randoms[i3] = Math.random();
    randoms[i3 + 1] = Math.random();
    randoms[i3 + 2] = Math.random();
}

geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
geometry.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 3));

const material = new THREE.ShaderMaterial({
    uniforms: {
        uTime: { value: 0 },
        uMorph: { value: 0 },
        uTemplate: { value: 0 },
        uExpand: { value: 1.0 },
        uColorShift: { value: 0.0 },
        uHandPos: { value: new THREE.Vector3(0, 0, 0) },
        uHandActive: { value: 0.0 }
    },
    vertexShader: document.getElementById('vertexShader').textContent,
    fragmentShader: document.getElementById('fragmentShader').textContent,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
});

const points = new THREE.Points(geometry, material);
scene.add(points);

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
});

// UI Controls & Interactive Selectors
const camToggle = document.getElementById('cam-toggle');
const videoContainer = document.getElementById('video-container');
const gestureList = document.getElementById('gesture-list');
const listItems = gestureList.querySelectorAll('li');

let isCamOpen = false;
camToggle.addEventListener('click', () => {
    isCamOpen = !isCamOpen;
    if (isCamOpen) {
        videoContainer.classList.add('show');
        camToggle.classList.add('active');
    } else {
        videoContainer.classList.remove('show');
        camToggle.classList.remove('active');
    }
});

function updateActiveUI(templateIdx) {
    gestureList.classList.add('has-active');
    listItems.forEach((li, idx) => {
        if (idx === templateIdx) {
            li.classList.add('active');
        } else {
            li.classList.remove('active');
        }
    });
}

function clearActiveUI() {
    gestureList.classList.remove('has-active');
    listItems.forEach(li => li.classList.remove('active'));
}

let targetTemplate = 0;
let targetMorph = 0;
let targetExpand = 1.0;

const hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});

hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.6,
    minTrackingConfidence: 0.6
});

hands.onResults((results) => {
    const statusEl = document.getElementById('status');

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];

        statusEl.innerText = "Tracking Active";
        statusEl.classList.add('status-active');

        const cx = landmarks[9].x - 0.5;
        const cy = landmarks[9].y - 0.5;

        points.rotation.y = THREE.MathUtils.lerp(points.rotation.y, cx * Math.PI * 3, 0.1);
        points.rotation.x = THREE.MathUtils.lerp(points.rotation.x, cy * Math.PI * 2, 0.1);
        material.uniforms.uColorShift.value += cx * 0.04;

        // Project the index finger tip in local space of points container
        const hx = landmarks[8].x - 0.5;
        const hy = landmarks[8].y - 0.5;
        const worldHand = new THREE.Vector3(-hx * 70, -hy * 50, 0);
        points.updateMatrixWorld(true);
        const localHand = worldHand.clone().applyMatrix4(points.matrixWorld.clone().invert());
        material.uniforms.uHandPos.value.copy(localHand);
        material.uniforms.uHandActive.value = 1.0;

        const wrist = landmarks[0];

        const indexUp = landmarks[8].y < landmarks[6].y;
        const middleUp = landmarks[12].y < landmarks[10].y;
        const ringUp = landmarks[16].y < landmarks[14].y;
        const pinkyUp = landmarks[20].y < landmarks[18].y;

        const thumbDist1 = Math.abs(landmarks[4].x - landmarks[17].x);
        const thumbDist2 = Math.abs(landmarks[2].x - landmarks[17].x);
        const thumbUp = thumbDist1 > thumbDist2 * 1.2;
        let countFingers = 0;
        if (thumbUp) countFingers++;
        if (indexUp) countFingers++;
        if (middleUp) countFingers++;
        if (ringUp) countFingers++;
        if (pinkyUp) countFingers++;

        if (countFingers === 0 || (!indexUp && !middleUp && !ringUp && !pinkyUp)) {
            targetTemplate = 0;
        }
        else if (indexUp && !middleUp && !ringUp && !pinkyUp) {
            targetTemplate = 1;
        }
        else if (indexUp && middleUp && !ringUp && !pinkyUp) {
            targetTemplate = 2;
        }
        else if (indexUp && middleUp && ringUp && !pinkyUp) {
            targetTemplate = 3;
        }
        else if (indexUp && middleUp && ringUp && pinkyUp && !thumbUp) {
            targetTemplate = 4;
        }
        else {
            targetTemplate = 5;
        }

        material.uniforms.uTemplate.value = targetTemplate;
        updateActiveUI(targetTemplate);

        const dx = landmarks[8].x - landmarks[4].x;
        const dy = landmarks[8].y - landmarks[4].y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        targetExpand = THREE.MathUtils.mapLinear(distance, 0.05, 0.25, 0.4, 3.5);
        targetExpand = Math.max(0.4, Math.min(targetExpand, 3.5));

        targetMorph = 1.0;
    } else {
        statusEl.innerText = "Scanning Area...";
        statusEl.classList.remove('status-active');
        targetMorph = 0.0;
        material.uniforms.uHandActive.value = 0.0;
        clearActiveUI();

        points.rotation.y += 0.002;
        points.rotation.x += 0.001;
    }
});
const videoElement = document.querySelector('video');
const cam = new Camera(videoElement, {
    onFrame: async () => { await hands.send({ image: videoElement }); },
    width: 640, height: 480
});
cam.start();

const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();
    const elapsedTime = clock.getElapsedTime();

    material.uniforms.uTime.value = elapsedTime;

    material.uniforms.uMorph.value = THREE.MathUtils.lerp(material.uniforms.uMorph.value, targetMorph, delta * 4.0);
    material.uniforms.uExpand.value = THREE.MathUtils.lerp(material.uniforms.uExpand.value, targetExpand, delta * 8.0);

    composer.render();
}

animate();
