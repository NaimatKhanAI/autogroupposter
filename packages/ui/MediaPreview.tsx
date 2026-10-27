import React, { useEffect, useState } from "react";
import { mediaUrl } from "../client";
export function MediaPreview({ paths }: { paths: string[] }) {
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => {
    let active = true;
    setUrls([]);
    if (paths.length)
      void Promise.all(paths.map(mediaUrl))
        .then((value) => {
          if (active) setUrls(value);
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [paths.join("|")]);
  if (!paths.length) return null;
  return (
    <div className="media-preview-grid">
      {urls.length ? (
        urls.map((url, i) => (
          <img key={url} src={url} alt={`Attached image ${i + 1}`} />
        ))
      ) : (
        <small>Image preview loading…</small>
      )}
    </div>
  );
}
