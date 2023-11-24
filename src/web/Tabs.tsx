import { Cross2Icon, PlusIcon } from '@radix-ui/react-icons';
import { ICON_SIZE } from './constants.js';

interface Props {
  activeSessionKey: string;
  sessions: { key: string; title: string | null }[];
  addSession: () => void;
  deleteSession: (key: string) => void;
  selectSession: (key: string) => void;
}

export default function Tabs({
  activeSessionKey,
  sessions,
  addSession,
  deleteSession,
  selectSession,
}: Props) {
  return (
    <>
      {sessions.map(({ key, title }) => (
        <div key={key} className={`dk-tab ${activeSessionKey === key && 'dk-tab-active'}`}>
          {
            <>
              <button
                className={sessions.length === 1 ? 'dk-tab-select-solo' : 'dk-tab-select'}
                onClick={(event) => {
                  event.preventDefault();
                  selectSession(key);
                }}
              >
                {title ?? '<untitled>'}
              </button>
              {sessions.length > 1 && (
                <button
                  className="dk-tab-close"
                  onClick={(event) => {
                    event.preventDefault();
                    deleteSession(key);
                  }}
                >
                  <Cross2Icon />
                </button>
              )}
            </>
          }
        </div>
      ))}
      <div className="dk-tab">
        <button
          className="dk-new-tab"
          onClick={(event) => {
            event.preventDefault();
            addSession();
          }}
        >
          <PlusIcon width={ICON_SIZE} height={ICON_SIZE} />
        </button>
      </div>
    </>
  );
}
