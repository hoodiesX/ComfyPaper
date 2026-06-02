import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PdfDropzone } from "@/components/PdfDropzone";
import { PresetSelector } from "@/components/PresetSelector";
import { PdfPreview } from "@/components/PdfPreview";

describe("demo capture selectors", () => {
  it("exposes stable upload and Academic/iPad preset selectors", () => {
    const uploadHtml = renderToStaticMarkup(<PdfDropzone onFileSelected={() => undefined} />);
    const presetHtml = renderToStaticMarkup(
      <PresetSelector selectedPresetId="academic-paper" onSelectPreset={() => undefined} />
    );

    expect(uploadHtml).toContain('data-testid="upload-input"');
    expect(presetHtml).toContain('data-testid="preset-academic-paper"');
    expect(presetHtml).toContain('data-testid="preset-ipad-tablet"');
  });

  it("exposes exact metadata for the selected ASP Academic Paper tile", () => {
    const html = renderToStaticMarkup(
      <PdfPreview
        previewKind="optimized"
        presetId="academic-paper"
        pages={[
          {
            pageNumber: 2,
            sourcePageNumber: 1,
            column: "left",
            tileIndex: 2,
            tileCount: 2,
            dataUrl: "data:image/png;base64,iVBORw0KGgo=",
            width: 300,
            height: 400
          } as never
        ]}
      />
    );

    expect(html).toContain('data-testid="optimized-preview-page-1-left-tile-2"');
    expect(html).toContain('data-demo-target="asp-ipad-page-1-left-tile-2"');
    expect(html).toContain('data-source-page="1"');
    expect(html).toContain('data-column="left"');
    expect(html).toContain('data-tile-index="2"');
    expect(html).toContain('data-tile-count="2"');
    expect(html).toContain('data-preset="academic-paper"');
  });

  it("exposes original page metadata for source page 1", () => {
    const html = renderToStaticMarkup(
      <PdfPreview
        previewKind="original"
        pages={[
          {
            pageNumber: 1,
            sourcePageNumber: 1,
            dataUrl: "data:image/png;base64,iVBORw0KGgo=",
            width: 300,
            height: 400
          } as never
        ]}
      />
    );

    expect(html).toContain('data-testid="original-preview-page-1"');
    expect(html).toContain('data-preview-kind="original"');
    expect(html).toContain('data-source-page="1"');
  });
});
