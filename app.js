// ============================================
// TIKTOK SHOP CALCULATOR — 3 MODES
// Kategori: Makanan & Accessories Hewan
//
// BIAYA TIKTOK SHOP (per Mei 2026):
//   1. Komisi Platform:     6,00% (Marketplace) / 8,00% (Mall)
//   2. Komisi Dinamis:      8,00% (cap Rp650.000/item)
//   3. Biaya Pemrosesan:    Rp 1.250 (flat per pesanan)
//   4. Cashback Bonus:      opsional (user set %)
//   5. Komisi Afiliasi:     opsional (user set %)
//
// RUMUS:
//   hargaEfektif  = hargaJual - diskonPenjual (kita asumsikan 0)
//   komisiPlatform = hargaEfektif × rate%
//   komisiDinamis  = min(hargaEfektif × 8%, cap)
//   cashbackBonus  = hargaEfektif × rate% (jika aktif)
//   komisiAfiliasi = hargaEfektif × rate% (jika aktif)
//   totalPot       = sum of all above + biayaProses
//   diterima       = hargaEfektif - totalPot
//   profit         = diterima - hpp
//
// MODE 1 — CARI HARGA JUAL (HPP + Margin %):
//   profit   = hpp × margin / 100
//   diterima = hpp + profit
//   hargaJual = solve inverse
//
// MODE 2 — CARI NET PROFIT (HPP + Target Profit Rp):
//   diterima = hpp + targetProfit
//   hargaJual = solve inverse
//
// MODE 3 — DANA DITERIMA (HPP + Target Diterima Rp):
//   hargaJual = solve inverse
//   profit = targetDiterima - hpp
// ============================================

let currentMode = 'harga';
let currentTier = 'marketplace';

const TIER_KOMISI = {
    'marketplace': 6.00,
    'mall': 8.00
};

// --- Utilities ---
function parseRp(str) {
    if (!str) return 0;
    return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0;
}

function fmtRp(num) {
    const r = Math.round(num);
    if (isNaN(r)) return 'Rp 0';
    return (r < 0 ? '-Rp ' : 'Rp ') + Math.abs(r).toLocaleString('id-ID');
}

function fmtThousands(val) {
    let digits = val.replace(/[^\d]/g, '');
    if (!digits) return '';
    digits = digits.replace(/^0+/, '') || '0';
    return parseInt(digits, 10).toLocaleString('id-ID');
}

function formatAndRecalculate(el) {
    const pos = el.selectionStart;
    const oldLen = el.value.length;
    el.value = fmtThousands(el.value);
    const diff = el.value.length - oldLen;
    el.setSelectionRange(Math.max(0, pos + diff), Math.max(0, pos + diff));
    recalculate();
}

// --- Fees ---
function getFees() {
    return {
        komisiPlatform: parseRp(document.getElementById('feeKomisiPlatform').value),
        komisiDinamis:  parseRp(document.getElementById('feeKomisiDinamis').value),
        capDinamis:     parseRp(document.getElementById('feeCapDinamis').value),
        biayaProses:    parseRp(document.getElementById('feeBiayaProses').value),
        cashbackBonus:  getCashbackRate(),
        komisiAfiliasi: getAfiliasiRate(),
    };
}

function getCashbackRate() {
    const cb = document.getElementById('toggleCashback');
    if (!cb || !cb.checked) return 0;
    return parseRp(document.getElementById('rateCashback').value);
}

function getAfiliasiRate() {
    const af = document.getElementById('toggleAfiliasi');
    if (!af || !af.checked) return 0;
    return parseRp(document.getElementById('rateAfiliasi').value);
}

// Total percentage fees (excluding cap logic for komisi dinamis)
function totalPctNoCap(f) {
    return f.komisiPlatform + f.komisiDinamis + f.cashbackBonus + f.komisiAfiliasi;
}

