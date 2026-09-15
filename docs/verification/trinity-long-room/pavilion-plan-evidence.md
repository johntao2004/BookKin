# Pavilion plan evidence — 2026-09-09

The reconstruction remains incomplete. This evidence pass found a publicly playable architectural presentation with a labelled floor-plan slide. It does not provide a measured current survey.

## Provenance and inspected frames

- Host article: https://www.trinitywomengraduates.ie/latest-news/transforming-the-long-room
- Article metadata inspected directly: published 2021-12-08, modified the same day.
- Article identifies participants Roisin Heneghan, Katarzyna Turza-Rachwal and Helen Shenton.
- Public embedded player: https://player.vimeo.com/video/654600999?h=ac5c86f801&app_id=122963
- Player title: *Transforming the Long Room*, owner Trinity Women Graduates, duration 59:58.
- Inspected through the actual browser player, using its seek controls; the video was left paused. No media download or access-control bypass was used.

| Inspected timestamp | Visible slide | What this proves / does not prove |
| --- | --- | --- |
| 20:11 | `COLLEGE LIBRARY, 1712–32`; separate Gallery Level, Long Room Level and Ground Floor plans | A multi-level pavilion arrangement is shown. At the drawing's left end on the Long Room level, a stair occupies one side and a separate room numbered 9 occupies the other. Main room is 7; opposite end room is 8. The slide lacks a readable scale, compass and plan-date legend. The construction-date caption does not establish that every depicted feature existed in 1732. |
| 21:30 | `COLLEGE LIBRARY, 1753`, exterior historical image | Useful for historical massing; it must not replace the later barrel-vault state requested for the model. |
| 22:49 | `FAGEL COLLECTION, 1802`, engraved interior | Separate fitted book room with a flat ceiling and classical timber lining; this is not a picture of the west stair enclosure. |
| 29:59 | `TODAY'S BRIEF TO THE ARCHITECTS`, text slide | Establishes the presentation transitions to a redevelopment brief; later project images must not be treated automatically as existing conditions. |

## Independent location check

Trinity's own collection-history page states that the Fagel collection was placed in a separate room at the **east end** of the Long Room:
https://onprem.tcd.ie/library/exhibitions/choicebooks/collections.php

Therefore do not use the Fagel interior image to furnish the unverified west-side room 9. The room number's identity has not been established from the inspected plan slide.

## Comparison with current code

- `WEST_CONNECTION.offsetX` is already `-2.08`. The current stair enclosure is **not centred on the hall axis**, even though its doorway joins the axial passage. An initial verbal impression of a centred stair room was corrected after inspecting the code.
- Current code models one stair enclosure but no complete adjacent west pavilion room. The plan slide is useful evidence for this missing volume.
- The current high-window location above the lower doorway remains an explicit hypothesis. The plan screenshot does not yet prove it.
- Neither north/south assignment nor a new numerical lateral offset can be justified from the inspected video frame alone.
- The later user-requested enlarged hall and reduced cabinets remain active adaptations. This evidence does not silently restore the original envelope or establish an exact 1:1 replica.

## Next reconstruction decisions supported by this evidence

1. Model the west pavilion as a stair enclosure plus an adjacent room once doorway adjacency and orientation have been checked against a legible plan/source legend.
2. Keep Fagel room evidence associated with the east end.
3. Obtain a readable source/version for the 20:11 plan before extracting distances or moving the live stair/window.
4. Compare any 2020 redevelopment drawings as **existing** versus **proposed** before using geometry. The 2024 application 3701/24 found during search concerns extension of temporary globe-exhibition use and is not a source survey for this task.

No live model geometry was changed in this evidence pass, and no build or test result is claimed for it.


## Archival follow-up: source identity and limitations

The 2024 doctoral research by Nele Lüttmann supplies a more precise archival lead:
https://www.tara.tcd.ie/items/2342207d-e4d5-4073-9921-0e7169dbd129

Volume I, printed p.35 / PDF p.43, identifies Fig.5.75 as the developed stair interior, TCD MUN/MC/26. Printed p.262 / PDF p.270 associates it with finishing estimate MUN/P/2/28 and discusses uncertain authorship. This is a design document; it does not independently prove present dimensions or every executed feature. Its full image in Volume II has not been inspected.

The Irish Architectural Archive's Dictionary of Irish Architects corroborates the references and lists a photograph at IAA 86/6.2/1:
https://dia.ie/works/view/52708/building/CO.%2BDUBLIN%2C%2BDUBLIN%2C%2BCOLLEGE%2BGREEN%2C%2BTRINITY%2BCOLLEGE%2C%2BLIBRARY%2B%28OLD%29

Reinspection of the already available *Enriching Architecture*, printed p.326 / PDF p.361, confirms that the illustrated proposed concave handrail ramp and terminal volute were not executed. Its existing-versus-proposed distinction remains authoritative for the stair. Do not overwrite the existing outward sweep with either proposal merely because a historical drawing survives.

