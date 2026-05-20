function orderDepth({ tick }) {
  // SmartAPI depth ticks usually include best bids/asks arrays.
  const depth = tick?.depth || tick?.best5 || tick?.depth20 || null;
  return {
    ok: Boolean(depth),
    data: { depth },
    meta: { fetchedAt: new Date().toISOString(), source: "smartapi:tick" },
    error: depth ? undefined : "depth_unavailable"
  };
}

module.exports = { orderDepth };

