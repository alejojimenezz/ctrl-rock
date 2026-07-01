// ===================================================
// GENERADOR DE PDF - COTIZACION DE GUITARRA
// ===================================================

/**
 * Genera el contenido HTML del PDF
 * @param {object} datos - Datos del cliente y configuración
 * @returns {string} - HTML para el PDF
 */
function generarHTMLPDF(datos) {
    const fecha = new Date().toLocaleDateString('es-CO');
    const hora = new Date().toLocaleTimeString('es-CO');
    const numeroReferencia = `CTRL-${Date.now()}`;

    return `
        <div style="font-family: Arial, sans-serif; max-width: 900px; margin: 0 auto; background: white; padding: 40px;">
            <!-- HEADER -->
            <div style="text-align: center; border-bottom: 3px solid #351c15; padding-bottom: 20px; margin-bottom: 30px;">
                <h1 style="color: #351c15; font-size: 32px; margin: 0;">CTRL + ROCK</h1>
                <p style="color: #5c3a21; margin: 5px 0; font-size: 14px;">Guitarras Personalizadas - Artesanía de Clase Mundial</p>
            </div>

            <!-- INFO DOCUMENTO -->
            <div style="display: flex; justify-content: space-between; margin-bottom: 30px;">
                <div>
                    <p style="margin: 5px 0;"><strong>Referencia:</strong> ${numeroReferencia}</p>
                    <p style="margin: 5px 0;"><strong>Fecha:</strong> ${fecha}</p>
                    <p style="margin: 5px 0;"><strong>Hora:</strong> ${hora}</p>
                </div>
                <div style="text-align: right;">
                    <p style="margin: 5px 0; color: #b73225;"><strong>COTIZACIÓN</strong></p>
                </div>
            </div>

            <!-- DATOS DEL CLIENTE -->
            <div style="background: #f4ece4; padding: 15px; border-radius: 5px; margin-bottom: 30px;">
                <h2 style="color: #351c15; font-size: 14px; margin-top: 0; text-transform: uppercase;">Datos del Cliente</h2>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="width: 50%; padding: 8px 0;"><strong>Nombre:</strong> ${datos.name}</td>
                        <td style="width: 50%; padding: 8px 0;"><strong>Identificación:</strong> ${datos.id_type} - ${datos.id_number}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0;"><strong>Correo:</strong> ${datos.email}</td>
                        <td style="padding: 8px 0;"><strong>Teléfono:</strong> ${datos.phone_number}</td>
                    </tr>
                    ${datos.empresa ? `<tr><td colspan="2" style="padding: 8px 0;"><strong>Empresa:</strong> ${datos.empresa}</td></tr>` : ''}
                </table>
            </div>

            <!-- DETALLES DE CONFIGURACIÓN -->
            <div style="margin-bottom: 30px;">
                <h2 style="color: #351c15; font-size: 14px; text-transform: uppercase; border-bottom: 2px solid #b73225; padding-bottom: 10px; margin-bottom: 15px;">Configuración de la Guitarra</h2>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr style="background: #e4d5c7;">
                        <td style="padding: 10px; border: 1px solid #d1c4b9;"><strong>Componente</strong></td>
                        <td style="padding: 10px; border: 1px solid #d1c4b9;"><strong>Selección</strong></td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #d1c4b9;">Modelo Base</td>
                        <td style="padding: 10px; border: 1px solid #d1c4b9;">${datos.configuracion.modelo}</td>
                    </tr>
                    <tr style="background: #fdfaf7;">
                        <td style="padding: 10px; border: 1px solid #d1c4b9;">Tipo de Madera</td>
                        <td style="padding: 10px; border: 1px solid #d1c4b9;">${datos.configuracion.madera}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #d1c4b9;">Clavijero</td>
                        <td style="padding: 10px; border: 1px solid #d1c4b9;">${datos.configuracion.clavijero}</td>
                    </tr>
                    <tr style="background: #fdfaf7;">
                        <td style="padding: 10px; border: 1px solid #d1c4b9;">Color</td>
                        <td style="padding: 10px; border: 1px solid #d1c4b9;">${datos.configuracion.color}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #d1c4b9;">Pastillas</td>
                        <td style="padding: 10px; border: 1px solid #d1c4b9;">${datos.configuracion.pastillas}</td>
                    </tr>
                    <tr style="background: #fdfaf7;">
                        <td style="padding: 10px; border: 1px solid #d1c4b9;">Perillas de Control</td>
                        <td style="padding: 10px; border: 1px solid #d1c4b9;">${datos.configuracion.nobs}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #d1c4b9;">Tipo de Trastes</td>
                        <td style="padding: 10px; border: 1px solid #d1c4b9;">${datos.configuracion.trastes}</td>
                    </tr>
                    <tr style="background: #fdfaf7;">
                        <td style="padding: 10px; border: 1px solid #d1c4b9;">Puente</td>
                        <td style="padding: 10px; border: 1px solid #d1c4b9;">${datos.configuracion.puente}</td>
                    </tr>
                </table>
            </div>

            ${datos.notas ? `
                <div style="background: #f4ece4; padding: 15px; border-radius: 5px; margin-bottom: 30px;">
                    <h3 style="color: #351c15; margin-top: 0;">Notas Especiales:</h3>
                    <p style="margin: 0; color: #5c3a21;">${datos.notas}</p>
                </div>
            ` : ''}

            <!-- RESUMEN DE PRECIOS -->
            <div style="background: #e4d5c7; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="text-align: right; padding: 8px;"><strong>Costo de Materiales:</strong></td>
                        <td style="text-align: right; padding: 8px; width: 150px;"><strong>${formatearMoneda(datos.configuracion.costoMateriales)}</strong></td>
                    </tr>
                    <tr>
                        <td style="text-align: right; padding: 8px;"><strong>Plusvalía de Trabajo (30%):</strong></td>
                        <td style="text-align: right; padding: 8px;"><strong>${formatearMoneda(datos.configuracion.plusvalia)}</strong></td>
                    </tr>
                    <tr style="border-top: 2px solid #351c15;">
                        <td style="text-align: right; padding: 12px; font-size: 16px; color: #b73225;"><strong>PRECIO TOTAL:</strong></td>
                        <td style="text-align: right; padding: 12px; font-size: 18px; color: #b73225;"><strong>${formatearMoneda(datos.configuracion.precioFinal)}</strong></td>
                    </tr>
                </table>
            </div>

            <!-- FOOTER -->
            <div style="border-top: 2px solid #351c15; padding-top: 20px; text-align: center; color: #5c3a21; font-size: 12px;">
                <p style="margin: 5px 0;"><strong>Ctrl + Rock - Guitarras Personalizadas</strong></p>
                <p style="margin: 5px 0;">Esta cotización es válida por 15 días hábiles desde la fecha de emisión.</p>
                <p style="margin: 5px 0;">Para confirmar tu pedido, responde a este correo con tu aprobación.</p>
                <p style="margin: 5px 0; color: #999;">Generado automáticamente por Ctrl + Rock</p>
            </div>
        </div>
    `;
}

/**
 * Descarga el PDF con la cotización
 * @param {object} datos - Datos del cliente y configuración
 */
function descargarPDF(datos) {
    const htmlContent = generarHTMLPDF(datos);
    const elemento = document.getElementById('pdf-content');
    elemento.innerHTML = htmlContent;

    const opt = {
        margin: 10,
        filename: `cotizacion-ctrl-rock-${Date.now()}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(elemento).save();
}

/**
 * Envía el PDF por correo (simulado)
 * En producción, esto se debe hacer desde el backend
 */
function enviarPorCorreo(datos, base64PDF) {
    // Este es un punto donde necesitas un backend
    // Por ahora, solo guardamos los datos
    console.log('Datos para enviar por correo:', datos);
    console.log('PDF en base64:', base64PDF.substring(0, 50) + '...');
}