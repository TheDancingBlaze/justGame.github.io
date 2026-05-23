/**
 * ==========================================================================
 * АРХИВ 1831 — Интерактивная историческая реконструкция
 * Основной игровой скрипт
 * ==========================================================================
 */

// ==========================================================================
// 1. КОНФИГУРАЦИЯ И КОНСТАНТЫ
// ==========================================================================

const CONFIG = {
    // Начальные значения статов
    INITIAL_STATS: {
        epidemy: 30,      // Стартовая эпидемия (уже идёт)
        reputation: 60,   // Доверие Николая I
        treasury: 20      // Казна после польской кампании
    },

    // Настройки карточек (УСКОРЕНО)
    CARD: {
        SWIPE_THRESHOLD: 80,       // Было 120 — свайп срабатывает раньше
        MAX_DRAG_DISTANCE: 150,    // Максимальное смещение при перетаскивании
        ROTATION_FACTOR: 15,       // Делитель для угла поворота
        ANIMATION_DURATION: 280,   // Было 400 — карточки летают быстрее
        RESET_DURATION: 200        // Новая: скорость появления следующей карты
    },

    // Настройки автоподгона текста (УСКОРЕНО: шаг 1 вместо 0.5)
    TEXT_FIT: {
        CARD_MAX: 22,
        CARD_MIN: 13,
        CHOICE_MAX: 13,
        CHOICE_MIN: 9,
        STEP: 1                    // Было 0.5 — подбор шрифта в 2 раза быстрее
    },

    // Настройки скорости UI (НОВОЕ)
    UI: {
        SCREEN_FADE: 500,          // Было 800 — переход между экранами
        TEXT_FADE: 80,             // Было 150 — смена текста карточки
        NAME_FADE: 40,             // Было 80  — смена имени
        TYPEWRITER_DELAY: 600      // Было 1200 — старт печатной машинки
    },

    // Месяцы для таймлайна
    MONTHS: {
        full: [ "Май ",  "Июнь ",  "Июль ",  "Август ",  "Сентябрь ",  "Октябрь ",
                "Ноябрь ",  "Декабрь ",  "Январь ",  "Февраль ",  "Март ",  "Апрель "],
        short: [ "МАЙ ",  "ИЮН ",  "ИЮЛ ",  "АВГ ",  "СЕН ",  "ОКТ ",
                 "НОЯ ",  "ДЕК ",  "ЯНВ ",  "ФЕВ ",  "МАР ",  "АПР "]
    },

    // Цитаты для печатной машинки
    QUOTES: [
         "«Доктор Распайль считал камфору почти универсальной панацеей...» ",
         "«Телесная сила не предохраняет от болезни — она располагает к ней.» ",
         "«Цыганку Таню вылечили крапивой и горячим морским пуншем с ромом.» ",
         "«Они не внимали предостережениям и наелись на ночь сырых огурцов.» ",
         "«Деятельность нервной системы необходима для противодействия холере.» ",
         "«В городе в большом употреблении сигаретки из слоновой кости...» ",
         "«Почти никто не умер из тех, которые не позволяли себе излишеств.» "
    ],

    // Музыкальные треки
    TRACKS: [
        { name:  "Заблудший ", url:  "music/Заблудший.mp3 " },
        { name:  "Мрак ", url:  "music/Мрак.mp3 " },
        { name:  "Секреты ", url:  "music/Секреты.mp3 " },
        { name:  "Хватит ", url:  "music/Хватит.mp3 " },
        { name:  "Lilium ", url:  "music/Lilium(Music_Box).mp3 " }
    ]
};

// ==========================================================================
// 2. СОСТОЯНИЕ ИГРЫ
// ==========================================================================

const gameState = {
    currentQuestionIndex: 0,
    stats: { ...CONFIG.INITIAL_STATS },
    isDragging: false,
    startX: 0,
    historicalAccuracy: { correct: 0, total: 0 },
    imageCache: new Map(),
    currentTrackIndex: 0,
    isHeartbeatPlaying: false
};

// ==========================================================================
// 3. DOM-ЭЛЕМЕНТЫ (кэширование)
// ==========================================================================

const DOM = {
    // Карточка и элементы выбора
    card: document.getElementById('game-card'),
    leftLabel: document.getElementById('choice-left'),
    rightLabel: document.getElementById('choice-right'),
    cardDateBelow: document.getElementById('card-date-below'),
    
    // Таймлайн
    timelineMarker: document.getElementById('timeline-marker'),
    timelineLabels: document.getElementById('timeline-labels'),
    
    // Экраны
    startScreen: document.getElementById('start-screen'),
    disclaimerScreen: document.getElementById('disclaimer-screen'),
    mainContent: document.querySelector('.main-layout'),
    gameOverScreen: document.getElementById('game-over-screen'),
    
    // Кнопки меню
    playBtn: document.getElementById('play-btn'),
    continueBtn: document.getElementById('continue-btn'),
    aboutBtn: document.getElementById('about-btn'),
    
    // Модальные окна
    aboutModal: document.getElementById('about-modal'),
    closeAboutBtn: document.getElementById('close-about'),
    rulesBtn: document.getElementById('rules-btn'),
    rulesModal: document.getElementById('rules-modal'),
    closeRulesBtn: document.getElementById('close-rules'),
    
    // Музыкальный плеер
    audio: document.getElementById('bg-music'),
    playerIcon: document.getElementById('player-icon'),
    playerPanel: document.getElementById('player-panel'),
    prevTrackBtn: document.getElementById('prev-track'),
    nextTrackBtn: document.getElementById('next-track'),
    volumeSlider: document.getElementById('volume-slider'),
    volumeValue: document.getElementById('volume-value'),
    trackNameSpan: document.getElementById('track-name'),
    heartbeatSound: document.getElementById('heartbeat-sound'),
    
    // Частицы и эффекты
    particlesContainer: document.getElementById('particles'),
    typewriterEl: document.getElementById('typewriter')
};

