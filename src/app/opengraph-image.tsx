import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Snapshot — private photo galleries';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#0c0c0c',
          color: '#f5f1ea',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '80px',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <div style={{ width: 64, height: 64, background: '#ff7849' }} />
          <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-0.02em' }}>Snapshot</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div
            style={{
              fontSize: 32,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.16em',
              color: '#ff7849',
            }}
          >
            Photo galleries
          </div>
          <div
            style={{
              fontSize: 96,
              fontWeight: 800,
              letterSpacing: '-0.03em',
              lineHeight: 1.05,
            }}
          >
            Private galleries
            <br />
            for your clients.
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
