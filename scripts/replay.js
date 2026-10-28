class ReplayController {
    constructor() {
        this.boardState = null;
        this.moves = [];
        this.headers = {};
        this.currentMoveIndex = -1; // -1 = starting position
        this.savedStates = [];      // board states at each point
        this.autoplayTimer = null;
        this.autoplaySpeed = 1000;  // ms between moves
        this.animating = false;
        this.animationDuration = 300; // ms, default duration
        this.finishAnimation = null;  // callable to force-finish current animation
        this.games = [];              // all parsed games from PGN
        this.currentGameIndex = 0;
    }

    loadPGN(pgnText) {
        this.games = PGNParser.parseMultiple(pgnText);
        this.currentGameIndex = 0;
        this.updateGameSelector();
        this.loadGame(0);
    }

    loadGame(index) {
        if (index < 0 || index >= this.games.length) return;
        if (this.animating && this.finishAnimation) this.finishAnimation();
        this.stopAutoplay();
        this.clearHighlights();
        this.currentGameIndex = index;
        const game = this.games[index];
        this.moves = game.moves;
        this.headers = game.headers;
        this.boardState = new BoardState();
        this.currentMoveIndex = -1;
        this.savedStates = [this.boardState.saveState()];

        // Pre-compute all states
        const tempState = new BoardState();
        for (let i = 0; i < this.moves.length; i++) {
            const result = tempState.applyMove(this.moves[i]);
            if (!result) {
                console.error(`Failed to apply move ${i + 1}: ${this.moves[i]}`);
                this.moves = this.moves.slice(0, i);
                break;
            }
            this.savedStates.push(tempState.saveState());
        }

        this.renderBoard();
        this.updateUI();
        this.updateMoveList();
    }

    updateGameSelector() {
        const selector = document.getElementById('game-selector');
        const container = document.getElementById('game-selector-container');
        if (!selector || !container) return;

        if (this.games.length <= 1) {
            container.classList.add('hidden');
            return;
        }

        container.classList.remove('hidden');
        selector.innerHTML = '';

        for (let i = 0; i < this.games.length; i++) {
            const game = this.games[i];
            const white = game.headers.White || 'Unknown';
            const black = game.headers.Black || 'Unknown';
            const event = game.headers.Event || '';
            const date = game.headers.Date || '';
            const result = game.headers.Result || '';

            let label = `Game ${i + 1}: ${white} vs ${black}`;
            if (event) label += ` - ${event}`;
            if (date) label += ` (${date})`;
            if (result) label += ` [${result}]`;

            const option = document.createElement('option');
            option.value = i;
            option.textContent = label;
            selector.appendChild(option);
        }

        selector.value = this.currentGameIndex;
    }

    stepForward() {
        if (this.currentMoveIndex >= this.moves.length - 1) {
            this.stopAutoplay();
            return false;
        }
        if (this.animating && this.finishAnimation) this.finishAnimation();

        // Resolve move info from current state before advancing
        const moveInfo = this.getMoveInfo(this.currentMoveIndex + 1);

        this.currentMoveIndex++;
        this.boardState.restoreState(this.savedStates[this.currentMoveIndex + 1]);

        if (moveInfo) {
            this.animateMove(moveInfo);
        } else {
            this.renderBoard();
        }

        this.highlightLastMove();
        this.updateUI();
        return true;
    }

    stepBackward() {
        if (this.currentMoveIndex < 0) return false;
        if (this.animating && this.finishAnimation) this.finishAnimation();

        // Resolve the current move in reverse (piece goes back to its origin)
        const moveInfo = this.getMoveInfo(this.currentMoveIndex);
        let reverseInfo = null;
        if (moveInfo) {
            reverseInfo = { from: moveInfo.to, to: moveInfo.from };
            if (moveInfo.castling) {
                reverseInfo.rookFrom = moveInfo.rookTo;
                reverseInfo.rookTo = moveInfo.rookFrom;
                reverseInfo.castling = moveInfo.castling;
            }
        }

        this.currentMoveIndex--;
        this.boardState.restoreState(this.savedStates[this.currentMoveIndex + 1]);

        if (reverseInfo) {
            this.animateMove(reverseInfo);
        } else {
            this.renderBoard();
        }

        this.highlightLastMove();
        this.updateUI();
        return true;
    }

    goToStart() {
        this.stopAutoplay();
        this.currentMoveIndex = -1;
        this.boardState.restoreState(this.savedStates[0]);
        this.renderBoard();
        this.clearHighlights();
        this.updateUI();
    }

    goToEnd() {
        this.stopAutoplay();
        this.currentMoveIndex = this.moves.length - 1;
        this.boardState.restoreState(this.savedStates[this.currentMoveIndex + 1]);
        this.renderBoard();
        this.highlightLastMove();
        this.updateUI();
    }

    toggleAutoplay() {
        if (this.autoplayTimer) {
            this.stopAutoplay();
        } else {
            this.startAutoplay();
        }
    }

    startAutoplay() {
        if (this.currentMoveIndex >= this.moves.length - 1) {
            // If at the end, restart from beginning
            this.goToStart();
        }
        this.autoplayTimer = setInterval(() => {
            if (!this.stepForward()) {
                this.stopAutoplay();
            }
        }, this.autoplaySpeed);
        this.updatePlayButton(true);
    }

    stopAutoplay() {
        if (this.autoplayTimer) {
            clearInterval(this.autoplayTimer);
            this.autoplayTimer = null;
        }
        this.updatePlayButton(false);
    }

    setSpeed(ms) {
        this.autoplaySpeed = ms;
        if (this.autoplayTimer) {
            this.stopAutoplay();
            this.startAutoplay();
        }
    }

    getMoveInfo(moveIndex) {
        if (moveIndex < 0 || moveIndex >= this.moves.length) return null;
        const prevState = new BoardState();
        prevState.restoreState(this.savedStates[moveIndex]);
        return prevState.resolveMove(this.moves[moveIndex].replace(/[+#]/, ''));
    }

    animateMove(moveInfo) {
        const board = document.querySelector('.board');
        const fromSquare = BoardState.posToSquare(moveInfo.from[0], moveInfo.from[1]);
        const toSquare = BoardState.posToSquare(moveInfo.to[0], moveInfo.to[1]);
        const fromEl = document.querySelector(`[data-square="${fromSquare}"]`);
        const toEl = document.querySelector(`[data-square="${toSquare}"]`);

        if (!fromEl || !toEl) {
            this.renderBoard();
            return;
        }

        // Get the piece element at the source before re-rendering
        const pieceContainer = fromEl.querySelector('.piece-container');
        if (!pieceContainer) {
            this.renderBoard();
            return;
        }

        // Scale animation duration: use 60% of autoplay speed, capped to default
        const duration = this.autoplayTimer
            ? Math.min(this.animationDuration, this.autoplaySpeed * 0.6)
            : this.animationDuration;

        // Capture positions relative to the board
        const boardRect = board.getBoundingClientRect();
        const fromRect = fromEl.getBoundingClientRect();
        const toRect = toEl.getBoundingClientRect();
        const squareSize = fromRect.width;

        // Clone the piece for animation
        const clone = pieceContainer.cloneNode(true);
        clone.classList.add('piece-animate');
        clone.classList.remove('piece-container');
        clone.style.transitionDuration = duration + 'ms';
        clone.style.width = squareSize + 'px';
        clone.style.height = squareSize + 'px';
        clone.style.left = (fromRect.left - boardRect.left) + 'px';
        clone.style.top = (fromRect.top - boardRect.top) + 'px';
        clone.style.transform = 'translate(0, 0)';

        // Handle castling - animate rook too
        let rookClone = null;
        let rookDx = 0, rookDy = 0;
        if (moveInfo.castling && moveInfo.rookFrom && moveInfo.rookTo) {
            const rookFromSquare = BoardState.posToSquare(moveInfo.rookFrom[0], moveInfo.rookFrom[1]);
            const rookToSquare = BoardState.posToSquare(moveInfo.rookTo[0], moveInfo.rookTo[1]);
            const rookFromEl = document.querySelector(`[data-square="${rookFromSquare}"]`);
            const rookToEl = document.querySelector(`[data-square="${rookToSquare}"]`);
            const rookPiece = rookFromEl?.querySelector('.piece-container');

            if (rookPiece && rookFromEl && rookToEl) {
                const rookFromRect = rookFromEl.getBoundingClientRect();
                const rookToRect = rookToEl.getBoundingClientRect();
                rookDx = rookToRect.left - rookFromRect.left;
                rookDy = rookToRect.top - rookFromRect.top;

                rookClone = rookPiece.cloneNode(true);
                rookClone.classList.add('piece-animate');
                rookClone.classList.remove('piece-container');
                rookClone.style.transitionDuration = duration + 'ms';
                rookClone.style.width = squareSize + 'px';
                rookClone.style.height = squareSize + 'px';
                rookClone.style.left = (rookFromRect.left - boardRect.left) + 'px';
                rookClone.style.top = (rookFromRect.top - boardRect.top) + 'px';
                rookClone.style.transform = 'translate(0, 0)';
            }
        }

        // Re-render board to final state, then hide the destination pieces
        this.renderBoard();

        const destPiece = toEl.querySelector('.piece-container');
        if (destPiece) destPiece.style.opacity = '0';

        if (moveInfo.castling && moveInfo.rookTo) {
            const rookDestSquare = BoardState.posToSquare(moveInfo.rookTo[0], moveInfo.rookTo[1]);
            const rookDestEl = document.querySelector(`[data-square="${rookDestSquare}"]`);
            const rookDestPiece = rookDestEl?.querySelector('.piece-container');
            if (rookDestPiece) rookDestPiece.style.opacity = '0';
        }

        // Append clones and trigger animation
        board.appendChild(clone);
        if (rookClone) board.appendChild(rookClone);

        this.animating = true;

        requestAnimationFrame(() => {
            const dx = toRect.left - fromRect.left;
            const dy = toRect.top - fromRect.top;
            clone.style.transform = `translate(${dx}px, ${dy}px)`;

            if (rookClone) {
                rookClone.style.transform = `translate(${rookDx}px, ${rookDy}px)`;
            }
        });

        // Clean up after animation
        let cleaned = false;
        const cleanup = () => {
            if (cleaned) return;
            cleaned = true;
            clone.remove();
            if (rookClone) rookClone.remove();

            if (destPiece) {
                destPiece.style.opacity = '';
                destPiece.classList.add('piece-fade-in');
            }

            if (moveInfo.castling && moveInfo.rookTo) {
                const rookDestSquare = BoardState.posToSquare(moveInfo.rookTo[0], moveInfo.rookTo[1]);
                const rookDestEl = document.querySelector(`[data-square="${rookDestSquare}"]`);
                const rookDestPiece = rookDestEl?.querySelector('.piece-container');
                if (rookDestPiece) {
                    rookDestPiece.style.opacity = '';
                    rookDestPiece.classList.add('piece-fade-in');
                }
            }

            this.animating = false;
            this.finishAnimation = null;
        };

        this.finishAnimation = cleanup;
        clone.addEventListener('transitionend', cleanup, { once: true });

        // Fallback in case transitionend doesn't fire
        setTimeout(cleanup, duration + 50);
    }

    renderBoard() {
        const pieceArray = this.boardState.toPieceArray();
        const boardRowEls = document.querySelectorAll(".board-row");

        for (let i = 0; i < 8; i++) {
            const squareEls = boardRowEls[i].querySelectorAll(".board-square");
            for (let j = 0; j < 8; j++) {
                // Clear existing piece
                const existing = squareEls[j].querySelector(".piece-container");
                const existingFocus = squareEls[j].querySelector(".piece-focus");
                if (existing) existing.remove();
                if (existingFocus) existingFocus.remove();

                const pieceVal = pieceArray[i][j];
                if (pieceVal !== null) {
                    const templateId = this.getTemplateId(pieceVal);
                    const template = document.querySelector(`#${templateId}`);
                    if (template) {
                        const clone = template.content.cloneNode(true);
                        clone.firstElementChild.dataset.val = pieceVal;
                        squareEls[j].appendChild(clone);
                    }
                }
            }
        }

        setTheme();
        this.renderCapturedPieces();
    }

    renderCapturedPieces() {
        const topEl = document.getElementById('captured-top');
        const bottomEl = document.getElementById('captured-bottom');
        if (!topEl || !bottomEl) return;

        // Walk through moves up to current index to collect captures
        const whiteCapturedRaw = []; // white pieces taken by black
        const blackCapturedRaw = []; // black pieces taken by white

        for (let i = 0; i <= this.currentMoveIndex; i++) {
            const moveInfo = this.getMoveInfo(i);
            if (moveInfo && moveInfo.captured) {
                const cap = moveInfo.captured;
                // Uppercase = white piece captured, lowercase = black piece captured
                if (cap >= 'A' && cap <= 'Z') {
                    whiteCapturedRaw.push(cap);
                } else {
                    blackCapturedRaw.push(cap);
                }
            }
        }

        // Sort captures by piece value: Q, R, B, N, P
        const pieceRank = { 'Q': 0, 'R': 1, 'B': 2, 'N': 3, 'P': 4 };
        const sortFn = (a, b) => (pieceRank[a.toUpperCase()] ?? 5) - (pieceRank[b.toUpperCase()] ?? 5);

        const whiteCaptured = whiteCapturedRaw.sort(sortFn);
        const blackCaptured = blackCapturedRaw.sort(sortFn);

        // Map piece chars to PIECE constants for template lookup
        const charToVal = {
            'P': PIECE.P1_PAWN, 'R': PIECE.P1_ROOK, 'N': PIECE.P1_KNIGHT,
            'B': PIECE.P1_BISHOP, 'Q': PIECE.P1_QUEEN, 'K': PIECE.P1_KING,
            'p': PIECE.P2_PAWN, 'r': PIECE.P2_ROOK, 'n': PIECE.P2_KNIGHT,
            'b': PIECE.P2_BISHOP, 'q': PIECE.P2_QUEEN, 'k': PIECE.P2_KING,
        };

        const renderPieces = (container, pieces) => {
            container.innerHTML = '';
            for (const p of pieces) {
                const templateId = this.getTemplateId(charToVal[p]);
                const template = document.querySelector(`#${templateId}`);
                if (template) {
                    const wrapper = document.createElement('div');
                    wrapper.className = 'captured-piece';
                    const clone = template.content.cloneNode(true);
                    const pieceContainer = clone.querySelector('.piece-container');
                    if (pieceContainer) {
                        pieceContainer.dataset.val = charToVal[p];
                    }
                    // Remove piece-focus element for captured display
                    const focus = clone.querySelector('.piece-focus');
                    if (focus) focus.remove();
                    wrapper.appendChild(clone);
                    container.appendChild(wrapper);
                }
            }
        };

        renderPieces(topEl, whiteCaptured);
        renderPieces(bottomEl, blackCaptured);

        // Apply theme colors to captured pieces
        this.themeCapturedPieces();
    }

    themeCapturedPieces() {
        const containers = document.querySelectorAll('.captured-pieces .piece-container');
        containers.forEach((el) => {
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
    }

    getTemplateId(pieceVal) {
        if (pieceVal === PIECE.P1_PAWN || pieceVal === PIECE.P2_PAWN) return 'pawn';
        if (pieceVal === PIECE.P1_ROOK || pieceVal === PIECE.P2_ROOK) return 'rook';
        if (pieceVal === PIECE.P1_KNIGHT || pieceVal === PIECE.P2_KNIGHT) return 'knight';
        if (pieceVal === PIECE.P1_BISHOP || pieceVal === PIECE.P2_BISHOP) return 'bishop';
        if (pieceVal === PIECE.P1_QUEEN || pieceVal === PIECE.P2_QUEEN) return 'queen';
        if (pieceVal === PIECE.P1_KING || pieceVal === PIECE.P2_KING) return 'king';
        return null;
    }

    highlightLastMove() {
        this.clearHighlights();
        if (this.currentMoveIndex < 0) return;

        // Reconstruct move info from saved states to get from/to squares
        const prevState = new BoardState();
        prevState.restoreState(this.savedStates[this.currentMoveIndex]);
        const moveInfo = prevState.resolveMove(
            this.moves[this.currentMoveIndex].replace(/[+#]/, '')
        );

        if (moveInfo) {
            const fromSquare = BoardState.posToSquare(moveInfo.from[0], moveInfo.from[1]);
            const toSquare = BoardState.posToSquare(moveInfo.to[0], moveInfo.to[1]);

            const fromEl = document.querySelector(`[data-square="${fromSquare}"]`);
            const toEl = document.querySelector(`[data-square="${toSquare}"]`);

            if (fromEl) fromEl.classList.add('highlight-from');
            if (toEl) toEl.classList.add('highlight-to');
        }
    }

    clearHighlights() {
        document.querySelectorAll('.highlight-from, .highlight-to').forEach(el => {
            el.classList.remove('highlight-from', 'highlight-to');
        });
    }

    describeMoveInEnglish(san, moveIndex) {
        const color = moveIndex % 2 === 0 ? 'White' : 'Black';
        const isCheck = san.includes('+');
        const isCheckmate = san.includes('#');
        const cleanSan = san.replace(/[+#]/g, '');

        // Castling
        if (cleanSan === 'O-O') {
            let desc = `${color} castles kingside`;
            if (isCheckmate) desc += ', checkmate';
            else if (isCheck) desc += ', check';
            return desc;
        }
        if (cleanSan === 'O-O-O') {
            let desc = `${color} castles queenside`;
            if (isCheckmate) desc += ', checkmate';
            else if (isCheck) desc += ', check';
            return desc;
        }

        const pieceNames = { K: 'king', Q: 'queen', R: 'rook', B: 'bishop', N: 'knight' };
        let pieceName;
        let rest;

        if (cleanSan[0] >= 'A' && cleanSan[0] <= 'Z') {
            pieceName = pieceNames[cleanSan[0]];
            rest = cleanSan.substring(1);
        } else {
            pieceName = 'pawn';
            rest = cleanSan;
        }

        const isCapture = rest.includes('x');
        rest = rest.replace('x', '');

        // Check for promotion
        let promotion = null;
        const promoMatch = rest.match(/=([QRBN])$/);
        if (promoMatch) {
            promotion = pieceNames[promoMatch[1]];
            rest = rest.replace(/=[QRBN]$/, '');
        }

        // Destination is last two chars
        const dest = rest.slice(-2).toUpperCase();

        let desc = `${color} ${pieceName}`;
        if (isCapture) {
            desc += ` captures on ${dest}`;
        } else {
            desc += ` to ${dest}`;
        }

        if (promotion) {
            desc += `, promotes to ${promotion}`;
        }

        if (isCheckmate) {
            desc += ', checkmate';
        } else if (isCheck) {
            desc += ', check';
        }

        return desc;
    }

    updateUI() {
        const moveCounter = document.getElementById('move-counter');
        if (moveCounter) {
            const totalMoves = this.moves.length;
            const current = this.currentMoveIndex + 1;
            moveCounter.textContent = `${current} / ${totalMoves}`;
        }

        // Update move hint
        const moveHint = document.getElementById('move-hint');
        if (moveHint) {
            if (this.currentMoveIndex >= 0 && this.currentMoveIndex < this.moves.length) {
                moveHint.textContent = this.describeMoveInEnglish(this.moves[this.currentMoveIndex], this.currentMoveIndex);
            } else {
                moveHint.textContent = '';
            }
        }

        const prevBtn = document.getElementById('btn-prev');
        const nextBtn = document.getElementById('btn-next');
        const startBtn = document.getElementById('btn-start');
        const endBtn = document.getElementById('btn-end');

        if (prevBtn) prevBtn.disabled = this.currentMoveIndex < 0;
        if (startBtn) startBtn.disabled = this.currentMoveIndex < 0;
        if (nextBtn) nextBtn.disabled = this.currentMoveIndex >= this.moves.length - 1;
        if (endBtn) endBtn.disabled = this.currentMoveIndex >= this.moves.length - 1;

        // Highlight current move in move list
        document.querySelectorAll('.move-item').forEach(el => {
            el.classList.remove('current-move');
        });
        const currentMoveEl = document.querySelector(`.move-item[data-index="${this.currentMoveIndex}"]`);
        if (currentMoveEl) {
            currentMoveEl.classList.add('current-move');
            currentMoveEl.scrollIntoView({ block: 'nearest' });
        }
    }

    updatePlayButton(isPlaying) {
        const playBtn = document.getElementById('btn-play');
        if (playBtn) {
            playBtn.textContent = isPlaying ? '\u2016' : '\u25B6';
            playBtn.title = isPlaying ? 'Pause' : 'Play';
        }
    }

    updateMoveList() {
        const moveListEl = document.getElementById('move-list');
        if (!moveListEl) return;

        moveListEl.innerHTML = '';

        const gameInfoEl = document.getElementById('game-info');
        if (gameInfoEl) {
            const white = this.headers.White || 'Unknown';
            const black = this.headers.Black || 'Unknown';
            const event = this.headers.Event || '';
            const date = this.headers.Date || '';
            const result = this.headers.Result || '';

            let infoHtml = `<span class="game-players">${white} vs ${black}</span>`;
            if (event) infoHtml += `<span class="game-event">${event}</span>`;
            if (date) infoHtml += `<span class="game-date">${date}</span>`;
            if (result) infoHtml += `<span class="game-result">${result}</span>`;
            gameInfoEl.innerHTML = infoHtml;
        }

        for (let i = 0; i < this.moves.length; i += 2) {
            const moveNum = Math.floor(i / 2) + 1;
            const row = document.createElement('div');
            row.className = 'move-row';

            const numSpan = document.createElement('span');
            numSpan.className = 'move-number';
            numSpan.textContent = `${moveNum}.`;
            row.appendChild(numSpan);

            const whiteSpan = document.createElement('span');
            whiteSpan.className = 'move-item';
            whiteSpan.dataset.index = i;
            whiteSpan.textContent = this.moves[i];
            whiteSpan.addEventListener('click', () => this.goToMove(i));
            row.appendChild(whiteSpan);

            if (i + 1 < this.moves.length) {
                const blackSpan = document.createElement('span');
                blackSpan.className = 'move-item';
                blackSpan.dataset.index = i + 1;
                blackSpan.textContent = this.moves[i + 1];
                blackSpan.addEventListener('click', () => this.goToMove(i + 1));
                row.appendChild(blackSpan);
            }

            moveListEl.appendChild(row);
        }
    }

    goToMove(index) {
        this.stopAutoplay();
        if (index < -1 || index >= this.moves.length) return;
        if (this.animating && this.finishAnimation) this.finishAnimation();

        const diff = index - this.currentMoveIndex;

        // Single step: use animated step
        if (diff === 1) {
            this.stepForward();
            return;
        }
        if (diff === -1) {
            this.stepBackward();
            return;
        }

        this.currentMoveIndex = index;
        this.boardState.restoreState(this.savedStates[index + 1]);
        this.renderBoard();
        this.highlightLastMove();
        this.updateUI();
    }
}
