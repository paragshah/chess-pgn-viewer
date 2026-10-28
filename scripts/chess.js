let replay = null;

document.addEventListener("DOMContentLoaded", () => {
    init();
});

function init() {
    const pieces = [
        [
            new ChessPiece(PIECE.P1_ROOK),
            new ChessPiece(PIECE.P1_KNIGHT),
            new ChessPiece(PIECE.P1_BISHOP),
            new ChessPiece(PIECE.P1_QUEEN),
            new ChessPiece(PIECE.P1_KING),
            new ChessPiece(PIECE.P1_BISHOP),
            new ChessPiece(PIECE.P1_KNIGHT),
            new ChessPiece(PIECE.P1_ROOK)
        ],
        [
            new ChessPiece(PIECE.P1_PAWN),
            new ChessPiece(PIECE.P1_PAWN),
            new ChessPiece(PIECE.P1_PAWN),
            new ChessPiece(PIECE.P1_PAWN),
            new ChessPiece(PIECE.P1_PAWN),
            new ChessPiece(PIECE.P1_PAWN),
            new ChessPiece(PIECE.P1_PAWN),
            new ChessPiece(PIECE.P1_PAWN)
        ],
        [],[],[],[],
        [
            new ChessPiece(PIECE.P2_PAWN),
            new ChessPiece(PIECE.P2_PAWN),
            new ChessPiece(PIECE.P2_PAWN),
            new ChessPiece(PIECE.P2_PAWN),
            new ChessPiece(PIECE.P2_PAWN),
            new ChessPiece(PIECE.P2_PAWN),
            new ChessPiece(PIECE.P2_PAWN),
            new ChessPiece(PIECE.P2_PAWN)
        ],
        [
            new ChessPiece(PIECE.P2_ROOK),
            new ChessPiece(PIECE.P2_KNIGHT),
            new ChessPiece(PIECE.P2_BISHOP),
            new ChessPiece(PIECE.P2_QUEEN),
            new ChessPiece(PIECE.P2_KING),
            new ChessPiece(PIECE.P2_BISHOP),
            new ChessPiece(PIECE.P2_KNIGHT),
            new ChessPiece(PIECE.P2_ROOK)
        ]
    ];

    setupBoard(pieces);
    loadSavedTheme();
    setTheme();
    setEvents();
    setupReplayControls();
    setupSettings();
    syncSidePanelToBoard();
    window.addEventListener('resize', syncSidePanelToBoard);
}

function setupBoard(pieces) {
    const boardRowEls = document.querySelectorAll(".board-row");

    if (boardRowEls.length !== 8) {
        console.error("Unable to setup pieces. Bad board render.");
        return;
    }

    for (let i = 0; i < pieces.length; i++) {
        const pieceEls = boardRowEls[i].querySelectorAll(".board-square");

        if (pieceEls.length !== 8) {
            console.error("Unable to setup pieces. Bad board render for pieces.");
            return;
        }

        for (let j = 0; j < pieces[i].length; j++) {
            const pos = pieces[i][j].type;

            if (pos === PIECE.P1_PAWN || pos === PIECE.P2_PAWN) {
                template = document.querySelector("#pawn");
            }
            else if (pos === PIECE.P1_ROOK || pos === PIECE.P2_ROOK) {
                template = document.querySelector("#rook");
            }
            else if (pos === PIECE.P1_KNIGHT || pos === PIECE.P2_KNIGHT) {
                template = document.querySelector("#knight");
            }
            else if (pos == PIECE.P1_BISHOP || pos == PIECE.P2_BISHOP) {
                template = document.querySelector("#bishop");
            }
            else if (pos == PIECE.P1_QUEEN || pos == PIECE.P2_QUEEN) {
                template = document.querySelector("#queen");
            }
            else if (pos == PIECE.P1_KING || pos == PIECE.P2_KING) {
                template = document.querySelector("#king");
            }

            if (template) {
                const clone = template.content.cloneNode(true);
                clone.firstElementChild.dataset.val = pos;
                pieceEls[j].appendChild(clone);
            } else {
                pieceEls[j].innerHTML = "";
            }
        }
    }
}

