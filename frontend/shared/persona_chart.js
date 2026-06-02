import { readPersonaStatsFromStorage } from './persona.js';

export function renderPersonaChart(canvas) {
    if (!canvas?.getContext) return;
    const items = readPersonaStatsFromStorage();
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const pad = { l: 48, r: 16, t: 24, b: 36 };
    const chartW = w - pad.l - pad.r;
    const chartH = h - pad.t - pad.b;
    const maxGames = Math.max(1, ...items.map((x) => x.stats?.games ?? 0));

    ctx.fillStyle = '#8e8c88';
    ctx.font = '11px system-ui, sans-serif';
    items.forEach((item, i) => {
        const g = item.stats?.games ?? 0;
        const barW = chartW / items.length * 0.55;
        const x = pad.l + (i + 0.5) * (chartW / items.length) - barW / 2;
        const totalH = (g / maxGames) * chartH;
        let y = pad.t + chartH;

        const segments = [
            { v: item.stats?.wins ?? 0, c: '#3bb273' },
            { v: item.stats?.losses ?? 0, c: '#d65252' },
            { v: item.stats?.draws ?? 0, c: '#8e8c88' },
        ];
        for (const seg of segments) {
            if (seg.v <= 0) continue;
            const sh = totalH * (seg.v / Math.max(1, g));
            y -= sh;
            ctx.fillStyle = seg.c;
            ctx.fillRect(x, y, barW, sh);
        }

        ctx.fillStyle = '#c9c8c6';
        ctx.textAlign = 'center';
        ctx.fillText(item.label || item.name, x + barW / 2, h - 10);
        ctx.fillStyle = '#8e8c88';
        ctx.fillText(String(g), x + barW / 2, pad.t + chartH + 14);
    });

    ctx.fillStyle = '#8e8c88';
    ctx.textAlign = 'left';
    ctx.fillText('W', pad.l, 14);
    ctx.fillStyle = '#3bb273';
    ctx.fillRect(pad.l + 14, 8, 10, 10);
    ctx.fillStyle = '#8e8c88';
    ctx.fillText('L', pad.l + 32, 14);
    ctx.fillStyle = '#d65252';
    ctx.fillRect(pad.l + 46, 8, 10, 10);
    ctx.fillStyle = '#8e8c88';
    ctx.fillText('D', pad.l + 64, 14);
    ctx.fillStyle = '#8e8c88';
    ctx.fillRect(pad.l + 78, 8, 10, 10);
}
