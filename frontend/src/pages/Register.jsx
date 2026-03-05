import { useState } from 'react';
import { useParams } from 'react-router-dom';

const FAMILY_STATUS_OPTIONS = [
  'Single',
  'Married with no kids',
  'Married with 1 or more kids',
];

const SERVICES = [
  'Free Financial Coaching (worth 300 euros)',
  'Investments (Gold, Silver & Stocks)',
  'Loans (Personal & Home)',
  'Real Estate',
  'Insurances',
  'Free Bank Account',
  'Retirement Plans',
];

function CheckboxItem({ label, checked, onChange }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group select-none">
      <div
        onClick={onChange}
        className={`mt-0.5 w-5 h-5 flex-shrink-0 rounded border-2 flex items-center justify-center transition ${
          checked ? 'bg-yellow-400 border-yellow-400' : 'border-gray-600 group-hover:border-yellow-400'
        }`}
      >
        {checked && (
          <svg className="w-3 h-3 text-black" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
      <span className="text-gray-300 text-sm group-hover:text-white transition leading-tight">{label}</span>
    </label>
  );
}

function RadioItem({ label, selected, onSelect }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer group select-none" onClick={onSelect}>
      <div className={`w-5 h-5 flex-shrink-0 rounded-full border-2 flex items-center justify-center transition ${
        selected ? 'border-yellow-400' : 'border-gray-600 group-hover:border-yellow-400'
      }`}>
        {selected && <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />}
      </div>
      <span className="text-gray-300 text-sm group-hover:text-white transition">{label}</span>
    </label>
  );
}

function SectionTitle({ children }) {
  return (
    <h3 className="text-yellow-400 font-bold text-xs uppercase tracking-widest mb-3">{children}</h3>
  );
}

export default function Register() {
  const { qrToken } = useParams();
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    family_status: '',
    services_required: [],
    consent: false,
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);
  const [closed, setClosed] = useState(false);
  const [loading, setLoading] = useState(false);

  const toggleService = (service) => {
    setForm((prev) => ({
      ...prev,
      services_required: prev.services_required.includes(service)
        ? prev.services_required.filter((s) => s !== service)
        : [...prev.services_required, service],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.name.trim()) return setError('Full name is required');
    if (!form.email.trim()) return setError('Email address is required');
    if (!form.phone.trim()) return setError('Mobile number is required');
    if (!form.family_status) return setError('Please select your family status');
    if (form.services_required.length === 0) return setError('Please select at least one service you are interested in');
    if (!form.consent) return setError('Please agree to the consent terms to continue');

    setLoading(true);
    try {
      const res = await fetch('/api/participants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qr_token: qrToken, ...form }),
      });
      const data = await res.json();

      // Event registration has been closed by the organiser
      if (res.status === 403 && data.status === 'ended') {
        setClosed(true);
        return;
      }
      // Duplicate email for this event
      if (res.status === 409) {
        setError(data.error || 'You are already registered for this event.');
        return;
      }
      if (!res.ok) throw new Error(data.error || 'Registration failed');
      setSuccess(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Registration closed screen
  if (closed) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center max-w-sm w-full">
          <div className="text-6xl mb-6">🔒</div>
          <h1 className="text-2xl font-extrabold text-gray-300 mb-3">Registration Closed</h1>
          <p className="text-gray-500 text-sm leading-relaxed">
            The organiser has closed registration for this event. No further entries are being accepted.
          </p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center max-w-md w-full">
          <div className="text-7xl mb-6">🎉</div>
          <h1 className="text-3xl font-extrabold text-yellow-400 mb-3">You're Registered!</h1>
          <p className="text-white text-lg mb-2">
            Welcome, <span className="font-bold">{success.participant.name}</span>!
          </p>
          <p className="text-gray-400 mb-5">
            You've been entered into the lucky draw for{' '}
            <span className="text-white font-semibold">{success.event.name}</span>.
          </p>
          {success.participant.services_required?.length > 0 && (
            <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4 text-left mb-5">
              <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-2">Services you're interested in</p>
              <ul className="text-sm text-gray-300 space-y-1">
                {success.participant.services_required.map((s) => (
                  <li key={s} className="flex items-center gap-2">
                    <span className="text-yellow-400 font-bold">✓</span> {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-green-400 font-bold text-xl">Good luck! 🍀</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-10 px-4 flex items-start justify-center">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🎰</div>
          <h1 className="text-3xl font-extrabold text-yellow-400 mb-2">Lucky Draw Registration</h1>
          <p className="text-gray-400 text-sm">Fill in your details to enter the lucky draw</p>
        </div>

        <div className="bg-gray-800/60 border border-gray-700 rounded-2xl p-6 backdrop-blur-md">
          <form onSubmit={handleSubmit} className="flex flex-col gap-7">

            {/* Personal Details */}
            <section>
              <SectionTitle>Personal Details</SectionTitle>
              <div className="flex flex-col gap-4">
                <div>
                  <label className="text-gray-400 text-xs font-semibold block mb-1.5">
                    Full Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Enter your full name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-white placeholder-gray-500 focus:border-yellow-400 outline-none transition"
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-xs font-semibold block mb-1.5">
                    Email Address <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="email"
                    placeholder="your@email.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-white placeholder-gray-500 focus:border-yellow-400 outline-none transition"
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-xs font-semibold block mb-1.5">
                    Mobile Number <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="tel"
                    placeholder="+49 1234567890"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-white placeholder-gray-500 focus:border-yellow-400 outline-none transition"
                  />
                </div>
              </div>
            </section>

            {/* Family Status */}
            <section>
              <SectionTitle>Family Status <span className="text-red-400">*</span></SectionTitle>
              <div className="flex flex-col gap-3 bg-gray-900/50 rounded-xl p-4 border border-gray-700/60">
                {FAMILY_STATUS_OPTIONS.map((option) => (
                  <RadioItem
                    key={option}
                    label={option}
                    selected={form.family_status === option}
                    onSelect={() => setForm({ ...form, family_status: option })}
                  />
                ))}
              </div>
            </section>

            {/* Services */}
            <section>
              <SectionTitle>Services You're Interested In <span className="text-red-400">*</span></SectionTitle>
              <p className="text-gray-500 text-xs mb-3 -mt-2">Select all that apply</p>
              <div className="flex flex-col gap-3 bg-gray-900/50 rounded-xl p-4 border border-gray-700/60">
                {SERVICES.map((service) => (
                  <CheckboxItem
                    key={service}
                    label={service}
                    checked={form.services_required.includes(service)}
                    onChange={() => toggleService(service)}
                  />
                ))}
              </div>
            </section>

            {/* Consent */}
            <section>
              <SectionTitle>Consent <span className="text-red-400">*</span></SectionTitle>
              <div className="bg-gray-900/50 border border-gray-700/60 rounded-xl p-4">
                <CheckboxItem
                  label="I consent to the collection and use of my personal information for the purpose of this lucky draw and to be contacted by the organiser regarding the services I have expressed interest in. I understand my data will be handled in accordance with applicable data protection regulations."
                  checked={form.consent}
                  onChange={() => setForm({ ...form, consent: !form.consent })}
                />
              </div>
            </section>

            {/* Error */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-yellow-400 to-yellow-600 text-black font-bold text-lg disabled:opacity-50 hover:scale-[1.01] transition active:scale-[0.99] shadow-lg"
            >
              {loading ? 'Registering...' : 'Register for Lucky Draw'}
            </button>

            <p className="text-center text-gray-600 text-xs -mt-4">
              Fields marked <span className="text-red-400">*</span> are required
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
