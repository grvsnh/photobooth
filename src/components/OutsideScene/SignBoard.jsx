import React from 'react';

export default function SignBoard({ theme = 'dark' }) {
  const isNight = theme === 'dark';

  return (
    <div
      id="signBoard"
      className={`storefront-sign storefront-sign--full-width ${isNight ? 'is-night-mode' : 'is-day-mode'}`}
      title="PHOTOBOOTH Storefront Signboard"
    >
      <div className="sign__board">
        <div className="sign__brass-corner sign__brass-corner--tl"></div>
        <div className="sign__brass-corner sign__brass-corner--tr"></div>
        <div className="sign__brass-corner sign__brass-corner--bl"></div>
        <div className="sign__brass-corner sign__brass-corner--br"></div>

        <div className="sign__text">
          <span className="sign__title-main">PHOTOBOOTH</span>
        </div>
      </div>
    </div>
  );
}
