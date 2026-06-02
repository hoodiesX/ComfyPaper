"use client";

import React from "react";
import { useRef, useState } from "react";

type PdfDropzoneProps = {
  disabled?: boolean;
  onFileSelected: (file: File) => void;
};

export function PdfDropzone({ disabled = false, onFileSelected }: PdfDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (file) {
      onFileSelected(file);
    }
  }

  return (
    <div
      className={`rounded-lg border border-dashed p-6 transition md:p-8 ${
        isDragging
          ? "border-brass bg-brass/10"
          : "border-sage/35 bg-white/70 hover:border-sage/70"
      } ${disabled ? "cursor-wait opacity-70" : "cursor-pointer"}`}
      onClick={() => !disabled && inputRef.current?.click()}
      onDragEnter={(event) => {
        event.preventDefault();
        if (!disabled) setIsDragging(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setIsDragging(true);
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        setIsDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        if (!disabled) handleFiles(event.dataTransfer.files);
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (!disabled && (event.key === "Enter" || event.key === " ")) {
          inputRef.current?.click();
        }
      }}
      aria-disabled={disabled}
    >
      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        accept="application/pdf,.pdf"
        disabled={disabled}
        data-testid="upload-input"
        onChange={(event) => handleFiles(event.target.files)}
      />
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-lg font-semibold text-ink">Drop a PDF here</p>
          <p className="mt-2 max-w-xl text-sm leading-6 text-ink/65">
            Or choose a file from your device. Current prototype limit: 25 MB.
          </p>
        </div>
        <span className="inline-flex w-fit items-center justify-center rounded-md bg-ink px-4 py-2 text-sm font-semibold text-paper">
          Choose PDF
        </span>
      </div>
    </div>
  );
}
