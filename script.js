const gifts = Array.from({ length: 5 }, () => ({
  cta: "Abrir regalo"
}));

const revealSteps = [
  {
    title: "Entradas VIP para ver la pelicula",
    text: "Portada y QR listos para nuestro plan.",
    images: [
      { src: "imagenes/pel\u00edcua.jpeg", alt: "Portada de la pelicula" },
      { src: "imagenes/qr_pelicula.jpeg", alt: "Codigo QR de las entradas VIP" }
    ]
  },
  {
    title: "Te regalo una imagen inedita de bebesita pola",
    text: "",
    images: [{ src: "imagenes/colaypola.jpeg", alt: "Imagen inedita de bebesita y pola" }]
  },
  {
    title: "Tarjeta de regalo",
    text: "Solicita el codigo con tu viejo con la siguiente clave secreta: 'Yo soy tu polita la mas colitas xisponas bebesonas xispas', envialo como mensaje de video circular",
    images: [{ src: "imagenes/tarjeta de regalo.png", alt: "Tarjeta de regalo" }]
  },
  {
    title: "Rosas para ti",
    text: "Te ganaste unas rosas por ser la xispa mas hermosa",
    images: [{ src: "imagenes/rosas.png", alt: "Rosas para ti" }]
  },
  {
    title: "Agenda para ti",
    text: "La sopesita numero 5 es una agenda para ti.",
    images: [{ src: "imagenes/Agenda.webp", alt: "Agenda" }]
  }
];

const releaseSlots = [
  { timeLabel: "10:00 AM", unlockAt: new Date(2026, 1, 14, 10, 0, 0, 0) },
  { timeLabel: "11:00 AM", unlockAt: new Date(2026, 1, 14, 11, 0, 0, 0) },
  { timeLabel: "12:00 PM", unlockAt: new Date(2026, 1, 14, 12, 0, 0, 0) },
  { timeLabel: "2:30 PM", unlockAt: new Date(2026, 1, 14, 14, 30, 0, 0) },
  { timeLabel: "3:30 PM", unlockAt: new Date(2026, 1, 14, 15, 30, 0, 0) }
];

const fallbackStep = {
  title: "Sorpresita pendiente",
  text: "Muy pronto voy a llenarla con algo especial para ti.",
  images: []
};

const secretReveal = {
  title: "Sopesita secreta",
  text: "Te ganaste el Carcassonne + Expansi\u00f3n!",
  images: [{ src: "imagenes/carcason.jpg", alt: "Carcassonne y su expansion" }]
};

const welcomeReveal = {
  title: "Hola bebesita te amo mucho",
  text: "",
  images: [
    {
      src: "imagenes/Pola.jpeg",
      alt: "Pola",
      caption: "una pola chill congelándose."
    },
    {
      src: "imagenes/colanavidad.jpeg",
      alt: "Bebesita navidad",
      caption: "Bebesita feliz con buzón."
    },
    {
      src: "imagenes/colaconsueño.jpeg",
      alt: "Bebesita con sueno",
      caption: "una bebesita preciosa preparada para la fiesta"
    }
  ],
  fullImageMode: true,
  sliderMode: true,
  skipConfetti: true
};

const STORAGE_KEY = "sorpresitas_estado_v4";
const MUSIC_VIDEO_ID = "A1MdThqGarI";
const MUSIC_VOLUME = 35;

const grid = document.getElementById("giftGrid");
const revealModal = document.getElementById("revealModal");
const revealContent = revealModal ? revealModal.querySelector(".reveal-content") : null;
const revealTitle = document.getElementById("revealTitle");
const revealText = document.getElementById("revealText");
const revealImages = document.getElementById("revealImages");
const revealActions = document.getElementById("revealActions");
const closeModalBtn = document.getElementById("closeModalBtn");
const resetBtn = document.getElementById("secretResetBtn");
const secretGiftBtn = document.getElementById("secretGiftBtn");
const countdownValue = document.getElementById("countdownValue");
const countdownHint = document.getElementById("countdownHint");
const musicToggleBtn = document.getElementById("musicToggleBtn");

const cardRefs = [];
const buttonRefs = [];

let revealSliderTimer = null;
let musicPlayer = null;
let musicPlayerReady = false;
let musicShouldPlay = true;
let musicAwaitingUserGesture = false;
let musicInitialUnlockPending = true;
let clearMusicUnlockListeners = null;

