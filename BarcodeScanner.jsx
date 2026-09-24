import React, { useEffect, useRef, useState } from "react";
import { X, ScanLine } from "lucide-react";

export default function BarcodeScanner({ onDetected, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [supported, setSupported] = useState(true);
  const [error, setError] = useState("");
  const [manual, setManual] = useState("");

  useEffect(() => {
    if (!("BarcodeDetector" in window)) {
      setSupported(false);
      return;
    }

    let stopped = false;
    let rafId;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        const detector = new window.BarcodeDetector({
          formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "qr_code"]
        });

        const tick = async () => {
          if (stopped || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes.length > 0) {
              onDetected(codes[0].rawValue);
              return; // stop after first hit
            }
          } catch {
            // transient detection errors are expected between frames; ignore
          }
          rafId = requestAnimationFrame(tick);
        };
        rafId = requestAnimationFrame(tick);
      } catch (err) {
        setError(err.message || "Could not access camera.");
      }
    }

    start();
    return () => {
      stopped = true;
      if (rafId) cancelAnimationFrame(rafId);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [onDetected]);

  const submitManual = (e) => {
    e.preventDefault();
    if (manual.trim()) onDetected(manual.trim());
  };

  return (
    <div className="modal-overlay">
      <div className="modal-box scanner-modal">
        <div className="modal-header">
          <h3><ScanLine size={16} /> Scan Barcode</h3>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        {supported ? (
          <>
            {error && <div className="form-error">{error}</div>}
            <video ref={videoRef} className="scanner-video" muted playsInline />
            <p className="form-hint">Point the camera at a barcode.</p>
          </>
        ) : (
          <p className="form-hint">Your browser doesn't support camera barcode scanning. Enter the code manually.</p>
        )}

        <form className="inline-form" onSubmit={submitManual}>
          <input placeholder="Or type barcode manually" value={manual} onChange={(e) => setManual(e.target.value)} />
          <button className="complete-btn small" type="submit">Add</button>
        </form>
      </div>
    </div>
  );
}
