import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { eventsAPI } from '../api/api';

export default function Dashboard() {
  const { manager, logout } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    eventsAPI.list().then((r) => setEvents(r.data)).finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this event and all its data?')) return;
    await eventsAPI.delete(id);
    setEvents((prev) => prev.filter((e) => e.id !== id));
  };

  const formatDate = (d) =>
    d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-yellow-400">Lucky Draw</h1>
            <p className="text-gray-400 text-sm mt-1">Welcome back, {manager?.name}</p>
          </div>
          <div className="flex gap-3">
            <Link
              to="/events/new"
              className="bg-yellow-400 hover:bg-yellow-300 text-black font-bold px-5 py-2 rounded-xl transition"
            >
              + New Event
            </Link>
            <button
              onClick={logout}
              className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-xl text-sm transition"
            >
              Sign Out
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center text-gray-400 py-20">Loading events...</div>
        ) : events.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <p className="text-2xl mb-4">No events yet</p>
            <Link to="/events/new" className="text-yellow-400 hover:underline">Create your first event</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {events.map((ev) => {
              const isEnded = ev.status === 'ended';
              return (
                <div
                  key={ev.id}
                  className={`bg-gray-800/60 border rounded-2xl p-6 flex flex-col gap-4 backdrop-blur-md ${
                    isEnded ? 'border-gray-700/40 opacity-80' : 'border-gray-700'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h2 className="text-xl font-bold text-white truncate">{ev.name}</h2>
                      {isEnded ? (
                        <span className="flex-shrink-0 bg-red-900/50 text-red-400 text-xs font-bold px-2.5 py-1 rounded-full border border-red-800/40">
                          Ended
                        </span>
                      ) : (
                        <span className="flex-shrink-0 bg-green-900/40 text-green-400 text-xs font-bold px-2.5 py-1 rounded-full border border-green-800/30">
                          Active
                        </span>
                      )}
                    </div>
                    {ev.venue && <p className="text-gray-400 text-sm truncate">{ev.venue}</p>}
                    <p className="text-gray-500 text-xs mt-1">{formatDate(ev.event_date)}</p>
                  </div>
                  <div>
                    <span className="bg-gray-700 text-gray-300 text-xs px-3 py-1 rounded-full">
                      {ev.participant_count} participants
                    </span>
                  </div>
                  <div className="flex gap-2 mt-auto">
                    <Link
                      to={`/events/${ev.id}`}
                      className="flex-1 text-center bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg text-sm font-semibold transition"
                    >
                      View
                    </Link>
                    {!isEnded && (
                      <Link
                        to={`/events/${ev.id}/draw`}
                        className="flex-1 text-center bg-gradient-to-r from-yellow-400 to-yellow-600 hover:from-yellow-300 text-black py-2 rounded-lg text-sm font-bold transition"
                      >
                        Draw
                      </Link>
                    )}
                    <button
                      onClick={() => handleDelete(ev.id)}
                      className="bg-red-900/40 hover:bg-red-800/60 text-red-400 px-3 py-2 rounded-lg text-sm transition"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