function getDefaultState() {
  return {
    revealIndex: 0,
    secretButtonVisible: false,
    secretOpened: false,
    opened: Array(gifts.length).fill(false)
  };
}

function loadState() {
  try {
    const rawState = localStorage.getItem(STORAGE_KEY);
    if (!rawState) {
      return getDefaultState();
    }

    const parsed = JSON.parse(rawState);
    if (!Array.isArray(parsed.opened) || typeof parsed.revealIndex !== "number") {
      return getDefaultState();
    }

    const opened = Array(gifts.length).fill(false);
    for (let i = 0; i < gifts.length; i += 1) {
      opened[i] = Boolean(parsed.opened[i]);
    }

    return {
      revealIndex: Math.max(0, Math.min(Math.floor(parsed.revealIndex), revealSteps.length)),
      secretButtonVisible: Boolean(parsed.secretButtonVisible),
      secretOpened: Boolean(parsed.secretOpened),
      opened
    };
  } catch {
    return getDefaultState();
  }
}

let state = loadState();

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function stopRevealSlider() {
  if (revealSliderTimer !== null) {
    window.clearInterval(revealSliderTimer);
    revealSliderTimer = null;
  }
}

function updateMusicButton() {
  if (!musicToggleBtn) {
    return;
  }

  if (musicShouldPlay) {
    if (!musicPlayerReady) {
      musicToggleBtn.textContent = "Cargando musica...";
      musicToggleBtn.classList.remove("playing");
      musicToggleBtn.classList.remove("needs-gesture");
      return;
    }

    musicToggleBtn.textContent = "Pausar musica";
    musicToggleBtn.classList.add("playing");
    musicToggleBtn.classList.remove("needs-gesture");
    return;
  }

  if (musicPlayerReady) {
    musicToggleBtn.textContent = "Reproducir musica";
  } else {
    musicToggleBtn.textContent = "Cargando musica...";
  }

  musicToggleBtn.classList.remove("playing");
  musicToggleBtn.classList.remove("needs-gesture");
}

function removeMusicUnlockHandlers() {
  if (typeof clearMusicUnlockListeners === "function") {
    clearMusicUnlockListeners();
    clearMusicUnlockListeners = null;
  }
}

function refreshMusicGestureState() {
  if (!musicPlayer || !musicPlayerReady || !window.YT || !window.YT.PlayerState) {
    return;
  }

  const state =
    typeof musicPlayer.getPlayerState === "function"
      ? musicPlayer.getPlayerState()
      : window.YT.PlayerState.UNSTARTED;
  const muted = typeof musicPlayer.isMuted === "function" ? musicPlayer.isMuted() : true;
  const isPlaying = state === window.YT.PlayerState.PLAYING;

  musicAwaitingUserGesture =
    musicShouldPlay && (musicInitialUnlockPending || !isPlaying || muted);
  if (musicAwaitingUserGesture) {
    installMusicUnlockHandlers();
  } else {
    removeMusicUnlockHandlers();
  }

  updateMusicButton();
}

function tryEnableMusicSound(restartFromBeginning = false) {
  if (!musicPlayer || !musicPlayerReady || !musicShouldPlay) {
    return;
  }

  if (restartFromBeginning && typeof musicPlayer.seekTo === "function") {
    musicPlayer.seekTo(0, true);
  }

  musicPlayer.unMute();
  musicPlayer.setVolume(MUSIC_VOLUME);
  musicPlayer.playVideo();

  window.setTimeout(refreshMusicGestureState, 220);
}

function installMusicUnlockHandlers() {
  if (clearMusicUnlockListeners) {
    return;
  }

  const unlock = () => {
    if (!musicShouldPlay) {
      return;
    }

    if (!musicPlayerReady) {
      musicInitialUnlockPending = true;
      return;
    }

    musicInitialUnlockPending = false;
    tryEnableMusicSound(true);
  };

  const onKeydown = () => {
    unlock();
  };

  document.addEventListener("pointerdown", unlock, { passive: true });
  document.addEventListener("touchstart", unlock, { passive: true });
  document.addEventListener("keydown", onKeydown);

  clearMusicUnlockListeners = () => {
    document.removeEventListener("pointerdown", unlock);
    document.removeEventListener("touchstart", unlock);
    document.removeEventListener("keydown", onKeydown);
  };
}

