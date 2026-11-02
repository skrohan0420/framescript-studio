import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { SlidersHorizontal, X } from "lucide-react";
import type { AudioClip } from "../shared/project";
import { useStudio } from "./store";
export function ClipVolume({
  clip,
  locked,
}: {
  clip: AudioClip;
  locked: boolean;
}) {
  const [position, setPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);
  useEffect(() => {
    if (!position) return;
    const close = () => setPosition(null);
    window.addEventListener("resize", close);
    return () => window.removeEventListener("resize", close);
  }, [position]);
  return (
    <>
      <button
        className="audio-clip-volume"
        aria-label={`Volume of ${clip.name}`}
        title="Clip volume"
        disabled={locked}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          const bounds = event.currentTarget.getBoundingClientRect();
          setPosition(
            position
              ? null
              : {
                  left: Math.max(
                    8,
                    Math.min(window.innerWidth - 220, bounds.right - 210),
                  ),
                  top: Math.max(8, bounds.top - 100),
                },
          );
        }}
      >
        <SlidersHorizontal size={11} />
      </button>
      {position &&
        createPortal(
          <div
            className="clip-volume-backdrop"
            onPointerDown={() => setPosition(null)}
          >
            <div
              className="clip-volume-popover"
              role="dialog"
              aria-label={`Clip volume: ${clip.name}`}
              style={position}
              onPointerDown={(event) => event.stopPropagation()}
              onKeyDown={(event) => {
                if (event.key === "Escape") setPosition(null);
              }}
            >
              <div>
                <strong>Clip volume</strong>
                <button
                  aria-label="Close clip volume"
                  onClick={() => setPosition(null)}
                >
                  <X size={13} />
                </button>
              </div>
              <small title={clip.name}>{clip.name}</small>
              <label>
                <input
                  autoFocus
                  type="range"
                  aria-label="Selected clip volume"
                  min="0"
                  max="1"
                  step="0.01"
                  value={Math.min(1, clip.volume)}
                  onChange={(event) => {
                    const state = useStudio.getState();
                    state.change(
                      {
                        audio: state.project.audio?.map((item) =>
                          item.id === clip.id
                            ? { ...item, volume: Number(event.target.value) }
                            : item,
                        ),
                      },
                      "Adjust clip volume",
                    );
                  }}
                />
                <span>{Math.round(clip.volume * 100)}%</span>
              </label>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
