import { useRef, useEffect } from 'react';

const COLORS = ['#e53e3e', '#dd6b20', '#d69e2e', '#38a169', '#3182ce', '#805ad5'];

export default function WheelCanvas({ participants, rotation, onRotationFrame }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    draw();
  }, [participants, rotation]);

  function draw() {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext('2d');
    const W = cvs.width;
    const H = cvs.height;
    const cx = W / 2;
    const cy = H / 2;
    const radius = W / 2;

    ctx.clearRect(0, 0, W, H);

    const total = participants.length;
    if (total === 0) {
      ctx.fillStyle = '#4a5568';
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#a0aec0';
      ctx.font = 'bold 24px Poppins, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('No participants', cx, cy);
      return;
    }

    const arc = (2 * Math.PI) / total;
    const circumference = 2 * Math.PI * radius;
    const fontSize = Math.min(60, Math.max(8, (circumference / total) * 0.30));

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-cx, -cy);

    participants.forEach((p, i) => {
      const angle = i * arc;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, angle, angle + arc);
      ctx.fillStyle = COLORS[i % COLORS.length];
      ctx.fill();
      ctx.strokeStyle = '#1a202c';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle + arc / 2);
      ctx.translate(radius - 20, 0);
      ctx.rotate(Math.PI);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${fontSize}px 'Roboto Mono', monospace`;
      ctx.fillText(p.name, 0, 0);
      ctx.restore();
    });

    // Center donut hole
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.15, 0, Math.PI * 2);
    ctx.fillStyle = '#1a202c';
    ctx.fill();

    ctx.restore();
  }

  return (
    <div className="relative w-full" style={{ maxWidth: 600, aspectRatio: '1/1', margin: '0 auto', filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.5))' }}>
      {/* Pointer */}
      <div style={{
        position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
        width: 40, height: 50, zIndex: 10,
        background: '#fff',
        clipPath: 'polygon(100% 0, 50% 100%, 0 0)',
        filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
      }} />
      <canvas
        ref={canvasRef}
        width={900}
        height={900}
        style={{ width: '100%', height: '100%', borderRadius: '50%' }}
      />
    </div>
  );
}
