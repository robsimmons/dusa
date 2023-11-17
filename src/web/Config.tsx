import React from 'react';
import { MoonIcon, Share1Icon, SunIcon } from '@radix-ui/react-icons';
import { ICON_SIZE } from './constants';
import * as Tooltip from '@radix-ui/react-tooltip';
const LS_THEME = 'dusa-theme';

interface Props {
  share: () => void;
}

export default function Config(props: Props) {
  const [mode, setMode] = React.useState<'light' | 'dark'>(
    localStorage.getItem(LS_THEME) === 'dark' ? 'dark' : 'light',
  );

  React.useEffect(() => {
    document.getElementById('root')!.className = `theme-${mode}`;
    localStorage.setItem(LS_THEME, mode);
  }, [mode]);

  function toggle() {
    const newMode = mode === 'light' ? 'dark' : 'light';
    setMode(newMode);
  }

  return (
    <>
      <div className="bottom-config">
        <Tooltip.Root>
          <Tooltip.Trigger asChild className="dk-trigger-button">
            <button onClick={() => props.share()}>
              <Share1Icon width={ICON_SIZE} height={ICON_SIZE} />
            </button>
          </Tooltip.Trigger>
          <Tooltip.Content className="dk-tooltip-button" side="right" sideOffset={8}>
            Copy a link that can be used to share the current program
          </Tooltip.Content>
        </Tooltip.Root>
        <Tooltip.Root>
          <Tooltip.Trigger asChild className="dk-trigger-button">
            <button id="themeswitcher" onClick={toggle}>
              {mode === 'light' && <SunIcon width={ICON_SIZE} height={ICON_SIZE} />}
              {mode === 'dark' && <MoonIcon width={ICON_SIZE} height={ICON_SIZE} />}{' '}
            </button>
          </Tooltip.Trigger>
          <Tooltip.Content className="dk-tooltip-button" side="right" sideOffset={8}>
            Switch to {mode === 'light' ? 'dark' : 'light'} mode
          </Tooltip.Content>
        </Tooltip.Root>
      </div>
    </>
  );
}