The new thesis could potentially expose the complete developed wall arrangement, rather than the single elevation reproduced in *Enriching Architecture*. Access this image before deciding whether it resolves window/door positions. Direct downloads returned challenge HTML; browser opening of Volume II returned `ERR_BLOCKED_BY_CLIENT`. Failed HTML files were removed. No valid thesis PDF or unseen image is represented as downloaded or reviewed.

The presentation's room 9 remains unidentified. Historical reading-room names changed between periods; none of the newly checked records ties that number to a particular present room. The search therefore strengthens provenance and prevents a wrong geometry substitution, but does not yet justify placing or furnishing the missing room.

## West-room evidence follow-up: identity is still not a plan assignment

Two additional sources were inspected in this continuation:

- Melanie Hayes, *Anglo-Irish Architectural Exchange*, Volume I (2015), printed p.145 / PDF p.153: https://www.tara.tcd.ie/bitstreams/be6da7f9-b862-46a0-9fe5-93e8dda7ce5b/download . The stair starts near the entrance and arrives immediately by the Long Room doorway. The suggestion of a reversed intended orientation is historical interpretation, not authorization to reverse the current built stair. This source provides no metric room-9 plan.
- Patrick Comerford's firsthand 19 October 2012 account and photographs: https://www.patrickcomerford.com/2012/10/memories-of-old-bishop-and-old-book-in.html . It identifies the Henry Jones Room, two memorial plaques, a windowsill bust, and views toward campus landmarks. Browser inspection of photo DSCN9262 confirms a square memorial panel in a broad mitred timber frame on a pale wall. This is local wall-detail evidence, not a room panorama.

The second source's prose compass directions have not been independently reconciled with a campus plan. Do not use them as survey bearings. Its room name also does not identify the numbered room on the 2021 slide: floor, door adjacency and plan-version correspondence still need verification. No adjacent-room geometry was invented or added from these observations. The next useful reference must show the room doorway relative to the stair landing, or give the numbered plan legend. Generic committee agendas and seating-capacity listings do not satisfy that need.

The college disability building page was retried twice through web retrieval and timed out; no dimensions are claimed from that failed access. A third-party transcription of a meeting-room accessibility table was inspected but excluded from geometry authority because it supplies no plan or door placement.

## Official existing-condition plans found — supersedes room-identity uncertainty

The live Dublin City Council portal returned application **2949/20**, registered 30 June 2020, final grant 6 October 2020:
https://planning.agileapplications.ie/dublincity/application-details/139567

Its Documents link resolves to a public 122-document catalogue:
https://webapps.dublincity.ie/PublicAccess_Live/SearchResult/RunThirdPartySearch?FileSystemId=PL&Folder1_Ref=2949/20

Four catalogue entries labelled Floor Plans / Existing Condition were downloaded as valid PDF files. File sizes, SHA-256 hashes, source GUIDs and view URLs are recorded in `dcc-existing-plan-manifest.json`. Three sheets have been visually rendered and inspected: Y1.001 (basement and basement mezzanine), Y1.002 (ground and first floor), Y1.003 (second and third floor). The fourth PDF is downloaded but not yet visually reviewed. These are scans of submitted existing-condition drawings, not newly measured survey data.

**Y1.002 resolves the current-state west-room identification:** the first-floor plan explicitly labels HENRY JONES ROOM, 49 m², south of the west axial landing. The grand stair and its central void lie to the north, with a separate service stair/lift strip farther north. The circulation label is CIRC. 29 m² and connects east into the Long Room. The room's north-edge doorway connects to this landing. The compass points upward on the sheet. At the east end, FAGEL, 55 m², occupies the south side; stairs/lift occupy the north side. This independent plan evidence replaces the previous name-only hypothesis for the 2019/2020 existing state, but does not retroactively date every feature on the 2021 historical slide.

The Long Room is labelled 784 m², and circulation at both ends has a +4580 relative level annotation. A 63880 dimension chain runs between pavilion boundary lines; 9500 chains mark pavilion axial depth. These are not interchangeable with net internal published room dimensions. Do not scale scanned pixels or replace the user-enlarged runtime envelope from these numbers without checking the dimension endpoints and sections.

The application description separates existing fabric from proposed removal/replacement: central stair removal, altered service stairs/lifts, upgraded pavilion doors and additional basement links are proposals. They must not be silently imported into the existing-condition reconstruction.

No runtime geometry was modified in this pass. Next: inspect the existing sections and enlarged pavilion detail, establish door/partition dimensions, then map the now-known west room/landing arrangement into the adapted hall. Tests/build were not rerun because only evidence documentation changed.

Runtime follow-up: the Henry Jones south-side shell is now connected to the adapted west landing with a supported doorway and guided forward/back route. Net working rectangle is 48.906 m²; height and joinery remain estimates. Main browser traversal and return passed with clear collision. Full source pavilion dimensions, furnishings and east-side reconstruction remain outstanding. See public-reference-data.json henryJonesRuntime.