function calcBreakdown(hargaJual, fees) {
    const bKomisiPlatform = hargaJual * fees.komisiPlatform / 100;
    const rawDinamis      = hargaJual * fees.komisiDinamis / 100;
    const bKomisiDinamis  = Math.min(rawDinamis, fees.capDinamis);
    const isCapped        = rawDinamis > fees.capDinamis;
    const bCashback       = hargaJual * fees.cashbackBonus / 100;
    const bAfiliasi       = hargaJual * fees.komisiAfiliasi / 100;
    const bProses         = fees.biayaProses;

    const totalPot = bKomisiPlatform + bKomisiDinamis + bCashback + bAfiliasi + bProses;
    const diterima = hargaJual - totalPot;

    return {
        hargaJual,
        bKomisiPlatform,
        bKomisiDinamis,
        isCapped,
        bCashback,
        bAfiliasi,
        bProses,
        totalPot,
        diterima
    };
}

// Inverse: given target diterima, find harga jual
// Because komisi dinamis has a cap, we need iterative approach
function hargaJualDari(targetDiterima, fees) {
    // First try without cap
    const totalPctAll = totalPctNoCap(fees);
    const denom = 1 - totalPctAll / 100;
    if (denom <= 0) return null;

    let hargaJual = Math.ceil((targetDiterima + fees.biayaProses) / denom);

    // Check if cap kicks in
    const rawDinamis = hargaJual * fees.komisiDinamis / 100;
    if (rawDinamis > fees.capDinamis) {
        // Recalculate with cap: komisi dinamis is fixed at cap value
        // hargaJual - (hargaJual × (platform% + cashback% + afiliasi%) / 100) - cap - biayaProses = targetDiterima
        const pctWithoutDinamis = (fees.komisiPlatform + fees.cashbackBonus + fees.komisiAfiliasi);
        const denomCapped = 1 - pctWithoutDinamis / 100;
        if (denomCapped <= 0) return null;
        hargaJual = Math.ceil((targetDiterima + fees.capDinamis + fees.biayaProses) / denomCapped);
    }

    // Verify and adjust (iterative safety check)
    for (let i = 0; i < 5; i++) {
        const bd = calcBreakdown(hargaJual, fees);
        if (bd.diterima >= targetDiterima) break;
        hargaJual++;
    }

    return hargaJual;
}

