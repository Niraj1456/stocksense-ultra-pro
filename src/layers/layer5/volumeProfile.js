// MODULE 5.1 (previously 3.7) — VOLUME PROFILE ENGINE
function volumeProfileEngine({ price_volume_pairs, price_bins = 100, current_price, rvol = 1.0, atr = 0, atr_target_2 = 0 }) {
  if (!price_volume_pairs || price_volume_pairs.length === 0) {
    return { ok: false, error: "no_data", meta: { fetchedAt: new Date().toISOString(), source: "calc:volumeProfileEngine" } };
  }

  const price_min = Math.min(...price_volume_pairs.map(p => p.price));
  const price_max = Math.max(...price_volume_pairs.map(p => p.price));
  const bin_size = (price_max - price_min) / price_bins;

  const volume_at_price = new Array(price_bins).fill(0);
  
  price_volume_pairs.forEach(c => {
    let bin = Math.floor((c.price - price_min) / bin_size);
    if (bin >= price_bins) bin = price_bins - 1;
    volume_at_price[bin] += c.volume;
  });

  const max_vol = Math.max(...volume_at_price);
  const poc_bin = volume_at_price.indexOf(max_vol);
  const poc = price_min + (poc_bin * bin_size) + (bin_size / 2);

  const total_volume = volume_at_price.reduce((a, b) => a + b, 0);
  const target_volume = total_volume * 0.70;
  
  let accumulated = volume_at_price[poc_bin];
  let upper_bin = poc_bin;
  let lower_bin = poc_bin;

  while (accumulated < target_volume && (upper_bin < price_bins - 1 || lower_bin > 0)) {
    const upper_add = upper_bin < price_bins - 1 ? volume_at_price[upper_bin + 1] : -1;
    const lower_add = lower_bin > 0 ? volume_at_price[lower_bin - 1] : -1;
    
    if (upper_add >= lower_add && upper_add >= 0) {
      upper_bin += 1;
      accumulated += upper_add;
    } else if (lower_add >= 0) {
      lower_bin -= 1;
      accumulated += lower_add;
    } else {
      break;
    }
  }

  const vah = price_min + (upper_bin * bin_size) + bin_size;
  const val = price_min + (lower_bin * bin_size);

  const mean_vol = total_volume / price_bins;
  const lvn_threshold = mean_vol * 0.3;
  const hvn_threshold = mean_vol * 1.5;

  const bin_to_price = (i) => price_min + (i * bin_size) + (bin_size / 2);
  const lvn_zones = [];
  const hvn_zones = [];
  
  for (let i = 0; i < price_bins; i++) {
    if (volume_at_price[i] < lvn_threshold) lvn_zones.push(bin_to_price(i));
    if (volume_at_price[i] > hvn_threshold) hvn_zones.push(bin_to_price(i));
  }

  let signal = "NEUTRAL";
  let pts = 0;

  if (current_price > vah && rvol > 1.5) { signal = "VALUE_AREA_BREAKOUT"; pts = 5; }
  else if (current_price < val && rvol > 1.5) { signal = "VALUE_AREA_BREAKDOWN"; pts = -5; }
  else if (Math.abs(current_price - poc) < bin_size) { signal = "AT_FAIR_VALUE_POC"; pts = 0; }
  else if (current_price > poc) { signal = "ABOVE_VALUE_AREA"; pts = 4; }

  let extend_target = 0;
  if (atr_target_2 && atr) {
    const lvn_between = lvn_zones.some(z => z > current_price && z < atr_target_2);
    if (lvn_between) extend_target = atr * 0.3; 
  }

  return {
    ok: true,
    data: { poc, vah, val, lvn_zones, hvn_zones, signal, pts, extend_target },
    meta: { fetchedAt: new Date().toISOString(), source: "calc:volumeProfileEngine" }
  };
}

module.exports = { volumeProfileEngine };
