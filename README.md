# Provenance Pursuit – results

Results of GLAMhack 2026, challenge 304 «Provenance Pursuit»: where provenance labels, stamps and marks sit on the
backs of works in the collection of the Stiftung für Kunst, Kultur und Geschichte (SKKG), Winterthur, and which
works carry the same label. *Have I seen this label before?*

- **Results site: https://ruedtim.github.io/glamhack26-box-viewer/** – the labels as pictures, the works with
  their boxes, and the labels found again on other works with the evidence from the records (shared exhibitions,
  the same seller, the provenance). Each work also shows its back «exploded»: the labels lift off, and a
  provenance timeline from SKKG's records lights up the labels that document each event (persons by role only).
- **Workbook: [provenance_pursuit_results.xlsx](https://ruedtim.github.io/glamhack26-box-viewer/provenance_pursuit_results.xlsx)**
  – all results in one Excel file; its first sheet explains the others.
- **Review page: [review.html](https://ruedtim.github.io/glamhack26-box-viewer/review.html)** – check the boxes the
  vision-language model proposed (correct, wrong, unsure) and download your decisions for the team.
- **Label search: [label-search/](https://ruedtim.github.io/glamhack26-box-viewer/label-search/)** – photograph or upload
  a label; the image model runs in the browser and shows the 20 most similar backs. Nothing is uploaded.
- **Entry form: `form.html?label=<key>`** – opens from every box: what the data say about the label, and fields for the
  team to add or correct the details for SKKG's label register (confirm or redraw the box, copy the row, CSV).
- **What SIK-ISEA adds: [sik_isea.html](https://ruedtim.github.io/glamhack26-box-viewer/sik_isea.html)** – links to
  SIK-ISEA's records and counts only.
- **How we got here: [how-we-got-here.html](https://ruedtim.github.io/glamhack26-box-viewer/how-we-got-here.html)** –
  the steps from the challenge's raw material to these results, with the numbers, the decisions and the dead ends.
- **Label box viewer: `viewer.html`** – any image straight from a IIIF server with one or more boxes drawn on it.
- **Feedback** – the «Feedback» button and the «Report a problem» links open a small form; no GitHub account is
  needed. Page, work, label key and box are filled in. The message becomes a public issue in this repository within
  about 10 to 20 minutes (`feedback-relay/`, `.github/workflows/feedback.yml`), so don't write names or addresses
  of private owners. With an account you can also open the prefilled issue on GitHub directly.
- **Entry form «Ways of seeing»** – filters for the label picture (local contrast, flat field, colour channels,
  decorrelation stretch and more), computed in the browser, to read faint pencil, blue crayon and stamps.

All images are loaded live from the SKKG IIIF server (`iiif.digital.skkg.ch`); nothing is copied. Boxes are in
pixels of the original images (x, y, width, height), exactly as in a IIIF region request.

## How the labels were found

Photos of the backs were cut into windows and indexed with DINOv2; photos of labels and the pictures of SKKG's
label register were placed on the backs with SuperPoint + LightGlue + MAGSAC (the same method as for locating aerial
photographs). The marks described in SKKG's provenance data sheets were found by reading the text on the backs
(OCR), by template matching with known labels, and – marked as unverified – by a local vision-language model
(Qwen3-VL). Every reliably located label was then searched on all other backs. Finally, a label detector (OWLv2,
an open-vocabulary object detector, run locally) searched all backs for anything that looks like a label or stamp;
the finds that no record documents are shown as «detected labels», with the text OCR read on them. They are leads
to check: the issuer is only guessed from that text, and finds without text are often not labels at all.

## Label box viewer

Address: `https://ruedtim.github.io/glamhack26-box-viewer/viewer.html?iiif=<IIIF image service>&xywh=x,y,w,h`

| Parameter | Meaning |
|---|---|
| `iiif` | IIIF Image API service URL (its `info.json` or any image request URL of it works too) |
| `xywh` | box `x,y,w,h` in pixels of the original image, as in the IIIF region parameter; repeat it, or separate several with `;` |
| `area` | approximate area `x,y,w,h`, always drawn dashed |
| `title`, `note` | heading and line below it |
| `page` | link to the object's collection page |
| `colour` | box colour, hex without `#` (default `ff3b30`) |
| `style=dashed` | draw the `xywh` boxes dashed (approximate position) |
| `zoom=1` | open zoomed to the box |
| `static=1` | one plain rendering instead of deep zoom |

Example: [back of SKKG Inv. 595 with the label of a framing workshop](https://ruedtim.github.io/glamhack26-box-viewer/viewer.html?iiif=https%3A%2F%2Fiiif.digital.skkg.ch%2Fiiif%2F3%2F8a47091d-5bc2-454f-b7f6-fae505b316dc&xywh=1643%2C1625%2C1677%2C1724&title=Inv.+595+%C2%B7+label+photo+located+on+the+back&page=https%3A%2F%2Fdigital.skkg.ch%2Fobject%2F106)

The viewer loads OpenSeadragon 4.1.0 from cdnjs and reads the image tiles directly from the IIIF server.

## Data and licences

Data and images: SKKG Stiftung für Kunst, Kultur und Geschichte, Winterthur ([SKKG Sammlung digital](https://digital.skkg.ch),
knowledge graph and IIIF image server). Object metadata and photographs of backs CC0; provenance data sheets
CC BY 4.0, SKKG provenance research team; label register and object list provided for the challenge. Exhibitions
and acquisitions were read from the knowledge graph following [skkg-mcp](https://github.com/kintopp/skkg-mcp)
(RISE, University of Basel). Names and addresses of private owners transcribed from labels are masked; SIK-ISEA's
research portal is only linked and counted, as its content may not be republished without SIK-ISEA's consent.
