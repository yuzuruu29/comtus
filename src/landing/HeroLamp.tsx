import { pokeLine, useLandingPlay } from "./LandingPlay";

function LampSprite({ sleepy }: { sleepy: boolean }) {
  return (
    <svg viewBox="0 0 36 42" width={96} height={112} aria-hidden="true" className="hero-lamp-svg">
      <g>
        <rect x="16" y="2" width="4" height="5" fill="#E64A19" />
        <rect x="15" y="4" width="6" height="5" fill="#FF8F00" />
        <rect x="16" y="5" width="4" height="4" fill="#FFC107" />
        <rect x="17" y="6" width="2" height="3" fill="#FFF59D" />
        <rect x="17" y="7" width="2" height="1" fill="#FFFFFF" />
      </g>
      <rect x="10" y="11" width="16" height="3" fill="#C99236" />
      <rect x="8" y="14" width="20" height="8" fill="#E3B04B" />
      <rect x="9" y="15" width="18" height="6" fill="#F0CE8C" />
      <rect x="10" y="16" width="16" height="4" fill="#E3B04B" />
      <rect x="11" y="16" width="3" height="2" fill="#F8E3B0" />
      {sleepy ? (
        <>
          <rect x="13" y="18" width="4" height="1" fill="#1B2334" />
          <rect x="19" y="18" width="4" height="1" fill="#1B2334" />
        </>
      ) : (
        <>
          <rect x="14" y="17" width="2" height="3" fill="#1B2334" />
          <rect x="20" y="17" width="2" height="3" fill="#1B2334" />
          <rect x="14" y="17" width="1" height="1" fill="#F2EDE3" />
          <rect x="20" y="17" width="1" height="1" fill="#F2EDE3" />
        </>
      )}
      <rect x="17" y="22" width="2" height="10" fill="#C99236" />
      <rect x="16" y="31" width="4" height="2" fill="#A5731C" />
      <rect x="12" y="33" width="12" height="3" fill="#E3B04B" />
      <rect x="10" y="36" width="16" height="3" fill="#C99236" />
      <rect x="11" y="37" width="14" height="1" fill="#F0CE8C" />
    </svg>
  );
}

/** Hero pixel lamp — poke or hover to ignite. Skippable; never covers the CTA. */
export default function HeroLamp() {
  const { lampLit, mood, pokeCount, poke, ignite } = useLandingPlay();
  const showSpeech = mood === "poke" || mood === "cheer" || pokeCount > 0;

  return (
    <div className="hero-lamp" data-lit={lampLit} data-mood={mood}>
      {showSpeech && (
        <p className="hero-lamp-speech" role="status">
          {mood === "cheer" ? "The light holds." : pokeLine(pokeCount)}
        </p>
      )}
      <button
        type="button"
        className="hero-lamp-btn"
        aria-label={lampLit ? "Study lamp, lit. Poke to spark." : "Light the study lamp"}
        onClick={poke}
        onMouseEnter={ignite}
      >
        <span className="hero-lamp-glow" aria-hidden />
        <span className="hero-lamp-sparks" aria-hidden>
          <i />
          <i />
          <i />
          <i />
        </span>
        <LampSprite sleepy={!lampLit && mood === "idle"} />
      </button>
    </div>
  );
}
