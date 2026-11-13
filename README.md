# Label box viewer

One static page that shows a whole image straight from a IIIF image server (deep zoom, nothing is copied) with
one or more boxes drawn on it. Made at GLAMhack 2026 for challenge 304 «Provenance Pursuit» (SKKG): the team's
workbook links every located provenance label, stamp or inscription to this page, so you see where on the back of
the artwork the box lies.

**Address:** `https://ruedtim.github.io/glamhack26-box-viewer/viewer.html?iiif=<IIIF image service>&xywh=x,y,w,h`

## Parameters

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

## Example

[Back of SKKG Inv. 595 with the label of a framing workshop](https://ruedtim.github.io/glamhack26-box-viewer/viewer.html?iiif=https%3A%2F%2Fiiif.digital.skkg.ch%2Fiiif%2F3%2F8a47091d-5bc2-454f-b7f6-fae505b316dc&xywh=1643%2C1625%2C1677%2C1724&title=Inv.+595+%C2%B7+label+photo+located+on+the+back&page=https%3A%2F%2Fdigital.skkg.ch%2Fobject%2F106)

The images come from the SKKG IIIF server (`iiif.digital.skkg.ch`; back images CC0). The page loads
OpenSeadragon 4.1.0 from cdnjs and reads the image tiles directly from the IIIF server.
