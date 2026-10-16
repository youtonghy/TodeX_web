import { useState } from 'react';
import { RiGithubLine } from '@remixicon/react';
import { Button, ButtonLink } from '@/components/base/buttons/button';
import { DirectionProvider } from '@/components/foundations/direction/direction';
import { Modal } from '@/components/ui/modal';
import { useLocale, useT } from '../i18n';

const REPOSITORY_URL = 'https://github.com/youtonghy/TodeX_web';

/** iPhone/iPod, and iPad, which reports a desktop "Macintosh" UA since
 * iPadOS 13 and is told apart from a Mac by its touch points. */
function isAppleMobile(): boolean {
  const { userAgent, maxTouchPoints } = navigator;
  return /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
}

/** Web-only: the workbench does not support iOS/iPadOS browsers, so point
 * those visitors at self-hosting. Dismissable for the current page load. */
export function IosUnsupportedNotice() {
  const t = useT();
  const locale = useLocale();
  const [isOpen, setIsOpen] = useState(isAppleMobile);
  return (
    <DirectionProvider locale={locale}>
      <Modal
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        title={t('iosUnsupported.title')}
        description={t('iosUnsupported.body')}
        size="md"
        hideCloseButton
        bodyClassName="pb-0"
        footer={(
          <>
            <Button variant="secondary" onClick={() => setIsOpen(false)}>{t('iosUnsupported.continue')}</Button>
            <ButtonLink href={REPOSITORY_URL} target="_blank" rel="noreferrer" leadingIcon={RiGithubLine}>
              {t('iosUnsupported.repository')}
            </ButtonLink>
          </>
        )}
      />
    </DirectionProvider>
  );
}