// ==========================================================================
// 4. УТИЛИТЫ
// ==========================================================================

/**
 * Получает X-координату из события (мыши или касания)
 */
function getEventX(e) {
    return e.touches ? e.touches[0].clientX : e.clientX;
}

/**
 * Получает финальную X-координату из события окончания
 */
function getEventEndX(e) {
    return e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
}

/**
 * Предзагружает изображение и кэширует его
 */
function preloadImage(src) {
    if (!src || gameState.imageCache.has(src)) {
        return Promise.resolve(gameState.imageCache.get(src));
    }
    
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            gameState.imageCache.set(src, img);
            resolve(img);
        };
        img.onerror = reject;
        img.src = src;
    });
}

/**
 * Предзагружает все изображения из вопросов
 */
function preloadAllImages() {
    const uniqueImages = new Set();
    questions.forEach(q => {
        if (q.image && q.image.trim() !== '') {
            uniqueImages.add(q.image);
        }
    });
    
    console.log(`Предзагрузка ${uniqueImages.size} изображений...`);
    uniqueImages.forEach(src => {
        preloadImage(src).catch(e => console.warn(`Не удалось загрузить: ${src}`, e));
    });
}

/**
Автоподгон размера шрифта под контейнер (УСКОРЕНО: шаг 1px вместо 0.5)
*/
function autoFitText(element, maxSize = CONFIG.TEXT_FIT.CARD_MAX, minSize = CONFIG.TEXT_FIT.CARD_MIN) {
    if (!element) return;
    
    // 🔧 ФИКСИРОВАННАЯ высота — карточка не меняет размер от длины текста
    element.style.height = '180px';
    element.style.overflow = 'hidden';
    
    let currentSize = maxSize;
    element.style.fontSize = currentSize + 'px';
    
    while (
        (element.scrollHeight > element.clientHeight ||
         element.scrollWidth > element.clientWidth) &&
        currentSize > minSize
    ) {
        currentSize -= CONFIG.TEXT_FIT.STEP;
        element.style.fontSize = currentSize + 'px';
    }
    
    if (currentSize <= minSize && element.scrollHeight > element.clientHeight) {
        element.style.display = '-webkit-box';
        element.style.webkitLineClamp = '6';
        element.style.webkitBoxOrient = 'vertical';
    }
}

/**
Автоподгон размера шрифта для плашек выбора (УСКОРЕНО)
*/
function autoFitChoice(element, maxSize = CONFIG.TEXT_FIT.CHOICE_MAX, minSize = CONFIG.TEXT_FIT.CHOICE_MIN) {
    if (!element) return;
    let currentSize = maxSize;
    element.style.fontSize = currentSize + 'px';
    // Уменьшаем, пока текст не влезет в границы
    while (
        (element.scrollWidth > element.clientWidth ||
        element.scrollHeight > element.clientHeight) &&
        currentSize > minSize
    ) {
        currentSize -= CONFIG.TEXT_FIT.STEP;
        element.style.fontSize = currentSize + 'px';
    }
}

/**
 * Предотвращает перетаскивание изображений
 */
function preventImageDrag() {
    const images = document.querySelectorAll('img');
    images.forEach(img => {
        img.addEventListener('dragstart', (e) => { 
            e.preventDefault(); 
            return false; 
        });
        img.addEventListener('contextmenu', (e) => { 
            e.preventDefault(); 
        });
    });
}

// ==========================================================================
// 5. УПРАВЛЕНИЕ ЭКРАНАМИ
// ==========================================================================

/**
Запускает игру с плавным появлением (УСКОРЕНО)
*/
function startGame() {
    if (DOM.mainContent) {
        DOM.mainContent.classList.remove('main-content-hidden');
        DOM.mainContent.classList.add('main-content-visible');
    }
    if (gameState.currentQuestionIndex === 0) {
        updateCardContent();
    }
    // Плавно включаем карточку с задержкой (было CONFIG.CARD.ANIMATION_DURATION)
    setTimeout(() => {
        if (DOM.card) {
            DOM.card.style.pointerEvents = 'auto';
            DOM.card.style.opacity = '1';
            DOM.card.style.transform = 'scale(1)';
        }
    }, 150);
}

/**
Скрывает дисклеймер и запускает игру (УСКОРЕНО: 800→UI.SCREEN_FADE)
*/
function hideDisclaimerAndStart() {
    DOM.disclaimerScreen.style.transition = `opacity ${CONFIG.UI.SCREEN_FADE}ms ease`;
    DOM.disclaimerScreen.style.opacity = '0';
    setTimeout(() => {
        DOM.disclaimerScreen.style.display = 'none';
        DOM.disclaimerScreen.style.visibility = 'hidden';
        startGame();
    }, CONFIG.UI.SCREEN_FADE);
}

// ==========================================================================
// 6. ТАЙМЛАЙН
// ==========================================================================

/**
 * Обновляет позицию маркера на таймлайне
 */
function updateTimelinePosition() {
    const timelineContainer = document.querySelector('.timeline-container');
    if (!timelineContainer) return;
    
    const containerHeight = timelineContainer.offsetHeight;
    const totalMonths = CONFIG.MONTHS.short.length;
    const padding = window.innerWidth <= 768 ? 10 : 20;
    const availableHeight = containerHeight - padding * 2;
    
    let position;
    if (window.innerWidth <= 768) {
        // Горизонтальный таймлайн: двигаем left
        position = padding + (gameState.currentQuestionIndex / (totalMonths - 1)) * availableHeight;
        DOM.timelineMarker.style.left = `${position}px`;
        DOM.timelineMarker.style.top = '50%';
        DOM.timelineMarker.style.transform = 'translateY(-50%)';
    } else {
        // Вертикальный: двигаем top
        position = padding + (gameState.currentQuestionIndex / (totalMonths - 1)) * availableHeight;
        DOM.timelineMarker.style.top = `${position}px`;
        DOM.timelineMarker.style.left = '50%';
        DOM.timelineMarker.style.transform = 'translateX(-50%)';
    }
    
    const ball = DOM.timelineMarker.querySelector('.marker-ball');
    if (ball) {
        ball.style.transform = window.innerWidth <= 768 ? 'translateY(-50%) scale(1.2)' : 'scale(1.2)';
        setTimeout(() => { 
            ball.style.transform = window.innerWidth <= 768 ? 'translateY(-50%) scale(1)' : 'scale(1)'; 
        }, 200);
    }
}

