import React, { useState } from 'react';
import SignBoard from './SignBoard';
import PosterWall from './PosterWall';
import PrinterSlot from './PrinterSlot';
import CurtainCanvas from '../CurtainCanvas/CurtainCanvas';

export default function OutsideScene({
  hidden,
  theme,
  onEnterBooth,
  currentScene,
  isTransitioning,
  interiorDarkVisible,
  slotCanvasRef,
  lampStatus,
  motorActive,
  instructionText,
  onDetachSlot,
  onPlayClawGame
}) {
  const [clawClicked, setClawClicked] = useState(false);

  const handleClawClick = () => {
    setClawClicked(true);
    setTimeout(() => setClawClicked(false), 1200);
    if (onPlayClawGame) {
      onPlayClawGame();
    }
  };

  const baseUrl = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;

  return (
    <section
      id="sceneOutside"
      className="scene scene--outside"
      aria-label="Outside the photobooth"
      hidden={hidden}
    >
      <div className="outside__bg">
        <div className="outside__floor"></div>
        <div className="outside__wall"></div>
        <div className="outside__vignette"></div>
      </div>

      <div className="anime-particle anime-particle--1" aria-hidden="true"></div>
      <div className="anime-particle anime-particle--2" aria-hidden="true"></div>
      <div className="anime-particle anime-particle--3" aria-hidden="true"></div>

      <div id="booth" className="booth">
        <div className="booth__cornice">
          <div className="booth__cornice-trim"></div>
        </div>

        <SignBoard theme={theme} />

        <div className="booth__body">
          <PosterWall />

          <div className="booth__entrance">
            <div className="entrance__frame">
              <div className="entrance__dark"></div>
              <div
                className="curtain-hint"
                onClick={onEnterBooth}
                title="Click or pull curtain to enter"
              >
                PULL CURTAIN<br /><span>TO ENTER</span>
              </div>
              <CurtainCanvas
                onEnterBooth={onEnterBooth}
                currentScene={currentScene}
                isTransitioning={isTransitioning}
              />
              <div
                id="interiorDark"
                className={`entrance__interior-dark ${interiorDarkVisible ? 'is-visible' : ''}`}
              ></div>
            </div>
          </div>

          <div className="booth__column booth__column--right">
            <PrinterSlot
              slotCanvasRef={slotCanvasRef}
              lampStatus={lampStatus}
              motorActive={motorActive}
              instructionText={instructionText}
              onDetach={onDetachSlot}
            />

            <div
              className={`booth-claw-decal ${clawClicked ? 'is-dispensing' : ''}`}
              onClick={handleClawClick}
              title="Click to Play Claw Machine Game!"
            >
              <img src={`${baseUrl}assets/claw-machine.png`} alt="Claw Machine" />
              <div className="claw-play-badge">PLAY</div>
              {clawClicked && <div className="vending-coin-anim">👾 PLAY!</div>}
            </div>
          </div>
        </div>

        {/* Photobooth Base & Feet anchored firmly to the floor */}
        <div className="booth__base">
          <div className="booth__foot booth__foot--left"></div>
          <div className="booth__foot booth__foot--right"></div>
        </div>

        <div className="booth__vibe" aria-hidden="true"></div>
      </div>
    </section>
  );
}
