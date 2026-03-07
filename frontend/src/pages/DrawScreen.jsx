import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import WheelCanvas from '../components/WheelCanvas';
import { useConfetti } from '../components/Confetti';
import { eventsAPI, baseURL } from '../api/api';

const RANK_EMOJI = { 1: '🥇', 2: '🥈', 3: '🥉' };
const RANK_LABEL = { 1: '1st Place', 2: '2nd Place', 3: '3rd Place' };

export default function DrawScreen() {
  const { id } = useParams();
  const [event, setEvent] = useState(null);
  const [allParticipants, setAllParticipants] = useState([]);
  const [activeParticipants, setActiveParticipants] = useState([]);
  const [winners, setWinners] = useState([]);
  const [prizes, setPrizes] = useState([]);

  const [rotation, setRotation] = useState(0);
  const rotationRef = useRef(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [currentPointerName, setCurrentPointerName] = useState('...');
  const [spinOrder, setSpinOrder] = useState('forward');
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(null);
  const countdownRef = useRef(null);

  const [confettiRef, fireConfetti] = useConfetti();

  // Load event, participants, prizes, existing winners
  useEffect(() => {
    Promise.all([
      eventsAPI.get(id),
      eventsAPI.participants(id),
      eventsAPI.winners(id),
      fetch(`${baseURL}/events/${id}/prizes`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('ld_token')}` },
      }).then((r) => r.json()),
    ]).then(([ev, pa, wi, pr]) => {
      setEvent(ev.data);
      const participants = pa.data;
      setAllParticipants(participants);

      const alreadyWonIds = new Set(wi.data.map((w) => w.participant_id));
      setActiveParticipants(participants.filter((p) => !alreadyWonIds.has(p.id)));
      setWinners(wi.data);
      setPrizes(Array.isArray(pr) ? pr : []);
    });
  }, [id]);

  const spinWheel = useCallback(async () => {
    if (isSpinning || activeParticipants.length === 0) return;
    setError('');
    setIsSpinning(true);

    // ── Step 1: fetch the actual winner BEFORE the animation starts ──────────
    let winnerData;
    try {
      const res = await eventsAPI.draw(id);
      winnerData = res.data;
    } catch (err) {
      setError(err.response?.data?.error || 'Draw failed');
      setIsSpinning(false);
      return;
    }

    const { winner, prize } = winnerData;
    const total = activeParticipants.length;
    const arcDeg = 360 / total;

    // ── Step 2: find winner's segment and calculate final rotation ───────────
    const winnerIdx = activeParticipants.findIndex((p) => Number(p.id) === Number(winner.participant_id));
    const targetIdx = winnerIdx >= 0 ? winnerIdx : 0;
    const sliceCenter = targetIdx * arcDeg + arcDeg / 2;
    const spins = 8;
    const startRot = rotationRef.current;
    const k = spins + Math.ceil(Math.abs(startRot) / 360);
    const finalRotation = 270 + 360 * k - sliceCenter;

    // ── Step 3: start 10-second countdown ────────────────────────────────────
    const DURATION = 10000;
    const startTime = performance.now();
    setCountdown(10);
    let remaining = 10;
    countdownRef.current = setInterval(() => {
      remaining -= 1;
      setCountdown(remaining > 0 ? remaining : null);
      if (remaining <= 0) clearInterval(countdownRef.current);
    }, 1000);

    // ── Step 4: animate wheel to the winner's segment ────────────────────────
    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / DURATION, 1);
      const ease = 1 - Math.pow(1 - progress, 5);
      const currentR = startRot + (finalRotation - startRot) * ease;
      rotationRef.current = currentR;
      setRotation(currentR);

      const normalised = ((currentR % 360) + 360) % 360;
      const angle = (270 - normalised + 360) % 360;
      const idx = Math.floor(angle / arcDeg) % total;
      if (activeParticipants[idx]) setCurrentPointerName(activeParticipants[idx].name);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        clearInterval(countdownRef.current);
        setCountdown(null);
        setWinners((prev) => {
          if (prev.find((w) => w.participant_id === winner.participant_id)) return prev;
          return [
            ...prev,
            {
              id: winner.id,
              participant_id: winner.participant_id,
              participant_name: winner.participant_name,
              rank: prize?.rank ?? prev.length + 1,
              prize_description: prize?.description,
              sponsor_name: prize?.sponsor_name,
              sponsor_logo: prize?.sponsor_logo,
            },
          ];
        });
        setActiveParticipants((prev) => prev.filter((p) => p.id !== winner.participant_id));
        fireConfetti();
        setIsSpinning(false);
      }
    };

    requestAnimationFrame(animate);
  }, [isSpinning, activeParticipants, id]);

  const restart = () => {
    setWinners([]);
    setRotation(0);
    rotationRef.current = 0;
    setCurrentPointerName('...');
    setSpinOrder('forward');
    setActiveParticipants([...allParticipants]);
  };

  const maxPrizes = prizes.length || 3;
  const drawComplete = winners.length >= maxPrizes;

  const nextPrizeRank = spinOrder === 'forward'
    ? winners.length + 1
    : maxPrizes - winners.length;

  const nextPrize = prizes.find((p) => p.rank === nextPrizeRank);
  const isToggleDisabled = winners.length > 0 || isSpinning;

  if (!event) return (
    <div className="min-h-screen flex items-center justify-center text-gray-400">Loading event...</div>
  );

  return (
    <div className="min-h-screen p-4 md:p-6">
      <canvas
        ref={confettiRef}
        style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 999 }}
      />

      <div className="max-w-[1400px] mx-auto grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-6">

        {/* Left: Wheel */}
        <div className="flex flex-col gap-5">
          <div className="bg-gray-800/60 border border-gray-700 rounded-2xl p-6 backdrop-blur-md">
            {/* Header */}
            <div className="flex items-start justify-between mb-4 gap-4">
              <div>
                <Link to={`/events/${id}`} className="text-gray-400 hover:text-white text-xs transition block mb-1">← {event.name}</Link>
                <h1 className="text-2xl font-extrabold text-yellow-400">Live Draw</h1>
                <p className="text-gray-400 text-sm mt-0.5">
                  Pool: {activeParticipants.length} eligible · {winners.length}/{maxPrizes} prizes awarded
                </p>
              </div>
            </div>

            {/* Spin order toggle */}
            <div className={`flex items-center justify-center mb-5 bg-gray-900/50 p-3 rounded-xl border border-gray-700 ${isToggleDisabled ? 'opacity-40' : ''}`}>
              <span className={`text-sm font-bold mr-3 transition-colors ${spinOrder !== 'forward' ? 'text-gray-400' : 'text-yellow-400'}`}>
                3rd → 1st
              </span>
              <button
                onClick={() => !isToggleDisabled && setSpinOrder(spinOrder === 'forward' ? 'reverse' : 'forward')}
                disabled={isToggleDisabled}
                className={`w-14 h-8 rounded-full p-1 transition-colors relative ${spinOrder === 'reverse' ? 'bg-yellow-500' : 'bg-gray-600'}`}
              >
                <div className={`bg-white w-6 h-6 rounded-full shadow-md transition-transform ${spinOrder === 'reverse' ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
              <span className={`text-sm font-bold ml-3 transition-colors ${spinOrder === 'reverse' ? 'text-gray-400' : 'text-yellow-400'}`}>
                1st → 3rd
              </span>
            </div>

            {/* Current selection indicator */}
            <div className="text-center mb-4 h-12">
              <span className="text-gray-400 text-xs uppercase tracking-widest font-bold block mb-1">Current Selection</span>
              <span className="font-bold text-yellow-400 text-2xl font-mono">{currentPointerName}</span>
            </div>

            {/* Wheel with flashing countdown overlay */}
            <div className="relative">
              <WheelCanvas participants={activeParticipants} rotation={rotation} />
              {countdown !== null && (
                <div
                  style={{
                    position: 'absolute',
                    top: '50%', left: '50%',
                    transform: 'translate(-50%, -50%)',
                    zIndex: 100,
                    animation: 'flashCount 0.5s ease-in-out infinite alternate',
                    fontSize: '9rem',
                    fontWeight: 900,
                    color: '#fff',
                    textShadow: '0 0 40px rgba(250,204,21,1), 0 0 80px rgba(250,204,21,0.7)',
                    pointerEvents: 'none',
                    lineHeight: 1,
                    userSelect: 'none',
                  }}
                >
                  {countdown}
                </div>
              )}
            </div>

            {/* Sponsor display */}
            {nextPrize?.sponsor_name && (
              <div className="mt-4 flex items-center justify-center gap-3 text-sm text-gray-400">
                {nextPrize.sponsor_logo && (
                  <img src={nextPrize.sponsor_logo} alt={nextPrize.sponsor_name} className="h-8 object-contain rounded" />
                )}
                <span>Sponsored by <span className="text-white font-semibold">{nextPrize.sponsor_name}</span></span>
              </div>
            )}

            {error && <p className="text-red-400 text-sm text-center mt-3">{error}</p>}

            {/* Spin / Restart button */}
            <div className="mt-4">
              {!drawComplete ? (
                <button
                  onClick={spinWheel}
                  disabled={isSpinning || activeParticipants.length === 0}
                  className={`w-full py-4 rounded-xl font-bold text-xl shadow-lg transition transform active:scale-95 ${
                    isSpinning || activeParticipants.length === 0
                      ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-yellow-400 to-yellow-600 text-black hover:scale-[1.02]'
                  }`}
                >
                  {isSpinning
                    ? 'Spinning...'
                    : activeParticipants.length === 0
                    ? 'No participants'
                    : `Spin for ${RANK_LABEL[nextPrizeRank] ?? `Rank ${nextPrizeRank}`}${nextPrize ? ` — ${nextPrize.description}` : ''}`}
                </button>
              ) : (
                <button
                  onClick={restart}
                  className="w-full py-4 rounded-xl font-bold text-xl bg-green-600 hover:bg-green-500 text-white shadow-lg transition"
                >
                  Restart Draw
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right: Winners */}
        <div className="flex flex-col gap-5">
          <div className="bg-gray-800/60 border border-gray-700 rounded-2xl p-6 backdrop-blur-md flex-1">
            <h2 className="text-lg font-bold text-yellow-400 mb-4">Winners</h2>
            {winners.length === 0 ? (
              <div className="text-gray-500 text-center py-16 italic">Spin the wheel to draw winners...</div>
            ) : (
              <div className="flex flex-col gap-4">
                {[...winners].sort((a, b) => a.rank - b.rank).map((w) => (
                  <div
                    key={w.id ?? w.participant_id}
                    className="winner-item bg-white/5 border-l-4 border-yellow-400 rounded-xl p-4"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-xs text-gray-400 uppercase font-bold tracking-widest mb-1">
                          {RANK_LABEL[w.rank] ?? `Rank ${w.rank}`}
                          {w.prize_description && ` — ${w.prize_description}`}
                        </p>
                        <p className="text-xl font-bold text-white font-mono">{w.participant_name}</p>
                        {w.sponsor_name && (
                          <div className="flex items-center gap-2 mt-1">
                            {w.sponsor_logo && (
                              <img src={w.sponsor_logo} alt={w.sponsor_name} className="h-5 object-contain rounded" />
                            )}
                            <p className="text-xs text-gray-400">Sponsored by {w.sponsor_name}</p>
                          </div>
                        )}
                      </div>
                      <div className="text-3xl">{RANK_EMOJI[w.rank] ?? '🏆'}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Prizes reference */}
          {prizes.length > 0 && (
            <div className="bg-gray-800/60 border border-gray-700 rounded-2xl p-5 backdrop-blur-md">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-3">Prizes</h3>
              <div className="flex flex-col gap-2">
                {prizes.map((p) => {
                  const awarded = winners.find((w) => w.rank === p.rank);
                  return (
                    <div key={p.id} className={`flex items-center gap-3 p-3 rounded-lg ${awarded ? 'opacity-40' : 'bg-white/5'}`}>
                      <span className="text-xl">{RANK_EMOJI[p.rank] ?? `#${p.rank}`}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-semibold truncate">{p.description}</p>
                        {p.sponsor_name && <p className="text-gray-400 text-xs">By {p.sponsor_name}</p>}
                      </div>
                      {awarded && <span className="text-green-400 text-xs font-bold">Awarded</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