// --- Tier ---
function setTier(tier) {
    currentTier = tier;
    document.querySelectorAll('.tier-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.tier === tier));
    document.getElementById('feeKomisiPlatform').value = TIER_KOMISI[tier].toFixed(2).replace('.', ',');
    recalculate();
}

// --- Mode ---
function setMode(mode) {
    currentMode = mode;
    document.querySelectorAll('.mode-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.mode === mode));

    document.getElementById('inputsHarga').classList.toggle('hidden', mode !== 'harga');
    document.getElementById('inputsProfit').classList.toggle('hidden', mode !== 'profit');
    document.getElementById('inputsTerima').classList.toggle('hidden', mode !== 'terima');

    const t = document.getElementById('cardTitle');
    const d = document.getElementById('cardDesc');
    if (mode === 'harga') {
        t.textContent = 'Cari Harga Jual Aman';
        d.textContent = 'Masukkan HPP dan target margin (%). Margin = profit / HPP. Contoh: 100% artinya profit = HPP.';
    } else if (mode === 'profit') {
        t.textContent = 'Cari Harga dari Target Profit';
        d.textContent = 'Masukkan HPP dan target net profit (Rp). Kalkulator menghitung harga jual yang diperlukan.';
    } else {
        t.textContent = 'Cari Harga dari Target Dana Diterima';
        d.textContent = 'Masukkan HPP dan target dana yang ingin diterima (Rp). Kalkulator menghitung harga jual.';
    }

    document.getElementById('resultCard').style.display = 'none';
    recalculate();
}

// --- Toggle handlers ---
function toggleCashback() {
    const cb = document.getElementById('toggleCashback');
    const rate = document.getElementById('rateCashback');
    const item = document.getElementById('cashbackItem');
    rate.disabled = !cb.checked;
    item.classList.toggle('active', cb.checked);
    recalculate();
}

function toggleAfiliasi() {
    const af = document.getElementById('toggleAfiliasi');
    const rate = document.getElementById('rateAfiliasi');
    const item = document.getElementById('afiliasiItem');
    rate.disabled = !af.checked;
    item.classList.toggle('active', af.checked);
    recalculate();
}

// --- Main ---
function recalculate() {
    const fees = getFees();

    // Update total fee display
    const pctDisplay = totalPctNoCap(fees);
    document.getElementById('totalFeePercent').textContent = pctDisplay.toFixed(2).replace('.', ',') + '%';
    document.getElementById('totalFeeFlat').textContent = fees.biayaProses.toLocaleString('id-ID');

    let hpp, profit, hargaJual, diterima, bd;

    // ===== MODE 1: HPP + MARGIN % =====
    if (currentMode === 'harga') {
        hpp = parseRp(document.getElementById('hppForHarga').value);
        const margin = parseFloat(document.getElementById('marginPct').value) || 0;
        if (hpp <= 0) { hide(); return; }

        profit = hpp * margin / 100;
        diterima = hpp + profit;
        hargaJual = hargaJualDari(diterima, fees);
        if (!hargaJual) { hide(); return; }

        bd = calcBreakdown(hargaJual, fees);
        profit = bd.diterima - hpp;

        show();
        setResult('Harga Jual Aman', 'Harga Jual Minimum', fmtRp(hargaJual),
            `Margin ${margin}% → Profit ${fmtRp(profit)} dari HPP ${fmtRp(hpp)}`, '');

        setSummary('HPP', fmtRp(hpp), '',
            'Total Potongan', '- ' + fmtRp(bd.totalPot), 'deduction',
            'Dana Diterima', fmtRp(bd.diterima), '',
            'Net Profit', fmtRp(profit), 'profit', true);

    // ===== MODE 2: HPP + TARGET PROFIT Rp =====
    } else if (currentMode === 'profit') {
        hpp = parseRp(document.getElementById('hppForProfit').value);
        const targetProfit = parseRp(document.getElementById('profitTarget').value);
        if (hpp <= 0 && targetProfit <= 0) { hide(); return; }

        diterima = hpp + targetProfit;
        hargaJual = hargaJualDari(diterima, fees);
        if (!hargaJual) { hide(); return; }

        bd = calcBreakdown(hargaJual, fees);
        profit = bd.diterima - hpp;
        const pctMarkup = hpp > 0 ? ((profit / hpp) * 100).toFixed(1).replace('.', ',') + '%' : '-';

        show();
        setResult('Harga Jual yang Diperlukan', 'Harga Jual Minimum', fmtRp(hargaJual),
            `Profit ${fmtRp(profit)} (markup ${pctMarkup})`, '');

        setSummary('HPP', fmtRp(hpp), '',
            'Total Potongan', '- ' + fmtRp(bd.totalPot), 'deduction',
            'Dana Diterima', fmtRp(bd.diterima), '',
            'Net Profit', fmtRp(profit), 'profit', true);

    // ===== MODE 3: HPP + TARGET DANA DITERIMA Rp =====
    } else {
        hpp = parseRp(document.getElementById('hppForTerima').value);
        const targetDiterima = parseRp(document.getElementById('targetDiterima').value);
        if (targetDiterima <= 0) { hide(); return; }

        hargaJual = hargaJualDari(targetDiterima, fees);
        if (!hargaJual) { hide(); return; }

        bd = calcBreakdown(hargaJual, fees);
        diterima = bd.diterima;
        profit = diterima - hpp;

        show();
        setResult('Harga Jual yang Diperlukan', 'Harga Jual Minimum', fmtRp(hargaJual),
            `Dana diterima ${fmtRp(diterima)}, profit ${fmtRp(profit)}`, '');

        setSummary('HPP', fmtRp(hpp), '',
            'Total Potongan', '- ' + fmtRp(bd.totalPot), 'deduction',
            'Dana Diterima', fmtRp(diterima), 'profit',
            'Net Profit', fmtRp(profit), profit >= 0 ? 'profit' : 'deduction', true);
    }

    // --- Breakdown ---
    fillBreakdown(bd, fees);

    // --- Visual bar ---
    if (bd && bd.hargaJual > 0 && hpp > 0) {
        const hj = bd.hargaJual;
        const p = Math.max(0, hj - hpp - bd.totalPot);
        document.getElementById('barHPP').style.width = (hpp / hj * 100) + '%';
        document.getElementById('barFee').style.width = (bd.totalPot / hj * 100) + '%';
        document.getElementById('barProfit').style.width = (p / hj * 100) + '%';
        document.getElementById('visualSection').style.display = '';
    } else {
        document.getElementById('visualSection').style.display = 'none';
    }
}

// --- UI Helpers ---
function show() { document.getElementById('resultCard').style.display = 'block'; }
function hide() { document.getElementById('resultCard').style.display = 'none'; }

function setResult(title, label, value, note, negClass) {
    document.getElementById('resultTitle').textContent = title;
    document.getElementById('bigLabel').textContent = label;
    document.getElementById('bigValue').textContent = value;
    document.getElementById('bigValue').className = 'big-value ' + (negClass || '');
    document.getElementById('bigNote').textContent = note;
    document.getElementById('bigResult').className = 'big-result' + (negClass === 'negative' ? ' big-negative' : '');
}

function setSummary(l1, v1, c1, l2, v2, c2, l3, v3, c3, l4, v4, c4, hl4) {
    for (let i = 0; i < 4; i++) {
        document.getElementById('sumLabel' + (i + 1)).textContent = arguments[i * 3];
        document.getElementById('sumValue' + (i + 1)).textContent = arguments[i * 3 + 1];
        document.getElementById('sumValue' + (i + 1)).className = 'summary-value ' + (arguments[i * 3 + 2] || '');
    }
    document.getElementById('sumItem4').className = 'summary-item' + (hl4 ? ' highlight-item' : '');
}

function fillBreakdown(bd, fees) {
    if (!bd) return;

    // Komisi Platform
    document.getElementById('brkKomisiPlatformPct').textContent =
        `(${fees.komisiPlatform.toFixed(2).replace('.', ',')}%)`;
    document.getElementById('brkKomisiPlatform').textContent = fmtRp(bd.bKomisiPlatform);

    // Komisi Dinamis
    const capText = bd.isCapped ? ' ⚠️ CAP' : '';
    document.getElementById('brkKomisiDinamisPct').textContent =
        `(${fees.komisiDinamis.toFixed(2).replace('.', ',')}%)`;
    document.getElementById('brkKomisiDinamis').textContent = fmtRp(bd.bKomisiDinamis);
    const capBadge = document.getElementById('capBadge');
    if (capBadge) {
        capBadge.style.display = bd.isCapped ? 'inline-block' : 'none';
    }

    // Cashback Bonus
    const cbRow = document.getElementById('brkCashbackRow');
    if (cbRow) {
        cbRow.style.display = fees.cashbackBonus > 0 ? 'flex' : 'none';
        document.getElementById('brkCashbackPct').textContent =
            `(${fees.cashbackBonus.toFixed(2).replace('.', ',')}%)`;
        document.getElementById('brkCashback').textContent = fmtRp(bd.bCashback);
    }

    // Komisi Afiliasi
    const afRow = document.getElementById('brkAfiliasiRow');
    if (afRow) {
        afRow.style.display = fees.komisiAfiliasi > 0 ? 'flex' : 'none';
        document.getElementById('brkAfiliasiPct').textContent =
            `(${fees.komisiAfiliasi.toFixed(2).replace('.', ',')}%)`;
        document.getElementById('brkAfiliasi').textContent = fmtRp(bd.bAfiliasi);
    }

    // Biaya Proses
    document.getElementById('brkProses').textContent = fmtRp(bd.bProses);

    // Total
    document.getElementById('brkTotal').textContent = fmtRp(bd.totalPot);
}

// --- Init ---
document.addEventListener('DOMContentLoaded', () => {
    const fees = getFees();
    document.getElementById('totalFeePercent').textContent = totalPctNoCap(fees).toFixed(2).replace('.', ',') + '%';
    document.getElementById('totalFeeFlat').textContent = fees.biayaProses.toLocaleString('id-ID');

    // Init toggle states
    const rateCashback = document.getElementById('rateCashback');
    const rateAfiliasi = document.getElementById('rateAfiliasi');
    if (rateCashback) rateCashback.disabled = true;
    if (rateAfiliasi) rateAfiliasi.disabled = true;
});
