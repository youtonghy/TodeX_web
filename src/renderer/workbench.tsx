import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RiBookOpenLine } from '@remixicon/react';
import { ButtonLink } from '@/components/base/buttons/button';
import { DirectionProvider } from '@/components/foundations/direction/direction';
import { Modal } from '@/components/ui/modal';
import { AppRoot } from './AppRoot';
import { IosUnsupportedNotice } from './components/IosUnsupportedNotice';
import { useLocale, useT } from './i18n';
import { installWebPlatformBridge } from './lib/webPlatform';
import { applyAppearance } from './lib/appearance';
import { loadWebDeployment } from './lib/webDeployment';
import '@fontsource-variable/inter';
import './styles/global.css';

const SELF_HOSTING_GUIDE_URL = 'https://github.com/youtonghy/TodeX_web/blob/main/docs/self-hosting.md';

/** Plain HTTP from a non-local address is not a secure context: WebCrypto
 * and `crypto.randomUUID` are missing, so device keys cannot be created or
 * sealed. Say so instead of starting a workbench that fails confusingly. */
function SecureContextRequiredNotice() {
  const t = useT();
  const locale = useLocale();
  return (
    <DirectionProvider locale={locale}>
      <Modal
        isOpen
        onOpenChange={() => {}}
        title={t('secureContext.title')}
        description={t('secureContext.body')}
        size="md"
        isDismissable={false}
        isKeyboardDismissDisabled
        hideCloseButton
        footer={(
          <ButtonLink href={SELF_HOSTING_GUIDE_URL} target="_blank" rel="noreferrer" leadingIcon={RiBookOpenLine}>
            {t('secureContext.guide')}
          </ButtonLink>
        )}
      >
        <p className="text-body-regular text-text-secondary">{t('secureContext.hint')}</p>
      </Modal>
    </DirectionProvider>
  );
}

const secure = window.isSecureContext;
if (secure) {
  // A self-hosted server pins its backends; the session reads them from the
  // bridge on its first load, so the bridge is installed only once they are known.
  installWebPlatformBridge(await loadWebDeployment());
  // Keep parity with the desktop renderer: the window-chrome attribute drives
  // drag-region CSS, which is inert in a browser ('native').
  document.documentElement.dataset.windowChrome = window.todexWeb.app.windowChrome;
}
applyAppearance();

const root = document.getElementById('root');
if (!root) throw new Error('root element missing');

const reactRoot = createRoot(root);
// A hot update that cannot Fast Refresh re-runs this module: unmount the
// previous app first, or it keeps running unseen with its own state,
// backend sockets and store writes beside the new one.
import.meta.hot?.dispose(() => reactRoot.unmount());
reactRoot.render(secure ? (
  <StrictMode>
    <AppRoot />
    <IosUnsupportedNotice />
  </StrictMode>
) : (
  <StrictMode>
    <SecureContextRequiredNotice />
  </StrictMode>
));