/**
 * Создает метки месяцев на таймлайне
 */
function createTimelineLabels() {
    if (!DOM.timelineLabels) return;
    
    CONFIG.MONTHS.short.forEach((month) => {
        const span = document.createElement('span');
        span.textContent = month;
        DOM.timelineLabels.appendChild(span);
    });
}

// ==========================================================================
// 7. КАРТОЧКА И КОНТЕНТ
// ==========================================================================

/**
 * Обновляет содержимое карточки
 */
function updateCardContent() {
    if (gameState.currentQuestionIndex >= questions.length) {
        showFinalVerdict();
        return;
    }
    
    const data = questions[gameState.currentQuestionIndex];
    
    // Меняем рамку
    if (DOM.card) {
        DOM.card.classList.remove('border-blue', 'border-orange', 'border-red', 'border-gold');
        if (data.borderColor) {
            DOM.card.classList.add(`border-${data.borderColor}`);
        }
    }
    
    const imageContainer = document.querySelector('.card-image');
    const imgElement = imageContainer ? imageContainer.querySelector('img') : null;
    
    // Берем дату из карточки, если её нет — генерируем по индексу
    let displayDate = data.date;
    if (!displayDate) {
        const currentMonth = CONFIG.MONTHS.full[gameState.currentQuestionIndex];
        const currentYear = gameState.currentQuestionIndex < 7 ? "1831" : "1832";
        displayDate = `${currentMonth} ${currentYear}`;
    }
    
    // Плавная смена изображения
    if (data.image && imgElement) {
        imgElement.style.display = 'block';
        
        const cachedImg = gameState.imageCache.get(data.image);
        if (cachedImg) {
            imgElement.src = cachedImg.src;
            if (imageContainer) imageContainer.style.background = "transparent";
        } else {
            imgElement.style.opacity = '0';
            imgElement.src = data.image;
            imgElement.onload = () => {
                imgElement.style.opacity = '1';
            };
            if (imageContainer) imageContainer.style.background = "transparent";
        }
        imgElement.setAttribute('draggable', 'false');
    } else if (imgElement) {
        imgElement.style.display = 'none';
        if (imageContainer) imageContainer.style.background = data.color || "#333";
    }
    
    const cardTextEl = document.querySelector('.card-text');
    const characterNameEl = document.querySelector('.character-name');
    
    // Плавная смена текста (УСКОРЕНО: 150→UI.TEXT_FADE)
    if (cardTextEl) {
        cardTextEl.style.opacity = '0';
        setTimeout(() => {
            cardTextEl.innerHTML = data.text;
            autoFitText(cardTextEl);
            requestAnimationFrame(() => {
                cardTextEl.style.opacity = '1';
            });
        }, CONFIG.UI.TEXT_FADE);
    }

    if (characterNameEl) {
        characterNameEl.style.opacity = '0';
        setTimeout(() => {
            characterNameEl.innerHTML = data.name;
            characterNameEl.style.opacity = '1';
        }, CONFIG.UI.NAME_FADE);
    }
    
    if (DOM.cardDateBelow) DOM.cardDateBelow.innerHTML = displayDate;
    
    // Скрываем плашки выбора, если текст пустой
    const leftText = data.left ? data.left.trim() : '';
    const rightText = data.right ? data.right.trim() : '';
    
    if (DOM.leftLabel) {
        if (leftText) {
            DOM.leftLabel.innerText = leftText;
            DOM.leftLabel.style.display = 'block';
            DOM.leftLabel.style.fontSize = '13px';
            autoFitChoice(DOM.leftLabel);
        } else {
            DOM.leftLabel.innerText = '';
            DOM.leftLabel.style.display = 'none';
        }
    }
    
    if (DOM.rightLabel) {
        if (rightText) {
            DOM.rightLabel.innerText = rightText;
            DOM.rightLabel.style.display = 'block';
            DOM.rightLabel.style.fontSize = '13px';
            autoFitChoice(DOM.rightLabel);
        } else {
            DOM.rightLabel.innerText = '';
            DOM.rightLabel.style.display = 'none';
        }
    }
    
    // Предзагружаем следующие изображения
    const nextIndex = gameState.currentQuestionIndex + 1;
    if (nextIndex < questions.length && questions[nextIndex].image) {
        preloadImage(questions[nextIndex].image).catch(() => {});
    }
    
    const nextNextIndex = gameState.currentQuestionIndex + 2;
    if (nextNextIndex < questions.length && questions[nextNextIndex].image) {
        preloadImage(questions[nextNextIndex].image).catch(() => {});
    }
    
    updateHeartbeat();
}

/**
Сбрасывает карточку для следующего вопроса (УСКОРЕНО)
*/
function resetCard() {
    gameState.currentQuestionIndex++;
    updateCardContent();
    if (gameState.currentQuestionIndex < questions.length && DOM.card) {
        DOM.card.style.transition = 'none';
        DOM.card.style.transform = `translateX(0px) scale(0.9) rotate(0deg)`;
        setTimeout(() => {
            DOM.card.style.transition = `all ${CONFIG.CARD.RESET_DURATION}ms ease`;
            DOM.card.style.opacity = '1';
            DOM.card.style.transform = `translateX(0px) scale(1) rotate(0deg)`;
        }, 30);
    }
}

// ==========================================================================
// 8. ОБРАБОТКА ПЕРЕТАСКИВАНИЯ
// ==========================================================================

function handleDragStart(e) {
    if (e.target.tagName === 'IMG') return;
    
    gameState.isDragging = true;
    gameState.startX = getEventX(e);
    DOM.card.style.transition = 'none';
    
    if (e.type === 'touchstart') e.preventDefault();
}

