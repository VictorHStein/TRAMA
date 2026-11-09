/**
 * Small inline chart for the inspector: a line with a faint area under it,
 * an optional shaded band (e.g. the eclipse part of an orbit) and captions
 * rendered as HTML so they never distort with the viewBox.
 */
export function Sparkline({
  values, height = 44, shadeFrom, shadeTo, min, max, ariaLabel, captionLeft, captionRight,
}: {
  values: number[];
  height?: number;
  /** Fraction (0–1) of the x axis where a shaded band starts / ends. */
  shadeFrom?: number;
  shadeTo?: number;
  min?: number;
  max?: number;
  ariaLabel: string;
  captionLeft?: string;
  captionRight?: string;
}) {
  const n = values.length;
  if (n < 2) return null;
  const lo = min ?? Math.min(...values);
  const hi = max ?? Math.max(...values);
  const span = hi - lo || 1;
  const W = 100;
  const H = 100;
  const pts = values.map((v, i) => `${((i / (n - 1)) * W).toFixed(2)},${(H - ((v - lo) / span) * H).toFixed(2)}`);
  const line = `M${pts.join(' L')}`;
  const area = `${line} L${W},${H} L0,${H} Z`;
  return (
    <div className="sp-spark-wrap">
      <svg className="sp-spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={ariaLabel} style={{ height }}>
        {shadeFrom !== undefined && (
          <rect className="sp-spark__shade" x={shadeFrom * W} y={0} width={((shadeTo ?? 1) - shadeFrom) * W} height={H} />
        )}
        <path className="sp-spark__area" d={area} />
        <path className="sp-spark__line" d={line} />
      </svg>
      {(captionLeft || captionRight) && (
        <div className="sp-spark__cap">
          <span>{captionLeft}</span>
          <span>{captionRight}</span>
        </div>
      )}
    </div>
  );
}
