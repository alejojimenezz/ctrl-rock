// === CONFIGURADOR 3D INTERACTIVO Y PARAMÉTRICO DE GUITARRAS ===

document.addEventListener("DOMContentLoaded", () => {

    // ── 1. PARÁMETROS URL Y ELEMENTOS DOM ─────────────────────────────────────
    const urlParams = new URLSearchParams(window.location.search);
    const modeloId  = urlParams.get('modelo') || 'Strat';

    const container = document.getElementById('guitar-preview-container');
    const canvas    = document.getElementById('guitar-preview-canvas');

    // Sliders CAD
    const sliderLength    = document.getElementById('bodyLength');
    const sliderWidth     = document.getElementById('bodyWidth');
    const sliderThickness = document.getElementById('bodyThickness');
    const sliderScale     = document.getElementById('scaleLength');

    // Spans de valor
    const valLength    = document.getElementById('val-bodyLength');
    const valWidth     = document.getElementById('val-bodyWidth');
    const valThickness = document.getElementById('val-bodyThickness');
    const valScale     = document.getElementById('val-scaleLength');

    // Spans de resumen
    const sumMadera  = document.getElementById('sum-madera');
    const sumColor   = document.getElementById('sum-color');
    const sumHardware= document.getElementById('sum-hardware');
    const sumPickups = document.getElementById('sum-pickups');
    const sumCad     = document.getElementById('sum-cad');

    // Botones Toolbar
    const btnReset     = document.getElementById('btn-reset-cam');
    const btnWireframe = document.getElementById('btn-toggle-wireframe');
    const btnGrid      = document.getElementById('btn-toggle-grid');
    const btnAxes      = document.getElementById('btn-toggle-axes');
    const btnExport    = document.getElementById('btn-export-cad');

    // Inicializar labels de sliders con sus valores por defecto
    if (valLength    && sliderLength)    valLength.innerText    = sliderLength.value;
    if (valWidth     && sliderWidth)     valWidth.innerText     = sliderWidth.value;
    if (valThickness && sliderThickness) valThickness.innerText = sliderThickness.value;
    if (valScale     && sliderScale)     valScale.innerText     = sliderScale.value;

    // ── 2. ESCENA THREE.JS ─────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    scene.background = null;

    const camera = new THREE.PerspectiveCamera(40, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.set(0, 0.5, 7.5);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance   = 3;
    controls.maxDistance   = 12;
    controls.target.set(0, 0.8, 0);
    controls.update();

    // ── 3. HELPERS ─────────────────────────────────────────────────────────────
    const gridHelper = new THREE.GridHelper(10, 20, 0x5c3a21, 0xd1c4b9);
    gridHelper.position.y = -1.8;
    gridHelper.visible = false;
    scene.add(gridHelper);

    const axesHelper = new THREE.AxesHelper(3);
    axesHelper.position.set(-2, -1.5, 0);
    axesHelper.visible = false;
    scene.add(axesHelper);

    // ── 4. LUCES ───────────────────────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.85);
    dirLight1.position.set(5, 10, 7);
    dirLight1.castShadow = true;
    dirLight1.shadow.mapSize.set(1024, 1024);
    dirLight1.shadow.bias = -0.001;
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xffeedd, 0.4);
    dirLight2.position.set(-5, 5, -5);
    scene.add(dirLight2);

    const spotLight = new THREE.SpotLight(0xffffff, 0.6);
    spotLight.position.set(0, 4, 6);
    spotLight.angle    = Math.PI / 4;
    spotLight.penumbra = 0.5;
    scene.add(spotLight);

    // ── 5. GRUPO DE LA GUITARRA ────────────────────────────────────────────────
    const guitarGroup = new THREE.Group();
    scene.add(guitarGroup);

    // ── 6. ESTADO INICIAL ──────────────────────────────────────────────────────
    let currentWood     = 'caoba';
    let currentColor    = 'cherry';
    let currentHardware = 'chrome';
    let currentPickups  = 'humbucker';
    let isWireframe     = false;
    let autoRotate      = true; // dejar de rotar cuando el usuario interactúa

    // ── 7. TABLAS DE MATERIALES ────────────────────────────────────────────────
    const woodMaterials = {
        caoba: { color: 0x5c3a21, roughness: 0.35, metalness: 0.1  },
        fresno:{ color: 0xe6d4c3, roughness: 0.45, metalness: 0.05 },
        arce:  { color: 0xfbf4eb, roughness: 0.3,  metalness: 0.05 }
    };

    const finishMaterials = {
        cherry:  { color: 0xb73225, roughness: 0.10, metalness: 0.10, clearcoat: 1.0, clearcoatRoughness: 0.05 },
        natural: { color: null,     roughness: 0.30, metalness: 0.05, clearcoat: 0.4, clearcoatRoughness: 0.10 },
        sunburst:{ color: 0xe07a1b, roughness: 0.08, metalness: 0.10, clearcoat: 1.0, clearcoatRoughness: 0.05 },
        negro:   { color: 0x1f1a18, roughness: 0.80, metalness: 0.20, clearcoat: 0.0, clearcoatRoughness: 0.20 },
        goldtop: { color: 0xd4af37, roughness: 0.15, metalness: 0.85, clearcoat: 0.9, clearcoatRoughness: 0.05 }
    };

    const metalMaterials = {
        chrome:{ color: 0xcccccc, metalness: 0.95, roughness: 0.05 },
        gold:  { color: 0xdaa520, metalness: 0.90, roughness: 0.08 },
        black: { color: 0x222222, metalness: 0.80, roughness: 0.20 }
    };

    // ── 8. OBJETOS DE MATERIAL (definidos una sola vez) ────────────────────────
    const bodyMaterialObj = new THREE.MeshPhysicalMaterial({
        color: 0xb73225, roughness: 0.1, metalness: 0.1,
        clearcoat: 1.0, clearcoatRoughness: 0.05
    });

    const neckMaterialObj = new THREE.MeshStandardMaterial({
        color: 0x5c3a21, roughness: 0.35, metalness: 0.1
    });

    const fretboardMaterialObj = new THREE.MeshStandardMaterial({
        color: 0x351c15, roughness: 0.8
    });

    const hardwareMaterialObj = new THREE.MeshStandardMaterial({
        color: 0xcccccc, metalness: 0.95, roughness: 0.05
    });

    const plasticMaterialObj = new THREE.MeshStandardMaterial({
        color: 0x111111, roughness: 0.5
    });

    const stringMaterialObj = new THREE.LineBasicMaterial({
        color: 0xdddddd, transparent: true, opacity: 0.6
    });

    // ── 9. REFERENCIAS A MESHES ────────────────────────────────────────────────
    let bodyMesh, neckMesh, fretboardMesh, headstockMesh, bridgeMesh;
    let pickupMeshes = [];
    let tunerMeshes  = [];
    let stringLines  = [];

    // ── 10. RECONSTRUCCIÓN PARAMÉTRICA ─────────────────────────────────────────
    function rebuildGuitar() {
        // Limpiar meshes previos
        [bodyMesh, neckMesh, fretboardMesh, headstockMesh, bridgeMesh].forEach(m => {
            if (m) guitarGroup.remove(m);
        });
        [...pickupMeshes, ...tunerMeshes, ...stringLines].forEach(m => guitarGroup.remove(m));
        pickupMeshes = [];
        tunerMeshes  = [];
        stringLines  = [];

        // Leer valores (mm → unidades Three.js, 100 mm = 1 u)
        const L = parseFloat(sliderLength.value)    / 100;
        const W = parseFloat(sliderWidth.value)     / 100;
        const T = parseFloat(sliderThickness.value) / 100;
        const S = parseFloat(sliderScale.value)     / 100;

        // ── A. CUERPO ──────────────────────────────────────────────────────────
        const bodyShape = new THREE.Shape();

        if (modeloId === 'Strat') {
            bodyShape.moveTo(0, -L/2);
            bodyShape.quadraticCurveTo( W/2,    -L/2,    W*0.50, -L*0.20);
            bodyShape.quadraticCurveTo( W*0.55,  L*0.10, W*0.35,  L*0.25);
            bodyShape.quadraticCurveTo( W*0.40,  L*0.35, W*0.23,  L*0.48);
            bodyShape.quadraticCurveTo( W*0.10,  L*0.40, W*0.05,  L*0.25);
            bodyShape.quadraticCurveTo( 0,       L*0.30,-W*0.05,  L*0.25);
            bodyShape.quadraticCurveTo(-W*0.10,  L*0.40,-W*0.23,  L*0.48);
            bodyShape.quadraticCurveTo(-W*0.40,  L*0.35,-W*0.35,  L*0.25);
            bodyShape.quadraticCurveTo(-W*0.55,  L*0.10,-W*0.50, -L*0.20);
            bodyShape.quadraticCurveTo(-W/2,    -L/2,    0,       -L/2);
        } else if (modeloId === 'LesPaul') {
            bodyShape.moveTo(0, -L/2);
            bodyShape.quadraticCurveTo( W*0.46, -L/2,    W*0.48, -L*0.25);
            bodyShape.quadraticCurveTo( W*0.48,  L*0.05, W*0.25,  L*0.13);
            bodyShape.quadraticCurveTo( W*0.33,  L*0.30, W*0.15,  L*0.45);
            bodyShape.quadraticCurveTo( 0,       L*0.44,-W*0.15,  L*0.45);
            bodyShape.quadraticCurveTo(-W*0.32,  L*0.32,-W*0.32,  L*0.18);
            bodyShape.quadraticCurveTo(-W*0.20,  L*0.08,-W*0.32, -0.05);
            bodyShape.quadraticCurveTo(-W*0.48, -L*0.25,-W*0.46, -L*0.25);
            bodyShape.quadraticCurveTo(-W*0.46, -L/2,    0,       -L/2);
        } else {
            // Flying V
            bodyShape.moveTo( 0,       L*0.42);
            bodyShape.lineTo(  W*0.46, -L*0.45);
            bodyShape.lineTo(  W*0.25, -L*0.48);
            bodyShape.lineTo(  0,      -L*0.12);
            bodyShape.lineTo( -W*0.25, -L*0.48);
            bodyShape.lineTo( -W*0.46, -L*0.45);
            bodyShape.lineTo(  0,       L*0.42);
        }

        const extrudeSettings = {
            depth: T, bevelEnabled: true,
            bevelSegments: 5, steps: 1,
            bevelSize: 0.04, bevelThickness: 0.04
        };

        const bodyGeom = new THREE.ExtrudeGeometry(bodyShape, extrudeSettings);
        bodyGeom.center();
        bodyMesh = new THREE.Mesh(bodyGeom, bodyMaterialObj);
        bodyMesh.castShadow = bodyMesh.receiveShadow = true;
        guitarGroup.add(bodyMesh);

        // ── B. MÁSTIL ──────────────────────────────────────────────────────────
        const neckLength = S * 0.45;
        const neckW      = 0.16;
        const neckDepth  = 0.08;
        const neckYPos   = L / 2 + neckLength / 2 - 0.2;

        neckMesh = new THREE.Mesh(new THREE.BoxGeometry(neckW, neckLength, neckDepth), neckMaterialObj);
        neckMesh.position.set(0, neckYPos, T / 2);
        guitarGroup.add(neckMesh);

        // ── C. DIAPASÓN ────────────────────────────────────────────────────────
        fretboardMesh = new THREE.Mesh(
            new THREE.BoxGeometry(neckW - 0.01, neckLength - 0.05, 0.02),
            fretboardMaterialObj
        );
        fretboardMesh.position.set(0, neckYPos + 0.025, T / 2 + neckDepth / 2 + 0.01);
        guitarGroup.add(fretboardMesh);

        // ── D. CABEZA ──────────────────────────────────────────────────────────
        const headYPos = neckYPos + neckLength / 2 + 0.24;
        headstockMesh  = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.52, 0.06), bodyMaterialObj);
        headstockMesh.position.set(0, headYPos, T / 2);
        guitarGroup.add(headstockMesh);

        // ── E. CLAVIJAS ────────────────────────────────────────────────────────
        const pegGeom  = new THREE.CylinderGeometry(0.012, 0.012, 0.08, 8);
        const knobGeom = new THREE.BoxGeometry(0.04, 0.02, 0.03);
        const isSixInLine = (modeloId === 'Strat');

        if (isSixInLine) {
            for (let i = 0; i < 6; i++) {
                const tg   = new THREE.Group();
                const peg  = new THREE.Mesh(pegGeom,  hardwareMaterialObj);
                peg.rotation.x = Math.PI / 2;
                tg.add(peg);
                const knob = new THREE.Mesh(knobGeom, hardwareMaterialObj);
                knob.position.set(-0.06, 0, 0);
                tg.add(knob);
                tg.position.set(-0.14, headYPos - 0.2 + i * 0.07, T / 2);
                guitarGroup.add(tg);
                tunerMeshes.push(tg);
            }
        } else {
            for (const side of [-1, 1]) {
                for (let i = 0; i < 3; i++) {
                    const tg   = new THREE.Group();
                    const peg  = new THREE.Mesh(pegGeom,  hardwareMaterialObj);
                    peg.rotation.x = Math.PI / 2;
                    tg.add(peg);
                    const knob = new THREE.Mesh(knobGeom, hardwareMaterialObj);
                    knob.position.set(0.06 * side, 0, 0);
                    tg.add(knob);
                    tg.position.set(0.14 * side, headYPos - 0.12 + i * 0.1, T / 2);
                    guitarGroup.add(tg);
                    tunerMeshes.push(tg);
                }
            }
        }

        // ── F. PUENTE ──────────────────────────────────────────────────────────
        const bridgeYPos = -L / 4 - 0.1;
        bridgeMesh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.14, 0.06), hardwareMaterialObj);
        bridgeMesh.position.set(0, bridgeYPos, T / 2 + 0.03);
        guitarGroup.add(bridgeMesh);

        // ── G. PASTILLAS ───────────────────────────────────────────────────────
        const isTriple  = (modeloId === 'Strat' && currentPickups === 'singlecoil');
        const pickupH   = isTriple ? 0.08 : 0.14;
        const pickupGeom = new THREE.BoxGeometry(0.24, pickupH, 0.05);

        const pickupOffsets = isTriple
            ? [bridgeYPos + 0.35, bridgeYPos + 0.70, bridgeYPos + 1.05]
            : [bridgeYPos + 0.45, bridgeYPos + 0.95];

        pickupOffsets.forEach(yOff => {
            // Marco (plástico) — argumentos correctos: (geometry, material)
            const ringMesh = new THREE.Mesh(
                new THREE.BoxGeometry(0.26, pickupH + 0.03, 0.06),
                plasticMaterialObj
            );
            ringMesh.position.set(0, yOff, T / 2 + 0.02);
            guitarGroup.add(ringMesh);
            pickupMeshes.push(ringMesh);

            // Núcleo
            const coreMaterial = (currentPickups === 'humbucker') ? plasticMaterialObj : hardwareMaterialObj;
            const coreMesh = new THREE.Mesh(pickupGeom, coreMaterial);
            coreMesh.position.set(0, yOff, T / 2 + 0.03);
            guitarGroup.add(coreMesh);
            pickupMeshes.push(coreMesh);
        });

        // ── H. CUERDAS ─────────────────────────────────────────────────────────
        const startZ       = T / 2 + 0.05;
        const stringStartXs = [-0.08, -0.05, -0.02, 0.01, 0.04, 0.07];

        stringStartXs.forEach((sx, idx) => {
            const points = [];
            points.push(new THREE.Vector3(sx, bridgeYPos, startZ));

            let endX, endY;
            if (isSixInLine) {
                endX = sx * 0.7;
                endY = headYPos - 0.1 + idx * 0.05;
            } else {
                if (idx < 3) {
                    endX = -0.08;
                    endY  = headYPos - 0.1 + idx * 0.08;
                } else {
                    endX =  0.08;
                    endY  = headYPos - 0.1 + (idx - 3) * 0.08;
                }
            }
            points.push(new THREE.Vector3(endX, endY, T / 2 + 0.04));

            const line = new THREE.Line(
                new THREE.BufferGeometry().setFromPoints(points),
                stringMaterialObj
            );
            guitarGroup.add(line);
            stringLines.push(line);
        });

        // Actualizar resumen CAD
        if (sumCad) {
            sumCad.innerText = `${sliderLength.value} × ${sliderWidth.value} × ${sliderThickness.value} mm (Escala: ${sliderScale.value} mm)`;
        }
    }

    // ── 11. ACTUALIZAR MATERIALES ──────────────────────────────────────────────
    function updateMaterials() {
        const woodConf   = woodMaterials[currentWood]   || woodMaterials.caoba;
        const finishConf = finishMaterials[currentColor] || finishMaterials.cherry;
        const metalConf  = metalMaterials[currentHardware] || metalMaterials.chrome;

        // Mástil — siempre toma el color de la madera
        neckMaterialObj.color.setHex(woodConf.color);
        neckMaterialObj.roughness = woodConf.roughness;
        neckMaterialObj.metalness = woodConf.metalness;

        // Diapasón — color oscuro fijo (palo de rosa)
        fretboardMaterialObj.color.setHex(0x351c15);
        fretboardMaterialObj.roughness = 0.8;

        // Acabado del cuerpo
        if (currentColor === 'natural') {
            bodyMaterialObj.color.setHex(woodConf.color);
            bodyMaterialObj.roughness          = woodConf.roughness;
            bodyMaterialObj.metalness          = woodConf.metalness;
            bodyMaterialObj.clearcoat          = 0.5;
            bodyMaterialObj.clearcoatRoughness = 0.1;
        } else {
            bodyMaterialObj.color.setHex(finishConf.color);
            bodyMaterialObj.roughness          = finishConf.roughness;
            bodyMaterialObj.metalness          = finishConf.metalness;
            bodyMaterialObj.clearcoat          = finishConf.clearcoat;
            bodyMaterialObj.clearcoatRoughness = finishConf.clearcoatRoughness;
        }

        // Metal
        hardwareMaterialObj.color.setHex(metalConf.color);
        hardwareMaterialObj.metalness = metalConf.metalness;
        hardwareMaterialObj.roughness = metalConf.roughness;

        // Plástico
        plasticMaterialObj.color.setHex(currentHardware === 'black' ? 0x0a0a0a : 0x1a1a1a);

        // Wireframe en todos los materiales
        [bodyMaterialObj, neckMaterialObj, fretboardMaterialObj,
         hardwareMaterialObj, plasticMaterialObj].forEach(m => {
            m.wireframe = isWireframe;
            m.needsUpdate = true;
        });
    }

    // ── 12. ARRANQUE ──────────────────────────────────────────────────────────
    // Primero actualizar materiales (sólo propiedades, sin referenciar meshes),
    // después construir geometría.
    updateMaterials();
    rebuildGuitar();

    // ── 13. EVENTOS DEL CONFIGURADOR ──────────────────────────────────────────

    // Madera
    document.querySelectorAll('[data-wood]').forEach(el => {
        el.addEventListener('click', e => {
            e.stopPropagation();
            document.querySelectorAll('[data-wood]').forEach(x => x.classList.remove('active'));
            el.classList.add('active');
            currentWood = el.getAttribute('data-wood');
            if (sumMadera) sumMadera.innerText = el.innerText.trim();
            updateMaterials();
        });
    });

    // Color / Acabado
    document.querySelectorAll('[data-color]').forEach(el => {
        el.addEventListener('click', e => {
            e.stopPropagation();
            document.querySelectorAll('[data-color]').forEach(x => x.classList.remove('active'));
            el.classList.add('active');
            currentColor = el.getAttribute('data-color');
            if (sumColor) sumColor.innerText = el.innerText.trim();
            updateMaterials();
        });
    });

    // Hardware
    document.querySelectorAll('[data-hardware]').forEach(el => {
        el.addEventListener('click', e => {
            e.stopPropagation();
            document.querySelectorAll('[data-hardware]').forEach(x => x.classList.remove('active'));
            el.classList.add('active');
            currentHardware = el.getAttribute('data-hardware');
            if (sumHardware) sumHardware.innerText = el.innerText.trim();
            updateMaterials();
            rebuildGuitar(); // reconstruir para re-asignar material de pastilla núcleo
        });
    });

    // Pastillas
    document.querySelectorAll('[data-pickups]').forEach(el => {
        el.addEventListener('click', e => {
            e.stopPropagation();
            document.querySelectorAll('[data-pickups]').forEach(x => x.classList.remove('active'));
            el.classList.add('active');
            currentPickups = el.getAttribute('data-pickups');
            if (sumPickups) sumPickups.innerText = el.innerText.trim();
            rebuildGuitar();
        });
    });

    // Sliders CAD
    [
        { sl: sliderLength,    val: valLength    },
        { sl: sliderWidth,     val: valWidth     },
        { sl: sliderThickness, val: valThickness },
        { sl: sliderScale,     val: valScale     }
    ].forEach(({ sl, val }) => {
        if (!sl) return;
        sl.addEventListener('input', () => {
            if (val) val.innerText = sl.value;
            rebuildGuitar();
        });
    });

    // ── 14. TOOLBAR ────────────────────────────────────────────────────────────

    function resetCamera() {
        camera.position.set(0, 0.5, 7.5);
        controls.target.set(0, 0.8, 0);
        controls.update();
    }
    if (btnReset) btnReset.addEventListener('click', resetCamera);

    if (btnWireframe) {
        btnWireframe.addEventListener('click', () => {
            isWireframe = !isWireframe;
            btnWireframe.classList.toggle('active', isWireframe);
            updateMaterials();
        });
    }

    let isGridVisible = false;
    if (btnGrid) {
        btnGrid.addEventListener('click', () => {
            isGridVisible = !isGridVisible;
            gridHelper.visible = isGridVisible;
            btnGrid.classList.toggle('active', isGridVisible);
        });
    }

    let isAxesVisible = false;
    if (btnAxes) {
        btnAxes.addEventListener('click', () => {
            isAxesVisible = !isAxesVisible;
            axesHelper.visible = isAxesVisible;
            btnAxes.classList.toggle('active', isAxesVisible);
        });
    }

    // ── 15. EXPORTAR JSON ──────────────────────────────────────────────────────
    if (btnExport) {
        btnExport.addEventListener('click', () => {
            const configData = {
                softwareCompatible: ["Autodesk Inventor", "SolidWorks", "Fusion 360"],
                timestamp:    new Date().toISOString(),
                guitarModel:  modeloId,
                wood:         currentWood,
                finish:       currentColor,
                hardware:     currentHardware,
                pickups:      currentPickups,
                bodyLength:   parseFloat(sliderLength.value),
                bodyWidth:    parseFloat(sliderWidth.value),
                bodyThickness:parseFloat(sliderThickness.value),
                scaleLength:  parseFloat(sliderScale.value)
            };
            const blob = new Blob([JSON.stringify(configData, null, 4)], { type: 'application/json' });
            const url  = URL.createObjectURL(blob);
            const a    = document.createElement('a');
            a.href     = url;
            a.download = `ctrl_rock_${modeloId.toLowerCase()}_parametros_cad.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
    }

    // ── 16. DETENER AUTOROTACIÓN AL INTERACTUAR ────────────────────────────────
    controls.addEventListener('start', () => { autoRotate = false; });

    // ── 17. LOOP DE ANIMACIÓN ──────────────────────────────────────────────────
    function animate() {
        requestAnimationFrame(animate);
        if (autoRotate) guitarGroup.rotation.y += 0.003;
        controls.update();
        renderer.render(scene, camera);
    }
    animate();

    // ── 18. RESIZE ─────────────────────────────────────────────────────────────
    window.addEventListener('resize', () => {
        const w = container.clientWidth;
        const h = container.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
    });

    // ── 19. EVENTOS DE INTEGRACIÓN MODO ASISTIDO / EXPERTO ────────────────────

    document.addEventListener('update3DFromWizard', (e) => {
        const s = e.detail;
        currentWood     = s.wood;
        currentColor    = s.color;
        currentHardware = s.hardware;
        currentPickups  = s.pickups;

        if (sliderLength)    { sliderLength.value    = s.length;    if (valLength)    valLength.innerText    = s.length;    }
        if (sliderWidth)     { sliderWidth.value     = s.width;     if (valWidth)     valWidth.innerText     = s.width;     }
        if (sliderThickness) { sliderThickness.value = s.thickness; if (valThickness) valThickness.innerText = s.thickness; }
        if (sliderScale)     { sliderScale.value     = s.scale;     if (valScale)     valScale.innerText     = s.scale;     }

        syncExpertPanelUI(s);
        updateMaterials();
        rebuildGuitar();
    });

    document.addEventListener('syncExpertControls', () => {
        if (valLength)    valLength.innerText    = sliderLength?.value    ?? '';
        if (valWidth)     valWidth.innerText     = sliderWidth?.value     ?? '';
        if (valThickness) valThickness.innerText = sliderThickness?.value ?? '';
        if (valScale)     valScale.innerText     = sliderScale?.value     ?? '';

        const woodLabel  = document.querySelector(`[data-wood="${currentWood}"]`)?.innerText.trim()     || currentWood;
        const colorLabel = document.querySelector(`[data-color="${currentColor}"]`)?.innerText.trim()   || currentColor;
        const hwLabel    = document.querySelector(`[data-hardware="${currentHardware}"]`)?.innerText.trim() || currentHardware;
        const pkLabel    = document.querySelector(`[data-pickups="${currentPickups}"]`)?.innerText.trim()   || currentPickups;

        if (sumMadera)  sumMadera.innerText  = woodLabel;
        if (sumColor)   sumColor.innerText   = colorLabel;
        if (sumHardware)sumHardware.innerText= hwLabel;
        if (sumPickups) sumPickups.innerText = pkLabel;
        if (sumCad)     sumCad.innerText     = `${sliderLength?.value} × ${sliderWidth?.value} × ${sliderThickness?.value} mm (Escala: ${sliderScale?.value} mm)`;
    });

    function syncExpertPanelUI(s) {
        document.querySelectorAll('[data-wood]').forEach(x =>
            x.classList.toggle('active', x.getAttribute('data-wood') === s.wood));
        document.querySelectorAll('[data-color]').forEach(x =>
            x.classList.toggle('active', x.getAttribute('data-color') === s.color));
        document.querySelectorAll('[data-hardware]').forEach(x =>
            x.classList.toggle('active', x.getAttribute('data-hardware') === s.hardware));
        document.querySelectorAll('[data-pickups]').forEach(x =>
            x.classList.toggle('active', x.getAttribute('data-pickups') === s.pickups));
    }

});