function handleDragMove(e) {
    if (!gameState.isDragging) return;
    if (e.type === 'touchmove') e.preventDefault();
    
    const currentX = getEventX(e);
    let moveX = currentX - gameState.startX;
    
    if (!DOM.card) return;
    
    // 🔧 РАСЧЁТ МАКСИМУМА: угол карточки не должен выходить за экран
    const screenWidth = window.innerWidth;
    const cardWidth = DOM.card.offsetWidth;
    const cardHeight = DOM.card.offsetHeight;
    
    // Запас от края экрана (≈0.5 см = 19px)
    const EDGE_PADDING = 20;
    
    // Пробуем текущее смещение, считаем угол
    let testMove = moveX;
    if (testMove > CONFIG.CARD.MAX_DRAG_DISTANCE) testMove = CONFIG.CARD.MAX_DRAG_DISTANCE;
    if (testMove < -CONFIG.CARD.MAX_DRAG_DISTANCE) testMove = -CONFIG.CARD.MAX_DRAG_DISTANCE;
    
    const testRotation = testMove / CONFIG.CARD.ROTATION_FACTOR;
    const rotationRad = Math.abs(testRotation) * Math.PI / 180;
    
    // 🔧 На сколько пикселей угол "вылетает" по горизонтали из-за поворота
    const cornerOverflow = Math.sin(rotationRad) * cardHeight / 2;
    
    // Максимальное смещение, при котором верхний угол ещё в кадре
    const maxSafeMove = (screenWidth - cardWidth) / 2 - cornerOverflow - EDGE_PADDING;
    
    // Применяем ограничение (берём меньшее из двух)
    const adaptiveMax = Math.min(CONFIG.CARD.MAX_DRAG_DISTANCE, Math.max(60, maxSafeMove));
    
    if (moveX > adaptiveMax) moveX = adaptiveMax;
    if (moveX < -adaptiveMax) moveX = -adaptiveMax;
    
    const rotation = moveX / CONFIG.CARD.ROTATION_FACTOR;
    
    DOM.card.style.transform = `translateX(${moveX}px) rotate(${rotation}deg)`;
    
    // Показываем плашки выбора
    if (moveX > 20) {
        if (DOM.rightLabel) DOM.rightLabel.style.opacity = Math.min(moveX / 100, 1);
        if (DOM.leftLabel) DOM.leftLabel.style.opacity = 0;
    } else if (moveX < -20) {
        if (DOM.leftLabel) DOM.leftLabel.style.opacity = Math.min(Math.abs(moveX) / 100, 1);
        if (DOM.rightLabel) DOM.rightLabel.style.opacity = 0;
    } else {
        if (DOM.leftLabel) DOM.leftLabel.style.opacity = 0;
        if (DOM.rightLabel) DOM.rightLabel.style.opacity = 0;
    }
}

function handleDragEnd(e) {
    if (!gameState.isDragging) return;
    gameState.isDragging = false;
    
    const endX = getEventEndX(e);
    const finalMoveX = endX - gameState.startX;
    
    if (Math.abs(finalMoveX) > CONFIG.CARD.SWIPE_THRESHOLD && DOM.card) {
        const direction = finalMoveX > 0 ? 1 : -1;
        const currentData = questions[gameState.currentQuestionIndex];
        let isBadEnd = false;
        let badEndReason = "";
        let badChoiceText = "";
        let badEndEpilogue = "";
        
        if (direction === -1) {
            badChoiceText = currentData.left;
            if (currentData.badEndLeft) {
                isBadEnd = true;
                badEndReason = currentData.badEndLeftReason || "Ваше решение привело к катастрофическим последствиям для империи.";
                badEndEpilogue = currentData.badEndLeftEpilogue || "";
            }
            if (!isBadEnd) {
                gameState.stats.epidemy += currentData.leftEff[0];
                gameState.stats.reputation += currentData.leftEff[1];
                gameState.stats.treasury += currentData.leftEff[2];
            }
        } else {
            badChoiceText = currentData.right;
            if (currentData.badEndRight) {
                isBadEnd = true;
                badEndReason = currentData.badEndRightReason || "Ваше решение привело к катастрофическим последствиям для империи.";
                badEndEpilogue = currentData.badEndRightEpilogue || "";
            }
            if (!isBadEnd) {
                gameState.stats.epidemy += currentData.rightEff[0];
                gameState.stats.reputation += currentData.rightEff[1];
                gameState.stats.treasury += currentData.rightEff[2];
            }
        }
        
        // Запись исторической точности
        if (!isBadEnd && currentData.correctChoice) {
            gameState.historicalAccuracy.total++;
            const playerChoice = direction === -1 ? 'left' : 'right';
            if (playerChoice === currentData.correctChoice) {
                gameState.historicalAccuracy.correct++;
            }
        }
        
        if (isBadEnd) {
            showBadEnd(badEndReason, badChoiceText, badEndEpilogue);
            return;
        }
        
        // Анимация улетающей карточки
        DOM.card.style.transition = 'all 0.4s cubic-bezier(0.23, 1, 0.32, 1)';
        const flyDistance = Math.max(600, window.innerWidth);
        DOM.card.style.transform = `translateX(${direction * 600}px) rotate(${direction * 60}deg)`;
        DOM.card.style.opacity = '0';
        setTimeout(resetCard, CONFIG.CARD.ANIMATION_DURATION);
    } else if (DOM.card) {
        // Возврат карточки на место
        DOM.card.style.transition = 'transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
        DOM.card.style.transform = `translateX(0px) rotate(0deg)`;
    }
    
    // Скрываем плашки выбора
    if (DOM.leftLabel) DOM.leftLabel.style.opacity = 0;
    if (DOM.rightLabel) DOM.rightLabel.style.opacity = 0;
}

// ==========================================================================
// 9. КОНЦОВКИ ИГРЫ
// ==========================================================================

/**
 * Показывает экран плохой концовки
 */
