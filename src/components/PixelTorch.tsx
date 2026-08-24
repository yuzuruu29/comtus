interface PixelTorchProps {
  size?: number;
  isLit?: boolean;
  isIgniting?: boolean;
  className?: string;
  variant?: "handheld" | "sconce";
}

/**
 * Pixel-art style Torch inspired by classic retro fantasy/dungeon torches.
 * Renders a crisp 32x32 pixel grid with animated flame and embers when lit.
 */
export default function PixelTorch({
  size = 36,
  isLit = true,
  isIgniting = false,
  className = "",
  variant = "handheld",
}: PixelTorchProps) {
  return (
    <div
      className={`relative select-none pointer-events-none ${className} ${
        isIgniting ? "animate-torch-ignite" : ""
      }`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {/* Ambient Flame Glow (when lit) */}
      {isLit && (
        <div
          className="absolute rounded-full pointer-events-none transition-opacity duration-700 -translate-x-1/2 -translate-y-1/2 bg-[radial-gradient(circle,rgba(255,183,77,0.55)_0%,rgba(230,81,0,0.22)_45%,transparent_70%)] animate-pulse-gentle"
          style={{
            left: variant === "handheld" ? "65.6%" : "50%",
            top: variant === "handheld" ? "21.8%" : "22%",
            width: size * 1.7,
            height: size * 1.7,
          }}
        />
      )}

      {/* Floating Spark Embers */}
      {isLit && (
        <div
          className="absolute overflow-visible pointer-events-none -translate-x-1/2 -translate-y-1/2"
          style={{
            left: variant === "handheld" ? "65.6%" : "50%",
            top: variant === "handheld" ? "21.8%" : "20%",
          }}
        >
          <span className="pixel-ember ember-1" />
          <span className="pixel-ember ember-2" />
          <span className="pixel-ember ember-3" />
        </div>
      )}

      {/* Pixel Torch SVG */}
      <svg
        viewBox="0 0 32 32"
        width={size}
        height={size}
        className="w-full h-full drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]"
        style={{ shapeRendering: "crispEdges" }}
      >
        {variant === "handheld" ? (
          /* Handheld 45-degree angle torch */
          <g>
            {/* Wooden Handle Pixels */}
            <rect x="5" y="25" width="2" height="2" fill="#4E342E" />
            <rect x="7" y="23" width="2" height="2" fill="#5D4037" />
            <rect x="9" y="21" width="2" height="2" fill="#6D4C41" />
            <rect x="11" y="19" width="2" height="2" fill="#8D6E63" />
            <rect x="13" y="17" width="2" height="2" fill="#A1887F" />
            <rect x="15" y="15" width="2" height="2" fill="#6D4C41" />
            <rect x="17" y="13" width="2" height="2" fill="#8D6E63" />

            {/* Torch Head Banding / Charcoal Wick */}
            <rect x="17" y="11" width="3" height="3" fill="#3E2723" />
            <rect x="19" y="13" width="3" height="3" fill="#271B16" />
            <rect x="18" y="12" width="4" height="4" fill={isLit ? "#BF360C" : "#37474F"} />

            {/* Animated Flame Elements */}
            {isLit ? (
              <g className="animate-pixel-flicker origin-[22px_10px]">
                {/* Outer Fire (Red / Deep Orange) */}
                <rect x="18" y="8" width="3" height="4" fill="#D84315" />
                <rect x="21" y="9" width="4" height="4" fill="#E64A19" />
                <rect x="19" y="6" width="3" height="3" fill="#F4511E" />
                <rect x="22" y="7" width="3" height="3" fill="#FF5722" />
                <rect x="20" y="4" width="2" height="3" fill="#FF7043" />
                <rect x="23" y="5" width="2" height="2" fill="#FF8A65" />

                {/* Mid Fire (Vibrant Orange / Amber) */}
                <rect x="19" y="9" width="3" height="3" fill="#FF8F00" />
                <rect x="20" y="7" width="3" height="3" fill="#FFA000" />
                <rect x="21" y="8" width="3" height="3" fill="#FFB300" />
                <rect x="21" y="6" width="2" height="3" fill="#FFC107" />

                {/* Core Fire (Hot Yellow / White) */}
                <rect x="20" y="8" width="2" height="2" fill="#FFE082" />
                <rect x="21" y="7" width="2" height="2" fill="#FFF59D" />
                <rect x="21" y="8" width="1" height="1" fill="#FFFFFF" />

                {/* Floating Tip Sparks */}
                <rect x="24" y="3" width="1" height="1" fill="#FFAB40" className="animate-spark-drift-1" />
                <rect x="21" y="2" width="1" height="1" fill="#FFD180" className="animate-spark-drift-2" />
                <rect x="18" y="4" width="1" height="1" fill="#FF6E40" className="animate-spark-drift-3" />
              </g>
            ) : (
              /* Unlit Smoke Wisp */
              <g className="opacity-40">
                <rect x="20" y="9" width="2" height="2" fill="#78909C" />
                <rect x="21" y="6" width="1" height="2" fill="#90A4AE" />
                <rect x="22" y="4" width="1" height="1" fill="#B0BEC5" />
              </g>
            )}
          </g>
        ) : (
          /* Sconce Vertical Wall Torch */
          <g>
            {/* Wall Mount Brass Sconce Bracket */}
            <rect x="11" y="19" width="4" height="2" fill="#8D6E63" />
            <rect x="10" y="21" width="2" height="5" fill="#5D4037" />
            <rect x="12" y="25" width="4" height="2" fill="#6D4C41" />

            {/* Vertical Wooden Torch */}
            <rect x="14" y="15" width="4" height="9" fill="#8D6E63" />
            <rect x="15" y="16" width="2" height="7" fill="#BCAAA4" />
            <rect x="13" y="13" width="6" height="3" fill="#3E2723" />

            {/* Flame / Sconce Fire */}
            {isLit ? (
              <g className="animate-pixel-flicker origin-[16px_9px]">
                {/* Outer Flame */}
                <rect x="13" y="8" width="6" height="5" fill="#D84315" />
                <rect x="14" y="5" width="4" height="5" fill="#E64A19" />
                <rect x="15" y="3" width="2" height="4" fill="#FF5722" />

                {/* Mid Flame */}
                <rect x="14" y="8" width="4" height="4" fill="#FF8F00" />
                <rect x="15" y="5" width="2" height="4" fill="#FFB300" />

                {/* Core White Hot */}
                <rect x="15" y="8" width="2" height="2" fill="#FFF59D" />
                <rect x="15" y="7" width="2" height="1" fill="#FFFFFF" />

                {/* Top Spark */}
                <rect x="15" y="1" width="1" height="1" fill="#FFE57F" className="animate-spark-drift-1" />
                <rect x="17" y="3" width="1" height="1" fill="#FFAB40" className="animate-spark-drift-2" />
                <rect x="13" y="3" width="1" height="1" fill="#FF6E40" className="animate-spark-drift-3" />
              </g>
            ) : (
              /* Dormant / Smoldering */
              <g className="opacity-40">
                <rect x="15" y="11" width="2" height="2" fill="#546E7A" />
                <rect x="15" y="9" width="1" height="2" fill="#78909C" />
                <rect x="16" y="7" width="1" height="1" fill="#B0BEC5" />
              </g>
            )}
          </g>
        )}
      </svg>
    </div>
  );
}
