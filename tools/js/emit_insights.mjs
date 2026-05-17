#!/usr/bin/env node
/**
 * Offline: read self-play games.jsonl, replay with browser Game+Rules,
 * emit pending yes/no insight prompts for opening moves in *lost* games.
 *
 * Usage:
 *   node tools/js/emit_insights.mjs --games-jsonl data/selfplay/run_XXX/games.jsonl
 *   node tools/js/emit_insights.mjs --games-jsonl ... --out data/insights/pending_insights.ndjson --max-insights 200 --opening-depth 12
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { COLORS } from '../../frontend/constants.js';
import { Game } from '../../frontend/game.js';
import { Rules } from '../../frontend/rules.js';
import { loserFromResult, openingPliesToReview } from './insight_heuristics.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

function parseArgs(argv) {
    const out = {
        gamesJsonl: null,
        outPath: join(ROOT, 'data', 'insights', 'pending_insights.ndjson'),
        maxInsights: 200,
        openingDepth: 12,
        /** decisive: only lost-side moves; annotate: any result, first opening plies */
        mode: 'annotate',
    };
    for (let i = 2; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--games-jsonl') out.gamesJsonl = argv[++i];
        else if (a === '--out') out.outPath = argv[++i];
        else if (a === '--max-insights') out.maxInsights = parseInt(argv[++i], 10);
        else if (a === '--opening-depth') out.openingDepth = parseInt(argv[++i], 10);
        else if (a === '--mode') out.mode = argv[++i];
    }
    if (!out.gamesJsonl) {
        console.error('Usage: node tools/js/emit_insights.mjs --games-jsonl <games.jsonl> [--out path] [--max-insights N] [--opening-depth D]');
        process.exit(1);
    }
    return out;
}

function parseUCIMove(uciMove) {
    if (!uciMove || typeof uciMove !== 'string' || uciMove.length < 4) return null;
    const files = 'abcdefghi';
    const fromFile = files.indexOf(uciMove[0]);
    const fromRank = 9 - parseInt(uciMove[1], 10);
    const toFile = files.indexOf(uciMove[2]);
    const toRank = 9 - parseInt(uciMove[3], 10);
    if (fromFile < 0 || toFile < 0 || Number.isNaN(fromRank) || Number.isNaN(toRank)) return null;
    if (fromRank < 0 || fromRank >= 9 || toRank < 0 || toRank >= 9) return null;
    return { from: { r: fromRank, c: fromFile }, to: { r: toRank, c: toFile }, promo: uciMove[4] || null };
}

/** Map UCI to a legal move object (may include isCastling). */
function resolveLegalTo(game, from, uciTo) {
    const piece = game.board[from.r][from.c];
    if (!piece || piece.color !== game.turn) return null;
    const legals = Rules.getLegalMoves(game.board, from.r, from.c, true);
    const wantR = uciTo.r;
    const wantC = uciTo.c;
    for (const m of legals) {
        if (m.r === wantR && m.c === wantC) return m;
    }
    return null;
}

function applyUci(game, uci) {
    const base = parseUCIMove(uci);
    if (!base) return false;
    const toSquare = resolveLegalTo(game, base.from, base.to);
    if (!toSquare) return false;
    game.executeMove(base.from, toSquare);
    return true;
}

function replayMoves(moves) {
    const game = new Game();
    for (const uci of moves) {
        if (!applyUci(game, uci)) return { ok: false, game, failedAt: uci };
    }
    return { ok: true, game };
}

function sideLabel(c) {
    return c === COLORS.WHITE ? 'White' : 'Black';
}

function main() {
    const args = parseArgs(process.argv);
    const text = readFileSync(args.gamesJsonl, 'utf8');
    const lines = text.split('\n').filter((l) => l.trim());

    const outDir = dirname(args.outPath);
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

    const seen = new Set();
    const outLines = [];
    let emitted = 0;

    for (const line of lines) {
        if (emitted >= args.maxInsights) break;
        let rec;
        try {
            rec = JSON.parse(line);
        } catch {
            continue;
        }
        const moves = rec.moves;
        const result = rec.result;
        if (!Array.isArray(moves) || moves.length === 0) continue;

        const loser = loserFromResult(result);
        const decisive = args.mode === 'decisive';
        if (decisive && !loser) continue;

        const plies = openingPliesToReview(args.openingDepth, moves.length);
        for (const ply of plies) {
            if (emitted >= args.maxInsights) break;

            const g = new Game();
            let replayOk = true;
            for (let i = 0; i < ply; i++) {
                if (!applyUci(g, moves[i])) {
                    replayOk = false;
                    break;
                }
            }
            if (!replayOk) continue;
            if (decisive && g.turn !== loser) continue;

            const positionHash = g.getHash();
            const moveUci = moves[ply];
            const key = `${positionHash}|${moveUci}`;
            if (seen.has(key)) continue;
            seen.add(key);

            const prefix = moves.slice(0, ply).join(' ');
            let prompt;
            if (decisive && loser) {
                prompt = `${sideLabel(g.turn)} to play ${moveUci} (ply ${ply + 1}). Game ended ${result}. ${sideLabel(loser)} lost. Was this move bad for ${sideLabel(g.turn)}? [y/n/s/q]`;
            } else {
                prompt = `${sideLabel(g.turn)} to play ${moveUci} (ply ${ply + 1}). Game ended ${result}. Was this move bad for ${sideLabel(g.turn)}? [y/n/s/q]`;
            }
            const insight = {
                id: `${rec.game ?? 'g'}_${ply}_${moveUci}`,
                game: rec.game ?? null,
                ply,
                result,
                loser,
                mode: args.mode,
                side_to_move: g.turn,
                position_hash: positionHash,
                move_uci: moveUci,
                move_prefix: prefix,
                prompt,
            };
            outLines.push(JSON.stringify(insight));
            emitted++;
        }
    }

    writeFileSync(args.outPath, outLines.length ? `${outLines.join('\n')}\n` : '', 'utf8');
    console.error(`Emitted ${emitted} insights -> ${args.outPath}`);
}

main();
