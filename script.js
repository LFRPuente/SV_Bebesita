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
    title: "Te regalo una imagen inedita de cola pola",
    text: "",
    images: [{ src: "imagenes/colaypola.jpeg", alt: "Imagen inedita de cola y pola" }]
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
  title: "Hola cola te amo mucho",
  text: "",
  images: [
    {
      src: "imagenes/Pola.jpeg",
      alt: "Pola",
      caption: "una pola chill congelándose."
    },
    {
      src: "imagenes/colanavidad.jpeg",
      alt: "Cola navidad",
      caption: "Colita feliz con buzón."
    },
    {
      src: "imagenes/colaconsueño.jpeg",
      alt: "Cola con sueno",
      caption: "una colita preciosa preparada para la fiesta"
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

const previousYouTubeReady = window.onYouTubeIframeAPIReady;
window.onYouTubeIframeAPIReady = () => {
  if (typeof previousYouTubeReady === "function") {
    previousYouTubeReady();
  }

  ensureMusicPlayer();
};

if (musicToggleBtn) {
  musicToggleBtn.addEventListener("click", handleMusicToggle);
}

if (window.YT && window.YT.Player) {
  ensureMusicPlayer();
}

updateMusicButton();

openReveal(welcomeReveal);
