import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { eventsAPI, sponsorsAPI, prizesAPI, baseURL } from '../api/api';
import * as XLSX from 'xlsx';

const RANK_LABELS = { 1: '1st Place', 2: '2nd Place', 3: '3rd Place' };

function Tab({ label, active, onClick, badge }) {
  return (
    <button
      onClick={onClick}
      className={`px-5 py-2 rounded-lg text-sm font-semibold transition ${
        active ? 'bg-yellow-400 text-black' : 'text-gray-400 hover:text-white'
      }`}
    >
      {label}
      {badge > 0 && (
        <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${active ? 'bg-black/20 text-black' : 'bg-gray-700 text-gray-300'}`}>
          {badge}
        </span>
      )}
    </button>
  );
}

// Fetches /api/events/:id/qr with auth headers → blob URL so <img> can display it
function useQRBlob(eventId) {
  const [qrSrc, setQrSrc] = useState(null);

  useEffect(() => {
    if (!eventId) return;
    const token = localStorage.getItem('ld_token');
    fetch(`${baseURL}/events/${eventId}/qr`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error('QR fetch failed');
        return res.blob();
      })
      .then((blob) => setQrSrc(URL.createObjectURL(blob)))
      .catch(() => setQrSrc(null));

    return () => {
      if (qrSrc) URL.revokeObjectURL(qrSrc);
    };
  }, [eventId]);

  return qrSrc;
}

function QRSection({ event, eventId }) {
  const [copied, setCopied] = useState(false);
  const imgRef = useRef(null);
  const qrSrc = useQRBlob(eventId);
  const registrationUrl = `${window.location.origin}/register/${event.qr_token}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(registrationUrl);
    } catch {
      const el = document.createElement('textarea');
      el.value = registrationUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadQR = () => {
    if (!qrSrc) return;
    // Draw QR + event name onto a new canvas then download as PNG
    const img = imgRef.current;
    if (!img) return;
    const pad = 24;
    const labelH = 36;
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth + pad * 2;
    canvas.height = img.naturalHeight + pad * 2 + labelH;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, pad, pad);
    ctx.fillStyle = '#1a202c';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(event.name, canvas.width / 2, img.naturalHeight + pad + 22);
    const link = document.createElement('a');
    link.download = `${event.name.replace(/\s+/g, '_')}_QR.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="bg-gray-800/60 border border-gray-700 rounded-2xl p-6 mb-6">
      <div className="flex flex-col md:flex-row items-center gap-6">
        {/* QR image — fetched from backend with auth header */}
        <div className="flex-shrink-0 bg-white p-3 rounded-xl w-44 h-44 flex items-center justify-center">
          {qrSrc ? (
            <img ref={imgRef} src={qrSrc} alt="Registration QR Code" className="w-full h-full object-contain" />
          ) : (
            <div className="text-gray-400 text-xs text-center">Loading QR...</div>
          )}
        </div>

        <div className="flex-1 w-full">
          <h2 className="text-lg font-bold text-white mb-1">Participant Registration QR Code</h2>
          <p className="text-gray-400 text-sm mb-3">
            Share this QR code or link so participants can self-register for the lucky draw.
          </p>

          <div className="bg-gray-900/60 border border-gray-700 rounded-lg px-4 py-3 mb-4">
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-widest mb-1">Registration Link</p>
            <p className="font-mono text-xs text-yellow-400 break-all">{registrationUrl}</p>
          </div>

          <div className="flex gap-3 flex-wrap">
            <button
              onClick={copyLink}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition ${
                copied ? 'bg-green-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-white'
              }`}
            >
              {copied ? (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy Link
                </>
              )}
            </button>
            <button
              onClick={downloadQR}
              disabled={!qrSrc}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-yellow-400 hover:bg-yellow-300 text-black transition disabled:opacity-40"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download QR
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EventDetail() {
  const { id } = useParams();
  const [event, setEvent] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [sponsors, setSponsors] = useState([]);
  const [prizes, setPrizes] = useState([]);
  const [winners, setWinners] = useState([]);
  const [tab, setTab] = useState('participants');
  const [loading, setLoading] = useState(true);

  const [sponsorForm, setSponsorForm] = useState({ name: '', logo_url: '' });
  const [prizeForm, setPrizeForm] = useState({ rank: '', description: '', sponsor_id: '' });
  const [formError, setFormError] = useState('');

  useEffect(() => {
    Promise.all([
      eventsAPI.get(id),
      eventsAPI.participants(id),
      sponsorsAPI.list(id),
      prizesAPI.list(id),
      eventsAPI.winners(id),
    ]).then(([ev, pa, sp, pr, wi]) => {
      setEvent(ev.data);
      setParticipants(pa.data);
      setSponsors(sp.data);
      setPrizes(pr.data);
      setWinners(wi.data);
    }).finally(() => setLoading(false));
  }, [id]);

  const addSponsor = async (e) => {
    e.preventDefault();
    setFormError('');
    try {
      const res = await sponsorsAPI.add(id, sponsorForm);
      setSponsors((prev) => [...prev, res.data]);
      setSponsorForm({ name: '', logo_url: '' });
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to add sponsor');
    }
  };

  const deleteSponsor = async (sponsorId) => {
    await sponsorsAPI.delete(id, sponsorId);
    setSponsors((prev) => prev.filter((s) => s.id !== sponsorId));
  };

  const addPrize = async (e) => {
    e.preventDefault();
    setFormError('');
    try {
      const res = await prizesAPI.add(id, {
        rank: parseInt(prizeForm.rank),
        description: prizeForm.description,
        sponsor_id: prizeForm.sponsor_id || null,
      });
      setPrizes((prev) => [...prev, res.data].sort((a, b) => a.rank - b.rank));
      setPrizeForm({ rank: '', description: '', sponsor_id: '' });
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to add prize');
    }
  };

  const deletePrize = async (prizeId) => {
    await prizesAPI.delete(id, prizeId);
    setPrizes((prev) => prev.filter((p) => p.id !== prizeId));
  };

  const handleEndEvent = async () => {
    const isEnded = event.status === 'ended';
    const msg = isEnded
      ? 'Reopen this event? Participants will be able to register again.'
      : 'End this event? Registration will be closed for participants.';
    if (!window.confirm(msg)) return;
    const fn = isEnded ? eventsAPI.reopen : eventsAPI.end;
    const res = await fn(id);
    setEvent(res.data);
  };

  const deleteWinner = async (winnerId) => {
    if (!window.confirm('Remove this winner? They will become eligible again in the next draw.')) return;
    await eventsAPI.deleteWinner(id, winnerId);
    setWinners((prev) => prev.filter((w) => w.id !== winnerId));
  };

  const formatDate = (d) =>
    d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—';

  const exportToExcel = () => {
    const rows = participants.map((p, i) => ({
      '#': i + 1,
      'Name': p.name,
      'Email': p.email || '',
      'Mobile': p.phone || '',
      'Family Status': p.family_status || '',
      'Services Interested In': (p.services_required || []).join(', '),
      'Consent': p.consent ? 'Yes' : 'No',
      'Registered At': new Date(p.registered_at).toLocaleString(),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Participants');
    XLSX.writeFile(wb, `${event.name.replace(/\s+/g, '_')}_Participants.xlsx`);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading...</div>;
  if (!event) return <div className="min-h-screen flex items-center justify-center text-gray-400">Event not found</div>;

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
          <div>
            <Link to="/dashboard" className="text-gray-400 hover:text-white text-sm mb-2 block transition">← Dashboard</Link>
            <h1 className="text-3xl font-extrabold text-yellow-400">{event.name}</h1>
            {event.venue && <p className="text-gray-400 mt-1">{event.venue} · {formatDate(event.event_date)}</p>}
            {event.description && <p className="text-gray-500 text-sm mt-2 max-w-xl">{event.description}</p>}
          </div>
          <div className="flex gap-3 flex-wrap items-center">
            {event.status === 'ended' ? (
              <span className="bg-red-900/50 text-red-400 text-xs font-bold px-3 py-2 rounded-xl border border-red-800/40">
                Registration Closed
              </span>
            ) : null}
            <Link to={`/events/${id}/edit`} className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-xl text-sm font-semibold transition">
              Edit
            </Link>
            {event.status !== 'ended' && (
              <Link to={`/events/${id}/draw`} className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-black px-5 py-2 rounded-xl font-bold transition hover:scale-[1.02]">
                Run Draw
              </Link>
            )}
            <button
              onClick={handleEndEvent}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
                event.status === 'ended'
                  ? 'bg-green-700 hover:bg-green-600 text-white'
                  : 'bg-red-900/60 hover:bg-red-800/80 text-red-300 border border-red-700/40'
              }`}
            >
              {event.status === 'ended' ? 'Reopen Registration' : 'End Event'}
            </button>
          </div>
        </div>

        {/* QR Code */}
        <QRSection event={event} eventId={id} />

        {/* Winners Summary */}
        {winners.length > 0 && (
          <div className="bg-gray-800/60 border border-yellow-700/40 rounded-2xl p-6 mb-6">
            <h2 className="text-lg font-bold text-yellow-400 mb-4">Draw Results</h2>
            <div className="flex flex-col gap-3">
              {winners.map((w) => (
                <div key={w.id} className="bg-white/5 border-l-4 border-yellow-400 rounded-lg p-4 flex justify-between items-center gap-4">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="text-3xl flex-shrink-0">{w.rank === 1 ? '🥇' : w.rank === 2 ? '🥈' : w.rank === 3 ? '🥉' : '🏆'}</div>
                    <div className="min-w-0">
                      <p className="text-xs text-gray-400 uppercase font-bold tracking-widest mb-0.5">
                        {w.rank ? (RANK_LABELS[w.rank] || `Rank ${w.rank}`) : 'Winner'}
                        {w.prize_description && ` — ${w.prize_description}`}
                      </p>
                      <p className="text-xl font-bold text-white font-mono truncate">{w.participant_name}</p>
                      {w.sponsor_name && <p className="text-xs text-gray-400 mt-0.5">Sponsored by {w.sponsor_name}</p>}
                    </div>
                  </div>
                  <button
                    onClick={() => deleteWinner(w.id)}
                    title="Remove winner"
                    className="flex-shrink-0 text-gray-600 hover:text-red-400 transition p-1.5 rounded-lg hover:bg-red-900/20"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-gray-800/60 border border-gray-700 rounded-2xl overflow-hidden">
          <div className="flex gap-2 p-3 border-b border-gray-700 bg-gray-900/30 flex-wrap">
            <Tab label="Participants" active={tab === 'participants'} onClick={() => setTab('participants')} badge={participants.length} />
            <Tab label="Sponsors" active={tab === 'sponsors'} onClick={() => setTab('sponsors')} badge={sponsors.length} />
            <Tab label="Prizes" active={tab === 'prizes'} onClick={() => setTab('prizes')} badge={prizes.length} />
          </div>

          <div className="p-6">

            {/* ── Participants Tab ── */}
            {tab === 'participants' && (
              <div>
                {participants.length === 0 ? (
                  <p className="text-gray-500 text-center py-10">No participants yet. Share the QR code to start registration.</p>
                ) : (
                  <div>
                    <div className="flex justify-end mb-3">
                      <button
                        onClick={exportToExcel}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-green-700 hover:bg-green-600 text-white transition"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Export Excel
                      </button>
                    </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm" style={{ minWidth: 900 }}>
                      <thead>
                        <tr className="text-gray-400 border-b border-gray-700 text-xs uppercase tracking-wider">
                          <th className="text-left py-3 pr-3 font-semibold w-8">#</th>
                          <th className="text-left py-3 pr-3 font-semibold">Name</th>
                          <th className="text-left py-3 pr-3 font-semibold">Email</th>
                          <th className="text-left py-3 pr-3 font-semibold">Mobile</th>
                          <th className="text-left py-3 pr-3 font-semibold">Family Status</th>
                          <th className="text-left py-3 pr-3 font-semibold">Services Interested In</th>
                          <th className="text-left py-3 pr-3 font-semibold w-14">Consent</th>
                          <th className="text-left py-3 font-semibold whitespace-nowrap">Registered</th>
                        </tr>
                      </thead>
                      <tbody>
                        {participants.map((p, i) => (
                          // Must use React.Fragment (not <>) to attach key to multiple sibling rows
                          <tr key={p.id} className="border-b border-gray-800 hover:bg-white/5 align-top">
                            <td className="py-3 pr-3 text-gray-500">{i + 1}</td>
                            <td className="py-3 pr-3 text-white font-medium whitespace-nowrap">{p.name}</td>
                            <td className="py-3 pr-3 text-gray-400">{p.email || '—'}</td>
                            <td className="py-3 pr-3 text-gray-400 whitespace-nowrap">{p.phone || '—'}</td>
                            <td className="py-3 pr-3 text-gray-400 whitespace-nowrap">{p.family_status || '—'}</td>
                            <td className="py-3 pr-3">
                              {p.services_required?.length > 0 ? (
                                <div className="flex flex-wrap gap-1.5">
                                  {p.services_required.map((s) => (
                                    <span
                                      key={s}
                                      className="inline-block bg-yellow-400/10 border border-yellow-400/30 text-yellow-400 text-xs px-2 py-0.5 rounded-full whitespace-nowrap"
                                    >
                                      {s}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-gray-600 text-xs">—</span>
                              )}
                            </td>
                            <td className="py-3 pr-3">
                              {p.consent
                                ? <span className="text-green-400 font-semibold text-xs">Yes</span>
                                : <span className="text-red-400 text-xs">No</span>}
                            </td>
                            <td className="py-3 text-gray-500 text-xs whitespace-nowrap">
                              {new Date(p.registered_at).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Sponsors Tab ── */}
            {tab === 'sponsors' && (
              <div className="flex flex-col gap-5">
                <form onSubmit={addSponsor} className="flex gap-3 flex-wrap">
                  <input
                    type="text" placeholder="Sponsor Name *" value={sponsorForm.name}
                    onChange={(e) => setSponsorForm({ ...sponsorForm, name: e.target.value })}
                    required
                    className="bg-gray-900 border border-gray-600 rounded-lg p-3 text-white focus:border-yellow-400 outline-none flex-1 min-w-40"
                  />
                  <input
                    type="url" placeholder="Logo URL (optional)" value={sponsorForm.logo_url}
                    onChange={(e) => setSponsorForm({ ...sponsorForm, logo_url: e.target.value })}
                    className="bg-gray-900 border border-gray-600 rounded-lg p-3 text-white focus:border-yellow-400 outline-none flex-1 min-w-40"
                  />
                  <button type="submit" className="bg-yellow-400 hover:bg-yellow-300 text-black px-5 py-3 rounded-lg font-bold transition">
                    Add Sponsor
                  </button>
                </form>
                {formError && <p className="text-red-400 text-sm">{formError}</p>}
                <div className="flex flex-col gap-3">
                  {sponsors.map((s) => (
                    <div key={s.id} className="flex items-center gap-4 bg-gray-900/50 rounded-xl p-4">
                      {s.logo_url && <img src={s.logo_url} alt={s.name} className="w-12 h-12 object-contain rounded" />}
                      <span className="flex-1 text-white font-semibold">{s.name}</span>
                      <button onClick={() => deleteSponsor(s.id)} className="text-red-400 hover:text-red-300 text-sm transition">Remove</button>
                    </div>
                  ))}
                  {sponsors.length === 0 && <p className="text-gray-500 text-center py-6">No sponsors added yet.</p>}
                </div>
              </div>
            )}

            {/* ── Prizes Tab ── */}
            {tab === 'prizes' && (
              <div className="flex flex-col gap-5">
                <form onSubmit={addPrize} className="flex gap-3 flex-wrap">
                  <input
                    type="number" placeholder="Rank (1=1st) *" value={prizeForm.rank} min={1}
                    onChange={(e) => setPrizeForm({ ...prizeForm, rank: e.target.value })}
                    required
                    className="bg-gray-900 border border-gray-600 rounded-lg p-3 text-white focus:border-yellow-400 outline-none w-32"
                  />
                  <input
                    type="text" placeholder="Prize Description *" value={prizeForm.description}
                    onChange={(e) => setPrizeForm({ ...prizeForm, description: e.target.value })}
                    required
                    className="bg-gray-900 border border-gray-600 rounded-lg p-3 text-white focus:border-yellow-400 outline-none flex-1 min-w-40"
                  />
                  <select
                    value={prizeForm.sponsor_id}
                    onChange={(e) => setPrizeForm({ ...prizeForm, sponsor_id: e.target.value })}
                    className="bg-gray-900 border border-gray-600 rounded-lg p-3 text-white focus:border-yellow-400 outline-none"
                  >
                    <option value="">No Sponsor</option>
                    {sponsors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <button type="submit" className="bg-yellow-400 hover:bg-yellow-300 text-black px-5 py-3 rounded-lg font-bold transition">
                    Add Prize
                  </button>
                </form>
                {formError && <p className="text-red-400 text-sm">{formError}</p>}
                <div className="flex flex-col gap-3">
                  {prizes.map((p) => (
                    <div key={p.id} className="flex items-center gap-4 bg-gray-900/50 rounded-xl p-4">
                      <span className="text-2xl">{p.rank === 1 ? '🥇' : p.rank === 2 ? '🥈' : p.rank === 3 ? '🥉' : `#${p.rank}`}</span>
                      <div className="flex-1">
                        <p className="text-white font-semibold">{p.description}</p>
                        {p.sponsor_name && <p className="text-gray-400 text-xs">Sponsored by {p.sponsor_name}</p>}
                      </div>
                      <button onClick={() => deletePrize(p.id)} className="text-red-400 hover:text-red-300 text-sm transition">Remove</button>
                    </div>
                  ))}
                  {prizes.length === 0 && <p className="text-gray-500 text-center py-6">No prizes defined yet.</p>}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
