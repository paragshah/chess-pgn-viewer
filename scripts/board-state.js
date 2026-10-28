class BoardState {
    // Internal board: 8x8 array, row 0 = rank 8 (top), row 7 = rank 1 (bottom)
    // Pieces: lowercase = black, uppercase = white
    // K=king, Q=queen, R=rook, B=bishop, N=knight, P=pawn

    constructor() {
        this.board = this.initialBoard();
        this.turn = 'w'; // 'w' or 'b'
        this.castling = { K: true, Q: true, k: true, q: true };
        this.enPassantTarget = null; // [row, col] or null
        this.history = []; // saved states for undo
    }

    initialBoard() {
        return [
            ['r','n','b','q','k','b','n','r'], // rank 8 (row 0)
            ['p','p','p','p','p','p','p','p'], // rank 7 (row 1)
            [' ',' ',' ',' ',' ',' ',' ',' '], // rank 6
            [' ',' ',' ',' ',' ',' ',' ',' '], // rank 5
            [' ',' ',' ',' ',' ',' ',' ',' '], // rank 4
            [' ',' ',' ',' ',' ',' ',' ',' '], // rank 3
            ['P','P','P','P','P','P','P','P'], // rank 2 (row 6)
            ['R','N','B','Q','K','B','N','R'], // rank 1 (row 7)
        ];
    }

    clone() {
        const bs = new BoardState();
        bs.board = this.board.map(r => [...r]);
        bs.turn = this.turn;
        bs.castling = { ...this.castling };
        bs.enPassantTarget = this.enPassantTarget ? [...this.enPassantTarget] : null;
        return bs;
    }

    saveState() {
        return {
            board: this.board.map(r => [...r]),
            turn: this.turn,
            castling: { ...this.castling },
            enPassantTarget: this.enPassantTarget ? [...this.enPassantTarget] : null,
        };
    }

    restoreState(state) {
        this.board = state.board.map(r => [...r]);
        this.turn = state.turn;
        this.castling = { ...state.castling };
        this.enPassantTarget = state.enPassantTarget ? [...state.enPassantTarget] : null;
    }

    // Convert algebraic square to [row, col]
    static squareToPos(sq) {
        const col = sq.charCodeAt(0) - 97; // 'a' = 0
        const row = 8 - parseInt(sq[1]);    // '8' = 0, '1' = 7
        return [row, col];
    }

    static posToSquare(row, col) {
        return String.fromCharCode(97 + col) + (8 - row);
    }

    getPiece(row, col) {
        return this.board[row][col];
    }

    isWhite(piece) { return piece >= 'A' && piece <= 'Z'; }
    isBlack(piece) { return piece >= 'a' && piece <= 'z'; }
    isEmpty(row, col) { return this.board[row][col] === ' '; }

    // Apply a SAN move and return { from: [r,c], to: [r,c], captured, promotion, castling, enPassant }
    applyMove(san) {
        this.history.push(this.saveState());
        const moveInfo = this.resolveMove(san);
        if (!moveInfo) {
            console.error('Could not resolve move:', san, 'turn:', this.turn);
            return null;
        }
        this.executeMove(moveInfo);
        this.turn = this.turn === 'w' ? 'b' : 'w';
        return moveInfo;
    }

    undoMove() {
        if (this.history.length === 0) return false;
        this.restoreState(this.history.pop());
        return true;
    }

    resolveMove(san) {
        // Strip check/checkmate symbols
        san = san.replace(/[+#]$/, '');

        // Castling
        if (san === 'O-O' || san === 'O-O-O') {
            return this.resolveCastling(san);
        }

        // Promotion: e8=Q, exd8=Q, etc.
        let promotion = null;
        const promoMatch = san.match(/=([QRBN])$/);
        if (promoMatch) {
            promotion = promoMatch[1];
            san = san.replace(/=[QRBN]$/, '');
        }

        // Determine piece type
        let pieceType;
        let moveStr;
        if (san[0] >= 'A' && san[0] <= 'Z') {
            pieceType = san[0];
            moveStr = san.substring(1);
        } else {
            pieceType = 'P';
            moveStr = san;
        }

        // Check for capture
        const isCapture = moveStr.includes('x');
        moveStr = moveStr.replace('x', '');

        // Destination square is always the last two characters
        const destSquare = moveStr.slice(-2);
        const [destRow, destCol] = BoardState.squareToPos(destSquare);

        // Disambiguation (what's left before the destination)
        const disambig = moveStr.slice(0, -2);

        // Find the source piece
        const candidates = this.findCandidates(pieceType, destRow, destCol, disambig);

        if (candidates.length === 0) {
            return null;
        }

        const [srcRow, srcCol] = candidates[0];

        const result = {
            from: [srcRow, srcCol],
            to: [destRow, destCol],
            piece: this.board[srcRow][srcCol],
            captured: null,
            promotion: null,
            castling: null,
            enPassant: false,
        };

        // Capture
        if (!this.isEmpty(destRow, destCol)) {
            result.captured = this.board[destRow][destCol];
        }

        // En passant
        if (pieceType === 'P' && isCapture && this.isEmpty(destRow, destCol)) {
            if (this.enPassantTarget &&
                this.enPassantTarget[0] === destRow &&
                this.enPassantTarget[1] === destCol) {
                const capturedRow = this.turn === 'w' ? destRow + 1 : destRow - 1;
                result.captured = this.board[capturedRow][destCol];
                result.enPassant = true;
                result.enPassantCapturePos = [capturedRow, destCol];
            }
        }

        // Promotion
        if (promotion) {
            result.promotion = this.turn === 'w' ? promotion : promotion.toLowerCase();
        }

        return result;
    }

    resolveCastling(san) {
        const row = this.turn === 'w' ? 7 : 0;
        const result = {
            from: [row, 4],
            to: null,
            piece: this.board[row][4],
            captured: null,
            promotion: null,
            castling: san,
            enPassant: false,
            rookFrom: null,
            rookTo: null,
        };

        if (san === 'O-O') {
            result.to = [row, 6];
            result.rookFrom = [row, 7];
            result.rookTo = [row, 5];
        } else {
            result.to = [row, 2];
            result.rookFrom = [row, 0];
            result.rookTo = [row, 3];
        }

        return result;
    }

    findCandidates(pieceType, destRow, destCol, disambig) {
        const targetPiece = this.turn === 'w' ? pieceType : pieceType.toLowerCase();
        const candidates = [];

        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (this.board[r][c] !== targetPiece) continue;

                // Check disambiguation
                if (disambig.length === 1) {
                    if (disambig >= 'a' && disambig <= 'h') {
                        if (c !== disambig.charCodeAt(0) - 97) continue;
                    } else if (disambig >= '1' && disambig <= '8') {
                        if (r !== 8 - parseInt(disambig)) continue;
                    }
                } else if (disambig.length === 2) {
                    const [dr, dc] = BoardState.squareToPos(disambig);
                    if (r !== dr || c !== dc) continue;
                }

                if (this.canPieceReach(pieceType, r, c, destRow, destCol)) {
                    candidates.push([r, c]);
                }
            }
        }

        // Filter candidates that leave king in check
        return candidates.filter(([r, c]) => {
            return !this.wouldBeInCheck(r, c, destRow, destCol);
        });
    }

    wouldBeInCheck(fromRow, fromCol, toRow, toCol) {
        const saved = this.saveState();
        this.board[toRow][toCol] = this.board[fromRow][fromCol];
        this.board[fromRow][fromCol] = ' ';
        const inCheck = this.isKingInCheck(this.turn);
        this.restoreState(saved);
        return inCheck;
    }

    isKingInCheck(color) {
        const king = color === 'w' ? 'K' : 'k';
        let kingRow = -1, kingCol = -1;
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (this.board[r][c] === king) {
                    kingRow = r; kingCol = c;
                }
            }
        }
        if (kingRow === -1) return false;

        // Check if any opponent piece can reach the king
        const oppColor = color === 'w' ? 'b' : 'w';
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const p = this.board[r][c];
                if (p === ' ') continue;
                const isOpp = oppColor === 'w' ? this.isWhite(p) : this.isBlack(p);
                if (!isOpp) continue;
                const pt = p.toUpperCase();
                if (this.canPieceReach(pt, r, c, kingRow, kingCol)) {
                    return true;
                }
            }
        }
        return false;
    }

    canPieceReach(pieceType, fromRow, fromCol, toRow, toCol) {
        switch (pieceType) {
            case 'P': return this.canPawnReach(fromRow, fromCol, toRow, toCol);
            case 'R': return this.canRookReach(fromRow, fromCol, toRow, toCol);
            case 'N': return this.canKnightReach(fromRow, fromCol, toRow, toCol);
            case 'B': return this.canBishopReach(fromRow, fromCol, toRow, toCol);
            case 'Q': return this.canQueenReach(fromRow, fromCol, toRow, toCol);
            case 'K': return this.canKingReach(fromRow, fromCol, toRow, toCol);
            default: return false;
        }
    }

    canPawnReach(fr, fc, tr, tc) {
        const piece = this.board[fr][fc];
        const isWhite = this.isWhite(piece);
        const dir = isWhite ? -1 : 1;

        // Forward one
        if (tc === fc && tr === fr + dir && this.isEmpty(tr, tc)) return true;

        // Forward two from starting position
        const startRow = isWhite ? 6 : 1;
        if (tc === fc && fr === startRow && tr === fr + 2 * dir &&
            this.isEmpty(fr + dir, fc) && this.isEmpty(tr, tc)) return true;

        // Capture diagonally
        if (Math.abs(tc - fc) === 1 && tr === fr + dir) {
            if (!this.isEmpty(tr, tc)) return true;
            // En passant
            if (this.enPassantTarget &&
                this.enPassantTarget[0] === tr &&
                this.enPassantTarget[1] === tc) return true;
        }

        return false;
    }

    canRookReach(fr, fc, tr, tc) {
        if (fr !== tr && fc !== tc) return false;
        return this.isPathClear(fr, fc, tr, tc);
    }

    canBishopReach(fr, fc, tr, tc) {
        if (Math.abs(fr - tr) !== Math.abs(fc - tc)) return false;
        return this.isPathClear(fr, fc, tr, tc);
    }

    canQueenReach(fr, fc, tr, tc) {
        return this.canRookReach(fr, fc, tr, tc) || this.canBishopReach(fr, fc, tr, tc);
    }

    canKnightReach(fr, fc, tr, tc) {
        const dr = Math.abs(fr - tr);
        const dc = Math.abs(fc - tc);
        return (dr === 2 && dc === 1) || (dr === 1 && dc === 2);
    }

    canKingReach(fr, fc, tr, tc) {
        return Math.abs(fr - tr) <= 1 && Math.abs(fc - tc) <= 1;
    }

    isPathClear(fr, fc, tr, tc) {
        const dr = Math.sign(tr - fr);
        const dc = Math.sign(tc - fc);
        let r = fr + dr, c = fc + dc;
        while (r !== tr || c !== tc) {
            if (!this.isEmpty(r, c)) return false;
            r += dr;
            c += dc;
        }
        return true;
    }

    executeMove(moveInfo) {
        const { from, to, castling, promotion, enPassant, enPassantCapturePos } = moveInfo;

        // Handle castling
        if (castling) {
            this.board[to[0]][to[1]] = this.board[from[0]][from[1]];
            this.board[from[0]][from[1]] = ' ';
            this.board[moveInfo.rookTo[0]][moveInfo.rookTo[1]] = this.board[moveInfo.rookFrom[0]][moveInfo.rookFrom[1]];
            this.board[moveInfo.rookFrom[0]][moveInfo.rookFrom[1]] = ' ';

            if (this.turn === 'w') {
                this.castling.K = false;
                this.castling.Q = false;
            } else {
                this.castling.k = false;
                this.castling.q = false;
            }
            this.enPassantTarget = null;
            return;
        }

        // Set en passant target for two-square pawn advance
        const piece = this.board[from[0]][from[1]];
        if (piece.toUpperCase() === 'P' && Math.abs(to[0] - from[0]) === 2) {
            const epRow = (from[0] + to[0]) / 2;
            this.enPassantTarget = [epRow, to[1]];
        } else {
            this.enPassantTarget = null;
        }

        // En passant capture
        if (enPassant && enPassantCapturePos) {
            this.board[enPassantCapturePos[0]][enPassantCapturePos[1]] = ' ';
        }

        // Move piece
        this.board[to[0]][to[1]] = promotion || this.board[from[0]][from[1]];
        this.board[from[0]][from[1]] = ' ';

        // Update castling rights
        if (piece.toUpperCase() === 'K') {
            if (this.turn === 'w') { this.castling.K = false; this.castling.Q = false; }
            else { this.castling.k = false; this.castling.q = false; }
        }
        if (piece.toUpperCase() === 'R') {
            if (from[0] === 7 && from[1] === 0) this.castling.Q = false;
            if (from[0] === 7 && from[1] === 7) this.castling.K = false;
            if (from[0] === 0 && from[1] === 0) this.castling.q = false;
            if (from[0] === 0 && from[1] === 7) this.castling.k = false;
        }
    }

    // Convert internal board to the PIECE constants used by the renderer
    toPieceArray() {
        const mapping = {
            'R': PIECE.P1_ROOK, 'N': PIECE.P1_KNIGHT, 'B': PIECE.P1_BISHOP,
            'Q': PIECE.P1_QUEEN, 'K': PIECE.P1_KING, 'P': PIECE.P1_PAWN,
            'r': PIECE.P2_ROOK, 'n': PIECE.P2_KNIGHT, 'b': PIECE.P2_BISHOP,
            'q': PIECE.P2_QUEEN, 'k': PIECE.P2_KING, 'p': PIECE.P2_PAWN,
        };

        return this.board.map(row =>
            row.map(cell => cell === ' ' ? null : mapping[cell] || null)
        );
    }
}