function playMusic() {
  if (!musicPlayer || !musicPlayerReady) {
    return;
  }

  musicShouldPlay = true;
  musicInitialUnlockPending = false;
  tryEnableMusicSound();
}

function pauseMusic() {
  if (!musicPlayer || !musicPlayerReady) {
    return;
  }

  musicShouldPlay = false;
  musicAwaitingUserGesture = false;
  musicInitialUnlockPending = false;
  musicPlayer.pauseVideo();
  removeMusicUnlockHandlers();
  updateMusicButton();
}

function ensureMusicPlayer() {
  if (musicPlayer || !window.YT || !window.YT.Player) {
    return;
  }

  musicPlayer = new window.YT.Player("youtubePlayer", {
    height: "1",
    width: "1",
    videoId: MUSIC_VIDEO_ID,
    playerVars: {
      autoplay: 1,
      controls: 0,
      disablekb: 1,
      fs: 0,
      iv_load_policy: 3,
      loop: 1,
      mute: 0,
      modestbranding: 1,
      playsinline: 1,
      rel: 0,
      playlist: MUSIC_VIDEO_ID
    },
    events: {
      onReady: () => {
        musicPlayerReady = true;
        musicShouldPlay = true;
        musicInitialUnlockPending = true;
        musicAwaitingUserGesture = true;
        musicPlayer.setVolume(MUSIC_VOLUME);
        installMusicUnlockHandlers();
        tryEnableMusicSound(true);
        updateMusicButton();

        window.setTimeout(() => {
          tryEnableMusicSound(true);
          if (musicAwaitingUserGesture) {
            installMusicUnlockHandlers();
          }
        }, 650);
      },
      onStateChange: (event) => {
        if (!window.YT || !window.YT.PlayerState) {
          return;
        }

        if (event.data === window.YT.PlayerState.PLAYING) {
          musicShouldPlay = true;
        } else if (event.data === window.YT.PlayerState.PAUSED) {
          if (musicShouldPlay) {
            musicPlayer.playVideo();
          }
        } else if (event.data === window.YT.PlayerState.ENDED) {
          musicShouldPlay = true;
          musicPlayer.playVideo();
        }

        if (musicShouldPlay && musicAwaitingUserGesture) {
          installMusicUnlockHandlers();
        }

        refreshMusicGestureState();
      }
    }
  });
}

function handleMusicToggle() {
  ensureMusicPlayer();

  if (!musicPlayerReady) {
    musicShouldPlay = true;
    if (musicToggleBtn) {
      musicToggleBtn.textContent = "Cargando musica...";
    }
    return;
  }

  if (musicAwaitingUserGesture) {
    musicShouldPlay = true;
    musicInitialUnlockPending = false;
    tryEnableMusicSound(true);
    installMusicUnlockHandlers();
    return;
  }

  if (musicShouldPlay) {
    pauseMusic();
    return;
  }

  musicInitialUnlockPending = false;
  playMusic();
  installMusicUnlockHandlers();
}

function renderImages(images) {
  revealImages.innerHTML = "";

  for (let i = 0; i < images.length; i += 1) {
    const imageData = images[i];
    const img = document.createElement("img");
    img.src = imageData.src;
    img.alt = imageData.alt;
    img.loading = "lazy";
    revealImages.appendChild(img);
  }
}

