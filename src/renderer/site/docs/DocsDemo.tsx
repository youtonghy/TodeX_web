// A docs-embedded workbench preview: either the scripted walkthrough
// (`walkthrough`, inert with play/pause/restart controls) or an interactive
// feature scene (`/demo?scene=<scene>`) framed in a workbench window chrome.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@heroui/react';
import { RiPauseFill, RiPlayFill, RiResetLeftLine } from '@remixicon/react';
import brand from '../../assets/brand/t-icon-light.png';
import { useLocale, useT, type MessageKey } from '../../i18n';
import { DEMO_STEPS, demoFrameSize, demoSceneUrl, isDemoStatusMessage, type DemoPlaybackMessage, type DemoScene, type DemoStep } from '../../demo/playback';

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

const sceneTitleKeys: Record<DemoScene, MessageKey> = {
  walkthrough: 'docs.demo.scene.walkthrough.title',
  mesh: 'docs.demo.scene.mesh.title',
  smart: 'docs.demo.scene.smart.title',
  'smart-settings': 'docs.demo.scene.smart-settings.title',
  'plan-steps': 'docs.demo.scene.plan-steps.title',
  'execution-group': 'docs.demo.scene.execution-group.title',
  'background-tasks': 'docs.demo.scene.background-tasks.title',
  home: 'docs.demo.scene.home.title',
  'computer-live': 'docs.demo.scene.computer-live.title',
  'agent-browser': 'docs.demo.scene.agent-browser.title',
  'linked-skills': 'docs.demo.scene.linked-skills.title',
  'config-sync': 'docs.demo.scene.config-sync.title',
  'offline-sidebar': 'docs.demo.scene.offline-sidebar.title',
};

const sceneCaptionKeys: Record<DemoScene, MessageKey> = {
  walkthrough: 'docs.demo.scene.walkthrough.caption',
  mesh: 'docs.demo.scene.mesh.caption',
  smart: 'docs.demo.scene.smart.caption',
  'smart-settings': 'docs.demo.scene.smart-settings.caption',
  'plan-steps': 'docs.demo.scene.plan-steps.caption',
  'execution-group': 'docs.demo.scene.execution-group.caption',
  'background-tasks': 'docs.demo.scene.background-tasks.caption',
  home: 'docs.demo.scene.home.caption',
  'computer-live': 'docs.demo.scene.computer-live.caption',
  'agent-browser': 'docs.demo.scene.agent-browser.caption',
  'linked-skills': 'docs.demo.scene.linked-skills.caption',
  'config-sync': 'docs.demo.scene.config-sync.caption',
  'offline-sidebar': 'docs.demo.scene.offline-sidebar.caption',
};

export function DocsDemo({ scene = 'walkthrough' }: { scene?: DemoScene }) {
  const t = useT();
  const locale = useLocale();
  const isWalkthrough = scene === 'walkthrough';
  const stageRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [width, setWidth] = useState(0);
  const [nearViewport, setNearViewport] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);
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
    if (!isWalkthrough) return;
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== frameRef.current?.contentWindow) return;
      if (!isDemoStatusMessage(event.data)) return;
      setReady(true);
      setStatus({ step: event.data.step, progress: event.data.progress, ended: event.data.ended });
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [isWalkthrough]);

  // The walkthrough runs while it is on screen, not paused and not finished.
  const playing = isWalkthrough && ready && onScreen && !paused && !status.ended;
  useEffect(() => {
    if (!isWalkthrough || !ready) return;
    const message: DemoPlaybackMessage = { type: 'todex-demo-playback', playing };
    frameRef.current?.contentWindow?.postMessage(message, window.location.origin);
  }, [isWalkthrough, ready, playing]);

  const restart = useCallback(() => {
    setLoaded(false);
    setReady(false);
    setPaused(false);
    setStatus({ step: 'loading', progress: 0, ended: false });
    setReloadNonce((count) => count + 1);
  }, []);

  const size = demoFrameSize(width);
  const scale = width ? width / size.width : 1;
  const chapter = chapters.indexOf(status.step);
  const percent = Math.round(status.progress * 100);
  const sceneTitle = t(sceneTitleKeys[scene]);
  const iframeSrc = demoSceneUrl(scene, locale);

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
        <span className="docs-demo-badge">
          {isWalkthrough ? t('site.preview.demoLabel') : t('docs.demo.interactiveBadge')}
        </span>
      </div>
      <div
        ref={stageRef}
        className="docs-demo-stage"
        role={isWalkthrough ? 'img' : undefined}
        aria-label={isWalkthrough ? t('docs.demo.ariaLabel') : sceneTitle}
        style={width ? { height: Math.round(size.height * scale) } : undefined}
      >
        {width && nearViewport ? (
          <iframe
            key={`${locale}:${scene}:${reloadNonce}`}
            ref={frameRef}
            src={iframeSrc}
            title={isWalkthrough ? t('docs.demo.ariaLabel') : sceneTitle}
            loading="lazy"
            inert={isWalkthrough ? true : undefined}
            tabIndex={isWalkthrough ? -1 : undefined}
            className={[loaded ? 'is-loaded' : '', !isWalkthrough ? 'is-interactive' : ''].filter(Boolean).join(' ') || undefined}
            onLoad={() => setLoaded(true)}
            style={{ width: size.width, height: size.height, transform: `scale(${scale})` }}
          />
        ) : null}
      </div>
      {isWalkthrough ? (
        <>
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
        </>
      ) : (
        <figcaption className="docs-demo-controls docs-demo-scene-bar">
          <span className="docs-demo-scene-caption">{t(sceneCaptionKeys[scene])}</span>
          <Button size="sm" variant="ghost" className="docs-demo-restart" onPress={restart} isDisabled={!loaded}>
            <RiResetLeftLine size={14} /> {t('docs.demo.resetScene')}
          </Button>
        </figcaption>
      )}
    </figure>
  );
}
