// === MÓDULO GLOBAL CTRL+ROCK: INTERACTIVIDAD DE TARJETAS (GIF + AUDIO) ===
// Nota: Se ha eliminado el motor 3D (Three.js) para optimizar el rendimiento y usar GIFs.

document.addEventListener("DOMContentLoaded", () => {

    // ── 1. GESTOR INTERACTIVO DE AUDIO MANUAL PARA PREVISUALIZACIÓN DE TONOS (BOTÓN CLIC) ──
    const playButtons = document.querySelectorAll(".btn-audio-play");
    let currentAudio = null;
    let currentButton = null;

    playButtons.forEach(button => {
        button.addEventListener("click", () => {
            let soundPath = button.getAttribute("data-sound");
            const icon = button.querySelector(".icon-play");

            // CORRECCIÓN LOCAL (file://)
            if (window.location.protocol === 'file:' && soundPath.startsWith('/')) {
                soundPath = soundPath.substring(1);
            }

            if (currentAudio && currentButton === button) {
                // Si hace clic en el mismo que suena, pausar
                if (!currentAudio.paused) {
                    currentAudio.pause();
                    if (icon) icon.innerText = "▶";
                    button.classList.remove("playing");
                } else {
                    currentAudio.play().catch(err => console.log("Error de reproducción:", err));
                    if (icon) icon.innerText = "⏸";
                    button.classList.add("playing");
                }
            } else {
                // Detener el anterior si existe
                if (currentAudio) {
                    currentAudio.pause();
                    const prevIcon = currentButton.querySelector(".icon-play");
                    if (prevIcon) prevIcon.innerText = "▶";
                    currentButton.classList.remove("playing");
                }

                // Reproducir el nuevo
                currentAudio = new Audio(soundPath);
                currentButton = button;
                currentAudio.volume = 0.6;

                currentAudio.play()
                    .then(() => {
                        if (icon) icon.innerText = "⏸";
                        button.classList.add("playing");
                    })
                    .catch(err => console.error("Error al reproducir audio:", err));

                currentAudio.addEventListener("ended", () => {
                    if (icon) icon.innerText = "▶";
                    button.classList.remove("playing");
                    currentAudio = null;
                    currentButton = null;
                });
            }
        });
    });


    // ── 2. GESTOR DE HOVER AUTOMÁTICO (GIF ANIMADO + SONIDO DE FONDO) ──
    const viewports = document.querySelectorAll('.model-3d-card-viewport');
    let hoverAudioActivo = null;

    viewports.forEach(viewport => {
        // Guardamos el fondo original (la imagen estática de la guitarra que configures por defecto)
        const fondoOriginal = viewport.style.backgroundImage;

        // A. Cuando el mouse ENTRA a cualquier tarjeta de guitarra
        viewport.addEventListener('mouseenter', () => {
            const rutaGif = viewport.getAttribute('data-gif');
            const rutaAudio = viewport.getAttribute('data-audio');

            // 1. Apagar cualquier audio manual de botones que esté sonando
            if (currentAudio) {
                currentAudio.pause();
                playButtons.forEach(btn => {
                    const icon = btn.querySelector(".icon-play");
                    if (icon) icon.innerText = "▶";
                    btn.classList.remove("playing");
                });
                currentAudio = null;
                currentButton = null;
            }

            // 2. Reemplazar la visualización estática por el GIF animado
            if (rutaGif) {
                viewport.style.backgroundImage = `url('${rutaGif}')`;
                viewport.style.backgroundSize = 'contain';
                viewport.style.backgroundPosition = 'center';
                viewport.style.backgroundRepeat = 'no-repeat';
                viewport.style.backgroundColor = '#f0e0d1';
            }

            // 3. Reiniciar el audio de hover si ya existía una instancia previa
            if (hoverAudioActivo) {
                hoverAudioActivo.pause();
                hoverAudioActivo.currentTime = 0;
            }

            // 4. Reproducir el tono de esta guitarra específica en bucle
            if (rutaAudio) {
                hoverAudioActivo = new Audio(rutaAudio);
                hoverAudioActivo.volume = 0.55; // Volumen óptimo balanceado
                hoverAudioActivo.loop = true;

                hoverAudioActivo.play().catch(error => {
                    console.log("El audio interactivo requiere un clic previo en la página.");
                });
            }
        });

        // B. Cuando el mouse SALE de la tarjeta de la guitarra
        viewport.addEventListener('mouseleave', () => {
            // 1. Restaurar la imagen estática original
            viewport.style.backgroundImage = fondoOriginal;

            // 2. Detener y apagar el sonido inmediatamente
            if (hoverAudioActivo) {
                hoverAudioActivo.pause();
                hoverAudioActivo.currentTime = 0;
                hoverAudioActivo = null;
            }
        });
    });

});