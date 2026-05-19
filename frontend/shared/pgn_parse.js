/** Minimal PGN import: headers, movetext, optional [UciMoves "..."] tag. */

const HEADER_RE = /^\s*\[(\w+)\s+"([^"]*)"\]\s*$/gm;

export function parsePgnHeaders(text) {
    const headers = {};
    let m;
    const re = new RegExp(HEADER_RE.source, 'gm');
    while ((m = re.exec(text)) !== null) {
        headers[m[1]] = m[2];
    }
    return headers;
}

export function extractMovetext(text) {
    const body = text.replace(/^\s*\[[^\]]+\]\s*$/gm, '').trim();
    const resultMatch = body.match(/\s(1-0|0-1|1\/2-1\/2|\*)\s*$/);
    let movetext = body;
    let result = '*';
    if (resultMatch) {
        result = resultMatch[1];
        movetext = body.slice(0, resultMatch.index).trim();
    }
    return { movetext, result };
}

/** Parse SAN tokens from movetext (strips move numbers, results). */
export function parseAlgebraicMoves(movetext) {
    const tokens = movetext
        .replace(/\{[^}]*\}/g, ' ')
        .replace(/\([^)]*\)/g, ' ')
        .replace(/\d+\./g, ' ')
        .split(/\s+/)
        .filter(t => t && !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(t));
    return tokens;
}

export function parseHelpMovesTag(headers) {
    const raw = headers.HelpMoves || headers.helpmoves || '';
    if (!raw.trim()) return [];
    return raw.split(';').filter(Boolean).map((part) => {
        const [ply, side, uci] = part.split(':');
        return { ply: parseInt(ply, 10), side, uci, reason: '' };
    });
}

export function parseUciMovesTag(headers) {
    const raw = headers.UciMoves || headers.ucimoves || '';
    if (!raw.trim()) return [];
    return raw.trim().split(/\s+/).filter(Boolean);
}

/**
 * @returns {{ headers: object, moves: string[], uci_moves: string[], result: string, error: string|null }}
 */
export function importPgnText(text) {
    if (!text || !text.trim()) {
        return { headers: {}, moves: [], uci_moves: [], help_plies: [], result: '*', error: 'Empty PGN' };
    }
    const headers = parsePgnHeaders(text);
    const { movetext, result } = extractMovetext(text);
    const moves = parseAlgebraicMoves(movetext);
    const uci_moves = parseUciMovesTag(headers);
    const help_plies = parseHelpMovesTag(headers);
    return { headers, moves, uci_moves, help_plies, result, error: null };
}

/** Build a game record compatible with PGNManager.games entries. */
export function pgnImportToGameRecord(parsed, mode = 'imported') {
    const h = parsed.headers;
    return {
        event: h.Event || 'Imported Game',
        site: h.Site || 'Import',
        date: h.Date || new Date().toISOString().split('T')[0],
        round: h.Round || '-',
        white: h.White || 'White',
        black: h.Black || 'Black',
        result: parsed.result || h.Result || '*',
        variant: h.Variant || '9x9 ShatrunZ',
        fen: h.FEN || 'rnbqkbznr/ppppppppp/9/9/9/9/9/PPPPPPPPP/RNBQKBZNR w - - 0 1',
        moves: [...parsed.moves],
        uci_moves: [...parsed.uci_moves],
        help_plies: [...(parsed.help_plies || [])],
        mode,
        imported: true,
    };
}
