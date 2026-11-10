// A docs-embedded walkthrough: the real workbench (/demo) driven by its
// scripted autoplay, which the reader can watch but not click. The bar below
// plays, pauses and restarts it; the demo reports its chapter and progress
// back (see demo/playback.ts) and plays once instead of looping.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@heroui/react';
import { RiPauseFill, RiPlayFill, RiResetLeftLine } from '@remixicon/react';
import { useLocale, useT, type MessageKey } from '../../i18n';
import { DEMO_PATH, DEMO_STEPS, demoFrameSize, isDemoStatusMessage, type DemoPlaybackMessage, type DemoStep } from '../../demo/playback';

/** The chapters a reader watches; loading and done sit outside the count. */
const chapters: readonly DemoStep[] = DEMO_STEPS.filter((step) => step !== 'loading' && step !== 'done');

const stepLabels: Record<DemoStep, MessageKey> = {
  loading: 'docs.demo.step.loading',
  newConversation: 'docs.demo.step.newConversation',
  typing: 'docs.demo.step.typing',
  send: 'docs.demo.step.send',
  process: 'docs.demo.step.process',
  answer: 'docs.demo.step.answer',
  done: 'docs.demo.step.done',
};

export function DocsDemo() {
  const t = useT();
  const locale = useLocale();
  const stageRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [width, setWidth] = useState(0);
  const [loaded, setLoaded] = useState(false);
  // The demo's entry is a deferred module that may start listening after the
  // frame's load event, so play/pause is sent once it has reported back.
  const [ready, setReady] = useState(false);
  const [onScreen, setOnScreen] = useState(false);
  // Reduced motion waits for the reader to press play.
  const [paused, setPaused] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [status, setStatus] = useState<{ step: DemoStep; progress: number; ended: boolean }>({ step: 'loading', progress: 0, ended: false });

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const resize = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    const view = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting), { threshold: 0.35 });
    resize.observe(stage);
    view.observe(stage);
    return () => {
      resize.disconnect();
      view.disconnect();
    };
  }, []);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== frameRef.current?.contentWindow) return;
      if (!isDemoStatusMessage(event.data)) return;
      setReady(true);
      setStatus({ step: event.data.step, progress: event.data.progress, ended: event.data.ended });
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // The walkthrough runs while it is on screen, not paused and not finished.
  const playing = ready && onScreen && !paused && !status.ended;
  useEffect(() => {
    if (!ready) return;
    const message: DemoPlaybackMessage = { type: 'todex-demo-playback', playing };
    frameRef.current?.contentWindow?.postMessage(message, window.location.origin);
  }, [ready, playing]);

  const restart = useCallback(() => {
    setLoaded(false);
    setReady(false);
    setPaused(false);
    setStatus({ step: 'loading', progress: 0, ended: false });
    frameRef.current?.contentWindow?.location.reload();
  }, []);

  const size = demoFrameSize(width);
  const scale = width ? width / size.width : 1;
  const chapter = chapters.indexOf(status.step);
  const percent = Math.round(status.progress * 100);

  return (
    <figure className="docs-demo">
      <div ref={stageRef} className="docs-demo-stage" role="img" aria-label={t('docs.demo.ariaLabel')}
        style={width ? { height: Math.round(size.height * scale) } : undefined}>
        {width ? (
          <iframe key={locale} ref={frameRef} src={`${DEMO_PATH}?lang=${locale}&autoplay&controls`} title={t('docs.demo.ariaLabel')}
            loading="lazy" inert tabIndex={-1} className={loaded ? 'is-loaded' : undefined} onLoad={() => setLoaded(true)}
            style={{ width: size.width, height: size.height, transform: `scale(${scale})` }} />
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
        <Button size="sm" variant="ghost" className="docs-demo-restart" onPress={restart} isDisabled={!ready && !status.ended}>
          <RiResetLeftLine size={14} /> {t('docs.demo.restart')}
        </Button>
        <div className="docs-demo-progress" role="progressbar" aria-label={t('docs.demo.progress')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
          <span style={{ transform: `scaleX(${status.progress})` }} />
        </div>
        <span className="docs-demo-step" aria-live="polite">
          {chapter >= 0 ? <small>{chapter + 1}/{chapters.length}</small> : null}{t(stepLabels[status.step])}
        </span>
      </figcaption>
      <p className="docs-demo-note">{t('docs.demo.note')}</p>
    </figure>
  );
}
