// =====================================================================
// CONFIGURADOR CTRL + ROCK — ajustado a configurador.html
// =====================================================================
// Requiere que en el <head> del HTML ya estén cargados:
//   - https://js.stripe.com/v3/
//   - model-viewer
// Este archivo NO usa Three.js: la vista 2D es una imagen PNG y la vista
// 3D es un <model-viewer> que carga un .glb ya generado.
// =====================================================================

document.addEventListener('DOMContentLoaded', () => {

    const API_BASE_URL = 'http://localhost:5000';

    // ── 1. PARÁMETROS DE URL Y TÍTULO ───────────────────────────────────
    const urlParams = new URLSearchParams(window.location.search);
    const modeloId  = (urlParams.get('modelo') || 'lespaul').toLowerCase();
    const MODELOS = {
    lespaul: "Gibson Les Paul",
    telecaster: "Fender Telecaster",
    ibanezxp: "Ibanez XP",
    stingray: "Music Man StingRay Bass",
    espex: "ESP EX",
    danelectro: "Danelectro"
};
const MADERAS = {
    fresno: "Fresno Americano",
    caoba: "Caoba de Honduras",
    nogal: "Nogal Negro Exótico"
};

    const tituloEl = document.getElementById('modelo-titulo');
    if (tituloEl) tituloEl.textContent = 'Personalizando tu modelo';

    // ── 2. ELEMENTOS DEL DOM (según configurador.html) ──────────────────
    const guitarImg = document.getElementById('guitar-image');
    const scaler    = document.getElementById('guitar-scaler');

    const contenedor2D = document.getElementById('contenedor2D');
    const contenedor3D = document.getElementById('contenedor3D');
    const visorBajo     = document.getElementById('visorBajo');

    const btnVer3D        = document.getElementById('btnVer3D');
    const btnCotizarFase2 = document.getElementById('btnCotizarFase2');

    const modalCotizacion = document.getElementById('modal-cotizacion');
    const modalCompra     = document.getElementById('modal-compra');
    const precioFinalEl   = document.getElementById('precio-final');

    const btnComprar        = document.getElementById('btn-comprar');
    const btnCancelar       = document.getElementById('btn-cancelar');
    const btnCancelarCompra = document.getElementById('btn-cancelar-compra');

    const formCompra    = document.getElementById('form-compra');
    const paymentStatus = document.getElementById('payment-status');
    const cardErrors    = document.getElementById('card-errors');
    const cardContainer = document.getElementById('card-element-container');

    // ── 3. ESTADO DE COTIZACIÓN / STRIPE ────────────────────────────────
    let cotizacionData  = null;
    let stripe          = null;
    let elements        = null;
    let cardElement     = null;
    let clientSecret    = null;
    let paymentIntentId = null;

    // ── 4. HELPERS DE SELECCIÓN ACTIVA ──────────────────────────────────
    function getSeleccion() {
        return {
            madera:  document.querySelector('.option-swatch.active[data-wood]')?.getAttribute('data-wood')     || 'fresno',
            acabado: document.querySelector('.option-swatch.active[data-finish]')?.getAttribute('data-finish') || 'cherry',
            tamano:  document.querySelector('.option-swatch.active[data-size]')?.getAttribute('data-size')     || '4_4',
            picks:   document.querySelector('.option-swatch.active[data-picks]')?.getAttribute('data-picks')   || 'rojo'
        };
    }

    function getConfigurationPayload() {
        const { madera, acabado, tamano, picks } = getSeleccion();
        return {
            modelo: modeloId,
            madera: madera,
            acabado,
            tamano,
            picks,
            // Valores por defecto: el backend de cotización los espera,
            // pero la UI actual no ofrece estas opciones al usuario.
            trastes: 'estandar',
            clavijeros: 'grover',
            knobs: 'top_hat',
            puente: 'tremolo'
        };
    }

    // ── 5. IMAGEN 2D Y ESCALADO SEGÚN TAMAÑO ────────────────────────────
    function actualizarImagenGuitarra() {
        if (!guitarImg || !scaler) return;

        const { madera, acabado, tamano } = getSeleccion();

        guitarImg.src = `../assets/images/guitarras/${modeloId}-${madera}-${acabado}.png`;

        const escalasPorTamano = {
            '1_4': 0.65,
            '1_2': 0.77,
            '3_4': 0.88,
            '4_4': 1.0
        };
        scaler.style.transform = `scale(${escalasPorTamano[tamano] ?? 1})`;
    }

    document.querySelectorAll('.option-swatch').forEach(opcion => {
        opcion.addEventListener('click', () => {
            const grupo = opcion.closest('.swatch-group');
            if (grupo) {
                grupo.querySelectorAll('.option-swatch').forEach(el => el.classList.remove('active'));
            }
            opcion.classList.add('active');
            actualizarImagenGuitarra();
        });
    });

    actualizarImagenGuitarra();

    // ── 6. VISOR 3D (MODEL-VIEWER) ───────────────────────────────────────
    if (btnVer3D) {
        btnVer3D.addEventListener('click', function () {
            this.disabled = true;
            this.textContent = 'Cargando modelo interactivo...';

            const { madera, acabado, tamano } = getSeleccion();
            const rutaGLB = `../assets/modelos_3d/${modeloId}-${madera}-${acabado}-${tamano}.glb`;

            visorBajo.src = rutaGLB;

            contenedor2D.style.display = 'none';
            contenedor3D.style.display = 'block';

            visorBajo.addEventListener('load', () => {
                btnVer3D.style.display = 'none';
                btnCotizarFase2.style.display = 'block';
            }, { once: true });

            visorBajo.addEventListener('error', () => {
                console.error('No se encontró el archivo GLB:', rutaGLB);
                alert(`Error al cargar el 3D.\nEl archivo no se encontró en:\n${rutaGLB}\n\nAsegúrate de que el archivo exista con ese nombre exacto y que estés usando Live Server.`);

                this.disabled = false;
                this.textContent = 'Ver modelo 3D';
                contenedor2D.style.display = 'flex';
                contenedor3D.style.display = 'none';
            }, { once: true });
        });
    }

    // ── 7. COTIZAR GUITARRA ──────────────────────────────────────────────
    if (btnCotizarFase2) {
        btnCotizarFase2.addEventListener('click', async () => {
            try {
                btnCotizarFase2.disabled = true;
                btnCotizarFase2.textContent = 'Calculando...';

                const configuracion = getConfigurationPayload();

                const response = await fetch(`${API_BASE_URL}/api/cotizar`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(configuracion)
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error || `Error ${response.status}: No fue posible obtener la cotización.`);
                }

                const data = await response.json();
                cotizacionData = {
                    ...data,
                    configuracion
                };

                precioFinalEl.textContent = `$${Number(cotizacionData.precio_final_cop).toLocaleString('es-CO')} COP`;
                modalCotizacion.classList.add('active');

            } catch (error) {
                console.error('Error en cotización:', error);
                alert(`No fue posible generar la cotización: ${error.message}`);
            } finally {
                btnCotizarFase2.disabled = false;
                btnCotizarFase2.textContent = 'Proceder a Cotización';
            }
        });
    }

    // ── 8. STRIPE: PREPARAR EL FORMULARIO DE TARJETA ────────────────────
    async function ensureStripe() {
        if (stripe && cardElement) return;

        const response = await fetch(`${API_BASE_URL}/api/stripe-config`);
        if (!response.ok) throw new Error('No fue posible cargar la configuración de Stripe.');

        const { publishable_key: publishableKey } = await response.json();
        if (!publishableKey) throw new Error('Falta STRIPE_PUBLISHABLE_KEY en el backend.');

        stripe   = Stripe(publishableKey);
        elements = stripe.elements({ locale: 'es' });
        cardElement = elements.create('card', {
            hidePostalCode: true,
            style: {
                base: {
                    color: '#2a1610',
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    fontSize: '16px',
                    '::placeholder': { color: '#8c766b' }
                },
                invalid: { color: '#c93628' }
            }
        });

        cardElement.mount(cardContainer);
        cardElement.on('change', (event) => {
            cardErrors.textContent = event.error ? event.error.message : '';
        });
    }

    async function createPaymentIntent() {
        const email = document.getElementById('correo').value || 'cliente@ctrlrock.test';

        const response = await fetch(`${API_BASE_URL}/api/payment-intent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                precio_cop: cotizacionData.precio_final_cop,
                email,
                configuracion: cotizacionData.configuracion
            })
        });

        const data = await response.json();
        if (!response.ok || data.error) throw new Error(data.error || 'Stripe no pudo crear el pago.');

        clientSecret    = data.client_secret;
        paymentIntentId = data.payment_intent_id;
    }

    // ── 9. CONTROL DE MODALES ────────────────────────────────────────────
    if (btnComprar) {
        btnComprar.addEventListener('click', async () => {
            if (!cotizacionData?.precio_final_cop) {
                alert('Primero genera una cotización.');
                return;
            }

            modalCotizacion.classList.remove('active');
            modalCompra.classList.add('active');
            paymentStatus.textContent = 'Cargando formulario de pago...';

            try {
                await ensureStripe();
                paymentStatus.textContent = 'Formulario de pago listo.';
            } catch (error) {
                console.error(error);
                paymentStatus.textContent = error.message;
            }
        });
    }

    if (btnCancelar) {
        btnCancelar.addEventListener('click', () => {
            modalCotizacion.classList.remove('active');
        });
    }

    if (btnCancelarCompra) {
        btnCancelarCompra.addEventListener('click', () => {
            modalCompra.classList.remove('active');
        });
    }

    // ── 10. ENVÍO DEL FORMULARIO DE COMPRA (Stripe Payment) ─────────────
    if (formCompra) {
        formCompra.addEventListener('submit', async (evento) => {
            evento.preventDefault();

            if (!stripe || !cardElement) {
                paymentStatus.textContent = 'Stripe Elements aún no está listo.';
                return;
            }

            const submitButton = document.getElementById('btn-confirmar-compra');
            submitButton.disabled = true;
            paymentStatus.textContent = 'Creando pago seguro...';
            cardErrors.textContent = '';

            try {
                await createPaymentIntent();
                paymentStatus.textContent = 'Confirmando pago...';

                const nombre = `${document.getElementById('nombre').value} ${document.getElementById('apellidos').value}`.trim();
                const email  = document.getElementById('correo').value;

                const result = await stripe.confirmCardPayment(clientSecret, {
                    payment_method: {
                        card: cardElement,
                        billing_details: {
                            name: nombre,
                            email,
                            phone: document.getElementById('telefono').value,
                            address: {
                                line1: document.getElementById('direccion').value,
                                city: document.getElementById('ciudad').value,
                                state: document.getElementById('departamento').value,
                                country: 'CO'
                            }
                        }
                    }
                });

                if (result.error) throw new Error(result.error.message);
                if (result.paymentIntent.status !== 'succeeded') {
                    throw new Error(`El pago quedó en estado ${result.paymentIntent.status}.`);
                }

                paymentStatus.textContent = 'Guardando pedido...';

                const confirmResponse = await fetch(`${API_BASE_URL}/api/confirm-payment`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        payment_intent_id: paymentIntentId,
                        precio_cop: cotizacionData.precio_final_cop,
                        cliente: {
                            nombre,
                            email,
                            telefono: document.getElementById('telefono').value,
                            direccion: document.getElementById('direccion').value,
                            ciudad: document.getElementById('ciudad').value,
                            departamento: document.getElementById('departamento').value,
                            tipo_identificacion: document.getElementById('tipo-identificacion').value,
                            identificacion: document.getElementById('identificacion').value
                        },
                        cotizacion: cotizacionData,
                        configuracion: cotizacionData.configuracion
                    })
                });

                const confirmData = await confirmResponse.json();
                if (!confirmResponse.ok || confirmData.error) {
                    throw new Error(confirmData.error || 'El pago fue aprobado, pero no se pudo guardar el pedido.');
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
    }

});
