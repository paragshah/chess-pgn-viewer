class PGNParser {
    static parseMultiple(pgnText) {
        const games = [];
        const lines = pgnText.split('\n');
        let currentHeaders = {};
        let currentMoveLines = [];
        let inHeaders = false;
        let hasContent = false;

        for (const line of lines) {
            const trimmed = line.trim();
            const headerMatch = trimmed.match(/^\[(\w+)\s+"(.*)"\]$/);

            if (headerMatch) {
                // If we were collecting moves and hit a new header block, save the previous game
                if (hasContent && !inHeaders) {
                    const moveText = currentMoveLines.join(' ');
                    const moves = PGNParser.parseMoveText(moveText);
                    if (moves.length > 0) {
                        games.push({ headers: currentHeaders, moves });
                    }
                    currentHeaders = {};
                    currentMoveLines = [];
                }
                currentHeaders[headerMatch[1]] = headerMatch[2];
                inHeaders = true;
                hasContent = true;
            } else if (trimmed.length > 0) {
                currentMoveLines.push(trimmed);
                inHeaders = false;
                hasContent = true;
            }
        }

        // Don't forget the last game
        if (hasContent) {
            const moveText = currentMoveLines.join(' ');
            const moves = PGNParser.parseMoveText(moveText);
            if (moves.length > 0) {
                games.push({ headers: currentHeaders, moves });
            }
        }

        return games;
    }

    static parse(pgnText) {
        const games = PGNParser.parseMultiple(pgnText);
        return games.length > 0 ? games[0] : { headers: {}, moves: [] };
    }

    static parseMoveText(text) {
        // Remove comments
        text = text.replace(/\{[^}]*\}/g, '');
        // Remove variations
        text = text.replace(/\([^)]*\)/g, '');
        // Remove NAGs (Numeric Annotation Glyphs)
        text = text.replace(/\$\d+/g, '');
        // Remove result
        text = text.replace(/\s*(1-0|0-1|1\/2-1\/2|\*)\s*$/, '');

        const tokens = text.split(/\s+/).filter(t => t.length > 0);
        const moves = [];

        for (const token of tokens) {
            // Skip move numbers like "1." or "1..."
            if (/^\d+\./.test(token)) {
                // Could be "1.e4" — extract the move after the dots
                const moveAfterNumber = token.replace(/^\d+\.+/, '');
                if (moveAfterNumber.length > 0) {
                    moves.push(PGNParser.cleanMove(moveAfterNumber));
                }
            } else if (!/^\d+$/.test(token)) {
                moves.push(PGNParser.cleanMove(token));
            }
        }

        return moves;
    }

    static cleanMove(move) {
        // Remove check/checkmate symbols for parsing, but keep the original
        return move.replace(/[\?!]+$/, '');
    }
}