function renderImageSlider(images) {
  revealImages.innerHTML = "";

  const slider = document.createElement("div");
  slider.className = "welcome-slider";

  const frame = document.createElement("div");
  frame.className = "welcome-slider-frame";

  const imageElement = document.createElement("img");
  imageElement.loading = "eager";
  frame.appendChild(imageElement);

  const captionBox = document.createElement("aside");
  captionBox.className = "welcome-slider-caption";
  captionBox.setAttribute("aria-live", "polite");

  const captionText = document.createElement("p");
  captionBox.appendChild(captionText);

  const stage = document.createElement("div");
  stage.className = "welcome-slider-stage";
  stage.appendChild(frame);
  stage.appendChild(captionBox);

  const dots = document.createElement("div");
  dots.className = "welcome-slider-dots";

  let slideIndex = 0;
  const dotButtons = [];
  let touchStartX = 0;
  let touchStartY = 0;
  let hasActiveTouch = false;

  function setSlide(nextIndex) {
    slideIndex = (nextIndex + images.length) % images.length;
    const currentImage = images[slideIndex];
    const description = currentImage.caption || currentImage.alt || "";

    imageElement.src = currentImage.src;
    imageElement.alt = currentImage.alt;
    captionText.textContent = description;

    frame.classList.remove("is-entering");
    captionBox.classList.remove("is-entering");
    void frame.offsetWidth;
    frame.classList.add("is-entering");
    captionBox.classList.add("is-entering");

    for (let i = 0; i < dotButtons.length; i += 1) {
      dotButtons[i].classList.toggle("active", i === slideIndex);
    }
  }

  function startAutoSlide() {
    stopRevealSlider();
    revealSliderTimer = window.setInterval(() => {
      setSlide(slideIndex + 1);
    }, 3200);
  }

  for (let i = 0; i < images.length; i += 1) {
    const dotButton = document.createElement("button");
    dotButton.type = "button";
    dotButton.className = "welcome-slider-dot";
    dotButton.setAttribute("aria-label", `Ir a imagen ${i + 1}`);
    dotButton.addEventListener("click", () => {
      setSlide(i);
      startAutoSlide();
    });
    dotButtons.push(dotButton);
    dots.appendChild(dotButton);
  }

  function onTouchStart(event) {
    if (event.touches.length !== 1) {
      return;
    }

    stopRevealSlider();
    const touch = event.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    hasActiveTouch = true;
  }

  function onTouchEnd(event) {
    if (!hasActiveTouch) {
      startAutoSlide();
      return;
    }

    hasActiveTouch = false;
    const touch = event.changedTouches[0];
    if (!touch) {
      startAutoSlide();
      return;
    }

    const deltaX = touch.clientX - touchStartX;
    const deltaY = touch.clientY - touchStartY;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);

    if (absDeltaX > 36 && absDeltaX > absDeltaY * 1.2) {
      if (deltaX < 0) {
        setSlide(slideIndex + 1);
      } else {
        setSlide(slideIndex - 1);
      }
    }

    startAutoSlide();
  }

  slider.addEventListener("mouseenter", stopRevealSlider);
  slider.addEventListener("mouseleave", startAutoSlide);
  slider.addEventListener("touchstart", onTouchStart, { passive: true });
  slider.addEventListener("touchend", onTouchEnd, { passive: true });
  slider.addEventListener("touchcancel", startAutoSlide, { passive: true });

  slider.appendChild(stage);
  revealImages.appendChild(slider);
  revealImages.appendChild(dots);

  setSlide(0);
  startAutoSlide();
}

function renderRevealMedia(step) {
  const media = Array.isArray(step.images) ? step.images : [];

  if (step.sliderMode && media.length > 1) {
    renderImageSlider(media);
    return;
  }

  stopRevealSlider();
  renderImages(media);
}

function renderActions(actions) {
  revealActions.innerHTML = "";

  for (let i = 0; i < actions.length; i += 1) {
    const action = actions[i];
    const button = document.createElement("button");
    button.type = "button";
    button.className = `reveal-action-btn ${action.tone || "secondary"}`;
    button.textContent = action.label;
    button.addEventListener("click", action.onClick);
    revealActions.appendChild(button);
  }
}

function createConfetti() {
  const container = document.createElement("div");
  container.className = "confetti-container";
  document.body.appendChild(container);

  const colors = ["#ff6b9d", "#ff94af", "#ffd869", "#ffb3c6", "#ff8fa9", "#ffeeb8", "#cf2f52"];
  const types = ["square", "circle", "heart", "heart", "heart"];
  const pieces = 60;

  for (let i = 0; i < pieces; i += 1) {
    const piece = document.createElement("div");
    const type = types[Math.floor(Math.random() * types.length)];

    piece.className = `confetti-piece ${type}`;
    piece.style.setProperty("--color", colors[Math.floor(Math.random() * colors.length)]);
    piece.style.setProperty("--left", `${Math.random() * 100}%`);
    piece.style.setProperty("--duration", `${2.5 + Math.random() * 2}s`);
    piece.style.setProperty("--delay", `${Math.random() * 0.5}s`);
    piece.style.setProperty("--rotation", `${Math.random() * 720 - 360}deg`);

    container.appendChild(piece);
  }

  setTimeout(() => {
    container.remove();
  }, 5000);
}

