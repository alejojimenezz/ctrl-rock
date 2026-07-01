// ===================================================
// LÓGICA PRINCIPAL DEL CONFIGURADOR
// ===================================================

// ⚠️ IMPORTANTE: Reemplaza estas credenciales con las tuyas
const SUPABASE_URL = 'https://exbkgwglryserymzyyzj.supabase.co';
const SUPABASE_KEY = 'tu-api-key-aqui'; // REEMPLAZA CON TU CLAVE VÁLIDA
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// URL del Backend (cambia según tu servidor)
const BACKEND_URL = 'http://localhost:3001'; // Cambiar a tu URL de producción

// === LECTURA DEL MODELO SELECCIONADO ===
const urlParams = new URLSearchParams(window.location.search);
const modeloId = urlParams.get('modelo') || 'Strat';

function inicializarPagina() {
    document.getElementById('modelo-titulo').innerText = `Personalizando tu modelo: ${modeloId}`;
    document.getElementById('guitar-preview').innerHTML = `🎸 <br> Modelo: ${modeloId}`;
}

// === NAVEGACIÓN ENTRE TABS ===
function inicializarTabs() {
    const botonesTabs = document.querySelectorAll('.tab-btn');
    const contenidos = document.querySelectorAll('.tab-content');

    botonesTabs.forEach(boton => {
        boton.addEventListener('click', () => {
            const tabActiva = boton.getAttribute('data-tab');

            // Remover clase active de todos
            botonesTabs.forEach(b => b.classList.remove('active'));
            contenidos.forEach(c => c.classList.remove('active'));

            // Agregar clase active al seleccionado
            boton.classList.add('active');
            document.getElementById(`tab-${tabActiva}`).classList.add('active');
        });
    });
}

// === CONVERTIR HTML A PDF EN BASE64 ===
function generarPDFBase64(htmlContent) {
    return new Promise((resolve, reject) => {
        const elemento = document.createElement('div');
        elemento.innerHTML = htmlContent;
        elemento.style.display = 'none';
        document.body.appendChild(elemento);

        const opt = {
            margin: 10,
            filename: `cotizacion-ctrl-rock-${Date.now()}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        html2pdf().set(opt).from(elemento).outputPdf('arraybuffer').then(pdf => {
            const base64 = btoa(String.fromCharCode.apply(null, new Uint8Array(pdf)));
            document.body.removeChild(elemento);
            resolve(base64);
        }).catch(err => {
            document.body.removeChild(elemento);
            reject(err);
        });
    });
}

// === MANEJO DE FORMULARIO ===
function inicializarFormulario() {
    const form = document.getElementById('cotizacion-form');
    const btnEnviar = document.getElementById('btn-enviar');
    const statusDiv = document.getElementById('mensaje-status');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Validar que todos los campos de personalización están completos
        const selects = ['tipo-madera', 'clavijero', 'color', 'pastillas', 'nobs', 'trastes', 'puente'];
        for (let id of selects) {
            if (!document.getElementById(id).value) {
                mostrarMensaje(statusDiv, '❌ Por favor completa todas las opciones de personalización', 'error');
                return;
            }
        }

        btnEnviar.disabled = true;
        btnEnviar.innerText = '⏳ Generando cotización...';
        statusDiv.style.display = 'block';
        mostrarMensaje(statusDiv, '⏳ Generando PDF y preparando correo...', 'info');

        try {
            // Obtener datos
            const configuracion = obtenerConfiguracionSeleccionada();
            const datosCotizacion = {
                id_type: document.getElementById('id_type').value,
                id_number: document.getElementById('id_number').value,
                name: document.getElementById('name').value,
                email: document.getElementById('email').value,
                phone_number: document.getElementById('phone_number').value,
                empresa: document.getElementById('empresa').value || 'N/A',
                notas: document.getElementById('notas').value || 'Sin notas',
                modelo_base: modeloId,
                configuracion: configuracion,
                fecha_cotizacion: new Date().toISOString()
            };

            // Generar PDF
            const htmlContent = generarHTMLPDF(datosCotizacion);
            mostrarMensaje(statusDiv, '⏳ Generando PDF...', 'info');
            
            const pdfBase64 = await generarPDFBase64(htmlContent);
            
            mostrarMensaje(statusDiv, '⏳ Enviando cotización por correo...', 'info');
            
            // Enviar al backend para que procese el email y guarde en Supabase
            const respuesta = await fetch(`${BACKEND_URL}/api/enviar-cotizacion`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    datosCliente: datosCotizacion,
                    pdfBase64: pdfBase64,
                    htmlContent: htmlContent
                })
            });

            if (!respuesta.ok) {
                const error = await respuesta.json();
                throw new Error(error.mensaje || 'Error al enviar la cotización');
            }

            const resultado = await respuesta.json();

            // Éxito
            mostrarMensaje(statusDiv, '✅ ¡Excelente! Tu cotización ha sido enviada al correo ' + datosCotizacion.email, 'success');
            form.reset();
            setTimeout(() => {
                window.location.href = 'modelos.html';
            }, 3000);

        } catch (err) {
            console.error('Error completo:', err);
            mostrarMensaje(statusDiv, '❌ Hubo un problema: ' + (err.message || 'Error desconocido'), 'error');
        } finally {
            btnEnviar.disabled = false;
            btnEnviar.innerText = '📧 Generar y Enviar Cotización';
        }
    });
}

/**
 * Muestra un mensaje de estado
 * @param {HTMLElement} elemento - Elemento donde mostrar el mensaje
 * @param {string} mensaje - Texto del mensaje
 * @param {string} tipo - Tipo: 'success', 'error', 'info'
 */
function mostrarMensaje(elemento, mensaje, tipo) {
    elemento.style.display = 'block';
    elemento.innerText = mensaje;

    switch (tipo) {
        case 'success':
            elemento.style.backgroundColor = '#d4edda';
            elemento.style.color = '#155724';
            elemento.style.borderLeft = '4px solid #155724';
            break;
        case 'error':
            elemento.style.backgroundColor = '#f8d7da';
            elemento.style.color = '#721c24';
            elemento.style.borderLeft = '4px solid #721c24';
            break;
        case 'info':
            elemento.style.backgroundColor = '#d1ecf1';
            elemento.style.color = '#0c5460';
            elemento.style.borderLeft = '4px solid #0c5460';
            break;
    }
}

// === INICIALIZACIÓN ===
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        inicializarPagina();
        inicializarTabs();
        inicializarFormulario();
        actualizarResumenPrecios();
    });
} else {
    inicializarPagina();
    inicializarTabs();
    inicializarFormulario();
    actualizarResumenPrecios();
}