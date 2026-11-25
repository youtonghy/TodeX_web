// A docs-embedded workbench demo: the real workbench (`/demo?scene=<scene>`)
// driven by a script, framed in a workbench window chrome. It plays itself
// once it is on screen; the reader can pause it, restart it, or jump to any
// step from the step bar.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@heroui/react';
import { RiArrowLeftSLine, RiArrowRightSLine, RiPauseFill, RiPlayFill, RiResetLeftLine } from '@remixicon/react';
import brand from '../../assets/brand/t-icon-light.png';
import { useLocale, useT, type MessageKey } from '../../i18n';
import { DEMO_SCENE_STEPS, demoFrameSize, demoSceneUrl, isDemoStatusMessage, type DemoPlaybackMessage, type DemoScene, type DemoSeekMessage } from '../../demo/playback';

type Status = { step: number; seeking: boolean; ended: boolean };
const initialStatus: Status = { step: -1, seeking: false, ended: false };

/** Every key below is checked for each scene and step in tests/unit/docsContent.test.ts. */
const sceneKey = (scene: DemoScene, part: 'title' | 'caption') => `docs.demo.scene.${scene}.${part}` as MessageKey;
const stepKey = (scene: DemoScene, step: string) => `docs.demo.scene.${scene}.step.${step}` as MessageKey;