function openReveal(step, actions = []) {
  if (revealContent) {
    revealContent.classList.toggle("full-image-mode", Boolean(step.fullImageMode));
  }

  revealTitle.textContent = step.title;

  if (step.text) {
    revealText.textContent = step.text;
    revealText.hidden = false;
  } else {
    revealText.hidden = true;
  }

  revealImages.classList.toggle("slider-mode", Boolean(step.sliderMode));
  renderRevealMedia(step);
  revealImages.classList.toggle("icon-mode", Boolean(step.iconMode));
  renderActions(actions);

  revealModal.hidden = false;
  document.body.classList.add("modal-open");

  if (!step.skipConfetti) {
    createConfetti();
  }
}

function closeModal() {
  stopRevealSlider();
  revealModal.hidden = true;
  document.body.classList.remove("modal-open");
}

function setSecretButtonLabel(text) {
  if (!secretGiftBtn) {
    return;
  }

  const label = secretGiftBtn.querySelector(".secret-gift-label");
  if (label) {
    label.textContent = text;
    return;
  }

  secretGiftBtn.textContent = text;
}

function updateSecretButtonState() {
  if (!secretGiftBtn) {
    return;
  }

  if (!state.secretButtonVisible) {
    secretGiftBtn.hidden = true;
    secretGiftBtn.disabled = false;
    secretGiftBtn.classList.remove("opened");
    setSecretButtonLabel("Sopesita secreta");
    return;
  }

  secretGiftBtn.hidden = false;

  if (state.secretOpened) {
    secretGiftBtn.disabled = true;
    setSecretButtonLabel("Sopesita secreta abierta");
    secretGiftBtn.classList.add("opened");
    return;
  }

  secretGiftBtn.disabled = false;
  setSecretButtonLabel("Sopesita secreta");
  secretGiftBtn.classList.remove("opened");
}

function getCurrentSlot() {
  if (state.revealIndex >= releaseSlots.length) {
    return null;
  }

  return releaseSlots[state.revealIndex];
}

