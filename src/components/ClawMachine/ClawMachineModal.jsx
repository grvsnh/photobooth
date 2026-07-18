import React, { useEffect, useRef } from 'react';
import '../../styles/claw-machine.css';

export default function ClawMachineModal({ onClose }) {
  const rootRef = useRef(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    let cleanup = () => {};

    // Delay initialization by 50ms so layout/bounding rects are fully computed
    const timer = setTimeout(() => {
      const clawMachineEl = root.querySelector('.claw-machine');
      const boxEl = root.querySelector('.box');
      const collectionBoxEl = root.querySelector('.collection-box');
      const collectionArrowEl = root.querySelector('.collection-arrow');
      const machineTopEl = root.querySelector('.machine-top');
      const machineBottomEl = root.querySelector('.machine-bottom');

      if (!clawMachineEl || !boxEl || !machineTopEl || !machineBottomEl) return;

      const elements = {
        clawMachine: clawMachineEl,
        box: boxEl,
        collectionBox: collectionBoxEl,
        collectionArrow: collectionArrowEl,
        toys: [],
      };

      const settings = {
        targetToy: null,
        collectedNumber: 0,
      };

      const m = 2;
      const toys = {
        bear: { w: 20 * m, h: 27 * m },
        bunny: { w: 20 * m, h: 29 * m },
        golem: { w: 20 * m, h: 27 * m },
        cucumber: { w: 16 * m, h: 28 * m },
        penguin: { w: 24 * m, h: 22 * m },
        robot: { w: 20 * m, h: 30 * m },
      };

      const sortedToys = [...Object.keys(toys), ...Object.keys(toys)].sort(
        () => 0.5 - Math.random()
      );

      const cornerBuffer = 16;
      const machineBuffer = { x: 36, y: 16 };

      const radToDeg = (rad) => Math.round(rad * (180 / Math.PI));
      const calcX = (i, n) => i % n;
      const calcY = (i, n) => Math.floor(i / n);

      const { width: machineWidth, height: machineHeight, top: machineTop } = clawMachineEl.getBoundingClientRect();
      const { height: machineTopHeight } = machineTopEl.getBoundingClientRect();
      const { height: machineBottomHeight, top: machineBottomTop } = machineBottomEl.getBoundingClientRect();

      const maxArmLength = Math.max(100, machineBottomTop - machineTop - machineBuffer.y);

      const adjustAngle = (angle) => {
        const adjustedAngle = angle % 360;
        return adjustedAngle < 0 ? adjustedAngle + 360 : adjustedAngle;
      };

      const randomN = (min, max) => {
        return Math.round(min - 0.5 + Math.random() * (max - min + 1));
      };

      class Button {
        constructor({ className, action, isLocked, pressAction, releaseAction }) {
          Object.assign(this, {
            el: root.querySelector(`.${className}`),
            isLocked,
          });
          if (!this.el) return;
          if (action) this.el.addEventListener('click', action);
          ['mousedown', 'touchstart'].forEach((act) =>
            this.el.addEventListener(act, pressAction)
          );
          ['mouseup', 'touchend'].forEach((act) =>
            this.el.addEventListener(act, releaseAction)
          );

          if (!isLocked) this.activate();
        }
        activate() {
          this.isLocked = false;
          if (this.el) this.el.classList.add('active');
        }
        deactivate() {
          this.isLocked = true;
          if (this.el) this.el.classList.remove('active');
        }
      }

      class WorldObject {
        constructor(props) {
          Object.assign(this, {
            x: 0,
            y: 0,
            z: 0,
            angle: 0,
            transformOrigin: { x: 0, y: 0 },
            interval: null,
            default: {},
            moveWith: [],
            el: props.className && root.querySelector(`.${props.className}`),
            ...props,
          });
          this.setStyles();
          if (props.className && this.el) {
            const { width, height } = this.el.getBoundingClientRect();
            this.w = width;
            this.h = height;
          }
          ['x', 'y', 'w', 'h'].forEach((key) => {
            this.default[key] = this[key];
          });
        }
        setStyles() {
          if (!this.el) return;
          Object.assign(this.el.style, {
            left: `${this.x}px`,
            top: !this.bottom && `${this.y}px`,
            bottom: this.bottom,
            width: `${this.w}px`,
            height: `${this.h}px`,
            transformOrigin: this.transformOrigin,
          });
          this.el.style.zIndex = this.z;
        }
        setClawPos(clawPos) {
          this.clawPos = clawPos;
        }
        setTransformOrigin(transformOrigin) {
          this.transformOrigin =
            transformOrigin === 'center'
              ? 'center'
              : `${transformOrigin.x}px ${transformOrigin.y}px`;
          this.setStyles();
        }
        handleNext(next) {
          clearInterval(this.interval);
          this.interval = null;
          if (next) next();
        }
        resumeMove({ moveKey, target, moveTime, next }) {
          this.interval = null;
          this.move({ moveKey, target, moveTime, next });
        }
        resizeShadow() {
          if (elements.box) {
            elements.box.style.setProperty('--scale', 0.5 + this.h / maxArmLength / 2);
          }
        }
        move({ moveKey, target, moveTime, next }) {
          if (this.interval) {
            this.handleNext(next);
          } else {
            const moveTarget = target !== undefined ? target : this.default[moveKey];
            this.interval = setInterval(() => {
              const distance =
                Math.abs(this[moveKey] - moveTarget) < 10
                  ? Math.abs(this[moveKey] - moveTarget)
                  : 10;
              const increment = this[moveKey] > moveTarget ? -distance : distance;
              if (
                increment > 0
                  ? this[moveKey] < moveTarget
                  : this[moveKey] > moveTarget
              ) {
                this[moveKey] += increment;
                this.setStyles();
                if (moveKey === 'h') this.resizeShadow();
                if (this.moveWith.length) {
                  this.moveWith.forEach((obj) => {
                    if (!obj) return;
                    obj[moveKey === 'h' ? 'y' : moveKey] += increment;
                    obj.setStyles();
                  });
                }
              } else {
                this.handleNext(next);
              }
            }, moveTime || 100);
          }
        }
      }

      class Toy extends WorldObject {
        constructor(props) {
          const toyType = sortedToys[props.index];
          const size = toys[toyType];
          super({
            el: Object.assign(document.createElement('div'), {
              className: `toy pix ${toyType}`,
            }),
            x:
              cornerBuffer +
              calcX(props.index, 4) * ((machineWidth - cornerBuffer * 3) / 4) +
              size.w / 2 +
              randomN(-6, 6),
            y:
              machineBottomTop -
              machineTop +
              cornerBuffer +
              calcY(props.index, 4) *
                ((machineBottomHeight - cornerBuffer * 2) / 3) -
              size.h / 2 +
              randomN(-2, 2),
            z: 0,
            toyType,
            ...size,
            ...props,
          });
          if (elements.box) elements.box.append(this.el);
          const toy = this;

          this.el.addEventListener('click', () => this.collectToy(toy));
          elements.toys.push(this);
        }
        collectToy(toy) {
          toy.el.classList.remove('selected');
          toy.x = machineWidth / 2 - toy.w / 2;
          toy.y = machineHeight / 2 - toy.h / 2;
          toy.z = 7;
          toy.el.style.setProperty('--rotate-angle', '0deg');
          toy.setTransformOrigin('center');
          toy.el.classList.add('display');
          if (elements.clawMachine) elements.clawMachine.classList.add('show-overlay');
          settings.collectedNumber++;
          if (elements.collectionBox) {
            elements.collectionBox.appendChild(
              Object.assign(document.createElement('div'), {
                className: `toy-wrapper ${
                  settings.collectedNumber > 6 ? 'squeeze-in' : ''
                }`,
                innerHTML: `<div class="toy pix ${toy.toyType}"></div>`,
              })
            );
          }
          setTimeout(() => {
            if (elements.clawMachine) elements.clawMachine.classList.remove('show-overlay');
            if (!root.querySelector('.selected') && elements.collectionArrow)
              elements.collectionArrow.classList.remove('active');
          }, 1000);
        }
        setRotateAngle() {
          const angle =
            radToDeg(
              Math.atan2(
                this.y + this.h / 2 - this.clawPos.y,
                this.x + this.w / 2 - this.clawPos.x
              )
            ) - 90;
          const adjustedAngle = Math.round(adjustAngle(angle));
          this.angle =
            adjustedAngle < 180 ? adjustedAngle * -1 : 360 - adjustedAngle;
          this.el.style.setProperty('--rotate-angle', `${this.angle}deg`);
        }
      }

      if (elements.box) {
        elements.box.style.setProperty('--shadow-pos', `${maxArmLength}px`);
      }

      const armJoint = new WorldObject({ className: 'arm-joint' });
      const vertRail = new WorldObject({ className: 'vert', moveWith: [null, armJoint] });
      const arm = new WorldObject({ className: 'arm' });

      armJoint.resizeShadow();

      armJoint.move({
        moveKey: 'y',
        target: machineTopHeight - machineBuffer.y,
        moveTime: 50,
        next: () =>
          vertRail.resumeMove({
            moveKey: 'x',
            target: machineBuffer.x,
            moveTime: 50,
            next: () => {
              Object.assign(armJoint.default, {
                y: machineTopHeight - machineBuffer.y,
                x: machineBuffer.x,
              });
              Object.assign(vertRail.default, {
                x: machineBuffer.x,
              });
              activateHoriBtn();
            },
          }),
      });

      const doOverlap = (a, b) => {
        // Standard AABB collision check
        return (
          a.x < b.x + b.w &&
          a.x + a.w > b.x &&
          a.y < b.y + b.h &&
          a.y + a.h > b.y
        );
      };

      const getClosestToy = () => {
        const claw = {
          y: armJoint.y + maxArmLength + machineBuffer.y + 7,
          x: armJoint.x + 7,
          w: 40,
          h: 32,
        };
        const overlappedToys = elements.toys.filter((t) => doOverlap(t, claw));

        if (overlappedToys.length) {
          const toy = overlappedToys.sort((a, b) => b.index - a.index)[0];
          toy.setTransformOrigin({
            x: claw.x - toy.x,
            y: claw.y - toy.y,
          });
          toy.setClawPos({
            x: claw.x,
            y: claw.y,
          });
          settings.targetToy = toy;
        }
      };

      new Array(12).fill('').forEach((_, i) => {
        if (i === 8) return;
        new Toy({ index: i });
      });

      const stopHoriBtnAndActivateVertBtn = () => {
        armJoint.interval = null;
        horiBtn.deactivate();
        vertBtn.activate();
      };

      const activateHoriBtn = () => {
        horiBtn.activate();
        [vertRail, armJoint, arm].forEach((c) => (c.interval = null));
      };

      const dropToy = () => {
        if (arm.el) arm.el.classList.add('open');
        if (settings.targetToy) {
          settings.targetToy.z = 3;
          settings.targetToy.move({
            moveKey: 'y',
            target: machineHeight - settings.targetToy.h - 30,
            moveTime: 50,
          });
          [vertRail, armJoint, arm].forEach((obj) => (obj.moveWith[0] = null));
        }
        setTimeout(() => {
          if (arm.el) arm.el.classList.remove('open');
          activateHoriBtn();
          if (settings.targetToy) {
            settings.targetToy.el.classList.add('selected');
            if (elements.collectionArrow) elements.collectionArrow.classList.add('active');
            settings.targetToy = null;
          }
        }, 700);
      };

      const grabToy = () => {
        if (settings.targetToy) {
          [vertRail, armJoint, arm].forEach(
            (obj) => (obj.moveWith[0] = settings.targetToy)
          );
          settings.targetToy.setRotateAngle();
          settings.targetToy.el.classList.add('grabbed');
        } else {
          if (arm.el) arm.el.classList.add('missed');
        }
      };

      const horiBtn = new Button({
        className: 'hori-btn',
        isLocked: true,
        pressAction: () => {
          if (arm.el) arm.el.classList.remove('missed');
          vertRail.move({
            moveKey: 'x',
            target: machineWidth - armJoint.w - machineBuffer.x,
            next: stopHoriBtnAndActivateVertBtn,
          });
        },
        releaseAction: () => {
          clearInterval(vertRail.interval);
          stopHoriBtnAndActivateVertBtn();
        },
      });

      const vertBtn = new Button({
        className: 'vert-btn',
        isLocked: true,
        pressAction: () => {
          if (vertBtn.isLocked) return;
          armJoint.move({
            moveKey: 'y',
            target: machineBuffer.y,
          });
        },
        releaseAction: () => {
          clearInterval(armJoint.interval);
          vertBtn.deactivate();
          getClosestToy();
          setTimeout(() => {
            if (arm.el) arm.el.classList.add('open');
            arm.move({
              moveKey: 'h',
              target: maxArmLength,
              next: () =>
                setTimeout(() => {
                  if (arm.el) arm.el.classList.remove('open');
                  grabToy();
                  arm.resumeMove({
                    moveKey: 'h',
                    next: () => {
                      vertRail.resumeMove({
                        moveKey: 'x',
                        next: () => {
                          armJoint.resumeMove({
                            moveKey: 'y',
                            next: dropToy,
                          });
                        },
                      });
                    },
                  });
                }, 500),
            });
          }, 500);
        },
      });

      cleanup = () => {
        [vertRail, armJoint, arm].forEach((obj) => {
          if (obj && obj.interval) clearInterval(obj.interval);
        });
      };
    }, 60);

    return () => {
      clearTimeout(timer);
      cleanup();
    };
  }, []);

  return (
    <div
      className="claw-modal-backdrop"
      onClick={(e) => e.target.classList.contains('claw-modal-backdrop') && onClose()}
    >
      <button className="claw-modal-close-btn" onClick={onClose} title="Close Claw Machine">
        ×
      </button>
      <div className="claw-game-root" ref={rootRef}>
        <div className="wrapper">
          <div className="collection-box pix"></div>
          <div className="claw-machine">
            <div className="box pix">
              <div className="machine-top pix">
                <div className="arm-joint pix">
                  <div className="arm pix">
                    <div className="claws pix"></div>
                  </div>
                </div>
                <div className="rail vert pix"></div>
                <div className="rail hori pix"></div>
              </div>
              <div className="machine-bottom pix">
                <div className="collection-point pix"></div>
              </div>
            </div>
            <div className="control pix">
              <div className="cover left"></div>
              <button className="hori-btn pix" aria-label="Move Horizontal"></button>
              <button className="vert-btn pix" aria-label="Move Vertical"></button>
              <div className="cover right">
                <div className="instruction pix"></div>
              </div>
              <div className="cover bottom"></div>
              <div className="cover top">
                <div className="collection-arrow pix"></div>
              </div>
              <div className="collection-point pix"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
