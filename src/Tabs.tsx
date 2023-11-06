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
                  <span className="fa-solid fa-xmark" />
                </button>
              )}
            </>
          }
        </div>
      ))}
      <button
        className="dk-new-tab"
        onClick={(event) => {
          event.preventDefault();
          addSession();
        }}
      >
        <span className="fa-solid fa-plus"></span>
      </button>
    </>
  );
}