export function DocsDemo({ scene = 'walkthrough' }: { scene?: DemoScene }) {
  const t = useT();
  const locale = useLocale();
  const steps: readonly string[] = DEMO_SCENE_STEPS[scene];
  const stageRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [width, setWidth] = useState(0);
  const [nearViewport, setNearViewport] = useState(false);
  const [loaded, setLoaded] = useState(false);
  // Each reload starts the frame at `startStep` (fast-forwarding to it).
  const [frame, setFrame] = useState({ nonce: 0, startStep: 0 });
  // The demo's entry is a deferred module that may start listening after the
  // frame's load event, so play/pause is sent once it has reported back.
  const [ready, setReady] = useState(false);
  const [onScreen, setOnScreen] = useState(false);
  // Reduced motion waits for the reader to press play.
  const [paused, setPaused] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [status, setStatus] = useState<Status>(initialStatus);
  // The step the reader asked for, shown as current until the demo gets there.
  const [pending, setPending] = useState<number | null>(null);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const resize = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    const preload = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setNearViewport(true);
      },
      { rootMargin: '350px 0px' },
    );
    const view = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting), { threshold: 0.35 });
    resize.observe(stage);
    preload.observe(stage);
    view.observe(stage);
    return () => {
      resize.disconnect();
      preload.disconnect();
      view.disconnect();
    };
  }, []);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== frameRef.current?.contentWindow) return;
      if (!isDemoStatusMessage(event.data)) return;
      const next: Status = { step: event.data.step, seeking: event.data.seeking, ended: event.data.ended };
      setReady(true);
      setStatus((current) => (current.step === next.step && current.seeking === next.seeking && current.ended === next.ended ? current : next));
      if ((!next.seeking && next.step >= 0) || next.ended) setPending(null);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // The demo runs while it is on screen, not paused and not finished.
  const playing = ready && onScreen && !paused && !status.ended;
  useEffect(() => {
    if (!ready) return;
    const message: DemoPlaybackMessage = { type: 'todex-demo-playback', playing };
    frameRef.current?.contentWindow?.postMessage(message, window.location.origin);
  }, [ready, playing]);

  const reload = useCallback((startStep: number) => {
    setLoaded(false);
    setReady(false);
    setStatus(initialStatus);
    setFrame((current) => ({ nonce: current.nonce + 1, startStep }));
  }, []);

  const goTo = useCallback((target: number) => {
    const step = Math.min(Math.max(target, 0), steps.length - 1);
    setPaused(false);
    setPending(step);
    // Later steps fast-forward in place; earlier ones (or a finished demo)
    // start over from the requested step.
    if (ready && !status.ended && step > status.step) {
      const message: DemoSeekMessage = { type: 'todex-demo-seek', step };
      frameRef.current?.contentWindow?.postMessage(message, window.location.origin);
    } else {
      reload(step);
    }
  }, [ready, reload, status.ended, status.step, steps.length]);

  const restart = useCallback(() => {
    setPaused(false);
    setPending(null);
    reload(0);
  }, [reload]);

  const size = demoFrameSize(width);
  const scale = width ? width / size.width : 1;
  const current = pending ?? status.step;
  // Hide the frame while it loads or fast-forwards to the requested step.
  const covered = !loaded || status.step < 0 || status.seeking || pending !== null;
  const sceneTitle = t(sceneKey(scene, 'title'));
  const label = `${sceneTitle} · ${t('docs.demo.ariaLabel')}`;
  const stepText = status.ended ? t('docs.demo.done') : current >= 0 ? t(stepKey(scene, steps[current])) : t('docs.demo.loading');

  return (
    <figure className="docs-demo">
      <div className="docs-demo-titlebar">
        <div className="docs-demo-dots" aria-hidden="true"><i /><i /><i /></div>
        <span className="docs-demo-window-title">
          <img src={brand} alt="" width="15" height="15" />
          <span>TodeX</span>
          <span className="docs-demo-title-slash">/</span>
          <span className="docs-demo-title-scene">{sceneTitle}</span>
        </span>
        <span className="docs-demo-badge">{t('site.preview.demoLabel')}</span>
      </div>
      <div
        ref={stageRef}
        className={covered ? 'docs-demo-stage is-covered' : 'docs-demo-stage'}
        role="img"
        aria-label={label}
        style={width ? { height: Math.round(size.height * scale) } : undefined}
      >
        {width && nearViewport ? (
          <iframe
            key={`${locale}:${scene}:${frame.nonce}`}
            ref={frameRef}
            src={demoSceneUrl(scene, locale, frame.startStep)}
            title={label}
            loading="lazy"
            inert
            tabIndex={-1}
            className={loaded ? 'is-loaded' : undefined}
            onLoad={() => setLoaded(true)}
            style={{ width: size.width, height: size.height, transform: `scale(${scale})` }}
          />
        ) : null}
      </div>
      <figcaption className="docs-demo-controls">
        {status.ended ? (
          <Button size="sm" variant="ghost" isIconOnly aria-label={t('docs.demo.replay')} onPress={restart}><RiResetLeftLine size={16} /></Button>
        ) : (
          <Button size="sm" variant="ghost" isIconOnly aria-label={paused ? t('docs.demo.play') : t('docs.demo.pause')} isDisabled={!ready}
            onPress={() => setPaused(!paused)}>
            {paused ? <RiPlayFill size={16} /> : <RiPauseFill size={16} />}
          </Button>
        )}
        <Button size="sm" variant="ghost" isIconOnly aria-label={t('docs.demo.prevStep')} isDisabled={current <= 0} onPress={() => goTo(current - 1)}>
          <RiArrowLeftSLine size={16} />
        </Button>
        <Button size="sm" variant="ghost" isIconOnly aria-label={t('docs.demo.nextStep')} isDisabled={current >= steps.length - 1} onPress={() => goTo(current + 1)}>
          <RiArrowRightSLine size={16} />
        </Button>
        <ol className="docs-demo-steps" aria-label={t('docs.demo.steps')}>
          {steps.map((step, index) => {
            const stepLabel = t(stepKey(scene, step));
            const state = index < current || (status.ended && index === current) ? 'done' : index === current ? 'current' : 'todo';
            return (
              <li key={step}>
                <button type="button" className={`docs-demo-step-dot is-${state}`} aria-current={index === current ? 'step' : undefined}
                  aria-label={`${index + 1}/${steps.length} ${stepLabel}`} title={stepLabel} onClick={() => goTo(index)} />
              </li>
            );
          })}
        </ol>
        <span className="docs-demo-step" aria-live="polite">
          {current >= 0 && !status.ended ? <small>{current + 1}/{steps.length}</small> : null}{stepText}
        </span>
        <Button size="sm" variant="ghost" className="docs-demo-restart" onPress={restart} isDisabled={!ready && !status.ended}>
          <RiResetLeftLine size={14} /> {t('docs.demo.restart')}
        </Button>
      </figcaption>
      <p className="docs-demo-note">{t(sceneKey(scene, 'caption'))} {t('docs.demo.note')}</p>
    </figure>
  );
}