function showBadEnd(reasonText, badChoiceText, epilogueText) {
    stopHeartbeat();
    
    const gameOverBox = DOM.gameOverScreen.querySelector('.game-over-box');
    const finalEpilogue = epilogueText || "Империя пала. История переписана навсегда...";
    
    gameOverBox.innerHTML = `
        <div class="corner-bl"></div>
        <div class="corner-br"></div>
        <div class="bad-end-header">
            <div class="bad-end-skull">⚰️</div>
            <h2 class="bad-end-title">ИСТОРИЯ ПРЕРВАНА</h2>
            <div class="bad-end-skull">⚰️</div>
        </div>
        <div class="bad-end-divider">
            <span class="divider-line"></span>
            <span class="divider-icon">✧</span>
            <span class="divider-line"></span>
        </div>
        <div class="bad-end-choice">
            <span class="choice-label-text">Роковой выбор:</span>
            <span class="choice-value">«${badChoiceText}»</span>
        </div>
        <div class="bad-end-consequence">
            <span class="consequence-icon">☠</span>
            <p class="consequence-text">${reasonText}</p>
        </div>
        <div class="bad-end-divider">
            <span class="divider-line short"></span>
            <span class="divider-icon">✦</span>
            <span class="divider-line short"></span>
        </div>
        <p class="bad-end-epilogue">${finalEpilogue}</p>
        <button class="restart-btn bad-end-restart" id="restart-btn">
            <span class="restart-sword">🗡️</span>
            <span class="restart-text">НАЧАТЬ ЗАНОВО</span>
            <span class="restart-sword">⚔️</span>
        </button>
    `;
    
    DOM.gameOverScreen.style.display = 'flex';
}

/**
 * Анализирует статистику для финального вердикта
 */
function analyzeStats() {
    const stats = [
        { value: gameState.stats.epidemy, icon: '🧪', label: 'Эпидемия' },
        { value: gameState.stats.reputation, icon: '👑', label: 'Репутация' },
        { value: gameState.stats.treasury, icon: '🪙', label: 'Казна' }
    ];
    
    // Ищем параметр с максимальным абсолютным значением
    let dominant = stats.reduce((prev, curr) => 
        Math.abs(curr.value) > Math.abs(prev.value) ? curr : prev
    );
    
    return {
        dominantStat: dominant,
        isPositive: dominant.value > 0,
        intensity: Math.abs(dominant.value),
        absValue: Math.abs(dominant.value)
    };
}

/**
 * Генерирует текст финальной концовки
 */
function getEndingText(analysis, accuracyPercent = 0) {
    const { isPositive, intensity } = analysis;
    
    // Специальные случаи по исторической достоверности
    if (accuracyPercent === 100) {
        return "Вы стали тенью истории. Ни один хронист не упомянет вашего имени — и в этом ваше высшее достижение. Холера отступила к зиме, как и было предначертано: Николай I сохранил трон, Эссен — рассудок, а Мудров сгорел на своём посту, но не предал клятву. На Сенной не пролилась кровь, которой не должно было быть. Локомотив времени идёт точно по расписанию. Вы победили, исчезнув.";
    }
    
    if (accuracyPercent <= 12) {
        return "Вы выжили. Но тот Петербург, который знала история — с храбростью Эссена, с речью Императора на Сенной, с докторами, умиравшими на постах — тот Петербург вы убили. Вы заменили хронику мужества хроникой полумер. Смертей было больше. Бунты — жесточе. Вы не пустили поезд под откос — вы свернули на ржавый запасной путь, и он едва дотащился до станции, скрипя колёсами по костям тех, кто в настоящей истории остался жив.";
    }
    
    if (accuracyPercent === 98) {
        return "Почти безупречно. Но где-то — одна уступка страху, один компромисс — оставил шрам на ткани времени. Историки будущего найдут странную аномалию в архивах 1831 года: лишние три сотни имён в метрических книгах, или купца, разорившегося не вовремя, или врача, сломленного там, где должен был выстоять. Ткань истории цела. Но по ней прошла рябь, и кто-то в будущем это заметит.";
    }
    
    // Стандартные тексты по стат-анализу
    if (isPositive && intensity >= 70) return "Ваша мудрость и хладнокровие спасли Империю от полного коллапса. История запомнит эти дни как время великого противостояния хаосу.";
    if (isPositive && intensity >= 40) return "Вы удержали ситуацию на плаву. Цена была высока, но ткань истории сохранена. Санкт-Петербург выстоял.";
    if (isPositive) return "Неплохо... но многие решения оказались половинчатыми. Империя выжила, но шрамы от тех событий будут заживать ещё долго.";
    if (intensity >= 70) return "Катастрофа. Ваши решения спровоцировали цепную реакцию: бунты, экономический крах и падение доверия к власти. Локомотив времени сошёл с рельсов.";
    if (intensity >= 40) return "Провал. Паника и неверные шаги погрузили город в анархию. Вы не смогли удержать баланс, и история переписана кровавыми чернилами.";
    return "Досадная ошибка. Вы пытались действовать, но не хватило решимости или знаний. Эпидемия оставила после себя слишком глубокие раны.";
}

/**
 * Показывает финальный вердикт игры
 */
