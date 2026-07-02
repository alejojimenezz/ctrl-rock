// Configurador 3D y flujo de compra Ctrl+Rock.

document.addEventListener("DOMContentLoaded", () => {
    const API_BASE_URL = "http://localhost:5000";
    const urlParams = new URLSearchParams(window.location.search);
    const modeloId = (urlParams.get("modelo") || "Stingray").toLowerCase();

    const container = document.getElementById("guitar-preview-container");
    const canvas = document.getElementById("guitar-preview-canvas");
    const title = document.getElementById("modelo-titulo");

    const btnReset = document.getElementById("btn-reset-cam");
    const btnWireframe = document.getElementById("btn-toggle-wireframe");
    const btnGrid = document.getElementById("btn-toggle-grid");
    const btnAxes = document.getElementById("btn-toggle-axes");
    const btnCotizar = document.getElementById("btn-enviar");
    const btnComprar = document.getElementById("btn-comprar");
    const btnCancelar = document.getElementById("btn-cancelar");
    const btnCancelarCompra = document.getElementById("btn-cancelar-compra");
    const formCompra = document.getElementById("form-compra");

    const modalCotizacion = document.getElementById("modal-cotizacion");
    const modalCompra = document.getElementById("modal-compra");
    const precioFinalEl = document.getElementById("precio-final");
    const paymentStatus = document.getElementById("payment-status");
    const cardErrors = document.getElementById("card-errors");
    const cardContainer = document.getElementById("card-element-container");

    const sumMadera = document.getElementById("sum-madera");
    const sumColor = document.getElementById("sum-color");
    const sumHardware = document.getElementById("sum-hardware");
    const sumPickups = document.getElementById("sum-pickups");
    const sumCad = document.getElementById("sum-cad");

    if (!container || !canvas || !window.THREE || !THREE.OrbitControls) {
        console.error("No se pudo iniciar el visor 3D: faltan canvas, contenedor o Three.js.");
        return;
    }

    if (title) title.textContent = `Personalizando tu modelo ${modeloId}`;

    const state = {
        wood: "caoba",
        color: "cherry",
        hardware: "chrome",
        pickups: "humbucker",
        size: "4_4",
        wireframe: false,
        autoRotate: true,
        length: 440,
        width: 325,
        thickness: 45,
        scale: 648
    };

    let cotizacionData = null;
    let stripe = null;
    let elements = null;
    let cardElement = null;
    let clientSecret = null;
    let paymentIntentId = null;

    const woodMaterials = {
        caoba: { color: 0x5c3a21, roughness: 0.35, metalness: 0.08 },
        fresno: { color: 0xe6d4c3, roughness: 0.45, metalness: 0.04 },
        nogal: { color: 0x3e2723, roughness: 0.42, metalness: 0.05 },
        arce: { color: 0xfbf4eb, roughness: 0.3, metalness: 0.04 }
    };

    const finishMaterials = {
        cherry: { color: 0xb73225, roughness: 0.1, metalness: 0.1, clearcoat: 1.0, clearcoatRoughness: 0.05 },
        natural: { color: null, roughness: 0.28, metalness: 0.04, clearcoat: 0.55, clearcoatRoughness: 0.12 },
        sunburst: { color: 0xe07a1b, roughness: 0.08, metalness: 0.1, clearcoat: 1.0, clearcoatRoughness: 0.05 },
        carbon: { color: 0x242424, roughness: 0.72, metalness: 0.18, clearcoat: 0.15, clearcoatRoughness: 0.18 },
        negro: { color: 0x1f1a18, roughness: 0.8, metalness: 0.2, clearcoat: 0.0, clearcoatRoughness: 0.2 },
        goldtop: { color: 0xd4af37, roughness: 0.15, metalness: 0.85, clearcoat: 0.9, clearcoatRoughness: 0.05 }
    };

    const metalMaterials = {
        chrome: { color: 0xcccccc, metalness: 0.95, roughness: 0.05 },
        gold: { color: 0xdaa520, metalness: 0.9, roughness: 0.08 },
        black: { color: 0x222222, metalness: 0.8, roughness: 0.2 }
    };

    const sizePresets = {
        "1_4": { length: 330, width: 244, thickness: 34, scale: 560 },
        "1_2": { length: 370, width: 275, thickness: 38, scale: 590 },
        "3_4": { length: 405, width: 302, thickness: 42, scale: 620 },
        "4_4": { length: 440, width: 325, thickness: 45, scale: 648 }
    };

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf7efe7);

    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    camera.position.set(0, 0.5, 7.5);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;

    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 3;
    controls.maxDistance = 12;
    controls.target.set(0, 0.8, 0);
    controls.update();
    controls.addEventListener("start", () => {
        state.autoRotate = false;
    });

    const guitarGroup = new THREE.Group();
    scene.add(guitarGroup);

    const gridHelper = new THREE.GridHelper(10, 20, 0x5c3a21, 0xd1c4b9);
    gridHelper.position.y = -1.8;
    gridHelper.visible = false;
    scene.add(gridHelper);

    const axesHelper = new THREE.AxesHelper(3);
    axesHelper.position.set(-2, -1.5, 0);
    axesHelper.visible = false;
    scene.add(axesHelper);

    scene.add(new THREE.HemisphereLight(0xffffff, 0xd7c4b5, 0.75));

    const keyLight = new THREE.DirectionalLight(0xffffff, 0.95);
    keyLight.position.set(5, 8, 7);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xffead7, 0.45);
    rimLight.position.set(-5, 4, -4);
    scene.add(rimLight);

    const bodyMaterial = new THREE.MeshPhysicalMaterial({ color: 0xb73225, roughness: 0.1, metalness: 0.1, clearcoat: 1 });
    const neckMaterial = new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.35, metalness: 0.08 });
    const fretboardMaterial = new THREE.MeshStandardMaterial({ color: 0x351c15, roughness: 0.8 });
    const hardwareMaterial = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.95, roughness: 0.05 });
    const plasticMaterial = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 });
    const stringMaterial = new THREE.LineBasicMaterial({ color: 0xdddddd, transparent: true, opacity: 0.68 });

    function disposeObject(object) {
        object.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
        });
    }

    function clearGuitar() {
        while (guitarGroup.children.length) {
            const child = guitarGroup.children.pop();
            disposeObject(child);
        }
    }

    function bodyShapeForModel(length, width) {
        const L = length;
        const W = width;
        const shape = new THREE.Shape();

        if (modeloId.includes("lespaul")) {
            shape.moveTo(0, -L / 2);
            shape.quadraticCurveTo(W * 0.46, -L / 2, W * 0.48, -L * 0.25);
            shape.quadraticCurveTo(W * 0.48, L * 0.05, W * 0.25, L * 0.13);
            shape.quadraticCurveTo(W * 0.33, L * 0.3, W * 0.15, L * 0.45);
            shape.quadraticCurveTo(0, L * 0.44, -W * 0.15, L * 0.45);
            shape.quadraticCurveTo(-W * 0.32, L * 0.32, -W * 0.32, L * 0.18);
            shape.quadraticCurveTo(-W * 0.2, L * 0.08, -W * 0.32, -0.05);
            shape.quadraticCurveTo(-W * 0.48, -L * 0.25, -W * 0.46, -L * 0.25);
            shape.quadraticCurveTo(-W * 0.46, -L / 2, 0, -L / 2);
            return shape;
        }

        if (modeloId.includes("v") || modeloId.includes("espex") || modeloId.includes("ibanez")) {
            shape.moveTo(0, L * 0.42);
            shape.lineTo(W * 0.46, -L * 0.45);
            shape.lineTo(W * 0.25, -L * 0.48);
            shape.lineTo(0, -L * 0.12);
            shape.lineTo(-W * 0.25, -L * 0.48);
            shape.lineTo(-W * 0.46, -L * 0.45);
            shape.lineTo(0, L * 0.42);
            return shape;
        }

        shape.moveTo(0, -L / 2);
        shape.quadraticCurveTo(W / 2, -L / 2, W * 0.5, -L * 0.2);
        shape.quadraticCurveTo(W * 0.55, L * 0.1, W * 0.35, L * 0.25);
        shape.quadraticCurveTo(W * 0.4, L * 0.35, W * 0.23, L * 0.48);
        shape.quadraticCurveTo(W * 0.1, L * 0.4, W * 0.05, L * 0.25);
        shape.quadraticCurveTo(0, L * 0.3, -W * 0.05, L * 0.25);
        shape.quadraticCurveTo(-W * 0.1, L * 0.4, -W * 0.23, L * 0.48);
        shape.quadraticCurveTo(-W * 0.4, L * 0.35, -W * 0.35, L * 0.25);
        shape.quadraticCurveTo(-W * 0.55, L * 0.1, -W * 0.5, -L * 0.2);
        shape.quadraticCurveTo(-W / 2, -L / 2, 0, -L / 2);
        return shape;
    }

    function updateMaterials() {
        const wood = woodMaterials[state.wood] || woodMaterials.caoba;
        const finish = finishMaterials[state.color] || finishMaterials.cherry;
        const metal = metalMaterials[state.hardware] || metalMaterials.chrome;

        neckMaterial.color.setHex(wood.color);
        neckMaterial.roughness = wood.roughness;
        neckMaterial.metalness = wood.metalness;

        if (state.color === "natural") {
            bodyMaterial.color.setHex(wood.color);
            bodyMaterial.roughness = finish.roughness;
            bodyMaterial.metalness = finish.metalness;
            bodyMaterial.clearcoat = finish.clearcoat;
            bodyMaterial.clearcoatRoughness = finish.clearcoatRoughness;
        } else {
            bodyMaterial.color.setHex(finish.color);
            bodyMaterial.roughness = finish.roughness;
            bodyMaterial.metalness = finish.metalness;
            bodyMaterial.clearcoat = finish.clearcoat;
            bodyMaterial.clearcoatRoughness = finish.clearcoatRoughness;
        }

        hardwareMaterial.color.setHex(metal.color);
        hardwareMaterial.metalness = metal.metalness;
        hardwareMaterial.roughness = metal.roughness;
        plasticMaterial.color.setHex(state.hardware === "black" ? 0x0a0a0a : 0x1a1a1a);

        [bodyMaterial, neckMaterial, fretboardMaterial, hardwareMaterial, plasticMaterial].forEach((material) => {
            material.wireframe = state.wireframe;
            material.needsUpdate = true;
        });

        if (sumMadera) sumMadera.textContent = state.wood.toUpperCase();
        if (sumColor) sumColor.textContent = state.color.toUpperCase();
        if (sumHardware) sumHardware.textContent = state.hardware.toUpperCase();
        if (sumPickups) sumPickups.textContent = state.pickups.toUpperCase();
        if (sumCad) sumCad.textContent = `${state.length} x ${state.width} x ${state.thickness} mm (Escala: ${state.scale} mm)`;
    }

    function rebuildGuitar() {
        clearGuitar();
        updateMaterials();

        const L = state.length / 100;
        const W = state.width / 100;
        const T = state.thickness / 100;
        const S = state.scale / 100;

        const bodyGeometry = new THREE.ExtrudeGeometry(bodyShapeForModel(L, W), {
            depth: T,
            bevelEnabled: true,
            bevelSegments: 5,
            steps: 1,
            bevelSize: 0.04,
            bevelThickness: 0.04
        });
        bodyGeometry.center();

        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.castShadow = true;
        body.receiveShadow = true;
        guitarGroup.add(body);

        const neckLength = S * 0.45;
        const neckWidth = 0.16;
        const neckDepth = 0.08;
        const neckY = L / 2 + neckLength / 2 - 0.2;

        const neck = new THREE.Mesh(new THREE.BoxGeometry(neckWidth, neckLength, neckDepth), neckMaterial);
        neck.position.set(0, neckY, T / 2);
        neck.castShadow = true;
        guitarGroup.add(neck);

        const fretboard = new THREE.Mesh(new THREE.BoxGeometry(neckWidth - 0.01, neckLength - 0.05, 0.02), fretboardMaterial);
        fretboard.position.set(0, neckY + 0.025, T / 2 + neckDepth / 2 + 0.01);
        guitarGroup.add(fretboard);

        const headY = neckY + neckLength / 2 + 0.24;
        const headstock = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.52, 0.06), bodyMaterial);
        headstock.position.set(0, headY, T / 2);
        guitarGroup.add(headstock);

        const isSixInLine = modeloId.includes("strat") || modeloId.includes("tele") || modeloId.includes("stingray");
        const pegGeometry = new THREE.CylinderGeometry(0.012, 0.012, 0.08, 12);
        const knobGeometry = new THREE.BoxGeometry(0.04, 0.02, 0.03);

        if (isSixInLine) {
            for (let i = 0; i < 6; i += 1) {
                const tuner = new THREE.Group();
                const peg = new THREE.Mesh(pegGeometry, hardwareMaterial);
                peg.rotation.x = Math.PI / 2;
                tuner.add(peg);
                const knob = new THREE.Mesh(knobGeometry, hardwareMaterial);
                knob.position.set(-0.06, 0, 0);
                tuner.add(knob);
                tuner.position.set(-0.14, headY - 0.2 + i * 0.07, T / 2);
                guitarGroup.add(tuner);
            }
        } else {
            [-1, 1].forEach((side) => {
                for (let i = 0; i < 3; i += 1) {
                    const tuner = new THREE.Group();
                    const peg = new THREE.Mesh(pegGeometry, hardwareMaterial);
                    peg.rotation.x = Math.PI / 2;
                    tuner.add(peg);
                    const knob = new THREE.Mesh(knobGeometry, hardwareMaterial);
                    knob.position.set(0.06 * side, 0, 0);
                    tuner.add(knob);
                    tuner.position.set(0.14 * side, headY - 0.12 + i * 0.1, T / 2);
                    guitarGroup.add(tuner);
                }
            });
        }

        const bridgeY = -L / 4 - 0.1;
        const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.14, 0.06), hardwareMaterial);
        bridge.position.set(0, bridgeY, T / 2 + 0.03);
        bridge.castShadow = true;
        guitarGroup.add(bridge);

        const isTriple = state.pickups === "singlecoil";
        const pickupHeight = isTriple ? 0.08 : 0.14;
        const pickupOffsets = isTriple ? [bridgeY + 0.35, bridgeY + 0.7, bridgeY + 1.05] : [bridgeY + 0.45, bridgeY + 0.95];

        pickupOffsets.forEach((y) => {
            const ring = new THREE.Mesh(new THREE.BoxGeometry(0.27, pickupHeight + 0.035, 0.055), plasticMaterial);
            ring.position.set(0, y, T / 2 + 0.02);
            guitarGroup.add(ring);

            const coreMaterial = state.pickups === "humbucker" ? plasticMaterial : hardwareMaterial;
            const core = new THREE.Mesh(new THREE.BoxGeometry(0.22, pickupHeight, 0.058), coreMaterial);
            core.position.set(0, y, T / 2 + 0.035);
            guitarGroup.add(core);
        });

        const stringStartZ = T / 2 + 0.075;
        [-0.08, -0.05, -0.02, 0.01, 0.04, 0.07].forEach((x, index) => {
            const endX = isSixInLine ? x * 0.7 : (index < 3 ? -0.08 : 0.08);
            const endY = isSixInLine ? headY - 0.1 + index * 0.05 : headY - 0.1 + (index % 3) * 0.08;
            const points = [
                new THREE.Vector3(x, bridgeY, stringStartZ),
                new THREE.Vector3(endX, endY, T / 2 + 0.055)
            ];
            guitarGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), stringMaterial));
        });
    }

    function resetView() {
        camera.position.set(0, 0.5, 7.5);
        controls.target.set(0, 0.8, 0);
        controls.update();
        guitarGroup.rotation.set(0, 0, 0);
        state.autoRotate = true;
        rebuildGuitar();
        resizeRenderer();
    }

    function resizeRenderer() {
        const width = Math.max(container.clientWidth, 320);
        const height = Math.max(container.clientHeight, 320);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height, false);
    }

    function applySizePreset(size) {
        const preset = sizePresets[size] || sizePresets["4_4"];
        state.size = size;
        state.length = preset.length;
        state.width = preset.width;
        state.thickness = preset.thickness;
        state.scale = preset.scale;
    }

    function getConfigurationPayload() {
        return {
            modelo: modeloId,
            madera: state.wood,
            color: state.color,
            hardware: state.hardware,
            pickups: state.pickups,
            tamano: state.size,
            dimensiones_cad: `${state.length}x${state.width}x${state.thickness}mm escala ${state.scale}mm`
        };
    }

    function updateActiveButton(button) {
        const group = button.closest(".swatch-group");
        if (!group) return;
        group.querySelectorAll(".option-swatch").forEach((item) => item.classList.remove("active"));
        button.classList.add("active");
    }

    document.querySelectorAll(".option-swatch").forEach((swatch) => {
        swatch.addEventListener("click", () => {
            updateActiveButton(swatch);
            if (swatch.dataset.wood) state.wood = swatch.dataset.wood;
            if (swatch.dataset.color) state.color = swatch.dataset.color;
            if (swatch.dataset.hardware) state.hardware = swatch.dataset.hardware;
            if (swatch.dataset.pickups) state.pickups = swatch.dataset.pickups;
            if (swatch.dataset.size) applySizePreset(swatch.dataset.size);
            rebuildGuitar();
        });
    });

    btnReset?.addEventListener("click", resetView);

    btnWireframe?.addEventListener("click", () => {
        state.wireframe = !state.wireframe;
        btnWireframe.classList.toggle("active", state.wireframe);
        rebuildGuitar();
    });

    btnGrid?.addEventListener("click", () => {
        gridHelper.visible = !gridHelper.visible;
        btnGrid.classList.toggle("active", gridHelper.visible);
    });

    btnAxes?.addEventListener("click", () => {
        axesHelper.visible = !axesHelper.visible;
        btnAxes.classList.toggle("active", axesHelper.visible);
    });

    btnCotizar?.addEventListener("click", async () => {
        try {
            btnCotizar.disabled = true;
            btnCotizar.textContent = "Calculando...";

            // Map frontend selections to backend expected keys
            const configuracion = {
                modelo: modeloId,
                madera: state.wood,
                color: state.color,
                hardware: state.hardware,
                pickups: state.pickups,
                trastes: "estandar",       // Default since not in UI
                clavijeros: "grover",      // Default since not in UI
                knobs: "top_hat",          // Default since not in UI
                puente: "tremolo"          // Default since not in UI
            };

            const response = await fetch(`${API_BASE_URL}/api/cotizar`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(configuracion)
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Error ${response.status}: No fue posible obtener la cotizacion.`);
            }

            const data = await response.json();
            cotizacionData = {
                ...data,
                configuracion: getConfigurationPayload()
            };

            precioFinalEl.textContent = `$${Number(cotizacionData.precio_final_cop).toLocaleString("es-CO")} COP`;
            modalCotizacion.classList.add("active");
        } catch (error) {
            console.error("Error en cotizacion:", error);
            alert(`No fue posible generar la cotizacion: ${error.message}`);
        } finally {
            btnCotizar.disabled = false;
            btnCotizar.textContent = "Cotizar mi guitarra";
        }
    });

    async function ensureStripe() {
        if (stripe && cardElement) return;

        const response = await fetch(`${API_BASE_URL}/api/stripe-config`);
        if (!response.ok) throw new Error("No fue posible cargar la configuracion de Stripe.");
        const { publishable_key: publishableKey } = await response.json();
        if (!publishableKey) throw new Error("Falta STRIPE_PUBLISHABLE_KEY en el backend.");

        stripe = Stripe(publishableKey);
        elements = stripe.elements({ locale: "es" });
        cardElement = elements.create("card", {
            hidePostalCode: true,
            style: {
                base: {
                    color: "#2a1610",
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    fontSize: "16px",
                    "::placeholder": { color: "#8c766b" }
                },
                invalid: { color: "#c93628" }
            }
        });

        cardElement.mount(cardContainer);
        cardElement.on("change", (event) => {
            cardErrors.textContent = event.error ? event.error.message : "";
        });
    }

    async function createPaymentIntent() {
        const email = document.getElementById("correo").value || "cliente@ctrlrock.test";
        const response = await fetch(`${API_BASE_URL}/api/payment-intent`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                precio_cop: cotizacionData.precio_final_cop,
                email,
                configuracion: cotizacionData.configuracion
            })
        });

        const data = await response.json();
        if (!response.ok || data.error) throw new Error(data.error || "Stripe no pudo crear el pago.");

        clientSecret = data.client_secret;
        paymentIntentId = data.payment_intent_id;
    }

    btnComprar?.addEventListener("click", async () => {
        if (!cotizacionData?.precio_final_cop) {
            alert("Primero genera una cotizacion.");
            return;
        }

        modalCotizacion.classList.remove("active");
        modalCompra.classList.add("active");
        paymentStatus.textContent = "Cargando formulario de pago...";

        try {
            await ensureStripe();
            paymentStatus.textContent = "Formulario de pago listo.";
        } catch (error) {
            console.error(error);
            paymentStatus.textContent = error.message;
        }
    });

    formCompra?.addEventListener("submit", async (event) => {
        event.preventDefault();

        if (!stripe || !cardElement) {
            paymentStatus.textContent = "Stripe Elements aun no esta listo.";
            return;
        }

        const submitButton = document.getElementById("btn-confirmar-compra");
        submitButton.disabled = true;
        paymentStatus.textContent = "Creando pago seguro...";
        cardErrors.textContent = "";

        try {
            await createPaymentIntent();
            paymentStatus.textContent = "Confirmando pago...";

            const nombre = `${document.getElementById("nombre").value} ${document.getElementById("apellidos").value}`.trim();
            const email = document.getElementById("correo").value;

            const result = await stripe.confirmCardPayment(clientSecret, {
                payment_method: {
                    card: cardElement,
                    billing_details: {
                        name: nombre,
                        email,
                        phone: document.getElementById("telefono").value,
                        address: {
                            line1: document.getElementById("direccion").value,
                            city: document.getElementById("ciudad").value,
                            state: document.getElementById("departamento").value,
                            country: "CO"
                        }
                    }
                }
            });

            if (result.error) throw new Error(result.error.message);
            if (result.paymentIntent.status !== "succeeded") {
                throw new Error(`El pago quedo en estado ${result.paymentIntent.status}.`);
            }

            paymentStatus.textContent = "Guardando pedido...";
            const confirmResponse = await fetch(`${API_BASE_URL}/api/confirm-payment`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    payment_intent_id: paymentIntentId,
                    precio_cop: cotizacionData.precio_final_cop,
                    cliente: {
                        nombre,
                        email,
                        telefono: document.getElementById("telefono").value,
                        direccion: document.getElementById("direccion").value,
                        ciudad: document.getElementById("ciudad").value,
                        departamento: document.getElementById("departamento").value,
                        tipo_identificacion: document.getElementById("tipo-identificacion").value,
                        identificacion: document.getElementById("identificacion").value
                    },
                    cotizacion: cotizacionData,
                    configuracion: cotizacionData.configuracion
                })
            });

            const confirmData = await confirmResponse.json();
            if (!confirmResponse.ok || confirmData.error) {
                throw new Error(confirmData.error || "El pago fue aprobado, pero no se pudo guardar el pedido.");
            }

            paymentStatus.textContent = `Pago exitoso. Pedido #${confirmData.pedido_id} guardado.`;
            formCompra.reset();
            cardElement.clear();
        } catch (error) {
            console.error(error);
            paymentStatus.textContent = error.message;
        } finally {
            submitButton.disabled = false;
        }
    });

    btnCancelar?.addEventListener("click", () => modalCotizacion.classList.remove("active"));
    btnCancelarCompra?.addEventListener("click", () => modalCompra.classList.remove("active"));

    function animate() {
        requestAnimationFrame(animate);
        if (state.autoRotate) guitarGroup.rotation.y += 0.003;
        controls.update();
        renderer.render(scene, camera);
    }

    window.addEventListener("resize", resizeRenderer);

    applySizePreset(state.size);
    rebuildGuitar();
    resizeRenderer();
    animate();
});