function setTheme() {
    document.body.style.backgroundColor = THEME.BOARD_BACKGROUND;

    const darkEls = document.querySelectorAll(".board-dark");
    darkEls.forEach((el) => {
        el.style.backgroundColor = THEME.DARK_SQUARE_BACKGROUND;
    });

    const lightEls = document.querySelectorAll(".board-light");
    lightEls.forEach((el) => {
        el.style.backgroundColor = THEME.LIGHT_SQUARE_BACKGROUND;
    });

    const boardEl = document.querySelector(".board");
    const pieceContainerEls = boardEl?.querySelectorAll(".piece-container");
    pieceContainerEls.forEach((el) => {
        const val = el.dataset["val"];
        if (val) {
            const svgEl = el.querySelector("svg");
            svgEl.style.fill = (val >= 1 && val <= 6)
                ? THEME.PLAYER_1_COLOR
                : THEME.PLAYER_2_COLOR;
        } else {
            console.error("Cannot set theme. Missing piece data value");
        }
    });

    // Apply theme to captured pieces
    const capturedPieceEls = document.querySelectorAll('.captured-pieces .piece-container');
    capturedPieceEls.forEach((el) => {
        const val = el.dataset['val'];
        if (val) {
            const svgEl = el.querySelector('svg');
            if (svgEl) {
                svgEl.style.fill = (val >= 1 && val <= 6)
                    ? THEME.PLAYER_1_COLOR
                    : THEME.PLAYER_2_COLOR;
            }
        }
    });

    // Apply accent and UI colors
    const root = document.documentElement;
    root.style.setProperty('--accent', THEME.ACCENT_COLOR);
    root.style.setProperty('--accent-hover', THEME.ACCENT_HOVER);
    root.style.setProperty('--accent-disabled', THEME.ACCENT_DISABLED);
    root.style.setProperty('--move-hover-bg', THEME.MOVE_HOVER_BG);
    root.style.setProperty('--upload-border', THEME.UPLOAD_BORDER);
    root.style.setProperty('--text-color', THEME.TEXT_COLOR);
    root.style.setProperty('--text-muted', THEME.TEXT_MUTED);
    root.style.setProperty('--panel-bg', THEME.PANEL_BG);
    root.style.setProperty('--panel-border', THEME.PANEL_BORDER);
    root.style.setProperty('--focus-border', THEME.PIECE_FOCUS_BORDER_COLOR);
    root.style.setProperty('--highlight-border', THEME.HIGHLIGHT_BORDER);
    root.style.setProperty('--highlight-bg', THEME.HIGHLIGHT_BG);
}

function setEvents() {
    const boardSquareEls = document.querySelectorAll(".board-square");
    boardSquareEls.forEach((el) => {
        el.addEventListener("click", handleBoardClick);
    });
}

function handleBoardClick(ev) {
    setFocusForTarget(ev.target);
}

function setFocusForTarget(targetElement) {
    const boardSquareEls = document.querySelectorAll(".board-square");
    boardSquareEls.forEach((el) => {
        if (el.querySelector(".piece-container") === targetElement) {
            el.classList.toggle("focus");
        } else {
            el.classList.remove("focus");
        }
    });

    while (targetElement && !targetElement.classList.contains("board-square")) {
        targetElement = targetElement.parentElement;
    }

    if (targetElement) {
        let row = targetElement.dataset["row"];
        let col = targetElement.dataset["col"];
        let square = targetElement.dataset["square"];

        const pieceContainerEl = targetElement.querySelector(".piece-container");

        if (pieceContainerEl) {
            const piece = Number(pieceContainerEl.dataset["val"]);
            if (piece >= PIECE.P1_PAWN && piece <= PIECE.P2_KING) {
                const chessPiece = new ChessPiece(piece);
                const chessPlayer = chessPiece.isPrimaryPlayer()
                    ? "P1" : "P2";

                console.log(chessPlayer + ": " + chessPiece.name + ", " + square + ", (" + row + "," + col + ")");
            }
        }
        else {
            console.log("Empty square, " + square + ", (" + row + "," + col + ")");
        }
    }
    else {
        console.log("Clicked on empty board square");
    }
}

function setupReplayControls() {
    replay = new ReplayController();

    // File upload button
    const uploadBtn = document.getElementById('btn-upload');
    const fileInput = document.getElementById('pgn-file-input');

    uploadBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) loadPGNFile(file);
    });

    // Drag and drop
    const uploadArea = document.getElementById('pgn-upload-area');
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('drag-over');
    });
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('drag-over');
    });
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (file && file.name.endsWith('.pgn')) {
            loadPGNFile(file);
        }
    });

    // Game selector
    const gameSelector = document.getElementById('game-selector');
    gameSelector.addEventListener('change', (e) => {
        const index = parseInt(e.target.value);
        replay.loadGame(index);
    });

    // Replay buttons
    document.getElementById('btn-start').addEventListener('click', () => replay.goToStart());
    document.getElementById('btn-prev').addEventListener('click', () => replay.stepBackward());
    document.getElementById('btn-play').addEventListener('click', () => replay.toggleAutoplay());
    document.getElementById('btn-next').addEventListener('click', () => replay.stepForward());
    document.getElementById('btn-end').addEventListener('click', () => replay.goToEnd());

    // Speed slider
    const speedSlider = document.getElementById('speed-slider');
    const speedLabel = document.getElementById('speed-label');
    speedSlider.addEventListener('input', () => {
        const ms = parseInt(speedSlider.value);
        replay.setSpeed(ms);
        speedLabel.textContent = (ms / 1000).toFixed(1) + 's';
    });

    // Keyboard controls
    document.addEventListener('keydown', (e) => {
        if (!replay || replay.moves.length === 0) return;
        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            replay.stepBackward();
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            replay.stepForward();
        } else if (e.key === ' ') {
            e.preventDefault();
            replay.toggleAutoplay();
        } else if (e.key === 'Home') {
            e.preventDefault();
            replay.goToStart();
        } else if (e.key === 'End') {
            e.preventDefault();
            replay.goToEnd();
        }
    });
}

function loadPGNFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const pgnText = e.target.result;
        replay.loadPGN(pgnText);

        // Show move list and enable play button
        document.querySelector('.move-list-container').classList.add('loaded');
        document.getElementById('btn-play').disabled = false;
        document.getElementById('btn-next').disabled = false;
        document.getElementById('btn-end').disabled = false;
    };
    reader.readAsText(file);
}

function loadSavedTheme() {
    const saved = localStorage.getItem('chess-theme');
    if (saved && THEMES[saved]) {
        THEME = { ...THEMES[saved] };
    }
}

function applyTheme(themeKey) {
    if (!THEMES[themeKey]) return;
    THEME = { ...THEMES[themeKey] };
    localStorage.setItem('chess-theme', themeKey);
    setTheme();
    renderThemeList();
}

function setupSettings() {
    const overlay = document.getElementById('settings-overlay');
    const btnOpen = document.getElementById('btn-settings');
    const btnClose = document.getElementById('btn-settings-close');

    btnOpen.addEventListener('click', () => {
        overlay.classList.remove('hidden');
        renderThemeList();
    });

    btnClose.addEventListener('click', () => overlay.classList.add('hidden'));

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.classList.add('hidden');
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !overlay.classList.contains('hidden')) {
            overlay.classList.add('hidden');
        }
    });
}

function renderThemeList() {
    const container = document.getElementById('theme-list');
    const currentKey = localStorage.getItem('chess-theme') || 'ocean';
    container.innerHTML = '';

    for (const [key, theme] of Object.entries(THEMES)) {
        const option = document.createElement('div');
        option.className = 'theme-option' + (key === currentKey ? ' active' : '');
        option.innerHTML = `
            <div class="theme-preview">
                <div class="theme-preview-square" style="background:${theme.LIGHT_SQUARE_BACKGROUND}"></div>
                <div class="theme-preview-square" style="background:${theme.DARK_SQUARE_BACKGROUND}"></div>
                <div class="theme-preview-square" style="background:${theme.DARK_SQUARE_BACKGROUND}"></div>
                <div class="theme-preview-square" style="background:${theme.LIGHT_SQUARE_BACKGROUND}"></div>
            </div>
            <div class="theme-info">
                <div class="theme-name">${theme.name}</div>
                <div class="theme-pieces">
                    <div class="theme-piece-dot" style="background:${theme.PLAYER_1_COLOR}"></div>
                    <div class="theme-piece-dot" style="background:${theme.PLAYER_2_COLOR}"></div>
                </div>
            </div>
        `;
        option.addEventListener('click', () => applyTheme(key));
        container.appendChild(option);
    }
}

function syncSidePanelToBoard() {
    const boardContainer = document.querySelector('.board-container');
    const sidePanel = document.querySelector('.side-panel');
    const moveListContainer = document.querySelector('.move-list-container');
    const boardRows = document.querySelectorAll('.board-row');

    if (!boardContainer || !sidePanel || !moveListContainer || boardRows.length < 8) return;

    const containerRect = boardContainer.getBoundingClientRect();
    const firstRowRect = boardRows[0].getBoundingClientRect();
    const lastRowRect = boardRows[7].getBoundingClientRect();

    const topOffset = firstRowRect.top - containerRect.top;
    const boardHeight = lastRowRect.bottom - firstRowRect.top;

    sidePanel.style.marginTop = topOffset + 'px';
    moveListContainer.style.height = boardHeight + 'px';
    moveListContainer.style.flex = 'none';
}

class ChessPiece {
    type = 0;
    hasMadeFirstMove = false;

    constructor(type) {
        this.type = type;
        this.name = this.label();
    }

    label() {
        if (this.type == PIECE.P1_PAWN || this.type == PIECE.P2_PAWN)     { return "pawn"; }
        if (this.type == PIECE.P1_ROOK || this.type == PIECE.P2_ROOK)     { return "rook"; }
        if (this.type == PIECE.P1_KNIGHT || this.type == PIECE.P2_KNIGHT) { return "knight"; }
        if (this.type == PIECE.P1_BISHOP || this.type == PIECE.P2_BISHOP) { return "bishop"; }
        if (this.type == PIECE.P1_QUEEN || this.type == PIECE.P2_QUEEN)   { return "queen"; }
        if (this.type == PIECE.P1_KING || this.type == PIECE.P2_KING)     { return "king"; }
    }

    isPrimaryPlayer() {
        return
            this.type >= PIECE.P1_PAWN &&
            this.type <= PIECE.P1_KING;
    }
}