function showFinalVerdict() {
    stopHeartbeat();
    
    const analysis = analyzeStats();
    const { isPositive, intensity } = analysis;
    
    let accuracyPercent = gameState.historicalAccuracy.total > 0 
        ? Math.round((gameState.historicalAccuracy.correct / gameState.historicalAccuracy.total) * 100) 
        : 0;
    
    let accuracyText = "КАТАСТРОФИЧЕСКИ", accuracyColor = "#b85c1a";
    if (accuracyPercent >= 80) { accuracyText = "БЛЕСТЯЩЕ"; accuracyColor = "#c4a747"; }
    else if (accuracyPercent >= 60) { accuracyText = "ХОРОШО"; accuracyColor = "#7cb342"; }
    else if (accuracyPercent >= 40) { accuracyText = "УДОВЛЕТВОРИТЕЛЬНО"; accuracyColor = "#e8b84a"; }
    else if (accuracyPercent >= 20) { accuracyText = "ПЛОХО"; accuracyColor = "#b85c1a"; }
    
    const endingText = getEndingText(analysis, accuracyPercent);
    let endingTitle = "", endingColor = "";
    
    // Специальные заголовки по достоверности
    if (accuracyPercent === 100) {
        endingTitle = "ТКАНЬ ИСТОРИИ СОХРАНЕНА";
        endingColor = "#f5e6c0";
    } else if (accuracyPercent <= 12) {
        endingTitle = "ВЫ ИЗГНАНЫ ИЗ ХРОНИК";
        endingColor = "#6b2f0f";
    } else if (accuracyPercent === 98) {
        endingTitle = "ПОЧТИ. НО НЕ ВПОЛНЕ.";
        endingColor = "#b8a992";
    } else if (isPositive) {
        if (intensity >= 70) { endingTitle = "ВЕЛИКАЯ ПОБЕДА"; endingColor = "#c4a747"; }
        else if (intensity >= 40) { endingTitle = "ДОСТОЙНЫЙ РЕЗУЛЬТАТ"; endingColor = "#7cb342"; }
        else { endingTitle = "НЕПЛОХО... НО МАЛО"; endingColor = "#8a7a60"; }
    } else {
        if (intensity >= 70) { endingTitle = "КАТАСТРОФА"; endingColor = "#b85c1a"; }
        else if (intensity >= 40) { endingTitle = "ПРОВАЛ"; endingColor = "#b85c1a"; }
        else { endingTitle = "ДОСАДНАЯ ОШИБКА"; endingColor = "#8a7a60"; }
    }
    
    const gameOverBox = DOM.gameOverScreen.querySelector('.game-over-box');
    
    const getStatClass = (val, type) => {
        if (type === 'epidemy') return val < 30 ? 'stat-good' : val > 50 ? 'stat-bad' : 'stat-mid';
        if (type === 'reputation') return val > 80 ? 'stat-good' : val < 50 ? 'stat-bad' : 'stat-mid';
        return val > 0 ? 'stat-good' : val < -50 ? 'stat-bad' : 'stat-mid';
    };
    
    gameOverBox.innerHTML = `
        <div class="corner-bl"></div>
        <div class="corner-br"></div>
        <h2 class="final-title" style="color: ${endingColor};">${endingTitle}</h2>
        <div class="final-epilogue"><p>${endingText}</p></div>
        
        <div class="final-divider">
            <span class="divider-line"></span>
            <span class="divider-icon">⚜</span>
            <span class="divider-line"></span>
        </div>
        
        <div class="accuracy-block">
            <div class="accuracy-title">⚜ ИСТОРИЧЕСКАЯ ДОСТОВЕРНОСТЬ ⚜</div>
            <div class="accuracy-percent" style="color: ${accuracyColor};">${accuracyPercent}%</div>
            <div class="accuracy-desc">(${gameState.historicalAccuracy.correct} из ${gameState.historicalAccuracy.total} решений)</div>
        </div>
        
        <div class="final-stats-mini">
            <div class="final-stat-mini">
                <span class="stat-icon">🧪</span>
                <span class="stat-value-mini ${getStatClass(gameState.stats.epidemy, 'epidemy')}">${gameState.stats.epidemy}</span>
                <span class="stat-label-mini">Эпидемия</span>
            </div>
            <div class="final-stat-mini">
                <span class="stat-icon">👑</span>
                <span class="stat-value-mini ${getStatClass(gameState.stats.reputation, 'reputation')}">${gameState.stats.reputation}</span>
                <span class="stat-label-mini">Репутация</span>
            </div>
            <div class="final-stat-mini">
                <span class="stat-icon">🪙</span>
                <span class="stat-value-mini ${getStatClass(gameState.stats.treasury, 'treasury')}">${gameState.stats.treasury}</span>
                <span class="stat-label-mini">Казна</span>
            </div>
        </div>
        
        <button class="restart-btn final-restart" id="restart-btn">
            <span class="restart-text">ПРОДОЛЖИТЬ ХРОНИКИ</span>
        </button>
    `;
    
    DOM.gameOverScreen.style.display = 'flex';
}

/**
 * Перезапускает игру
 */
function restartGame() {
    stopHeartbeat();
    
    // Сброс переменных
    gameState.currentQuestionIndex = 0;
    gameState.stats = { ...CONFIG.INITIAL_STATS };
    gameState.historicalAccuracy = { correct: 0, total: 0 };
    
    // Скрываем экран концовки
    if (DOM.gameOverScreen) DOM.gameOverScreen.style.display = 'none';
    
    // Восстанавливаем карточку
    if (DOM.card) {
        DOM.card.style.display = '';
        DOM.card.style.transition = 'none';
        DOM.card.style.opacity = '1';
        DOM.card.style.transform = 'translateX(0px) scale(1) rotate(0deg)';
        DOM.card.style.pointerEvents = 'auto';
    }
    
    // Сбрасываем плашки выбора
    if (DOM.leftLabel) DOM.leftLabel.style.opacity = 0;
    if (DOM.rightLabel) DOM.rightLabel.style.opacity = 0;
    
    // Обновляем UI
    updateTimelinePosition();
    updateCardContent();
}

// ==========================================================================
// 10. МУЗЫКАЛЬНЫЙ ПЛЕЕР
// ==========================================================================

/**
 * Загружает трек по индексу
 */
function loadTrack(index) {
    if (index < 0) index = CONFIG.TRACKS.length - 1;
    if (index >= CONFIG.TRACKS.length) index = 0;
    
    gameState.currentTrackIndex = index;
    DOM.audio.src = CONFIG.TRACKS[gameState.currentTrackIndex].url;
    DOM.trackNameSpan.textContent = CONFIG.TRACKS[gameState.currentTrackIndex].name;
    
    if (!DOM.audio.paused) {
        DOM.audio.play().catch(() => {});
    }
}