function formatCountdown(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function updateCountdown() {
  if (!countdownValue || !countdownHint) {
    return;
  }

  const now = new Date();
  const currentSlot = getCurrentSlot();

  if (currentSlot) {
    const diff = currentSlot.unlockAt.getTime() - now.getTime();
    if (diff > 0) {
      countdownValue.textContent = formatCountdown(diff);
      countdownHint.textContent = `Se desbloquea el 14 de febrero de 2026 a las ${currentSlot.timeLabel}.`;
      return;
    }

    countdownValue.textContent = "00:00:00";
    countdownHint.textContent = `Ya puedes abrir el siguiente paquete (${currentSlot.timeLabel}).`;
    return;
  }

  if (state.secretButtonVisible && !state.secretOpened) {
    countdownValue.textContent = "Disponible";
    countdownHint.textContent = "Ya puedes abrir la sopesita secreta.";
    return;
  }

  if (state.secretOpened) {
    countdownValue.textContent = "Completado";
    countdownHint.textContent = "Todas las sorpresitas fueron abiertas.";
    return;
  }

  countdownValue.textContent = "--:--:--";
  countdownHint.textContent = "";
}

function refreshCards() {
  const now = new Date();
  const currentSlot = getCurrentSlot();
  const slotUnlocked = !currentSlot || now >= currentSlot.unlockAt;

  for (let i = 0; i < gifts.length; i += 1) {
    const card = cardRefs[i];
    const button = buttonRefs[i];

    if (!card || !button) {
      continue;
    }

    if (state.opened[i]) {
      card.classList.add("opened");
      button.disabled = true;
      button.textContent = "Abierta";
      continue;
    }

    card.classList.remove("opened");

    if (state.revealIndex >= revealSteps.length) {
      button.disabled = true;
      button.textContent = "Cerrada";
      continue;
    }

    if (!slotUnlocked) {
      button.disabled = true;
      button.textContent = `Abre ${currentSlot.timeLabel}`;
      continue;
    }

    button.disabled = false;
    button.textContent = gifts[i].cta;
  }
}

function getNextReveal() {
  return revealSteps[state.revealIndex] || fallbackStep;
}

function showLockedMessage(slot) {
  openReveal({
    title: "Todavia no se puede abrir",
    text: `Esta sorpresita se desbloquea el 14 de febrero de 2026 a las ${slot.timeLabel}.`,
    images: []
  });
}

function openCard(index) {
  if (state.opened[index]) {
    openReveal({
      title: "Esta sorpresita ya fue abierta",
      text: "Prueba abrir otra cajita para seguir descubriendo.",
      images: []
    });
    return;
  }

  if (state.revealIndex >= revealSteps.length) {
    openReveal({
      title: "Ya abriste todas",
      text: "Todas las sorpresitas del dia ya fueron abiertas.",
      images: []
    });
    return;
  }

  const slot = getCurrentSlot();
  const now = new Date();

  if (slot && now < slot.unlockAt) {
    showLockedMessage(slot);
    return;
  }

  state.opened[index] = true;
  const step = getNextReveal();
  state.revealIndex += 1;

  if (state.revealIndex >= revealSteps.length) {
    state.secretButtonVisible = true;
  }

  saveState();
  refreshCards();
  updateCountdown();
  updateSecretButtonState();
  openReveal(step);
}

function openSecretGift() {
  if (!state.secretButtonVisible) {
    return;
  }

  if (state.secretOpened) {
    openReveal({
      title: "La sopesita secreta ya fue abierta",
      text: "Ya descubriste la sorpresa final.",
      images: []
    });
    return;
  }

  state.secretOpened = true;
  saveState();
  updateCountdown();
  updateSecretButtonState();
  openReveal(secretReveal);
}

function resetAllSurprises() {
  const shouldReset = window.confirm("Quieres reiniciar todas las sorpresitas?");
  if (!shouldReset) {
    return;
  }

  state = getDefaultState();
  saveState();

  refreshCards();
  updateCountdown();
  updateSecretButtonState();
  closeModal();
}

for (let i = 0; i < gifts.length; i += 1) {
  const card = document.createElement("article");
  const button = document.createElement("button");

  card.className = "gift-card";
  card.style.setProperty("--delay", `${0.1 + i * 0.1}s`);
  card.innerHTML = `
    <span class="gift-icon" aria-hidden="true">
      <span class="gift-box-top"></span>
      <span class="gift-box-base"></span>
      <span class="gift-ribbon-v"></span>
      <span class="gift-ribbon-h"></span>
      <span class="gift-bow-left"></span>
      <span class="gift-bow-right"></span>
      <span class="gift-knot"></span>
    </span>
    <span class="opened-mark" aria-hidden="true">Abierta</span>
  `;

  button.className = "gift-link gift-button";
  button.type = "button";
  button.textContent = gifts[i].cta;
  button.addEventListener("click", () => openCard(i));

  card.appendChild(button);
  grid.appendChild(card);

  cardRefs.push(card);
  buttonRefs.push(button);
}

refreshCards();
updateCountdown();
updateSecretButtonState();

setInterval(() => {
  refreshCards();
  updateCountdown();
}, 1000);

closeModalBtn.addEventListener("click", closeModal);
revealModal.addEventListener("click", (event) => {
  const target = event.target;
  if (target instanceof HTMLElement && target.hasAttribute("data-close-modal")) {
    closeModal();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !revealModal.hidden) {
    closeModal();
  }
});

if (resetBtn) {
  resetBtn.addEventListener("click", resetAllSurprises);
}

if (secretGiftBtn) {
  secretGiftBtn.addEventListener("click", openSecretGift);
}

if (musicToggleBtn) {
  musicToggleBtn.addEventListener("click", handleMusicToggle);
}

const previousYouTubeReady = window.onYouTubeIframeAPIReady;
window.onYouTubeIframeAPIReady = () => {
  if (typeof previousYouTubeReady === "function") {
    previousYouTubeReady();
  }

  ensureMusicPlayer();
};

if (window.YT && window.YT.Player) {
  ensureMusicPlayer();
} else {
  // Fallback: check periodically if YT API loaded
  let checkCount = 0;
  const checkYTReady = setInterval(() => {
    checkCount++;
    if (window.YT && window.YT.Player) {
      clearInterval(checkYTReady);
      ensureMusicPlayer();
    } else if (checkCount > 50) {
      // After 10 seconds, give up
      clearInterval(checkYTReady);
      console.error("YouTube API failed to load");
    }
  }, 200);
}

updateMusicButton();

openReveal(welcomeReveal);

// ========================================
// MINIJUEGO: ATRAPA LAS SOPESITAS
// ========================================

const gameModal = document.getElementById("gameModal");
const gameBtn = document.getElementById("gameBtn");
const closeGameBtn = document.getElementById("closeGameBtn");
const gameCanvas = document.getElementById("gameCanvas");
const player = document.getElementById("player");
const gameScoreEl = document.getElementById("gameScore");
const progressFill = document.getElementById("progressFill");
const gameVictory = document.getElementById("gameVictory");
const gameOver = document.getElementById("gameOver");
const restartGameBtn = document.getElementById("restartGameBtn");
const retryGameBtn = document.getElementById("retryGameBtn");

let gameState = {
  isPlaying: false,
  score: 0,
  playerX: 50, // percentage
  touchStartX: 0,
  fallingItems: [],
  gameLoop: null,
  spawnInterval: null
};

const GOOD_ITEMS = ["❤️", "🎁", "🌮", "💝", "🌹"];
const BAD_ITEMS = ["💔", "😡", "⚡"];
const GOOD_ITEM_SPEED = 3; // pixels per frame - más rápidos (más difíciles)
const BAD_ITEM_SPEED = 2; // pixels per frame - más lentos (más fáciles de evitar)
const SPAWN_RATE = 1200; // milliseconds
const PLAYER_SPEED = 3; // percentage per frame
const GOOD_ITEM_POINTS = 10;
const BAD_ITEM_POINTS = -15;
const MISSED_GOOD_ITEM_PENALTY = -4; // Menor al valor del item bueno atrapado
const MAX_SCORE = 100;
const MIN_SCORE = -50; // Game over si llega a -50

// Abrir/Cerrar modal del juego
function openGameModal() {
  gameModal.hidden = false;
  document.body.classList.add("modal-open");
  resetGame();
  startGame();
}

function closeGameModal() {
  stopGame();
  gameModal.hidden = true;
  document.body.classList.remove("modal-open");
}

if (gameBtn) {
  gameBtn.addEventListener("click", openGameModal);
}

if (closeGameBtn) {
  closeGameBtn.addEventListener("click", closeGameModal);
}

if (gameModal) {
  gameModal.addEventListener("click", (event) => {
    if (event.target.hasAttribute("data-close-game")) {
      closeGameModal();
    }
  });
}

if (restartGameBtn) {
  restartGameBtn.addEventListener("click", () => {
    gameVictory.hidden = true;
    resetGame();
    startGame();
  });
}

if (retryGameBtn) {
  retryGameBtn.addEventListener("click", () => {
    gameOver.hidden = true;
    resetGame();
    startGame();
  });
}

// Movimiento del jugador con teclado
document.addEventListener("keydown", (e) => {
  if (!gameState.isPlaying || gameModal.hidden) return;

  if (e.key === "ArrowLeft") {
    gameState.playerX = Math.max(5, gameState.playerX - PLAYER_SPEED);
    updatePlayerPosition();
  } else if (e.key === "ArrowRight") {
    gameState.playerX = Math.min(95, gameState.playerX + PLAYER_SPEED);
    updatePlayerPosition();
  }
});

// Movimiento del jugador con touch
if (gameCanvas) {
  gameCanvas.addEventListener("touchstart", (e) => {
    if (!gameState.isPlaying) return;
    e.preventDefault();
    gameState.touchStartX = e.touches[0].clientX;
  }, { passive: false });

  gameCanvas.addEventListener("touchmove", (e) => {
    if (!gameState.isPlaying) return;
    e.preventDefault();

    const touch = e.touches[0];
    const rect = gameCanvas.getBoundingClientRect();
    const relativeX = touch.clientX - rect.left;
    const percentage = (relativeX / rect.width) * 100;

    gameState.playerX = Math.max(5, Math.min(95, percentage));
    updatePlayerPosition();
  }, { passive: false });
}

function updatePlayerPosition() {
  if (player) {
    player.style.left = `${gameState.playerX}%`;
  }
}

// Crear item que cae
function spawnItem() {
  if (!gameState.isPlaying) return;

  const isGood = Math.random() > 0.25; // 75% buenos, 25% malos
  const emoji = isGood
    ? GOOD_ITEMS[Math.floor(Math.random() * GOOD_ITEMS.length)]
    : BAD_ITEMS[Math.floor(Math.random() * BAD_ITEMS.length)];

  const item = document.createElement("div");
  item.className = "falling-item";
  item.textContent = emoji;
  item.style.left = `${Math.random() * 90 + 5}%`;
  item.style.top = '-50px';
  item.style.position = 'absolute';

  const itemData = {
    element: item,
    x: parseFloat(item.style.left),
    y: -50,
    isGood: isGood,
    points: isGood ? GOOD_ITEM_POINTS : BAD_ITEM_POINTS,
    speed: isGood ? GOOD_ITEM_SPEED : BAD_ITEM_SPEED
  };

  gameCanvas.appendChild(item);
  gameState.fallingItems.push(itemData);
}

// Detectar colisión
function checkCollision(item) {
  const playerRect = player.getBoundingClientRect();
  const itemRect = item.element.getBoundingClientRect();

  return !(
    itemRect.right < playerRect.left ||
    itemRect.left > playerRect.right ||
    itemRect.bottom < playerRect.top ||
    itemRect.top > playerRect.bottom
  );
}

// Actualizar puntuación
function updateScore(points) {
  gameState.score = Math.max(MIN_SCORE, Math.min(MAX_SCORE, gameState.score + points));
  gameScoreEl.textContent = `${gameState.score}`;

  // Calcular el porcentaje de la barra (0 es el centro, 50%)
  // Score de -50 a 100 se mapea a 0% a 100%
  const percentage = ((gameState.score - MIN_SCORE) / (MAX_SCORE - MIN_SCORE)) * 100;
  progressFill.style.width = `${percentage}%`;

  // Cambiar color si es negativo
  if (gameState.score < 0) {
    progressFill.classList.add('negative');
  } else {
    progressFill.classList.remove('negative');
  }

  // Verificar victoria o derrota
  if (gameState.score >= MAX_SCORE) {
    winGame();
  } else if (gameState.score <= MIN_SCORE) {
    loseGame();
  }
}

// Loop principal del juego
function gameUpdate() {
  if (!gameState.isPlaying) return;

  const canvasRect = gameCanvas.getBoundingClientRect();

  for (let i = gameState.fallingItems.length - 1; i >= 0; i--) {
    const item = gameState.fallingItems[i];
    item.y += item.speed;
    item.element.style.top = `${item.y}px`;

    // Verificar colisión con jugador
    if (checkCollision(item)) {
      updateScore(item.points);
      item.element.remove();
      gameState.fallingItems.splice(i, 1);
      continue;
    }

    // Eliminar si salió de la pantalla
    if (item.y > canvasRect.height) {
      // Si era un item bueno que no atrapaste, pierdes puntos
      if (item.isGood) {
        updateScore(MISSED_GOOD_ITEM_PENALTY);
      }
      item.element.remove();
      gameState.fallingItems.splice(i, 1);
    }
  }

  gameState.gameLoop = requestAnimationFrame(gameUpdate);
}

// Ganar el juego
function winGame() {
  stopGame();
  createConfetti();

  setTimeout(() => {
    gameVictory.hidden = false;
  }, 300);
}

// Perder el juego
function loseGame() {
  stopGame();

  setTimeout(() => {
    gameOver.hidden = false;
  }, 300);
}

// Iniciar juego
function startGame() {
  gameState.isPlaying = true;
  updatePlayerPosition();

  // Spawn inicial
  spawnItem();

  // Spawn periódico
  gameState.spawnInterval = setInterval(spawnItem, SPAWN_RATE);

  // Loop principal
  gameState.gameLoop = requestAnimationFrame(gameUpdate);
}

// Detener juego
function stopGame() {
  gameState.isPlaying = false;

  if (gameState.gameLoop) {
    cancelAnimationFrame(gameState.gameLoop);
    gameState.gameLoop = null;
  }

  if (gameState.spawnInterval) {
    clearInterval(gameState.spawnInterval);
    gameState.spawnInterval = null;
  }
}

// Reiniciar juego
function resetGame() {
  stopGame();

  // Limpiar items
  gameState.fallingItems.forEach(item => item.element.remove());
  gameState.fallingItems = [];

  // Resetear estado
  gameState.score = 0;
  gameState.playerX = 50;
  gameVictory.hidden = true;
  gameOver.hidden = true;

  // Actualizar UI
  gameScoreEl.textContent = '0';
  progressFill.style.width = '33.33%'; // 0 puntos está en el 33% (de -50 a 100)
  progressFill.classList.remove('negative');

  updatePlayerPosition();
}
