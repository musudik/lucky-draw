import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { eventsAPI } from '../api/api';

export default function EventCreate() {
  const { id } = useParams(); // present when editing
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', description: '', venue: '', event_date: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (id) {
      eventsAPI.get(id).then((r) => {
        const ev = r.data;
        setForm({
          name: ev.name || '',
          description: ev.description || '',
          venue: ev.venue || '',
          event_date: ev.event_date ? ev.event_date.split('T')[0] : '',
        });
      });
    }
  }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (id) {
        await eventsAPI.update(id, form);
        navigate(`/events/${id}`);
      } else {
        const r = await eventsAPI.create(form);
        navigate(`/events/${r.data.id}`);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save event');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-6 flex items-start justify-center">
      <div className="w-full max-w-xl mt-12">
        <div className="flex items-center gap-4 mb-6">
          <Link to="/dashboard" className="text-gray-400 hover:text-white text-sm transition">← Back</Link>
          <h1 className="text-2xl font-bold text-yellow-400">{id ? 'Edit Event' : 'Create Event'}</h1>
        </div>

        <div className="bg-gray-800/60 border border-gray-700 rounded-2xl p-8 backdrop-blur-md">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Event Name *</label>
              <input
                type="text"
                placeholder="e.g. Annual Company Dinner 2025"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-white focus:border-yellow-400 outline-none"
              />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Description</label>
              <textarea
                placeholder="Optional description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-white focus:border-yellow-400 outline-none resize-none"
              />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Venue</label>
              <input
                type="text"
                placeholder="e.g. Grand Ballroom, Hotel XYZ"
                value={form.venue}
                onChange={(e) => setForm({ ...form, venue: e.target.value })}
                className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-white focus:border-yellow-400 outline-none"
              />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Event Date</label>
              <input
                type="date"
                value={form.event_date}
                onChange={(e) => setForm({ ...form, event_date: e.target.value })}
                className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-white focus:border-yellow-400 outline-none"
              />
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-yellow-400 to-yellow-600 text-black font-bold text-lg disabled:opacity-50 hover:scale-[1.01] transition transform"
            >
              {loading ? 'Saving...' : id ? 'Save Changes' : 'Create Event'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