function nextTrack() {
    gameState.currentTrackIndex++;
    if (gameState.currentTrackIndex >= CONFIG.TRACKS.length) gameState.currentTrackIndex = 0;
    loadTrack(gameState.currentTrackIndex);
    DOM.audio.play().catch(() => {});
}

function prevTrack() {
    gameState.currentTrackIndex--;
    if (gameState.currentTrackIndex < 0) gameState.currentTrackIndex = CONFIG.TRACKS.length - 1;
    loadTrack(gameState.currentTrackIndex);
    DOM.audio.play().catch(() => {});
}

/**
 * Устанавливает громкость
 */
function setVolume() {
    const volume = DOM.volumeSlider.value / 100;
    DOM.audio.volume = volume;
    DOM.volumeValue.textContent = `${DOM.volumeSlider.value}%`;
    
    const percent = DOM.volumeSlider.value;
    DOM.volumeSlider.style.background = `linear-gradient(90deg, #d4b872 0%, #d4b872 ${percent}%, rgba(212, 184, 114, 0.15) ${percent}%)`;
    
    syncAllVolumes();
}

/**
 * Синхронизирует громкость всех аудиоэлементов
 */
function syncAllVolumes() {
    const currentVolume = DOM.audio.volume;
    if (DOM.heartbeatSound) {
        DOM.heartbeatSound.volume = currentVolume;
    }
}

// ==========================================================================
// 11. ЗВУК СЕРДЦЕБИЕНИЯ
// ==========================================================================

function startHeartbeat() {
    if (DOM.heartbeatSound && !gameState.isHeartbeatPlaying) {
        DOM.heartbeatSound.volume = DOM.audio.volume;
        DOM.heartbeatSound.currentTime = 0;
        DOM.heartbeatSound.play().catch(e => console.log('Сердцебиение не запустилось:', e));
        gameState.isHeartbeatPlaying = true;
    }
}

function stopHeartbeat() {
    if (DOM.heartbeatSound && gameState.isHeartbeatPlaying) {
        DOM.heartbeatSound.pause();
        DOM.heartbeatSound.currentTime = 0;
        gameState.isHeartbeatPlaying = false;
    }
}

function updateHeartbeat() {
    if (!DOM.heartbeatSound) return;
    
    const currentData = questions[gameState.currentQuestionIndex];
    const isRedCard = currentData && currentData.borderColor === 'red';
    
    if (isRedCard && !gameState.isHeartbeatPlaying) {
        startHeartbeat();
    } else if (!isRedCard && gameState.isHeartbeatPlaying) {
        stopHeartbeat();
    }
}

// ==========================================================================
// 12. ЭФФЕКТЫ (ЧАСТИЦЫ И ПЕЧАТНАЯ МАШИНКА)
// ==========================================================================

/**
 * Создает частицы на стартовом экране
 */
function createParticles() {
    if (!DOM.particlesContainer) return;
    
    for (let i = 0; i < 50; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        const size = Math.random() * 3 + 2;
        p.style.width = p.style.height = size + 'px';
        p.style.left = Math.random() * 100 + '%';
        p.style.animationDuration = (Math.random() * 18 + 10) + 's';
        p.style.animationDelay = '0s';
        DOM.particlesContainer.appendChild(p);
    }
}

/**
 * Эффект печатной машинки для цитат
 */
let quoteIndex = 0;
let charIndex = 0;
let isDeleting = false;

function typeEffect() {
    if (!DOM.typewriterEl) return;
    
    const currentQuote = CONFIG.QUOTES[quoteIndex];
    
    if (!isDeleting) {
        DOM.typewriterEl.textContent = currentQuote.substring(0, charIndex + 1);
        charIndex++;
        
        if (charIndex === currentQuote.length) {
            isDeleting = true;
            setTimeout(typeEffect, 3200);
            return;
        }
    } else {
        DOM.typewriterEl.textContent = currentQuote.substring(0, charIndex - 1);
        charIndex--;
        
        if (charIndex === 0) {
            isDeleting = false;
            quoteIndex = (quoteIndex + 1) % CONFIG.QUOTES.length;
        }
    }
    
    setTimeout(typeEffect, isDeleting ? 30 : 58);
}

// ==========================================================================
// 13. МОДАЛЬНЫЕ ОКНА
// ==========================================================================

function openAboutModal() {
    if (!DOM.aboutModal) return;
    DOM.aboutModal.classList.add('visible');
    document.body.style.overflow = 'hidden';
}

function closeAboutModal() {
    if (!DOM.aboutModal) return;
    DOM.aboutModal.classList.remove('visible');
    setTimeout(() => { document.body.style.overflow = ''; }, 350);
}

function openRulesModal() {
    if (!DOM.rulesModal) return;
    DOM.rulesModal.classList.add('visible');
    document.body.style.overflow = 'hidden';
}

function closeRulesModal() {
    if (!DOM.rulesModal) return;
    DOM.rulesModal.classList.remove('visible');
    setTimeout(() => { document.body.style.overflow = ''; }, 350);
}

// ==========================================================================
// 14. ИНИЦИАЛИЗАЦИЯ И ОБРАБОТЧИКИ СОБЫТИЙ
// ==========================================================================

function initializeGame() {
    // Изначально скрываем основной контент
    if (DOM.mainContent) {
        DOM.mainContent.classList.add('main-content-hidden');
    }
    
    // Блокируем карточку до старта игры
    if (DOM.card) {
        DOM.card.style.pointerEvents = 'none';
        DOM.card.style.opacity = '1';
    }
    
    // Создаем элементы
    createParticles();
    createTimelineLabels();
    preventImageDrag();
    
    // Запускаем эффект печатной машинки с задержкой
    setTimeout(typeEffect, 1200);
    
    // Инициализируем музыкальный плеер
    loadTrack(0);
    DOM.audio.volume = 0.3;
    DOM.volumeSlider.value = 30;
    setVolume();
    
    // Попытка автовоспроизведения
    DOM.audio.play().catch(e => console.log('Автовоспроизведение заблокировано, нажмите на страницу'));
    
    // Добавляем CSS для плавного появления текста
    const style = document.createElement('style');
    style.textContent = `.card-text, .character-name { transition: opacity 0.15s ease; } .card-image img { transition: opacity 0.2s ease; }`;
    document.head.appendChild(style);
}

// ==========================================================================
// 15. ОБРАБОТЧИКИ СОБЫТИЙ
// ==========================================================================

// Кнопка старта игры
if (DOM.playBtn) {
    DOM.playBtn.addEventListener('click', () => {
        preloadAllImages();
        
        // Анимация исчезновения меню
        DOM.startScreen.style.transition = 'opacity 0.8s ease, visibility 0.8s ease';
        DOM.startScreen.style.opacity = '0';
        
        setTimeout(() => {
            DOM.startScreen.style.display = 'none';
            DOM.startScreen.style.visibility = 'hidden';
            
            // Показываем дисклеймер с плавным появлением
            DOM.disclaimerScreen.style.display = 'flex';
            DOM.disclaimerScreen.style.visibility = 'visible';
            DOM.disclaimerScreen.style.opacity = '0';
            
            setTimeout(() => {
                DOM.disclaimerScreen.style.transition = 'opacity 0.8s ease';
                DOM.disclaimerScreen.style.opacity = '1';
            }, 50);
        }, 800);
    });
}

// Клик по кнопке "Нажмите в любом месте"
if (DOM.continueBtn) {
    DOM.continueBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        hideDisclaimerAndStart();
    });
}

// Клик в любом месте экрана дисклеймера
if (DOM.disclaimerScreen) {
    DOM.disclaimerScreen.addEventListener('click', (e) => {
        if (!DOM.continueBtn.contains(e.target)) {
            hideDisclaimerAndStart();
        }
    });
}

// Перетаскивание карточки (мышь и палец)
if (DOM.card) {
    DOM.card.addEventListener('mousedown', handleDragStart);
    DOM.card.addEventListener('touchstart', handleDragStart, { passive: false });
}
document.addEventListener('mousemove', handleDragMove);
document.addEventListener('touchmove', handleDragMove, { passive: false });
document.addEventListener('mouseup', handleDragEnd);
document.addEventListener('touchend', handleDragEnd);

// Музыкальный плеер
if (DOM.playerIcon) {
    DOM.playerIcon.addEventListener('click', () => {
        if (DOM.playerPanel.style.display === 'none') {
            DOM.playerPanel.style.display = 'block';
        } else {
            DOM.playerPanel.style.display = 'none';
        }
    });
}

if (DOM.prevTrackBtn) DOM.prevTrackBtn.addEventListener('click', prevTrack);
if (DOM.nextTrackBtn) DOM.nextTrackBtn.addEventListener('click', nextTrack);
if (DOM.volumeSlider) DOM.volumeSlider.addEventListener('input', setVolume);

DOM.audio.addEventListener('ended', () => {
    DOM.audio.currentTime = 0;
    DOM.audio.play().catch(() => {});
});

// Модальные окна
if (DOM.aboutBtn) DOM.aboutBtn.addEventListener('click', openAboutModal);
if (DOM.closeAboutBtn) DOM.closeAboutBtn.addEventListener('click', closeAboutModal);
if (DOM.rulesBtn) DOM.rulesBtn.addEventListener('click', openRulesModal);
if (DOM.closeRulesBtn) DOM.closeRulesBtn.addEventListener('click', closeRulesModal);

// Закрытие модалок по клику на фон
if (DOM.aboutModal) {
    DOM.aboutModal.addEventListener('click', (e) => {
        if (e.target === DOM.aboutModal) closeAboutModal();
    });
}

if (DOM.rulesModal) {
    DOM.rulesModal.addEventListener('click', (e) => {
        if (e.target === DOM.rulesModal) closeRulesModal();
    });
}

// Делегирование клика по кнопке рестарта
document.addEventListener('click', (e) => {
    if (e.target.closest('.restart-btn')) {
        e.preventDefault();
        e.stopPropagation();
        restartGame();
    }
});

// Закрытие модалок по клавише ESC
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (DOM.aboutModal?.classList.contains('visible')) closeAboutModal();
        if (DOM.rulesModal?.classList.contains('visible')) closeRulesModal();
    }
});

// Пересчитываем позицию маркера при повороте экрана или ресайзе
window.addEventListener('resize', () => {
    clearTimeout(window.resizeTimer);
    window.resizeTimer = setTimeout(updateTimelinePosition, 100);
});

// ==========================================================================
// 16. РЕЖИМ РАЗРАБОТЧИКА (DEV MODE)
// ==========================================================================

document.addEventListener('keydown', (e) => {
    // Нажмите F (или А на русской раскладке) для мгновенного перехода к финалу
    if (e.key === 'f' || e.key === 'F' || e.key === 'а' || e.key === 'А') {
        console.log('⚡ Прыжок к финалу (dev mode)');
        
        // Устанавливаем тестовые статы (меняйте под нужную концовку)
        gameState.stats.epidemy = -50;
        gameState.stats.reputation = -70;
        gameState.stats.treasury = -30;
        gameState.historicalAccuracy = { correct: 51, total: 51 };
        gameState.currentQuestionIndex = questions.length;
        
        if (DOM.card) DOM.card.style.display = 'none';
        showFinalVerdict();
    }
    
    // Клавиша B — мгновенный Bad End
    if (e.key === 'b' || e.key === 'B' || e.key === 'и' || e.key === 'И') {
        console.log('💀 Прыжок к Bad End (dev mode)');
        showBadEnd('Тестовый bad end для отладки', 'Нажата клавиша B');
    }
});

// ==========================================================================
// 17. ЗАПУСК ИГРЫ
// ==========================================================================

initializeGame();
setTimeout(() => {
    syncAllVolumes();
    updateHeartbeat();
}, 100);
